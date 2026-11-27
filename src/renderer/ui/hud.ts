import { h, makeModal, svgUrl, type Modal } from './dom';
import { pineBranchSvg, bellSymbol, maskSymbol, omikujiBoxSvg } from '../art/svg';

/** One consistent line-icon set (24 px grid, drawn in the current text colour). */
const icon = (body: string) => `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const ICONS = {
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor"/>'),
  stats: icon('<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>'),
  settings: icon('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  sound: icon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  muted: icon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  fullscreen: icon('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
};
import { ADD_CREDIT_OPTIONS, ADD_CREDIT_MAX, BONUS_BUY } from '../../config/math';

export interface Hud {
  root: HTMLElement;
  title: HTMLElement;
  balance: HTMLElement; balanceLabel: HTMLElement;
  bet: HTMLElement; betLabel: HTMLElement;
  win: HTMLElement; winLabel: HTMLElement;
  message: HTMLElement;
  spinBtn: HTMLButtonElement; autoBtn: HTMLButtonElement; turboBtn: HTMLButtonElement;
  betMinus: HTMLButtonElement; betPlus: HTMLButtonElement;
  btnDenom: HTMLButtonElement; btnMoney: HTMLButtonElement;
  btnBuy: HTMLButtonElement; btnInfo: HTMLButtonElement; btnStats: HTMLButtonElement; btnSettings: HTMLButtonElement;
  btnFull: HTMLButtonElement; btnFunds: HTMLButtonElement; btnMute: HTMLButtonElement;
  featurePanel: HTMLElement; fpTitle: HTMLElement; fpLine1: HTMLElement; fpLine2: HTMLElement; fpLine3: HTMLElement;
  autoMenu: HTMLElement; denomMenu: HTMLElement;
  buy: Modal; buyTorii: HTMLButtonElement; buyFs: HTMLButtonElement; buyToriiPrice: HTMLElement; buyFsPrice: HTMLElement;
  credits: Modal; creditBtns: HTMLButtonElement[]; creditInput: HTMLInputElement; creditHint: HTMLElement; creditAddBtn: HTMLButtonElement;
  settings: Modal; vol: Record<'master' | 'music' | 'sfx', HTMLInputElement>; muteBox: HTMLInputElement; motionSel: HTMLSelectElement; padList: HTMLElement;
  menuRules: HTMLButtonElement; menuStats: HTMLButtonElement; menuFunds: HTMLButtonElement; menuFull: HTMLButtonElement;
  padHints: HTMLElement;
  btnNewSession: HTMLButtonElement; btnResetStats: HTMLButtonElement; btnQuit: HTMLButtonElement;
  confirm: Modal; confirmText: HTMLElement; confirmYes: HTMLButtonElement; confirmNo: HTMLButtonElement;
  slip: HTMLElement; slipKanji: HTMLElement; slipName: HTMLElement; slipMeaning: HTMLElement; slipPrize: HTMLElement; slipNote: HTMLElement;
  debug: HTMLElement; debugBody: HTMLElement; debugArmed: HTMLElement;
  toast: HTMLElement;
  pressPrompt: HTMLElement;
}

export function buildHud(root: HTMLElement): Hud {
  const btn = (cls: string, text: string, title = '') => h('button', { class: 'btn ' + cls, title }, text) as HTMLButtonElement;

  const title = h('div', { id: 'title' },
    h('div', { class: 'title-main' }, 'Sakura Fortune'),
    h('div', { class: 'title-sub' }, 'Spring festival · play money only'));

  // top-right icon buttons: one drawn icon set, grouped on a lacquer rail
  const iconBtn = (name: keyof typeof ICONS, title: string) => {
    const b = h('button', { class: 'btn icon', title, 'aria-label': title, html: ICONS[name] }) as HTMLButtonElement;
    return b;
  };
  const btnInfo = iconBtn('info', 'Paytable and rules');
  const btnStats = iconBtn('stats', 'Stats');
  const btnSettings = iconBtn('settings', 'Settings');
  const btnMute = iconBtn('sound', 'Mute / unmute');
  const btnFull = iconBtn('fullscreen', 'Fullscreen (F11)');
  const topBar = h('div', { id: 'topbar' }, btnInfo, btnStats, btnSettings, btnMute, btnFull);

  // side column: bonus buy, then either the feature guide (base game) or the live feature panel
  const btnBuy = btn('buy', 'BUY BONUS', 'Buy the Torii Path or Free Spins');
  const fpTitle = h('div', { class: 'fp-title' });
  const fpLine1 = h('div', { class: 'fp-line big' });
  const fpLine2 = h('div', { class: 'fp-line' });
  const fpLine3 = h('div', { class: 'fp-line' });
  const featurePanel = h('div', { id: 'featurePanel' }, fpTitle, fpLine1, fpLine2, fpLine3);
  const guideRow = (img: string, how: string, what: string) => h('div', { class: 'guide-row' },
    h('img', { src: svgUrl(img), alt: '' }), h('div', {}, h('div', { class: 'guide-how' }, how), h('div', { class: 'guide-what' }, what)));
  const guide = h('div', { class: 'feature-guide' },
    h('div', { class: 'guide-title' }, 'Festival Features'),
    guideRow(bellSymbol(), '3+ Shrine Bells', 'Lantern Festival free spins'),
    guideRow(maskSymbol(), 'Masks on reels 1 · 3 · 5', 'Torii Path climb'),
    guideRow(omikujiBoxSvg(), 'A spin with no win', 'Omikuji fortune draw'),
    h('div', { class: 'guide-foot' }, 'Every win cascades: ×1 ×2 ×3 ×5'));
  const side = h('div', { id: 'side' }, btnBuy, featurePanel, guide);

  // bottom bar: lacquered rail with three plaques (balance, bet, win) and the spin controls
  const plaque = (label: string, cls: string) => {
    const l = h('div', { class: 'lbl' }, label), v = h('div', { class: 'val' });
    return { el: h('div', { class: 'plaque ' + cls }, l, v), l, v };
  };
  const bal = plaque('BALANCE', 'balance');
  const betB = plaque('BET', 'bet');
  const winB = plaque('WIN', 'win');
  const btnFunds = btn('round mini gold', '+', 'Add free play money');
  bal.el.append(btnFunds);
  const betMinus = btn('round small', '−', 'Lower bet');
  const betPlus = btn('round small', '+', 'Raise bet');
  const btnDenom = btn('chip', '1¢', 'Denomination: value of one credit');
  const btnMoney = btn('chip', 'Show Credits', 'Switch between dollars and credits');
  // bet plaque: − value + on one row, denomination and view chips under it
  betB.v.remove();
  betB.el.append(h('div', { class: 'betrow' }, betMinus, betB.v, betPlus), h('div', { class: 'chips' }, btnDenom, btnMoney));
  const autoBtn = btn('pill', 'AUTO', 'Auto-spin');
  const turboBtn = btn('pill', 'TURBO', 'Faster reels and animations');
  const spinBtn = btn('spin', 'SPIN', 'Spin (Space)');
  const right = h('div', { class: 'hud-right' }, autoBtn, spinBtn, turboBtn);
  const message = h('div', { id: 'message' });
  const hud = h('div', { id: 'hud' }, bal.el, betB.el, winB.el, right);

  // auto menu & denom menu
  const autoMenu = h('div', { class: 'popmenu', id: 'autoMenu' });
  const denomMenu = h('div', { class: 'popmenu', id: 'denomMenu' });

  // bonus buy
  const buy = makeModal('buyModal', 'Buy a Bonus');
  const buyToriiPrice = h('div', { class: 'price' });
  const buyFsPrice = h('div', { class: 'price' });
  const buyTorii = btn('gold', 'BUY');
  const buyFs = btn('gold', 'BUY');
  buy.body.append(h('div', { class: 'buy-cards' },
    h('div', { class: 'buy-card torii' }, h('h3', {}, 'Torii Path'), h('p', {}, 'Climb the 24-stone mountain path: 3 rolls of the die, gates pay 5x, 10x, 20x and 40x, the shrine pays 250x, and lanterns multiply everything.'), h('div', { class: 'cost' }, `${BONUS_BUY.torii}x bet`), buyToriiPrice, buyTorii),
    h('div', { class: 'buy-card fs' }, h('h3', {}, 'Lantern Festival'), h('p', {}, '8 free spins at night plus 2x bet. Every Wild sticks and drifts left; every 3 lanterns lit add 4 spins and raise the multiplier up to x3.'), h('div', { class: 'cost' }, `${BONUS_BUY.freespins}x bet`), buyFsPrice, buyFs)),
  h('p', { class: 'note' }, 'Play money only. Bought features pay the same as natural ones.'));

  // add credits
  const credits = makeModal('creditsModal', 'Add Play Money');
  const creditBtns = ADD_CREDIT_OPTIONS.map((n) => btn('gold', `+$${n.toLocaleString()}`));
  const creditInput = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Any amount, e.g. 250', maxlength: '10' }) as HTMLInputElement;
  const creditHint = h('div', { class: 'hint' });
  const creditAddBtn = btn('gold', 'Add');
  credits.body.append(
    h('p', {}, 'Free fictional money for play. It has no cash value and nothing can be bought with it.'),
    h('div', { class: 'row' }, ...creditBtns),
    h('div', { class: 'row' }, h('span', {}, '$'), creditInput, creditAddBtn),
    creditHint,
    h('p', { class: 'note' }, `Up to $${ADD_CREDIT_MAX.toLocaleString()} per add.`));

  // settings
  const settings = makeModal('settingsModal', 'Menu & Settings');
  // shortcuts so a controller can reach every panel from here (Start opens this menu)
  const menuRules = btn('', 'Rules & Pays');
  const menuStats = btn('', 'Stats');
  const menuFunds = btn('gold', 'Add Play Money');
  const menuFull = btn('', 'Fullscreen');
  const slider = (v: string) => h('input', { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': v }) as HTMLInputElement;
  const vol = { master: slider('Master volume'), music: slider('Music volume'), sfx: slider('Sound effects volume') };
  const muteBox = h('input', { type: 'checkbox' }) as HTMLInputElement;
  const motionSel = h('select', {}, h('option', { value: 'auto' }, 'Follow system'), h('option', { value: 'on' }, 'Reduced'), h('option', { value: 'off' }, 'Full')) as HTMLSelectElement;
  const padList = h('div', { class: 'pads' });
  const btnNewSession = btn('', 'New session');
  const btnResetStats = btn('red', 'Reset all stats');
  const btnQuit = btn('red', 'Quit game');
  settings.body.append(
    h('div', { class: 'row menu-row' }, menuRules, menuStats, menuFunds, menuFull),
    h('label', { class: 'setting' }, 'Master', vol.master), h('label', { class: 'setting' }, 'Music', vol.music), h('label', { class: 'setting' }, 'Effects', vol.sfx),
    h('label', { class: 'setting' }, 'Mute', muteBox), h('label', { class: 'setting' }, 'Motion', motionSel),
    h('h4', {}, 'Controllers'), padList,
    h('div', { class: 'row' }, btnNewSession, btnResetStats, btnQuit));

  // confirm dialog
  const confirm = makeModal('confirmModal', null);
  const confirmText = h('p', { class: 'confirm-text' });
  const confirmYes = btn('gold', 'Yes');
  const confirmNo = btn('', 'Cancel');
  confirm.body.append(confirmText, h('div', { class: 'row' }, confirmYes, confirmNo));

  // Omikuji slip card (kanji with its reading and meaning)
  const slipKanji = h('div', { class: 'slip-kanji', lang: 'ja' });
  const slipName = h('div', { class: 'slip-name' });
  const slipMeaning = h('div', { class: 'slip-meaning' });
  const slipPrize = h('div', { class: 'slip-prize' });
  const slipNote = h('div', { class: 'slip-note' });
  const pine = h('img', { class: 'pine', src: svgUrl(pineBranchSvg()), alt: 'Pine branch' });
  const slip = h('div', { id: 'slip' }, pine, h('div', { class: 'slip-paper' }, slipKanji, slipName, slipMeaning, slipPrize, slipNote));

  // debug
  const debugArmed = h('div', { class: 'armed' });
  const debugBody = h('div', { class: 'dbg-body' });
  const debug = h('div', { id: 'debug' }, h('h3', {}, 'Debug (Ctrl+D)'), debugArmed, debugBody);

  const toast = h('div', { id: 'toast' });
  const pressPrompt = h('div', { id: 'pressPrompt' });
  // controller button guide (visible only while a controller is in use)
  const padHints = h('div', { id: 'padHints' });

  root.append(title, topBar, side, message, hud, autoMenu, denomMenu, buy.bg, credits.bg, settings.bg, confirm.bg, slip, debug, toast, pressPrompt, padHints);
  return {
    root, title, balance: bal.v, balanceLabel: bal.l, bet: betB.v, betLabel: betB.l, win: winB.v, winLabel: winB.l, message,
    spinBtn, autoBtn, turboBtn, betMinus, betPlus, btnDenom, btnMoney, btnBuy, btnInfo, btnStats, btnSettings, btnFull, btnFunds, btnMute,
    featurePanel, fpTitle, fpLine1, fpLine2, fpLine3, autoMenu, denomMenu,
    buy, buyTorii, buyFs, buyToriiPrice, buyFsPrice,
    credits, creditBtns, creditInput, creditHint, creditAddBtn,
    settings, vol, muteBox, motionSel, padList, menuRules, menuStats, menuFunds, menuFull, padHints, btnNewSession, btnResetStats, btnQuit,
    confirm, confirmText, confirmYes, confirmNo,
    slip, slipKanji, slipName, slipMeaning, slipPrize, slipNote,
    debug, debugBody, debugArmed, toast, pressPrompt,
  };
}
