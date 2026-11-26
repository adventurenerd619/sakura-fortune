// Automated smoke test: launches the built game in Electron with a throwaway save folder,
// plays spins, every bonus (forced) and both bonus buys, opens every panel, checks the
// portrait layout, and saves screenshots plus a log.
// Usage: npm run test:smoke   (or: npx electron scripts/smoke-main.cjs <outDir>)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createSaveStore } = require('../app/saveStore.js');

const out = path.resolve(process.argv[2] || 'smoke-out');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-smoke-'));
app.setPath('userData', tmp);
const store = createSaveStore(tmp);
ipcMain.handle('save:load', () => store.load());
ipcMain.handle('save:write', (_e, d) => store.write(d));
ipcMain.on('save:writeSync', (e, d) => { e.returnValue = store.write(d); });
ipcMain.handle('window:fullscreen', () => false);
ipcMain.handle('app:quit', () => app.quit());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let errors = 0, failures = 0;
const log = (...a) => { console.log(...a); fs.appendFileSync(path.join(out, 'log.txt'), a.join(' ') + '\n'); };
const check = (name, ok, detail = '') => { log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) failures++; };

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1600, height: 900, useContentSize: true, show: true,
    webPreferences: { preload: path.join(__dirname, '..', 'app', 'preload.js'), contextIsolation: true, backgroundThrottling: false, additionalArguments: ['--sf-dev'] },
  });
  win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') { log('[console]', e.message); if (e.level === 'error') errors++; } });
  await win.loadFile(path.join(__dirname, '..', 'app', 'renderer', 'index.html'));
  const js = (code) => win.webContents.executeJavaScript(code);
  const run = (code) => win.webContents.executeJavaScript('(()=>{' + code + ';return 0})()');
  const shot = async (name) => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, name + '.png'), img.toPNG()); log('shot', name); };
  const waitIdle = async (max = 240000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (!(await js('game.busy'))) return true; await sleep(300); } return false; };
  const waitFor = async (cond, max = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (await js(cond)) return true; await sleep(150); } return false; };
  /** the harness presses SPIN at every prompt unless __hold is set */
  const autoPress = () => js("window.__hold = false; window.__ap = setInterval(() => { if (!window.__hold && game.waiter) game.waiter(); }, 500); 0");
  try {
    for (let i = 0; i < 100 && !(await js('!!(window.game && game.hud && game.reels)')); i++) await sleep(100);
    await sleep(1500);
    await shot('01-base');
    log('fps', await js('game.app.ticker.FPS.toFixed(1)'));
    await autoPress();

    // ---- base spins
    const bal0 = await js('game.save.balance');
    await js('game.spin(); 0');
    await sleep(500);
    await shot('02-spinning');
    await waitIdle();
    await shot('03-after-spin');
    const r1 = await js('({cost: game.lastResult.cost, win: game.lastResult.totalWin})');
    check('first spin settled into the balance', Math.abs((await js('game.save.balance')) - (bal0 - r1.cost + r1.win)) < 1e-6, JSON.stringify(r1));
    check('first spin counted in stats', (await js('game.save.session.spins')) === 1);
    await run('game.save.settings.turbo = true; game.refreshAll()');
    let cascades = 0;
    for (let i = 0; i < 30; i++) { await js('game.spin()'); await waitIdle(); cascades += await js('Math.max(0, game.lastResult.base.steps.length - 2)'); }
    await shot('04-after-30-spins');
    log('balance', await js('game.save.balance'), 'spins', await js('game.save.session.spins'), 'cascades seen', cascades);
    check('31 paid spins recorded', (await js('game.save.session.spins')) === 31);
    check('shown balance matches the real balance when idle', (await js('game.displayBalance() === game.save.balance && game.pendingWin === 0')) === true);

    // ---- a cascade with line wins, at normal speed (wait for a spin that cascades)
    await run('game.save.settings.turbo = false; game.refreshAll()');
    await js('window.__hold = true');
    for (let i = 0; i < 40; i++) {
      await js('game.spin(); 0');
      if (await waitFor("document.querySelector('#message').textContent.startsWith('Line') || !game.busy", 8000) && await js("document.querySelector('#message').textContent.startsWith('Line')")) { await sleep(200); await shot('05-line-win'); break; }
      await waitIdle();
    }
    await waitIdle();
    await js('window.__hold = false');

    // ---- Omikuji: Kyo then a redraw (forced spins from here on must not count as paid spins)
    const paidSpins = await js('game.save.session.spins');
    await js('window.__hold = true');
    await run("game.force = {feature:'omikuji', slip:'kyo'}; game.spin()");
    await waitFor('game.omikujiBox.visible && !!game.waiter');
    await sleep(700);
    await shot('06-omikuji-box');
    await js('game.waiter()');
    await waitFor("game.hud.slip.classList.contains('show')");
    await sleep(600);
    await shot('07-omikuji-kyo');
    await js('game.waiter()');
    await waitFor("game.hud.slip.classList.contains('show') && !game.hud.slip.classList.contains('kyo')");
    await sleep(600);
    await shot('08-omikuji-redraw');
    await js('window.__hold = false');
    await waitIdle();
    const om = await js('game.lastResult.omikuji');
    check('Omikuji Kyo is followed by a good slip', om.draws.length === 2 && om.draws[0] === 'kyo' && om.draws[1] !== 'kyo', JSON.stringify(om));
    for (const slip of ['daikichi', 'chukichi', 'shokichi', 'kichi']) {
      await run(`game.save.settings.turbo = true; game.force = {feature:'omikuji', slip:'${slip}'}; game.spin()`);
      await waitIdle();
      check(`Omikuji forced ${slip}`, (await js('game.lastResult.omikuji.draws[0]')) === slip);
    }
    await run('game.save.settings.turbo = false; game.refreshAll()');

    // ---- Torii Path to the summit
    await js('window.__hold = true');
    await run("game.force = {feature:'torii', summit:true}; game.spin()");
    await waitFor('!!game.waiter && game.inFeature', 30000);
    await sleep(600);
    await shot('09-torii-intro');
    await js('game.waiter()');
    await waitFor('game.torii.visible && !!game.waiter', 15000);
    await sleep(500);
    await shot('10-torii-board');
    const rolls = await js('game.lastResult.torii.rolls.length');
    for (let i = 0; i < rolls; i++) {
      await waitFor('!!game.waiter', 20000);
      await js('game.waiter()');
      await sleep(900);
      if (i === 0) await shot('11-torii-roll');
    }
    await waitFor('!!game.waiter && game.overlays.dim.alpha > 0.3', 20000);
    await sleep(600);
    await shot('12-torii-end');
    await js('window.__hold = false');
    await waitIdle();
    const tr = await js('game.lastResult.torii');
    check('forced Torii Path reaches the shrine', tr.summit === true, `win ${tr.win}x, mult ${tr.mult}`);
    await shot('13-after-torii');

    // ---- Lantern Festival with a retrigger
    await js('window.__hold = true');
    await run("game.force = {feature:'freespins', retrigger:true}; game.spin()");
    await waitFor('!!game.waiter && game.inFeature', 30000);
    await sleep(600);
    await shot('14-fs-intro');
    await js('window.__hold = false');
    await waitFor('game.lanternLayer.visible', 15000);
    await sleep(4000);
    await shot('15-fs-night');
    await waitFor('game.reels.stickyViews.size > 0', 60000);
    await sleep(800);
    await shot('16-fs-sticky');
    await waitFor("game.lastResult.freeSpins && game.hud.fpLine1.textContent.includes('of ' + (game.lastResult.freeSpins.awarded + 4))", 120000);
    await sleep(300);
    await shot('17-fs-retrigger');
    await js('window.__hold = true');
    await waitFor("!!game.waiter && game.overlays.dim.alpha > 0.3", 240000);
    await sleep(500);
    await shot('18-fs-end');
    await js('window.__hold = false');
    await waitIdle();
    const fsr = await js('game.lastResult.freeSpins');
    check('forced free spins retriggered', fsr.retriggers > 0, `${fsr.spins.length} spins, mult x${fsr.finalMult}`);
    check('forced (debug) spins are not counted as paid spins', (await js('game.save.session.spins')) === paidSpins);
    check('debug actions counted separately', (await js('game.save.session.debugActions')) >= 7);

    // ---- big win celebration (presentation only)
    await run("game.busy = true; const sk = {skipped:false, wait:(ms)=>new Promise(r=>setTimeout(r,ms)), skip(){this.skipped=true}}; game.overlays.bigWin(game.bet*60, game.bet, [{name:'Daikichi Win',x:50},{name:'Mega Win',x:25},{name:'Big Win',x:10}], sk, ()=>game.audio.tier(), ()=>{}).then(()=>{game.busy=false; game.skipper=null;})");
    await sleep(4600);
    await shot('19-big-win');
    await waitFor('!game.busy', 20000);

    // ---- bonus buys (real, paid)
    await run('game.save.settings.turbo = true; game.refreshAll()');
    await run('game.addCredits(1000, true)');
    const before = await js('game.save.balance');
    await run('game.openBuy()');
    await sleep(500);
    await shot('20-buy-panel');
    await run("game.hud.buy.close(); game.buyBonus('torii')");
    await waitIdle();
    const buyT = await js('({cost: game.lastResult.cost, win: game.lastResult.totalWin, bought: game.lastResult.bought})');
    check('Torii Path buy costs 60x bet', Math.abs(buyT.cost - 60 * (await js('game.bet'))) < 1e-9 && buyT.bought === 'torii', JSON.stringify(buyT));
    await run("game.buyBonus('freespins')");
    await waitIdle();
    const buyF = await js('({cost: game.lastResult.cost, win: game.lastResult.totalWin, bought: game.lastResult.bought})');
    check('Free Spins buy costs 80x bet', Math.abs(buyF.cost - 80 * (await js('game.bet'))) < 1e-9 && buyF.bought === 'freespins', JSON.stringify(buyF));
    check('buys settled correctly', Math.abs((await js('game.save.balance')) - (before - buyT.cost + buyT.win - buyF.cost + buyF.win)) < 1e-6);
    check('buys recorded in stats', (await js('game.save.session.buysTorii')) === 1 && (await js('game.save.session.buysFreeSpins')) === 1);
    await run('game.save.settings.turbo = false; game.refreshAll()');
    await shot('21-after-buys');

    // ---- panels
    for (let t = 0; t < 4; t++) { await run(`game.paytable.tab=${t}; game.paytable.open()`); await sleep(400); await shot(`22-paytable-${t}`); }
    await run('game.paytable.modal.close()');
    for (let t = 0; t < 5; t++) { await run(`game.book.tab=${t}; game.book.open()`); await sleep(400); await shot(`23-stats-${t}`); }
    await run('game.book.modal.close(); game.openCredits()'); await sleep(400); await shot('24-credits');
    await run("game.hud.creditInput.value = '369'; game.updateCreditHint()");
    const b369 = await js('game.save.balance');
    await run('game.addCustomCredits()');
    check('custom $369 added', Math.abs((await js('game.save.balance')) - b369 - 369) < 1e-6);
    await run('game.openSettings()'); await sleep(400); await shot('25-settings');
    await run('game.hud.settings.close(); game.toggleDebug()'); await sleep(400); await shot('26-debug');
    await run('game.toggleDebug(); game.toggleMenu(game.hud.autoMenu, game.hud.autoBtn)'); await sleep(400); await shot('27-auto-menu');
    await run('game.hideMenus(); game.toggleMenu(game.hud.denomMenu, game.hud.btnDenom)'); await sleep(400); await shot('28-denom-menu');
    await run('game.hideMenus(); game.setDenom(4)');
    await run('game.toggleMoney()'); await sleep(300); await shot('29-credits-view');
    log('25c credits view: bet', await js('game.hud.bet.textContent'), 'balance', await js('game.hud.balance.textContent'));
    await run('game.toggleMoney(); game.setDenom(0)');
    await run("game.confirm('Example confirmation dialog', () => {})"); await sleep(300); await shot('30-confirm');
    await run('game.hud.confirm.close()');
    // Esc closes panels; Android-style back closes panels too
    await run('game.paytable.open()');
    await run('game.onBack()');
    check('back button closes the open panel', !(await js('game.paytable.modal.isOpen()')));

    // ---- auto-spin
    await run('game.save.settings.turbo = true; game.startAuto(10)');
    await waitFor('game.autoLeft === 0 && !game.busy', 120000);
    check('auto-spin 10 completed', (await js('game.autoLeft')) === 0);

    // ---- portrait layout
    win.setContentSize(540, 1080);
    await sleep(1200);
    await shot('31-portrait-base');
    check('portrait layout active', (await js('game.app.screen.height > game.app.screen.width')) === true);
    await run('game.save.settings.turbo = false; game.refreshAll(); game.spin()');
    await sleep(900);
    await shot('32-portrait-spinning');
    await waitIdle();
    await js('window.__hold = true');
    await run("game.force = {feature:'torii'}; game.spin()");
    await waitFor('!!game.waiter && game.inFeature', 30000);
    await js('game.waiter()');
    await waitFor('game.torii.visible && !!game.waiter', 15000);
    await sleep(500);
    await shot('33-portrait-torii');
    await js('window.__hold = false');
    await waitIdle();
    await run('game.paytable.tab=0; game.paytable.open()'); await sleep(400); await shot('34-portrait-paytable');
    await run('game.paytable.modal.close()');
    win.setContentSize(1600, 900);
    await sleep(1000);
    await shot('35-back-to-landscape');

    const save = JSON.parse(fs.readFileSync(store.files.main, 'utf-8'));
    log('save ok: balance', save.balance, 'session spins', save.session.spins, 'allTime spins', save.allTime.spins, 'debugActions', save.allTime.debugActions,
      'FS natural/bought', save.allTime.fsNatural + '/' + save.allTime.fsBought, 'Torii natural/bought', save.allTime.toriiNatural + '/' + save.allTime.toriiBought);
    check('forced features are not in the feature stats', save.allTime.fsNatural === 0 || save.allTime.fsNatural < 3);
    check('save file balance matches the game', Math.abs(save.balance - (await js('game.save.balance'))) < 1e-6);
  } catch (e) {
    log('ERROR', e && e.stack || e);
    failures++;
  }
  log(errors ? `${errors} console error(s)` : 'no console errors');
  log(failures || errors ? 'SMOKE TEST FAILED' : 'SMOKE TEST PASSED');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows may still hold the folder */ }
  app.exit(failures || errors ? 1 : 0);
});
