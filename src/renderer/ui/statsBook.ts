import { h, makeModal } from './dom';
import { fmt } from '../scene/symbols';
import { OMIKUJI_SLIPS } from '../../config/math';
import type { StatsBlock } from '../stats';

const TABS = ['Overview', 'Features', 'Omikuji', 'Best Wins', 'Balance'];

/** The stats book: session and all-time records. */
export class StatsBook {
  modal = makeModal('statsBook', 'Festival Records');
  mode: 'session' | 'allTime' = 'session';
  tab = 0;
  tabs: HTMLButtonElement[] = [];
  modeBtn = h('button', { class: 'btn small' }) as HTMLButtonElement;
  content = h('div', { class: 'sb-content' });
  constructor(private get: (m: 'session' | 'allTime') => StatsBlock, private onReset: () => void, private click: () => void) {
    const bar = h('div', { class: 'tabs' });
    TABS.forEach((t, i) => {
      const b = h('button', { class: 'btn tab' }, t) as HTMLButtonElement;
      b.addEventListener('click', () => { this.click(); this.tab = i; this.render(); });
      this.tabs.push(b);
      bar.append(b);
    });
    this.modeBtn.addEventListener('click', () => { this.click(); this.mode = this.mode === 'session' ? 'allTime' : 'session'; this.render(); });
    const reset = h('button', { class: 'btn small red' }, 'Reset stats') as HTMLButtonElement;
    reset.addEventListener('click', () => this.onReset());
    this.modal.modal.classList.add('wide');
    this.modal.body.append(h('div', { class: 'sb-top' }, bar, this.modeBtn, reset), this.content);
  }
  open() { this.render(); this.modal.open(); }
  render() {
    const s = this.get(this.mode);
    this.tabs.forEach((b, i) => b.classList.toggle('on', i === this.tab));
    this.modeBtn.textContent = this.mode === 'session' ? 'This session ▸ All time' : 'All time ▸ This session';
    const c = this.content;
    c.innerHTML = '';
    const row = (k: string, v: string) => h('tr', {}, h('td', {}, k), h('td', {}, v));
    const table = (...rows: [string, string][]) => h('table', { class: 'stats' }, ...rows.map(([k, v]) => row(k, v)));
    const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—');
    const time = (ms: number) => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
    if (this.tab === 0) {
      c.append(table(
        ['Spins', s.spins.toLocaleString()], ['Total bet', fmt(s.wagered)], ['Total won', fmt(s.won)],
        ['Net', fmt(s.won - s.wagered)], ['Return', pct(s.won, s.wagered)], ['Hit rate', pct(s.hits, s.spins)],
        ['Biggest win', `${fmt(s.biggestWin)} (${s.biggestWinX}× bet)`], ['Longest dry spell', `${s.longestWinless} spins`], ['Best winning streak', `${s.bestWinStreak} spins`],
        ['Cascades', `${s.cascades.toLocaleString()} (best chain ${s.bestCascade})`],
        ['Big / Mega / Daikichi wins', ['Big Win', 'Mega Win', 'Daikichi Win'].map((k) => s.tiers[k] || 0).join(' / ')],
        ['Play money added', fmt(s.creditsAdded)], ['Time played', time(s.timeMs)],
        ['Debug actions (not counted)', String(s.debugActions)]));
    } else if (this.tab === 1) {
      c.append(h('h3', {}, 'Lantern Festival'), table(
        ['Triggered / bought', `${s.fsNatural} / ${s.fsBought}`], ['Spins played', String(s.fsSpins)], ['Total won', fmt(s.fsWin)], ['Best', fmt(s.fsBest)],
        ['Lantern retriggers', String(s.fsRetriggers)], ['Highest multiplier', `×${s.fsBestMult}`]));
      c.append(h('h3', {}, 'Torii Path'), table(
        ['Triggered / bought', `${s.toriiNatural} / ${s.toriiBought}`], ['Total won', fmt(s.toriiWin)], ['Best', fmt(s.toriiBest)],
        ['Shrine reached', String(s.summits)], ['Highest lantern multiplier', `×${s.bestLantern}`]));
      c.append(h('h3', {}, 'Bonus buys'), table(['Torii Path / Free Spins', `${s.buysTorii} / ${s.buysFreeSpins}`], ['Spent', fmt(s.buySpent)]));
    } else if (this.tab === 2) {
      c.append(table(['Fortune draws', String(s.omikujiDraws)], ['Won from slips', fmt(s.omikujiWin)]),
        h('table', { class: 'stats' }, ...OMIKUJI_SLIPS.map((sl) => h('tr', {},
          h('td', {}, h('span', { class: 'kanji', lang: 'ja', title: `${sl.name}: ${sl.meaning}` }, sl.kanji), ` ${sl.name}`),
          h('td', {}, String(s.omikuji[sl.key] || 0))))));
    } else if (this.tab === 3) {
      c.append(s.hall.length ? h('table', { class: 'stats hall' }, h('tr', {}, h('th', {}, 'Win'), h('th', {}, '× bet'), h('th', {}, 'Bet'), h('th', {}, 'How'), h('th', {}, 'When')),
        ...s.hall.map((e) => h('tr', {}, h('td', {}, fmt(e.amount)), h('td', {}, String(e.x)), h('td', {}, fmt(e.bet)), h('td', {}, e.feature), h('td', {}, new Date(e.date).toLocaleString()))))
        : h('p', {}, 'No wins recorded yet.'));
    } else {
      const pts = s.balance;
      if (pts.length < 2) { c.append(h('p', {}, 'Play a few spins to see your balance over time.')); return; }
      const W = 900, H = 320, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
      const d = pts.map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * W).toFixed(1)},${(H - ((v - min) / span) * (H - 20) - 10).toFixed(1)}`).join(' ');
      const wrap = h('div', { class: 'graph' });
      wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><rect width="${W}" height="${H}" fill="#f5eedc" rx="8"/><path d="${d}" fill="none" stroke="#c8102e" stroke-width="3"/></svg>`;
      c.append(h('p', { class: 'note' }, `Last ${pts.length} results · low ${fmt(min)} · high ${fmt(max)}`), wrap);
    }
  }
}
