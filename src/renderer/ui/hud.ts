import { h, makeModal, svgUrl, type Modal } from './dom';
import { pineBranchSvg } from '../art/svg';
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

  // top-right icon buttons
  const btnInfo = btn('icon', 'i', 'Paytable and rules');
  const btnStats = btn('icon', '☰', 'Stats');
  const btnSettings = btn('icon', '⚙', 'Settings');
  const btnMute = btn('icon', '♪', 'Mute / unmute');
  const btnFull = btn('icon', '⛶', 'Fullscreen (F11)');
  const btnFunds = btn('gold small', '+ Funds', 'Add free play money');
  const topBar = h('div', { id: 'topbar' }, btnFunds, btnInfo, btnStats, btnSettings, btnMute, btnFull);

  // side panel: bonus buy + feature status
  const btnBuy = btn('buy', 'BUY BONUS', 'Buy the Torii Path or Free Spins');
  const fpTitle = h('div', { class: 'fp-title' });
  const fpLine1 = h('div', { class: 'fp-line big' });
  const fpLine2 = h('div', { class: 'fp-line' });
  const fpLine3 = h('div', { class: 'fp-line' });
  const featurePanel = h('div', { id: 'featurePanel' }, fpTitle, fpLine1, fpLine2, fpLine3);
  const side = h('div', { id: 'side' }, btnBuy, featurePanel);

  // bottom bar
  const box = (label: string, cls = '') => {
    const l = h('div', { class: 'lbl' }, label), v = h('div', { class: 'val' });
    return { el: h('div', { class: 'box ' + cls }, l, v), l, v };
  };
  const bal = box('BALANCE', 'balance');
  const betB = box('BET');
  const winB = box('WIN', 'win');
  const betMinus = btn('round small', '−', 'Lower bet');
  const betPlus = btn('round small', '+', 'Raise bet');
  const btnDenom = btn('chip', '1¢', 'Denomination: value of one credit');
  const btnMoney = btn('chip', 'Show Credits', 'Switch between dollars and credits');
  const autoBtn = btn('pill', 'AUTO', 'Auto-spin');
  const turboBtn = btn('pill', 'TURBO', 'Faster reels and animations');
  const spinBtn = btn('spin', 'SPIN', 'Spin (Space)');
  const betGroup = h('div', { class: 'betgroup' }, betMinus, betB.el, betPlus);
  const left = h('div', { class: 'hud-left' }, bal.el, h('div', { class: 'chips' }, btnDenom, btnMoney));
  const right = h('div', { class: 'hud-right' }, autoBtn, spinBtn, turboBtn);
  const message = h('div', { id: 'message' });
  const hud = h('div', { id: 'hud' }, left, betGroup, winB.el, right);

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
  const settings = makeModal('settingsModal', 'Settings');
  const slider = (v: string) => h('input', { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': v }) as HTMLInputElement;
  const vol = { master: slider('Master volume'), music: slider('Music volume'), sfx: slider('Sound effects volume') };
  const muteBox = h('input', { type: 'checkbox' }) as HTMLInputElement;
  const motionSel = h('select', {}, h('option', { value: 'auto' }, 'Follow system'), h('option', { value: 'on' }, 'Reduced'), h('option', { value: 'off' }, 'Full')) as HTMLSelectElement;
  const padList = h('div', { class: 'pads' });
  const btnNewSession = btn('', 'New session');
  const btnResetStats = btn('red', 'Reset all stats');
  const btnQuit = btn('red', 'Quit game');
  settings.body.append(
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

  root.append(title, topBar, side, message, hud, autoMenu, denomMenu, buy.bg, credits.bg, settings.bg, confirm.bg, slip, debug, toast, pressPrompt);
  return {
    root, title, balance: bal.v, balanceLabel: bal.l, bet: betB.v, betLabel: betB.l, win: winB.v, winLabel: winB.l, message,
    spinBtn, autoBtn, turboBtn, betMinus, betPlus, btnDenom, btnMoney, btnBuy, btnInfo, btnStats, btnSettings, btnFull, btnFunds, btnMute,
    featurePanel, fpTitle, fpLine1, fpLine2, fpLine3, autoMenu, denomMenu,
    buy, buyTorii, buyFs, buyToriiPrice, buyFsPrice,
    credits, creditBtns, creditInput, creditHint, creditAddBtn,
    settings, vol, muteBox, motionSel, padList, btnNewSession, btnResetStats, btnQuit,
    confirm, confirmText, confirmYes, confirmNo,
    slip, slipKanji, slipName, slipMeaning, slipPrize, slipNote,
    debug, debugBody, debugArmed, toast, pressPrompt,
  };
}
