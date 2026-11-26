import { h, makeModal, svgUrl } from './dom';
import { SYMBOL_SVGS } from '../art/svg';
import { PAYTABLE, SYMBOL_NAMES, SYM, PAYLINES, OMIKUJI_SLIPS, TORII, FREE_SPINS, BONUS_BUY, MAX_WIN_X, WIN_TIERS, CASCADE_MULTS } from '../../config/math';
import { fmt } from '../scene/symbols';

const TABS = ['Paytable', 'Paylines', 'Features', 'Rules'];

/** Paytable and rules (pays are shown at the current bet). */
export class Paytable {
  modal = makeModal('paytable', 'Paytable & Rules');
  tab = 0;
  tabs: HTMLButtonElement[] = [];
  content = h('div', { class: 'pt-content' });
  private imgs: string[] = SYMBOL_SVGS.map((f) => svgUrl(f()));
  constructor(private bet: () => number, private click: () => void) {
    const bar = h('div', { class: 'tabs' });
    TABS.forEach((t, i) => {
      const b = h('button', { class: 'btn tab' }, t) as HTMLButtonElement;
      b.addEventListener('click', () => { this.click(); this.tab = i; this.render(); });
      this.tabs.push(b);
      bar.append(b);
    });
    this.modal.modal.classList.add('wide');
    this.modal.body.append(bar, this.content);
  }
  open() { this.render(); this.modal.open(); }
  render() {
    this.tabs.forEach((b, i) => b.classList.toggle('on', i === this.tab));
    const c = this.content;
    c.innerHTML = '';
    const bet = this.bet();
    const pay = (x: number) => `${fmt(x * bet)}`;
    if (this.tab === 0) {
      const card = (s: number) => h('div', { class: 'pt-card' },
        h('img', { src: this.imgs[s], alt: SYMBOL_NAMES[s] }),
        h('div', { class: 'pt-name' }, SYMBOL_NAMES[s]),
        h('div', { class: 'pt-pays' }, ...[5, 4, 3].map((n) => h('div', {}, h('b', {}, `${n}×`), ' ', pay(PAYTABLE[s][n - 3])))));
      c.append(
        h('p', { class: 'note' }, `Pays at your current bet (${fmt(bet)}). Line wins pay left to right from reel 1, 3 or more in a row on any of the 25 lines. Pays are multiples of the total bet; the highest win on each line counts.`),
        h('div', { class: 'pt-grid' }, ...[SYM.KOI, SYM.TORII, SYM.FAN, SYM.KABUTO, SYM.LANTERN].map(card)),
        h('div', { class: 'pt-grid' }, ...[SYM.MOCHI, SYM.TEACUP, SYM.CRANE, SYM.BAMBOO, SYM.MON].map(card)),
        h('div', { class: 'pt-grid specials' },
          h('div', { class: 'pt-card wide' }, h('img', { src: this.imgs[SYM.WILD] }), h('div', { class: 'pt-name' }, 'Maneki-neko Wild'),
            h('div', { class: 'pt-text' }, `Reels 2, 3 and 4 in the base game. Substitutes for every symbol except the Shrine Bell and Kitsune Mask. Pays on its own: 5× ${pay(25)}, 4× ${pay(5)}, 3× ${pay(2)}.`)),
          h('div', { class: 'pt-card wide' }, h('img', { src: this.imgs[SYM.BELL] }), h('div', { class: 'pt-name' }, 'Shrine Bell (Scatter)'),
            h('div', { class: 'pt-text' }, `Anywhere on the reels. 3, 4 or 5 Bells start the Lantern Festival with 8, 12 or 16 free spins and pay ${pay(2)}, ${pay(5)} or ${pay(20)}.`)),
          h('div', { class: 'pt-card wide' }, h('img', { src: this.imgs[SYM.MASK] }), h('div', { class: 'pt-name' }, 'Kitsune Mask (Bonus)'),
            h('div', { class: 'pt-text' }, 'Reels 1, 3 and 5 only, no line pay. One on each of those reels starts the Torii Path.'))));
    } else if (this.tab === 1) {
      const grid = (rows: number[], i: number) => {
        const g = h('div', { class: 'pl' }, h('div', { class: 'pl-n' }, String(i + 1)));
        const cells = h('div', { class: 'pl-cells' });
        for (let row = 0; row < 3; row++) for (let r = 0; r < 5; r++) cells.append(h('div', { class: 'pl-c' + (rows[r] === row ? ' on' : '') }));
        g.append(cells);
        return g;
      };
      c.append(h('p', { class: 'note' }, '25 fixed paylines, always all active. Wins start on reel 1 and run left to right.'), h('div', { class: 'pl-grid' }, ...PAYLINES.map(grid)));
    } else if (this.tab === 2) {
      const slipRow = (s: (typeof OMIKUJI_SLIPS)[number]) => h('tr', {},
        h('td', {}, h('span', { class: 'kanji', lang: 'ja', title: `${s.name}: ${s.meaning}` }, s.kanji)),
        h('td', {}, s.name), h('td', {}, s.meaning), h('td', {}, `${s.weight}%`), h('td', {}, s.pay ? `${s.pay}× ${pay(s.pay)}` : 'Draw again'));
      c.append(
        h('h3', {}, 'Sakura Cascade (every spin)'),
        h('p', {}, `Winning symbols burst into petals and are removed; the symbols above fall and new ones drop in. Each new win in the same spin pays more: ${CASCADE_MULTS.map((m) => '×' + m).join(', ')} (stays at ×${CASCADE_MULTS[CASCADE_MULTS.length - 1]}). The multiplier resets on every paid spin.`),
        h('h3', {}, 'Omikuji Fortune Draw'),
        h('p', {}, 'On a spin with no win, the shrine box sometimes shakes (about 1 in 75 of those spins). Tap it or press A to draw a fortune slip. Hover a slip name for its meaning.'),
        h('table', { class: 'slips' }, h('tr', {}, h('th', {}, 'Slip'), h('th', {}, 'Reading'), h('th', {}, 'Meaning'), h('th', {}, 'Chance'), h('th', {}, 'Prize')), ...OMIKUJI_SLIPS.map(slipRow)),
        h('p', { class: 'note' }, 'A Kyo slip is tied to the pine branch to leave the bad luck behind, and you draw again from the four good slips.'),
        h('h3', {}, 'Torii Path'),
        h('p', {}, `Kitsune Masks on reels 1, 3 and 5 start the climb: a ${TORII.length}-stone path up the mountain under torii gates at stones ${TORII.gates.join(', ')}, to the shrine at stone ${TORII.length}. You have ${TORII.startRolls} rolls of a die (press SPIN, tap or press A to roll) and a fox hops along. Passing or landing on a gate pays ${TORII.gatePays.map((g) => pay(g)).join(', ')} in order. Reaching the shrine pays ${pay(TORII.summitPay)} and ends the climb. The stones are laid out differently every time:`),
        h('ul', {},
          h('li', {}, h('b', {}, 'Offering: '), `${pay(1)} to ${pay(10)} (the amount is shown on the stone).`),
          h('li', {}, h('b', {}, 'Lantern: '), `end multiplier +1 (starts at ×1, up to ×${TORII.maxMult}).`),
          h('li', {}, h('b', {}, 'Ema plaque: '), '+1 roll.'),
          h('li', {}, h('b', {}, 'Fox spirit: '), 'jump ahead to the next gate (it pays).'),
          h('li', {}, h('b', {}, 'Mist: '), 'nothing happens.')),
        h('p', {}, 'At the end every prize collected is multiplied by the lantern multiplier.'),
        h('h3', {}, 'Lantern Festival Free Spins'),
        h('p', {}, `3, 4 or 5 Shrine Bells: ${FREE_SPINS.spins.join(', ')} free spins plus ${FREE_SPINS.scatterPay.map((x) => pay(x)).join(', ')}. The village turns to night. Every Wild that lands sticks and drifts one reel left each spin until it leaves reel 1 (Wilds can land on reels 2 to 5). A payline that runs through a sticky Wild pays at most once per spin. Every Shrine Bell lights a lantern; every ${FREE_SPINS.lanternsPerStep} lanterns add ${FREE_SPINS.extraSpins} spins and raise the multiplier ×1 → ×2 → ×3 (top). Cascades continue, and the cascade and lantern multipliers multiply. No Torii Path or Omikuji during free spins.`),
        h('h3', {}, 'Bonus Buy'),
        h('p', {}, `Torii Path for ${BONUS_BUY.torii}× bet (${pay(BONUS_BUY.torii)}), Lantern Festival for ${BONUS_BUY.freespins}× bet (${pay(BONUS_BUY.freespins)}, 8 spins plus ${pay(2)}).`));
    } else {
      c.append(
        h('h3', {}, 'Play money only'),
        h('p', {}, 'Sakura Fortune uses free, fictional money. It has no cash value, cannot be withdrawn, and nothing in the game can be bought with real money. Add more at any time with + Funds.'),
        h('h3', {}, 'Money'),
        h('p', {}, 'Your wallet is kept in dollars. The denomination (1¢ to $1) sets the value of one credit; bets are 25, 50, 75, 100, 250, 500 or 1,000 credits. Use Show Credits / Show in $ to switch how amounts are shown. The odds are the same at every bet and denomination.'),
        h('h3', {}, 'Return to player'),
        h('p', {}, `Designed for a long-run return of about 96% (measured by simulation over 10 million spins, each bonus buy too). Medium volatility. The total win from one spin or buy, including its features, is capped at ${MAX_WIN_X.toLocaleString()}× bet.`),
        h('h3', {}, 'Win celebrations'),
        h('p', {}, WIN_TIERS.slice().reverse().map((t) => `${t.name}: ${t.x}× bet`).join(' · ')),
        h('h3', {}, 'Malfunction'),
        h('p', {}, 'Every result is decided the moment you spin and is credited and saved before the animation plays. If the game closes mid-feature, the win is already in your balance.'));
    }
  }
}
