import 'pixi.js/unsafe-eval';
import { Application, Container, Sprite, Text } from 'pixi.js';
import { loadTextures, TEX } from './art/textures';
import { Audio } from './audio';
import { initTweens, wait, clock, tween, every, Skipper, motion } from './tween';
import { loadSave, writeSave, loadStatus, type SaveData } from './save';
import { newStats, recordResult } from './stats';
import { Background } from './scene/background';
import { Reels } from './scene/reels';
import { L, setLayout, preferredOrientation, portraitHeight, type Orientation } from './layout';
import { Mascot } from './scene/mascot';
import { Effects } from './scene/effects';
import { Overlays } from './scene/overlays';
import { ToriiPath } from './scene/toriiPath';
import { fmt, fmtExact, money, denomLabel, textStyle, CELL_W, CELL_H } from './scene/symbols';
import { buildHud, type Hud } from './ui/hud';
import { StatsBook } from './ui/statsBook';
import { Paytable } from './ui/paytable';
import { h } from './ui/dom';
import * as platform from './platform';
import { GamepadInput, PAD } from './gamepad';
import {
  BET_CREDITS, DENOMINATIONS, ADD_CREDIT_MAX, STARTING_CREDITS, WIN_TIERS, SYM, SYMBOL_NAMES, REELS, ROWS,
  OMIKUJI_SLIPS, FREE_SPINS, type SlipKey,
} from '../config/math';
import {
  playSpin, playBonusBuy, bonusBuyCost, STRIPS, FS_STRIPS,
  type SpinResult, type ForceOptions, type CascadeResult, type FeatureKind, type FreeSpinsResult, type ToriiResult, type OmikujiResult,
} from '../engine/game';
import { makeGameRng } from '../engine/rng';

/** Money is kept to a millionth of a dollar (pays can be fractions of a cent); it is rounded only for display. */
const r2 = (x: number) => Math.round(x * 1e6) / 1e6;
const AUTO_OPTIONS: (number | 'feature')[] = [10, 25, 50, 100, 'feature'];
/** Auto-spin stop limits, in x bet (0 = off). */
const AUTO_STOP_WIN = [0, 10, 25, 50, 100];
const AUTO_STOP_LOSS = [0, 25, 50, 100, 250];

class Game {
  app!: Application;
  save!: SaveData;
  audio = new Audio();
  audioStarted = false;
  rng = makeGameRng();
  hud!: Hud;
  bg!: Background;
  reels!: Reels;
  reelLayer = new Container();
  frame!: Sprite;
  mascot!: Mascot;
  fx!: Effects;
  overlays!: Overlays;
  torii!: ToriiPath;
  omikujiBox!: Sprite;
  lanternLayer = new Container();
  lanternSprites: Sprite[] = [];
  lanternText!: Text;
  book!: StatsBook;
  paytable!: Paytable;
  pad!: GamepadInput;
  debugAllowed = platform.debugAllowed;

  busy = false;
  inFeature = false;
  autoLeft = 0;
  autoUntilFeature = false;
  /** balance when auto-spin started (for the loss limit) */
  autoStartBalance = 0;
  force: ForceOptions | null = null;
  forceBuy: FeatureKind | null = null;
  /** Part of the current result already credited to the saved balance but not yet revealed. */
  pendingWin = 0;
  /** Win shown in the WIN box for the current spin. */
  shownWin = 0;
  /** Player asked to speed up the rest of the current presentation. */
  fast = false;
  skipper: Skipper | null = null;
  /** Resolves the current "press SPIN / A / tap" prompt. */
  waiter: (() => void) | null = null;
  pendingLayout: Orientation | null = null;
  confirmAction: (() => void) | null = null;
  padCursor: HTMLElement | null = null;
  lastResult: SpinResult | null = null;

  get bet() { return r2(BET_CREDITS[this.save.betIndex] * DENOMINATIONS[this.save.settings.denomIndex]); }
  get turbo() { return this.save.settings.turbo; }
  get quick() { return this.turbo || this.fast; }
  get reducedMotion() {
    const m = this.save.settings.reducedMotion;
    return m === 'on' || (m === 'auto' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }
  /** Balance as the player should see it right now (real balance minus wins still being presented). */
  displayBalance() { return r2(this.save.balance - this.pendingWin); }

  // ======================= boot & layout =======================
  async boot() {
    setLayout(preferredOrientation(window.innerWidth, window.innerHeight), window.innerWidth, window.innerHeight);
    this.applyStageSize();
    this.fit();
    window.addEventListener('resize', () => this.fit());
    this.save = await loadSave();
    Object.assign(this.audio.settings, { master: this.save.settings.master, music: this.save.settings.music, sfx: this.save.settings.sfx, muted: this.save.settings.muted });
    this.audio.apply();

    this.app = new Application();
    await this.app.init({ width: L.w, height: L.h, background: '#1F2A44', antialias: true, autoDensity: true, resolution: this.renderRes() });
    document.getElementById('pixi')!.appendChild(this.app.canvas);
    initTweens(this.app.ticker);
    const fill = document.getElementById('loadFill')!;
    await loadTextures((p) => (fill.style.width = `${Math.round(p * 100)}%`));

    this.buildScene();
    const ui = document.getElementById('ui')!;
    this.hud = buildHud(ui);
    this.book = new StatsBook((m) => this.save[m], () => this.askResetStats(), () => this.audio.click());
    this.paytable = new Paytable(() => this.bet, () => this.audio.click());
    ui.append(this.book.modal.bg, this.paytable.modal.bg);
    this.wireUi();
    this.buildDebug();
    this.overlays.onDim = (on) => ui.classList.toggle('dimmed', on);
    this.applyMotion();
    // the base track is set now; it is heard once the first tap or key press unlocks audio (features switch tracks the same way)
    this.audio.playMusic('base');
    // 'Follow system' reacts when the system setting changes while the game is open
    window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => this.applyMotion());
    this.refreshAll();

    this.app.ticker.add((t) => this.tick(t.deltaMS));
    this.pad = new GamepadInput((b) => this.onPad(b), () => this.toast('Controller connected. A: spin · B: back · X: auto · Y: bonus buy · D-pad: bet · LB/RB: denomination · LT: credits/$ · RT: turbo · Start: rules · View: stats', 6500));
    this.app.ticker.add(() => this.pad.poll(performance.now()));
    platform.onBackButton(() => this.onBack());
    platform.onPauseResume(
      () => { writeSave(this.save, true); if (platform.isNative) this.audio.ctx.suspend(); },
      () => { if (platform.isNative && this.audioStarted) this.audio.resume(); },
    );
    if (!platform.canToggleFullscreen()) this.hud.btnFull.style.display = 'none';
    if (!platform.isNative && !platform.isElectron) this.hud.btnQuit.style.display = 'none';
    document.body.dataset.platform = platform.platformName;
    setInterval(() => this.secondTick(), 1000);
    window.addEventListener('beforeunload', () => writeSave(this.save, true));

    const loading = document.getElementById('loading')!;
    loading.style.opacity = '0';
    setTimeout(() => loading.remove(), 700);
    if (loadStatus === 'recovered') setTimeout(() => this.toast('Your save file was damaged, so it was restored from the most recent backup.', 7000), 900);
    if (loadStatus === 'reset') setTimeout(() => this.toast('Your save file could not be read and no backup was usable. A copy was kept, and a new game has started.', 9000), 900);
    const startAudio = () => {
      this.audio.resume();
      this.audioStarted = true;
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
    window.addEventListener('pointerdown', startAudio);
    window.addEventListener('keydown', startAudio);
  }

  renderRes() {
    const s = Math.min(window.innerWidth / L.w, window.innerHeight / L.h);
    return Math.max(0.5, Math.min(2, s * (window.devicePixelRatio || 1)));
  }
  fit() {
    const stage = document.getElementById('stage')!;
    const W = window.innerWidth, H = window.innerHeight;
    const want = preferredOrientation(W, H);
    const wantH = want === 'portrait' ? portraitHeight(W, H) : 1080;
    if ((want !== L.orientation || wantH !== L.h) && this.app?.renderer && this.reels) {
      // a rotation during a spin or feature is applied once it finishes
      if (this.busy) this.pendingLayout = want;
      else this.applyLayout(want);
    }
    const s = Math.min(W / L.w, H / L.h);
    stage.style.transform = `translate(${(W - L.w * s) / 2}px, ${(H - L.h * s) / 2}px) scale(${s})`;
    if (this.app?.renderer) this.app.renderer.resize(L.w, L.h, this.renderRes());
  }
  applyStageSize() {
    const stage = document.getElementById('stage')!;
    stage.style.width = L.w + 'px';
    stage.style.height = L.h + 'px';
    stage.classList.toggle('portrait', L.orientation === 'portrait');
    stage.style.setProperty('--reel-top', L.reelY + 'px');
    stage.style.setProperty('--reel-bottom', L.reelY + CELL_H * 3 + 'px');
  }
  relayoutScene() {
    this.bg.relayout();
    this.reels.relayout();
    this.frame.position.set(L.reelX - 36, L.reelY - 36);
    this.mascot.position.set(L.mascot.x, L.mascot.y);
    this.mascot.scale.set(L.mascot.s);
    this.overlays.relayout();
    this.omikujiBox.position.set(L.omikuji.x, L.omikuji.y);
    this.omikujiBox.scale.set(L.omikuji.s * 0.67);
    this.layoutLanterns();
  }
  applyLayout(o: Orientation) {
    setLayout(o, window.innerWidth, window.innerHeight);
    this.applyStageSize();
    this.relayoutScene();
    const s = Math.min(window.innerWidth / L.w, window.innerHeight / L.h);
    document.getElementById('stage')!.style.transform = `translate(${(window.innerWidth - L.w * s) / 2}px, ${(window.innerHeight - L.h * s) / 2}px) scale(${s})`;
    this.app.renderer.resize(L.w, L.h, this.renderRes());
  }

  buildScene() {
    const st = this.app.stage;
    this.bg = new Background();
    this.reels = new Reels();
    this.reels.setPool(STRIPS);
    this.reels.setBoard(Array.from({ length: REELS }, (_, r) => [0, 1, 2].map((i) => STRIPS[r][(i * 7 + r * 3) % STRIPS[r].length])));
    this.frame = new Sprite(TEX.frame);
    this.reelLayer.addChild(this.frame, this.reels);
    this.mascot = new Mascot();
    this.mascot.eventMode = 'static';
    this.mascot.cursor = 'pointer';
    this.mascot.on('pointerdown', () => { this.mascot.poke(); this.mascot.wave(1200); this.audio.suzu(); });
    this.fx = new Effects();
    this.overlays = new Overlays(this.fx);
    this.torii = new ToriiPath(this.fx);
    this.omikujiBox = new Sprite(TEX.omikujiBox);
    this.omikujiBox.anchor.set(0.5, 1);
    this.omikujiBox.visible = false;
    this.omikujiBox.eventMode = 'static';
    this.omikujiBox.cursor = 'pointer';
    this.omikujiBox.on('pointerdown', () => this.waiter?.());
    this.buildLanterns();
    st.addChild(this.bg, this.reelLayer, this.mascot, this.lanternLayer, this.torii, this.omikujiBox, this.overlays, this.fx);
    this.relayoutScene();
  }
  buildLanterns() {
    for (let i = 0; i < FREE_SPINS.lanternsPerStep; i++) {
      const s = new Sprite(TEX.lanternOff);
      s.anchor.set(0.5, 0);
      s.scale.set(0.62);
      this.lanternSprites.push(s);
      this.lanternLayer.addChild(s);
    }
    this.lanternText = new Text({ text: '', style: textStyle(26, '#F5EEDC', 5) });
    this.lanternText.anchor.set(0.5, 0);
    this.lanternLayer.addChild(this.lanternText);
    this.lanternLayer.visible = false;
  }
  layoutLanterns() {
    const { x, y, dx } = L.lanterns;
    this.lanternSprites.forEach((s, i) => s.position.set(x + i * dx, y));
    this.lanternText.position.set(x + dx, y + 130);
  }
  setLanterns(total: number) {
    const lit = total % FREE_SPINS.lanternsPerStep;
    this.lanternSprites.forEach((s, i) => { s.texture = i < lit ? TEX.lanternLit : TEX.lanternOff; });
    this.lanternText.text = `Lanterns lit: ${total}`;
  }
  applyMotion() {
    const rm = !!this.reducedMotion;
    motion.reduced = rm;
    this.bg.reducedMotion = rm;
    this.fx.reducedMotion = rm;
    this.mascot.calm = rm;
    document.body.classList.toggle('reduced-motion', rm);
  }

  tick(dt: number) {
    this.bg.update(dt);
    this.reels.update(dt * clock.speed);
    this.mascot.update(dt);
    this.fx.tick(dt * clock.speed);
  }
  secondTick() {
    if (document.visibilityState === 'visible') {
      this.save.session.timeMs += 1000;
      this.save.allTime.timeMs += 1000;
    }
    writeSave(this.save);
  }

  // ======================= UI wiring =======================
  wireUi() {
    const u = this.hud;
    const click = (el: HTMLElement, fn: () => void) => el.addEventListener('click', () => { this.audio.resume(); this.audio.click(); fn(); });
    u.spinBtn.addEventListener('click', () => { this.audio.resume(); this.onSpinButton(); });
    click(u.betMinus, () => this.changeBet(-1));
    click(u.betPlus, () => this.changeBet(1));
    click(u.turboBtn, () => this.toggleTurbo());
    click(u.autoBtn, () => this.onAutoButton());
    click(u.btnDenom, () => this.toggleMenu(u.denomMenu, u.btnDenom));
    click(u.btnMoney, () => this.toggleMoney());
    click(u.btnBuy, () => this.openBuy());
    click(u.btnInfo, () => this.paytable.open());
    click(u.btnStats, () => this.book.open());
    click(u.btnSettings, () => this.openSettings());
    click(u.btnMute, () => this.toggleMute());
    click(u.btnFull, () => platform.toggleFullscreen());
    click(u.btnFunds, () => this.openCredits());
    click(u.buyTorii, () => { u.buy.close(); void this.buyBonus('torii'); });
    click(u.buyFs, () => { u.buy.close(); void this.buyBonus('freespins'); });
    u.creditBtns.forEach((b, i) => click(b, () => { this.addCredits([100, 500, 1000][i], false); u.credits.close(); }));
    u.creditInput.addEventListener('input', () => this.updateCreditHint());
    u.creditInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addCustomCredits(); e.stopPropagation(); });
    click(u.creditAddBtn, () => this.addCustomCredits());
    for (const k of ['master', 'music', 'sfx'] as const) {
      u.vol[k].addEventListener('input', () => { this.save.settings[k] = Number(u.vol[k].value); this.audio.settings[k] = this.save.settings[k]; this.audio.apply(); writeSave(this.save); });
    }
    u.muteBox.addEventListener('change', () => { if (u.muteBox.checked !== this.save.settings.muted) this.toggleMute(); });
    u.motionSel.addEventListener('change', () => { this.save.settings.reducedMotion = u.motionSel.value as any; this.applyMotion(); writeSave(this.save); });
    click(u.btnNewSession, () => this.confirm('Start a new session? Session stats are cleared; all-time stats and your balance stay.', () => this.newSession()));
    click(u.btnResetStats, () => this.askResetStats());
    click(u.btnQuit, () => this.confirm('Quit Sakura Fortune? Your game is saved.', () => { writeSave(this.save, true); platform.quitApp(); }));
    click(u.confirmYes, () => { const a = this.confirmAction; this.confirmAction = null; u.confirm.close(); a?.(); });
    click(u.confirmNo, () => { this.confirmAction = null; u.confirm.close(); });
    // auto + denom menus
    // stop limits (remembered), below the spin-count options
    const limit = (label: string, key: 'autoStopWin' | 'autoStopLoss', opts: number[], name: (x: number) => string) => {
      const sel = h('select', { class: 'auto-limit', 'aria-label': label }, ...opts.map((x) => h('option', { value: String(x) }, x ? name(x) : 'Off'))) as HTMLSelectElement;
      sel.value = String(this.save.settings[key]);
      sel.addEventListener('change', () => { this.save.settings[key] = Number(sel.value); writeSave(this.save); });
      return h('label', { class: 'auto-limit-row' }, label, sel);
    };
    const limits = h('div', { class: 'auto-limits' },
      limit('Stop on a win of', 'autoStopWin', AUTO_STOP_WIN, (x) => `${x}× bet`),
      limit('Stop if balance drops by', 'autoStopLoss', AUTO_STOP_LOSS, (x) => `${x}× bet`));
    for (const opt of AUTO_OPTIONS) {
      const b = h('button', { class: 'btn' }, opt === 'feature' ? 'Until feature' : `${opt} spins`) as HTMLButtonElement;
      click(b, () => { this.hideMenus(); this.startAuto(opt); });
      u.autoMenu.append(b);
    }
    u.autoMenu.append(limits);
    DENOMINATIONS.forEach((d, i) => {
      const b = h('button', { class: 'btn' }, denomLabel(d)) as HTMLButtonElement;
      click(b, () => { this.hideMenus(); this.setDenom(i); });
      u.denomMenu.append(b);
    });
    window.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.popmenu') && t !== u.autoBtn && t !== u.btnDenom) this.hideMenus();
    });
    // tapping the stage answers any prompt (banners, Torii Path rolls, Omikuji) and skips a big-win count-up
    this.app.canvas.addEventListener('pointerdown', () => {
      if (this.waiter) this.waiter();
      else if (this.skipper && !this.skipper.skipped) this.skipper.skip();
    });
    u.slip.addEventListener('pointerdown', () => this.waiter?.());
    // keyboard
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (!this.anyModalOpen()) this.onSpinButton(); }
      else if (e.key === 'Escape') { if (!this.closeTopModal()) this.hideMenus(); }
      else if ((e.key === 'd' || e.key === 'D') && e.ctrlKey) { e.preventDefault(); this.toggleDebug(); }
      else if (e.key === 'F11' && !platform.isElectron) { e.preventDefault(); platform.toggleFullscreen(); }
    });
  }

  modals() { return [this.hud.confirm, this.hud.credits, this.hud.settings, this.hud.buy, this.paytable.modal, this.book.modal]; }
  anyModalOpen() { return this.modals().some((m) => m.isOpen()); }
  closeTopModal(): boolean {
    for (const m of this.modals()) if (m.isOpen()) { m.close(); this.setPadCursor(null); return true; }
    if (this.hud.debug.style.display === 'block') { this.toggleDebug(); return true; }
    return false;
  }
  toggleMenu(menu: HTMLElement, anchor: HTMLElement) {
    const open = menu.classList.contains('open');
    this.hideMenus();
    if (open) return;
    const st = document.getElementById('stage')!.getBoundingClientRect();
    const r = anchor.getBoundingClientRect();
    const s = st.width / L.w;
    menu.style.left = `${(r.left - st.left) / s}px`;
    menu.style.bottom = `${L.h - (r.top - st.top) / s + 10}px`;
    menu.classList.add('open');
    this.setPadCursor(menu.querySelector('button'));
  }
  hideMenus() { this.hud.autoMenu.classList.remove('open'); this.hud.denomMenu.classList.remove('open'); }
  toast(msg: string, ms = 2600) {
    const t = this.hud.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout((t as any)._h);
    (t as any)._h = setTimeout(() => t.classList.remove('show'), ms);
  }
  confirm(text: string, action: () => void) {
    this.hud.confirmText.textContent = text;
    this.confirmAction = action;
    this.hud.confirm.open();
    this.setPadCursor(this.hud.confirmYes);
  }
  setMessage(text: string) { this.hud.message.textContent = text; }

  // ---------------- controller ----------------
  setPadCursor(el: HTMLElement | null) {
    this.padCursor?.classList.remove('pad-focus');
    this.padCursor = el;
    el?.classList.add('pad-focus');
  }
  /** Buttons the D-pad can move between (the open panel or menu). */
  padTargets(): HTMLElement[] {
    const open = this.modals().find((m) => m.isOpen());
    const scope: HTMLElement | null = open ? open.bg : this.hud.autoMenu.classList.contains('open') ? this.hud.autoMenu : this.hud.denomMenu.classList.contains('open') ? this.hud.denomMenu : this.hud.debug.style.display === 'block' ? this.hud.debug : null;
    if (!scope) return [];
    return Array.from(scope.querySelectorAll<HTMLElement>('button, input, select')).filter((e) => e.offsetParent !== null && !(e as HTMLButtonElement).disabled);
  }
  onPad(b: number) {
    this.audio.resume();
    this.audioStarted = true;
    const targets = this.padTargets();
    if (targets.length) {
      const i = Math.max(0, targets.indexOf(this.padCursor as HTMLElement));
      const cur = this.padCursor && targets.includes(this.padCursor) ? this.padCursor : null;
      // a highlighted slider is adjusted with left / right
      if (cur instanceof HTMLInputElement && cur.type === 'range' && (b === PAD.LEFT || b === PAD.RIGHT)) {
        cur.value = String(Math.max(0, Math.min(1, Number(cur.value) + (b === PAD.RIGHT ? 0.05 : -0.05))));
        cur.dispatchEvent(new Event('input'));
        return;
      }
      // Stats and Rules: LB / RB change page, LT / RT switch this session / all time
      const book = this.book.modal.isOpen() ? this.book : this.paytable.modal.isOpen() ? this.paytable : null;
      if (book && (b === PAD.LB || b === PAD.RB)) {
        const n = book.tabs.length;
        book.tab = (book.tab + (b === PAD.RB ? 1 : -1) + n) % n;
        book.render();
        this.setPadCursor(book.tabs[book.tab]);
        this.audio.click();
        return;
      }
      if (book === this.book && (b === PAD.LT || b === PAD.RT)) { this.book.modeBtn.click(); return; }
      if (b === PAD.UP || b === PAD.LEFT) this.setPadCursor(targets[(i - 1 + targets.length) % targets.length]);
      else if (b === PAD.DOWN || b === PAD.RIGHT) this.setPadCursor(targets[(i + 1) % targets.length]);
      else if (b === PAD.A) {
        const el = cur ?? targets[0];
        if (el instanceof HTMLInputElement && el.type === 'checkbox') { el.checked = !el.checked; el.dispatchEvent(new Event('change')); }
        else if (el instanceof HTMLInputElement && el.type === 'text') el.focus(); // opens the on-screen keyboard on devices
        else if (el instanceof HTMLSelectElement) { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change')); }
        else if (!(el instanceof HTMLInputElement)) el.click();
      }
      else if (b === PAD.B) { if (!this.closeTopModal()) this.hideMenus(); this.setPadCursor(null); }
      return;
    }
    switch (b) {
      case PAD.A: this.onSpinButton(); break;
      case PAD.B: this.onBack(); break;
      case PAD.X: this.onAutoButton(); break;
      case PAD.Y: this.openBuy(); break;
      case PAD.LEFT: case PAD.DOWN: this.changeBet(-1); break;
      case PAD.RIGHT: case PAD.UP: this.changeBet(1); break;
      case PAD.LB: this.setDenom(this.save.settings.denomIndex - 1); break;
      case PAD.RB: this.setDenom(this.save.settings.denomIndex + 1); break;
      case PAD.LT: this.toggleMoney(); break;
      case PAD.RT: this.toggleTurbo(); break;
      case PAD.START: this.paytable.open(); this.setPadCursor(this.paytable.tabs[0]); break;
      case PAD.VIEW: this.book.open(); this.setPadCursor(this.book.tabs[0]); break;
    }
  }
  /** Android back button / controller B. */
  onBack() {
    if (this.closeTopModal()) return;
    if (this.hud.autoMenu.classList.contains('open') || this.hud.denomMenu.classList.contains('open')) { this.hideMenus(); return; }
    if (this.autoLeft > 0) { this.stopAuto(); return; }
    if (this.busy) { this.fastForward(); return; }
    if (platform.isNative) this.confirm('Quit Sakura Fortune? Your game is saved.', () => { writeSave(this.save, true); platform.quitApp(); });
  }

  // ---------------- money & bets ----------------
  refreshAll() {
    const u = this.hud, s = this.save.settings;
    money.mode = s.moneyMode;
    money.denom = DENOMINATIONS[s.denomIndex];
    u.balance.textContent = fmt(this.displayBalance());
    u.bet.textContent = fmt(this.bet);
    u.betLabel.textContent = s.moneyMode === 'credits' ? `BET · ${BET_CREDITS[this.save.betIndex]} cr` : 'BET';
    u.win.textContent = this.shownWin > 0 ? fmt(this.shownWin) : '';
    u.btnDenom.textContent = denomLabel(DENOMINATIONS[s.denomIndex]);
    u.btnMoney.textContent = s.moneyMode === 'credits' ? 'Show in $' : 'Show Credits';
    u.turboBtn.classList.toggle('on', s.turbo);
    u.btnMute.classList.toggle('on', s.muted);
    u.btnMute.textContent = s.muted ? '✕' : '♪';
    u.autoBtn.textContent = this.autoLeft > 0 ? (this.autoUntilFeature ? 'STOP ∞' : `STOP ${this.autoLeft}`) : 'AUTO';
    u.autoBtn.classList.toggle('on', this.autoLeft > 0);
    u.buyToriiPrice.textContent = fmt(bonusBuyCost('torii', this.bet));
    u.buyFsPrice.textContent = fmt(bonusBuyCost('freespins', this.bet));
    for (const b of [u.betMinus, u.betPlus, u.btnDenom, u.btnBuy]) b.disabled = this.busy;
    u.spinBtn.classList.toggle('busy', this.busy);
    u.root.classList.toggle('busy', this.busy);
    if (this.paytable?.modal.isOpen()) this.paytable.render();
  }
  changeBet(d: number) {
    if (this.busy) return;
    const i = Math.max(0, Math.min(BET_CREDITS.length - 1, this.save.betIndex + d));
    if (i === this.save.betIndex) { this.audio.error(); return; }
    this.save.betIndex = i;
    this.refreshAll();
    writeSave(this.save);
  }
  setDenom(i: number) {
    if (this.busy) return;
    if (i < 0 || i >= DENOMINATIONS.length) { this.audio.error(); return; }
    this.save.settings.denomIndex = i;
    this.refreshAll();
    writeSave(this.save);
    this.toast(`Denomination ${denomLabel(DENOMINATIONS[i])}: bet ${fmt(this.bet)}`);
  }
  toggleMoney() {
    const s = this.save.settings;
    s.moneyMode = s.moneyMode === 'credits' ? 'dollars' : 'credits';
    s.moneyModeChosen = true;
    this.refreshAll();
    writeSave(this.save);
  }
  toggleTurbo() { this.save.settings.turbo = !this.save.settings.turbo; this.refreshAll(); writeSave(this.save); }
  toggleMute() {
    this.save.settings.muted = !this.save.settings.muted;
    this.audio.settings.muted = this.save.settings.muted;
    this.audio.apply();
    this.hud.muteBox.checked = this.save.settings.muted;
    this.refreshAll();
    writeSave(this.save);
  }
  openCredits() {
    this.hud.creditInput.value = '';
    this.updateCreditHint();
    this.hud.credits.open();
    this.setPadCursor(this.hud.creditBtns[0]);
  }
  parseCustomAmount(): number | string {
    const raw = this.hud.creditInput.value.trim().replace(/^\$/, '').replace(/,/g, '');
    if (!raw) return '';
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return 'Enter an amount like 250 or 12.50.';
    const v = Number(raw);
    if (v < 0.01) return 'The smallest amount is $0.01.';
    if (v > ADD_CREDIT_MAX) return `The most you can add at once is $${ADD_CREDIT_MAX.toLocaleString()}.`;
    return v;
  }
  updateCreditHint() {
    const v = this.parseCustomAmount();
    this.hud.creditHint.textContent = typeof v === 'number' ? `Adds $${v.toFixed(2)}` : v;
    this.hud.creditAddBtn.disabled = typeof v !== 'number';
  }
  addCustomCredits() {
    const v = this.parseCustomAmount();
    if (typeof v !== 'number') { this.audio.error(); return; }
    this.addCredits(v, false);
    this.hud.credits.close();
  }
  addCredits(n: number, debug: boolean) {
    this.save.balance = r2(this.save.balance + n);
    if (debug) { this.save.session.debugActions++; this.save.allTime.debugActions++; }
    else { this.save.session.creditsAdded = r2(this.save.session.creditsAdded + n); this.save.allTime.creditsAdded = r2(this.save.allTime.creditsAdded + n); }
    this.audio.chime(4);
    this.refreshAll();
    writeSave(this.save, true);
    this.toast(`Added $${n.toLocaleString(undefined, { minimumFractionDigits: 2 })} of play money.`);
  }
  newSession() {
    this.save.session = newStats(this.save.balance);
    this.save.sessionStart = new Date().toISOString();
    writeSave(this.save, true);
    this.toast('New session started.');
  }
  askResetStats() {
    this.confirm('Reset all stats (session and all time)? Your balance is kept.', () => {
      this.save.session = newStats(this.save.balance);
      this.save.allTime = newStats(STARTING_CREDITS);
      writeSave(this.save, true);
      if (this.book.modal.isOpen()) this.book.render();
      this.toast('Stats reset.');
    });
  }
  openSettings() {
    const u = this.hud, s = this.save.settings;
    u.vol.master.value = String(s.master); u.vol.music.value = String(s.music); u.vol.sfx.value = String(s.sfx);
    u.muteBox.checked = s.muted;
    u.motionSel.value = s.reducedMotion;
    const pads = this.pad.list();
    u.padList.textContent = pads.length ? pads.map((p) => `${p.index + 1}: ${p.id} (${p.mapping})`).join('\n') : 'No controller detected. Press a button on it to wake it up.';
    u.settings.open();
    this.setPadCursor(u.vol.master);
  }
  openBuy() {
    if (this.busy) { this.busyHint(); return; }
    this.refreshAll();
    const can = (k: FeatureKind) => this.save.balance >= bonusBuyCost(k, this.bet);
    this.hud.buyTorii.disabled = !can('torii');
    this.hud.buyFs.disabled = !can('freespins');
    this.hud.buy.open();
    this.setPadCursor(this.hud.buyTorii.disabled ? this.hud.buyFs : this.hud.buyTorii);
  }
  busyHint() { this.toast('Finish the current spin first.'); }

  // ---------------- auto ----------------
  onAutoButton() {
    if (this.autoLeft > 0) { this.stopAuto(); return; }
    this.toggleMenu(this.hud.autoMenu, this.hud.autoBtn);
  }
  startAuto(opt: number | 'feature') {
    this.autoUntilFeature = opt === 'feature';
    this.autoLeft = opt === 'feature' ? Infinity : opt;
    this.autoStartBalance = this.save.balance;
    this.refreshAll();
    if (!this.busy) void this.spin();
  }
  stopAuto() { this.autoLeft = 0; this.autoUntilFeature = false; this.refreshAll(); }

  // ======================= spin flow =======================
  onSpinButton() {
    if (this.waiter) { this.waiter(); return; }
    if (this.skipper && !this.skipper.skipped) { this.skipper.skip(); return; }
    if (this.busy) { this.fastForward(); return; }
    if (this.autoLeft > 0) { this.stopAuto(); return; }
    void this.spin();
  }
  fastForward() {
    if (!this.busy || this.fast) return;
    this.fast = true;
    clock.speed = 3;
  }
  /** Waits for the player (SPIN, A, tap); during auto-spin or fast-forward it continues by itself. */
  waitForPress(prompt: string, autoMs = 1400, button = 'GO'): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; this.waiter = null; this.hud.pressPrompt.classList.remove('show'); this.hud.spinBtn.textContent = 'SPIN'; resolve(); };
      this.waiter = finish;
      this.hud.pressPrompt.textContent = prompt;
      this.hud.pressPrompt.classList.add('show');
      this.hud.spinBtn.textContent = button;
      if (this.autoLeft > 0 || this.fast) void wait(this.fast ? 250 : autoMs).then(finish);
    });
  }

  async spin() {
    if (this.busy) return;
    this.hideMenus();
    if (this.anyModalOpen()) return;
    const bet = this.bet;
    if (this.save.balance < bet - 1e-9) {
      this.stopAuto();
      this.audio.error();
      this.toast('Not enough play money for this bet. Add more with + Funds (it is free).', 4000);
      this.openCredits();
      return;
    }
    const force = this.force;
    this.force = null;
    const res = playSpin(this.rng, bet, force);
    await this.play(res);
  }

  async buyBonus(kind: FeatureKind, debug = false) {
    if (this.busy) return;
    const cost = bonusBuyCost(kind, this.bet);
    if (!debug && this.save.balance < cost - 1e-9) { this.toast('Not enough play money for this buy.'); this.openCredits(); return; }
    const force = this.force;
    this.force = null;
    const res = playBonusBuy(this.rng, this.bet, kind, force);
    if (debug) res.forced = true;
    await this.play(res);
  }

  /** Settles a result (balance, stats, save) before anything is shown, then presents it. */
  commitResult(res: SpinResult) {
    this.save.balance = r2(this.save.balance - res.cost + res.totalWin);
    this.pendingWin = res.totalWin;
    if (res.forced) { this.save.session.debugActions++; this.save.allTime.debugActions++; }
    else { recordResult(this.save.session, res, this.save.balance); recordResult(this.save.allTime, res, this.save.balance); }
    writeSave(this.save, true);
  }

  async play(res: SpinResult) {
    this.busy = true;
    this.fast = false;
    clock.speed = 1;
    this.shownWin = 0;
    this.lastResult = res;
    this.commitResult(res);
    this.refreshAll();
    this.mascot.poke();
    try {
      await this.present(res);
    } catch (e) {
      console.error(e);
    }
    this.finishSpin(res);
  }

  /** Reveals part of the pending win: moves it into the shown win and the shown balance. */
  reveal(amount: number) {
    amount = Math.min(amount, this.pendingWin);
    this.pendingWin = r2(this.pendingWin - amount);
    if (this.pendingWin < 0.000001) this.pendingWin = 0;
    this.shownWin = r2(this.shownWin + amount);
    this.hud.win.textContent = fmt(this.shownWin);
    this.hud.balance.textContent = fmt(this.displayBalance());
  }
  /** Counts the WIN box up by `amount` over `ms`. */
  async countUp(amount: number, ms: number) {
    if (amount <= 0) return;
    const start = this.shownWin, startBal = this.displayBalance();
    ms = this.quick ? Math.min(ms, 200) : ms;
    let last = 0;
    await every((_dt, el) => {
      const p = Math.min(1, el / ms);
      const v = amount * p;
      this.hud.win.textContent = fmt(start + v);
      this.hud.balance.textContent = fmt(startBal + v);
      if (el - last > 70 && p < 1) { last = el; this.audio.countTick(); }
      return p < 1;
    });
    this.reveal(amount);
  }

  async present(res: SpinResult) {
    const bet = res.bet;
    this.hud.win.textContent = '';
    this.setMessage(res.bought ? (res.bought === 'torii' ? 'Bonus buy: Torii Path' : 'Bonus buy: Lantern Festival') : '');
    if (res.base) {
      await this.presentCascade(res.base, { bet, lanternMult: 1, fs: false });
      const bells = res.freeSpins ? res.freeSpins.bells : 0;
      if (res.freeSpins || res.torii) this.highlightTriggers(!!res.freeSpins, !!res.torii);
      if (bells) { this.audio.scatter(); await wait(500); }
    }
    if (res.freeSpins) await this.playFreeSpins(res.freeSpins, bet, !!res.bought);
    if (res.torii) await this.playTorii(res.torii, bet, !!res.bought);
    if (res.omikuji) await this.playOmikuji(res.omikuji, bet);
    // anything left (rounding, capped amounts) is revealed now
    if (this.pendingWin > 0) await this.countUp(this.pendingWin, 400);
    const x = res.winX;
    if (x >= WIN_TIERS[WIN_TIERS.length - 1].x) {
      this.skipper = new Skipper();
      this.mascot.cheer(4000);
      this.audio.bigWin();
      const sk = this.skipper;
      if (this.autoLeft > 0 || this.fast) void wait(this.fast ? 600 : 3000).then(() => sk.skip());
      await this.overlays.bigWin(res.totalWin, bet, WIN_TIERS, sk, () => this.audio.tier(), () => {});
      this.skipper = null;
    } else if (res.totalWin > 0) {
      this.mascot.wave(1600);
      this.audio.win(Math.min(4, Math.floor(x)));
    }
    if (res.capped) this.toast(`Maximum win reached: ${fmt(res.totalWin)}`, 4000);
    this.hud.win.textContent = res.totalWin > 0 ? fmt(res.totalWin) : '';
    this.shownWin = res.totalWin;
    this.setMessage(res.totalWin > 0 ? `You won ${fmt(res.totalWin)}` : '');
  }

  highlightTriggers(bells: boolean, masks: boolean) {
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) {
      const v = this.reels.view(r, row);
      const hit = (bells && v.sym === SYM.BELL) || (masks && v.sym === SYM.MASK);
      v.setGlow(hit, v.sym === SYM.MASK ? 0xc9a7ff : 0xffe9a8);
      v.alpha = hit ? 1 : 0.5;
      if (hit) this.fx.sparkles(L.reelX + r * CELL_W + CELL_W / 2, L.reelY + row * CELL_H + CELL_H / 2, 10, 120);
    }
    this.mascot.bow(1800);
  }

  /** Spins the reels and plays every cascade step of one (base or free) spin. */
  async presentCascade(c: CascadeResult, o: { bet: number; lanternMult: number; fs: boolean }) {
    const first = c.steps[0];
    this.reels.startSpin();
    this.audio.spinStart();
    await wait(this.quick ? 160 : 520);
    // anticipation: two Bells or two Masks already landed with reels still to stop
    let anticipate: number | undefined;
    let bells = 0, masks = 0;
    for (let r = 0; r < REELS - 1; r++) {
      bells += first.board[r].filter((s) => s === SYM.BELL).length;
      if ([0, 2].includes(r) && first.board[r].includes(SYM.MASK)) masks++;
      if (bells >= 2 || masks >= 2) { anticipate = r + 1; break; }
    }
    await this.reels.stopAll(first.board, {
      turbo: this.turbo, fast: () => this.fast, anticipate,
      onStop: (r) => {
        this.audio.reelStop(r);
        const col = first.board[r];
        if (col.includes(SYM.BELL)) this.audio.scatterLand(col.filter((s) => s === SYM.BELL).length);
        if (col.includes(SYM.MASK)) this.audio.maskLand();
      },
    });
    if (o.fs) { await this.reels.lockNew(first.locked); if (first.locked.flat().some(Boolean)) this.audio.stickyLock(); }
    for (let i = 0; i < c.steps.length; i++) {
      const st = c.steps[i];
      if (!st.wins.length) break;
      if (i > 0) {
        this.fx.floatText(`Cascade ×${st.mult}`, L.reelX + CELL_W * 2.5, L.reelY - 10, 46, '#F4B6C2');
      }
      const mult = st.mult * o.lanternMult;
      // line wins one at a time with a count-up
      const per = this.quick ? 260 : Math.max(380, Math.min(900, 2600 / st.wins.length));
      for (let k = 0; k < st.wins.length; k++) {
        const w = st.wins[k];
        const amount = r2(w.pay * mult * o.bet * 1e4) / 1e4;
        this.reels.showLine(w, fmtExact(amount));
        this.setMessage(`Line ${w.line + 1}: ${w.count} × ${SYMBOL_NAMES[w.sym]}${mult > 1 ? ` · ×${mult}` : ''} · ${fmtExact(amount)}`);
        this.audio.lineTick(k);
        await this.countUp(amount, per * 0.8);
        await wait(per * 0.2);
      }
      // burst and drop
      const cells = st.wins.flatMap((w) => w.cells);
      this.reels.showAll(cells);
      this.audio.cascade(i);
      const pos = await this.reels.burst(cells, st.locked, this.quick);
      for (const p of pos) this.fx.petalBurst(p.x, p.y);
      const removed = new Set(cells.filter(([r, row]) => !st.locked[r][row]).map(([r, row]) => `${r},${row}`));
      const next = c.steps[i + 1];
      await this.reels.drop(next.board, removed, st.locked, this.quick);
      if (o.fs) { await this.reels.lockNew(next.locked); }
      this.reels.clearWins();
      await wait(this.quick ? 60 : 160);
    }
    this.reels.clearWins();
  }

  // ======================= Lantern Festival =======================
  async playFreeSpins(fs: FreeSpinsResult, bet: number, bought: boolean) {
    this.inFeature = true;
    if (this.autoUntilFeature) this.stopAuto();
    this.audio.featureStart();
    this.mascot.bow(2000);
    await wait(this.quick ? 300 : 1500);
    const intro = this.waitForPress('Press SPIN to begin', 2500, 'START');
    await this.overlays.banner('LANTERN FESTIVAL', `${bought ? 'Bonus buy · ' : `${fs.bells} Shrine Bells · `}${fs.awarded} free spins + ${fmt(fs.scatterPay * bet)}`, intro, 'Tap or press SPIN to begin');
    this.audio.playMusic('night');
    void this.bg.show('night');
    this.frame.texture = TEX.frameNight;
    this.reels.setPool(FS_STRIPS);
    this.reels.setSticky(null);
    this.lanternLayer.visible = true;
    this.setLanterns(0);
    this.hud.featurePanel.classList.add('show');
    this.hud.fpTitle.textContent = 'LANTERN FESTIVAL';
    await this.countUp(fs.scatterPay * bet, 800);
    let total = fs.awarded;
    for (const s of fs.spins) {
      this.hud.fpLine1.textContent = `Spin ${s.n} of ${total}`;
      this.hud.fpLine2.textContent = `Multiplier ×${s.mult}`;
      this.hud.fpLine3.textContent = `Win ${fmt(this.shownWin)}`;
      if (s.n > 1) await this.reels.drift(this.quick);
      await this.presentCascade(s.cascade, { bet, lanternMult: s.mult, fs: true });
      for (let b = 0; b < s.bells; b++) {
        const before = s.lanternsAfter - s.bells + b;
        this.setLanterns(before + 1);
        this.audio.lanternLit();
        const lit = (before + 1) % FREE_SPINS.lanternsPerStep || FREE_SPINS.lanternsPerStep;
        const sp = this.lanternSprites[lit - 1];
        this.fx.sparkles(sp.x, sp.y + 60, 10, 60);
        await wait(this.quick ? 120 : 380);
      }
      if (s.added) {
        total += s.added;
        this.audio.retrigger();
        this.mascot.bow(1400);
        this.lanternSprites.forEach((sp) => { sp.texture = TEX.lanternLit; this.fx.sparkles(sp.x, sp.y + 60, 14, 80); });
        this.fx.floatText(`+${s.added} spins · ×${s.multAfter}`, L.cx, L.reelY + CELL_H * 1.5, 72, '#F2D27A');
        await wait(this.quick ? 400 : 1400);
        this.setLanterns(s.lanternsAfter);
      }
      this.hud.fpLine3.textContent = `Win ${fmt(this.shownWin)}`;
      await wait(this.quick ? 100 : 400);
    }
    const outro = this.waitForPress('Press SPIN to continue', 2500, 'OK');
    await this.overlays.banner('FESTIVAL COMPLETE', `Free spins won ${fmt(fs.win * bet)}${fs.capped ? ' (maximum win)' : ''}`, outro, 'Tap or press SPIN to continue');
    this.reels.setSticky(null);
    this.lanternLayer.visible = false;
    this.hud.featurePanel.classList.remove('show');
    this.frame.texture = TEX.frame;
    this.reels.setPool(STRIPS);
    void this.bg.show('dusk');
    this.audio.playMusic('base');
    this.inFeature = false;
  }

  // ======================= Torii Path =======================
  async playTorii(t: ToriiResult, bet: number, bought: boolean) {
    this.inFeature = true;
    if (this.autoUntilFeature) this.stopAuto();
    this.audio.featureStart();
    this.mascot.bow(2000);
    await wait(this.quick ? 300 : 1500);
    const intro = this.waitForPress('Press SPIN to begin', 2500, 'START');
    await this.overlays.banner('TORII PATH', `${bought ? 'Bonus buy · ' : 'Three Kitsune Masks · '}${t.startRolls} rolls to climb to the shrine`, intro, 'Tap or press SPIN to begin');
    this.audio.playMusic('climb');
    await this.bg.show('mountain', 600);
    this.reelLayer.visible = false;
    this.mascot.visible = false;
    this.hud.root.classList.add('climb');
    this.torii.build(t.spaces, bet, t.startRolls);
    this.torii.visible = true;
    this.torii.alpha = 0;
    await tween(this.torii, { alpha: 1 }, 400);
    for (const r of t.rolls) {
      await this.waitForPress('Tap or press SPIN to roll', 900, 'ROLL');
      this.audio.dieRoll();
      await this.torii.playRoll(r, this.quick, { hop: () => this.audio.hop(), gate: () => this.audio.gate(), land: (e) => this.audio.land(e), summit: () => this.audio.summit() });
    }
    const full = t.uncappedWin ?? t.win;
    let sub = t.mult > 1 ? `Collected ${fmt(t.collected * bet)} × lantern ${t.mult} = ${fmt(full * bet)}` : `Collected ${fmt(full * bet)}`;
    // the 5,000x cap can cut a climb short: say so rather than show two different totals
    if (t.capped) sub += `
Maximum win reached: ${fmt(t.win * bet)} paid`;
    const outro = this.waitForPress('Press SPIN to continue', 2500, 'OK');
    const cu = this.countUp(t.win * bet, 1200);
    await this.overlays.banner(t.summit ? 'SHRINE REACHED!' : 'CLIMB COMPLETE', sub, outro, 'Tap or press SPIN to continue');
    await cu;
    await tween(this.torii, { alpha: 0 }, 300);
    this.torii.visible = false;
    this.hud.root.classList.remove('climb');
    this.reelLayer.visible = true;
    this.mascot.visible = true;
    void this.bg.show('dusk');
    this.audio.playMusic('base');
    this.inFeature = false;
  }

  // ======================= Omikuji =======================
  async playOmikuji(o: OmikujiResult, bet: number) {
    const box = this.omikujiBox;
    box.visible = true;
    box.alpha = 0;
    await tween(box, { alpha: 1 }, 250);
    this.mascot.surprise(1400);
    let shaking = true;
    const baseX = L.omikuji.x;
    void every((_dt, el) => { box.x = baseX + Math.sin(el / 30) * 8; box.rotation = Math.sin(el / 45) * 0.06; if (Math.floor(el / 600) !== Math.floor((el - 16) / 600)) this.audio.omikujiShake(); return shaking; });
    this.audio.omikujiShake();
    await this.waitForPress('The shrine box shakes! Tap it or press SPIN to draw', 1400, 'DRAW');
    shaking = false;
    box.x = baseX; box.rotation = 0;
    for (let i = 0; i < o.draws.length; i++) {
      this.audio.omikujiDraw();
      await this.showSlip(o.draws[i], bet, i === 0 && o.draws.length > 1);
    }
    await this.countUp(o.pay * bet, 900);
    await tween(box, { alpha: 0 }, 300);
    box.visible = false;
  }
  async showSlip(key: SlipKey, bet: number, kyoFirst: boolean) {
    const s = OMIKUJI_SLIPS.find((x) => x.key === key)!;
    const u = this.hud;
    u.slipKanji.textContent = s.kanji;
    u.slipKanji.title = `${s.name}: ${s.meaning}`;
    u.slipName.textContent = s.name;
    u.slipMeaning.textContent = s.meaning.split(' (')[0];
    u.slipPrize.textContent = s.pay ? `${s.pay}× bet · ${fmt(s.pay * bet)}` : 'No prize';
    u.slipNote.textContent = s.key === 'kyo' ? 'Tie it to the pine branch and draw again…' : '';
    u.slip.classList.toggle('kyo', s.key === 'kyo');
    u.slip.classList.add('show');
    this.audio.slipReveal(s.key !== 'kyo');
    if (s.key !== 'kyo') { this.mascot.wave(1600); this.fx.sparkles(L.cx, L.cy, 20, 400); }
    else this.mascot.surprise(1200);
    await this.waitForPress(kyoFirst ? 'Tap or press SPIN to tie it and draw again' : 'Tap or press SPIN to continue', 1600, kyoFirst ? 'TIE' : 'OK');
    if (kyoFirst) {
      u.slip.classList.add('tie');
      await wait(this.quick ? 250 : 900);
      u.slip.classList.remove('tie');
    }
    u.slip.classList.remove('show');
    await wait(200);
  }

  finishSpin(res: SpinResult) {
    this.busy = false;
    this.fast = false;
    clock.speed = 1;
    this.pendingWin = 0;
    this.overlays.clear();
    void this.overlays.setDim(0, 100);
    this.refreshAll();
    if (this.pendingLayout && this.pendingLayout !== L.orientation) this.applyLayout(this.pendingLayout);
    else if (this.pendingLayout) this.fit();
    this.pendingLayout = null;
    if (this.autoLeft > 0) {
      if (this.autoUntilFeature && (res.freeSpins || res.torii)) { this.stopAuto(); return; }
      const s = this.save.settings;
      if (s.autoStopWin && !res.bought && res.winX >= s.autoStopWin) { this.stopAuto(); this.toast(`Auto-spin stopped: a win of ${s.autoStopWin}× bet or more.`, 4000); return; }
      if (s.autoStopLoss && this.autoStartBalance - this.save.balance >= s.autoStopLoss * res.bet - 1e-9) { this.stopAuto(); this.toast(`Auto-spin stopped: balance down ${fmt(this.autoStartBalance - this.save.balance)} since it started.`, 4000); return; }
      if (!this.autoUntilFeature) this.autoLeft--;
      this.refreshAll();
      if (this.autoLeft > 0) void wait(this.turbo ? 150 : 450).then(() => { if (this.autoLeft > 0 && !this.busy) void this.spin(); });
    }
  }

  // ======================= debug =======================
  buildDebug() {
    const d = this.hud.debugBody;
    const b = (label: string, fn: () => void) => { const el = h('button', { class: 'btn small' }, label); el.addEventListener('click', () => { this.audio.click(); fn(); this.updateDebugArmed(); }); d.append(el); };
    const arm = (f: ForceOptions, label: string) => b(label, () => { this.force = f; this.forceBuy = null; });
    d.append(h('div', { class: 'dbg-h' }, 'Next spin'));
    arm({ feature: 'freespins' }, 'Free Spins (3 Bells)');
    arm({ feature: 'freespins', bells: 4 }, 'Free Spins (4 Bells)');
    arm({ feature: 'freespins', bells: 5 }, 'Free Spins (5 Bells)');
    arm({ feature: 'freespins', retrigger: true }, 'Free Spins + retrigger');
    arm({ feature: 'torii' }, 'Torii Path');
    arm({ feature: 'torii', summit: true }, 'Torii Path: summit');
    for (const s of OMIKUJI_SLIPS) arm({ feature: 'omikuji', slip: s.key }, `Omikuji: ${s.name}`);
    d.append(h('div', { class: 'dbg-h' }, 'Play now (free, not in stats)'));
    b('Buy Torii Path', () => { this.toggleDebug(); void this.buyBonus('torii', true); });
    b('Buy Free Spins', () => { this.toggleDebug(); void this.buyBonus('freespins', true); });
    b('Clear forced outcome', () => { this.force = null; });
    d.append(h('div', { class: 'dbg-h' }, 'Funds (not in stats)'));
    b('+ $1,000', () => this.addCredits(1000, true));
    b('+ $10,000', () => this.addCredits(10000, true));
    this.updateDebugArmed();
  }
  updateDebugArmed() {
    const f = this.force;
    this.hud.debugArmed.textContent = f ? `Armed: ${JSON.stringify(f)}` : 'Nothing armed';
  }
  toggleDebug() {
    if (!this.debugAllowed) return;
    const el = this.hud.debug;
    const open = el.style.display !== 'block';
    el.style.display = open ? 'block' : 'none';
    this.setPadCursor(open ? el.querySelector('button') : null);
  }
}

const game = new Game();
(window as any).game = game;
void game.boot();
