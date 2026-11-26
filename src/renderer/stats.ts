import type { SpinResult } from '../engine/game';
import type { SlipKey } from '../config/math';
import { WIN_TIERS } from '../config/math';

export interface HallEntry { amount: number; x: number; bet: number; date: string; feature: string }
export interface StatsBlock {
  spins: number; wagered: number; won: number; hits: number;
  creditsAdded: number; cashOuts: number;
  buysTorii: number; buysFreeSpins: number; buySpent: number;
  biggestWin: number; biggestWinX: number;
  curWinless: number; longestWinless: number; curWinStreak: number; bestWinStreak: number;
  timeMs: number;
  cascades: number; bestCascade: number;
  fsNatural: number; fsBought: number; fsWin: number; fsBest: number; fsRetriggers: number; fsSpins: number; fsBestMult: number;
  toriiNatural: number; toriiBought: number; toriiWin: number; toriiBest: number; summits: number; bestLantern: number;
  omikuji: Record<SlipKey, number>; omikujiWin: number; omikujiDraws: number;
  tiers: Record<string, number>;
  hall: HallEntry[];
  balance: number[];
  winDist: number[];
  debugActions: number;
  startCredits: number;
}

export function newStats(startCredits = 0): StatsBlock {
  return {
    spins: 0, wagered: 0, won: 0, hits: 0, creditsAdded: 0, cashOuts: 0, buysTorii: 0, buysFreeSpins: 0, buySpent: 0,
    biggestWin: 0, biggestWinX: 0, curWinless: 0, longestWinless: 0, curWinStreak: 0, bestWinStreak: 0, timeMs: 0,
    cascades: 0, bestCascade: 0,
    fsNatural: 0, fsBought: 0, fsWin: 0, fsBest: 0, fsRetriggers: 0, fsSpins: 0, fsBestMult: 1,
    toriiNatural: 0, toriiBought: 0, toriiWin: 0, toriiBest: 0, summits: 0, bestLantern: 1,
    omikuji: { daikichi: 0, chukichi: 0, shokichi: 0, kichi: 0, kyo: 0 }, omikujiWin: 0, omikujiDraws: 0,
    tiers: Object.fromEntries(WIN_TIERS.map((t) => [t.name, 0])),
    hall: [], balance: [], winDist: [0, 0, 0, 0, 0, 0], debugActions: 0, startCredits,
  };
}

/** Fill missing fields (older saves). */
export function upgradeStats(s: any, start = 0): StatsBlock {
  const base = newStats(start);
  if (!s) return base;
  const merged: any = { ...base, ...s };
  for (const k of ['omikuji', 'tiers'] as const) merged[k] = { ...(base as any)[k], ...(s[k] || {}) };
  return merged;
}

export function featureLabel(r: SpinResult): string {
  const parts: string[] = [];
  if (r.bought) parts.push(r.bought === 'torii' ? 'Bonus Buy: Torii Path' : 'Bonus Buy: Free Spins');
  else {
    if (r.freeSpins) parts.push(`Lantern Festival (${r.freeSpins.bells} Bells)`);
    if (r.torii) parts.push('Torii Path');
    if (r.omikuji) parts.push('Omikuji');
  }
  if (r.torii?.summit) parts.push('Shrine reached');
  if (!parts.length) parts.push((r.base?.steps.length ?? 0) > 2 ? `Base game, ${r.base!.steps.length - 1} cascades` : 'Base game');
  return parts.join(' · ');
}

/** Money is kept to a millionth of a dollar (pays can be fractions of a cent); it is rounded only for display. */
const r2 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Records a settled result (called before any animation). */
export function recordResult(s: StatsBlock, r: SpinResult, balanceAfter: number) {
  const date = new Date().toISOString();
  const bought = !!r.bought;
  if (!bought) s.spins++;
  s.wagered = r2(s.wagered + r.cost);
  s.won = r2(s.won + r.totalWin);
  if (bought) {
    if (r.bought === 'torii') s.buysTorii++; else s.buysFreeSpins++;
    s.buySpent = r2(s.buySpent + r.cost);
  }
  const x = r.winX;
  if (r.totalWin > s.biggestWin) { s.biggestWin = r.totalWin; s.biggestWinX = r2(x); }
  if (!bought) {
    if (r.totalWin > 0) {
      s.hits++;
      s.curWinStreak++; s.curWinless = 0;
      s.bestWinStreak = Math.max(s.bestWinStreak, s.curWinStreak);
    } else {
      s.curWinless++; s.curWinStreak = 0;
      s.longestWinless = Math.max(s.longestWinless, s.curWinless);
    }
    s.winDist[x === 0 ? 0 : x < 1 ? 1 : x < 5 ? 2 : x < 25 ? 3 : x < 100 ? 4 : 5]++;
  }
  if (r.base) {
    const c = Math.max(0, r.base.steps.length - 2);
    s.cascades += c;
    s.bestCascade = Math.max(s.bestCascade, c);
  }
  for (const t of WIN_TIERS) if (x >= t.x) { s.tiers[t.name] = (s.tiers[t.name] || 0) + 1; break; }
  const fs = r.freeSpins;
  if (fs) {
    if (bought) s.fsBought++; else s.fsNatural++;
    const w = r2(fs.win * r.bet);
    s.fsWin = r2(s.fsWin + w);
    s.fsBest = Math.max(s.fsBest, w);
    s.fsRetriggers += fs.retriggers;
    s.fsSpins += fs.spins.length;
    s.fsBestMult = Math.max(s.fsBestMult, fs.finalMult);
  }
  const t = r.torii;
  if (t) {
    if (bought) s.toriiBought++; else s.toriiNatural++;
    const w = r2(t.win * r.bet);
    s.toriiWin = r2(s.toriiWin + w);
    s.toriiBest = Math.max(s.toriiBest, w);
    if (t.summit) s.summits++;
    s.bestLantern = Math.max(s.bestLantern, t.mult);
  }
  if (r.omikuji) {
    s.omikujiDraws++;
    for (const d of r.omikuji.draws) s.omikuji[d]++;
    s.omikujiWin = r2(s.omikujiWin + r.omikuji.pay * r.bet);
  }
  if (r.totalWin > 0) {
    s.hall.push({ amount: r.totalWin, x: r2(x), bet: r.bet, date, feature: featureLabel(r) });
    s.hall.sort((a, b) => b.amount - a.amount);
    if (s.hall.length > 10) s.hall.length = 10;
  }
  s.balance.push(r2(balanceAfter));
  if (s.balance.length > 500) s.balance.splice(0, s.balance.length - 500);
}
