/**
 * Sakura Fortune game engine: pure logic shared by the game, the tests and the simulator.
 *
 * Every play returns a complete, already-settled script of what happened (each cascade step,
 * each free spin, each Torii Path roll, each Omikuji draw). The renderer only replays it,
 * so a win is credited and saved before any animation starts.
 *
 * All win values inside the engine are in x bet; `amount` fields are x bet * bet.
 */
import {
  SYM, PAYTABLE, PAYLINES, REELS, ROWS, BASE_COUNTS, FS_COUNTS, STRIP_SEED, SPECIAL_GAP, CASCADE_MULTS,
  OMIKUJI_CHANCE, OMIKUJI_SLIPS, TORII, FREE_SPINS, BONUS_BUY, MAX_WIN_X,
  type Sym, type SlipKey, type ToriiSpaceType,
} from '../config/math';
import { makeRng, pickWeighted, type Rng } from './rng';

export type Board = Sym[][]; // board[reel][row], row 0 = top
export type Cell = [reel: number, row: number];

// ======================= reel strips =======================

/** Builds one strip from symbol counts: seeded shuffle, repaired until special symbols are spaced apart. */
export function buildStrip(counts: number[], rng: Rng): Sym[] {
  const syms: Sym[] = [];
  counts.forEach((n, s) => { for (let i = 0; i < n; i++) syms.push(s); });
  const ok = (a: Sym[]) => {
    for (const [sym, gap] of Object.entries(SPECIAL_GAP)) {
      const s = Number(sym);
      const pos = a.map((x, i) => (x === s ? i : -1)).filter((i) => i >= 0);
      for (let i = 0; i < pos.length; i++) {
        const next = i + 1 < pos.length ? pos[i + 1] : pos[0] + a.length;
        if (pos.length > 1 && next - pos[i] < gap) return false;
      }
    }
    // no three identical symbols in a row (keeps the strips looking varied)
    for (let i = 0; i < a.length; i++) if (a[i] === a[(i + 1) % a.length] && a[i] === a[(i + 2) % a.length]) return false;
    return true;
  };
  for (let attempt = 0; attempt < 100000; attempt++) {
    for (let i = syms.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [syms[i], syms[j]] = [syms[j], syms[i]];
    }
    if (ok(syms)) return syms.slice();
  }
  throw new Error('could not build a strip with the required spacing');
}

/** Each reel has its own seed, so changing one reel's counts leaves the other strips as they are. */
function buildStrips(counts: number[][], seed: number): Sym[][] {
  return counts.map((c, i) => buildStrip(c, makeRng(seed + 7919 * (i + 1))));
}
export const STRIPS: Sym[][] = buildStrips(BASE_COUNTS, STRIP_SEED);
export const FS_STRIPS: Sym[][] = buildStrips(FS_COUNTS, STRIP_SEED + 1);

// ======================= line evaluation =======================

export interface LineWin {
  /** payline index 0..24 */
  line: number;
  sym: Sym;
  count: number;
  /** pay in x bet before cascade / lantern multipliers */
  pay: number;
  cells: Cell[];
}

/** Evaluates the 25 paylines left to right. Highest win per line counts; Wild pays on its own if that is higher. */
export function evalLines(board: Board): LineWin[] {
  const wins: LineWin[] = [];
  PAYLINES.forEach((rows, line) => {
    const syms = rows.map((row, reel) => board[reel][row]);
    let wildRun = 0;
    while (wildRun < REELS && syms[wildRun] === SYM.WILD) wildRun++;
    const wildPay = wildRun >= 3 ? PAYTABLE[SYM.WILD][wildRun - 3] : 0;
    const target = syms.find((s) => s !== SYM.WILD);
    let subPay = 0, subCount = 0;
    if (target !== undefined && target < SYM.WILD) {
      while (subCount < REELS && (syms[subCount] === target || syms[subCount] === SYM.WILD)) subCount++;
      if (subCount >= 3) subPay = PAYTABLE[target][subCount - 3];
    }
    if (wildPay === 0 && subPay === 0) return;
    const useWild = wildPay >= subPay;
    const count = useWild ? wildRun : subCount;
    wins.push({
      line, sym: useWild ? SYM.WILD : target!, count, pay: useWild ? wildPay : subPay,
      cells: rows.slice(0, count).map((row, reel) => [reel, row] as Cell),
    });
  });
  return wins;
}

export const countSym = (board: Board, s: Sym) => board.reduce((n, col) => n + col.filter((x) => x === s).length, 0);
export const reelHas = (board: Board, reel: number, s: Sym) => board[reel].includes(s);

// ======================= Sakura Cascade =======================

export interface CascadeStep {
  /** board at the start of this step (before its wins are removed) */
  board: Board;
  /** sticky (locked) cells, free spins only */
  locked: boolean[][];
  wins: LineWin[];
  /** cascade multiplier for this step (x1, x2, x3, x5) */
  mult: number;
  /** win of this step in x bet, cascade multiplier applied (lantern multiplier not applied) */
  win: number;
}
export interface CascadeResult {
  stops: number[];
  steps: CascadeStep[];
  /** sum of step wins in x bet (cascade multipliers applied) */
  win: number;
  finalBoard: Board;
  finalLocked: boolean[][];
}

const emptyLocks = (): boolean[][] => Array.from({ length: REELS }, () => [false, false, false]);
const cloneBoard = (b: Board): Board => b.map((c) => c.slice());
const cloneLocks = (l: boolean[][]) => l.map((c) => c.slice());
const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Plays one spin with cascades. `locked` cells (free spins sticky Wilds) hold a Wild and never move;
 * other symbols fall past them. In free spins (`stickyWilds`), every Wild that lands locks immediately.
 * New symbols come from the strip above each reel's stop, so strip composition sets the odds.
 */
export function runCascades(rng: Rng, strips: Sym[][], locked0: boolean[][] | null, stickyWilds: boolean, stops?: number[]): CascadeResult {
  const locked = locked0 ? cloneLocks(locked0) : emptyLocks();
  const board: Board = [];
  const ptr: number[] = [];
  const st = stops ?? strips.map((s) => Math.floor(rng() * s.length));
  for (let r = 0; r < REELS; r++) {
    const strip = strips[r];
    const col: Sym[] = [];
    let k = 0;
    for (let row = 0; row < ROWS; row++) {
      if (locked[r][row]) col.push(SYM.WILD);
      else col.push(strip[mod(st[r] + k++, strip.length)]);
    }
    board.push(col);
    ptr.push(st[r] - 1);
  }
  const lockNewWilds = () => {
    if (!stickyWilds) return;
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) if (board[r][row] === SYM.WILD) locked[r][row] = true;
  };
  lockNewWilds();
  const steps: CascadeStep[] = [];
  let total = 0;
  // a payline that runs through a sticky Wild pays at most once per spin (sticky Wilds never burst,
  // so without this two of them side by side would win again on every cascade, forever)
  const stickyPaid = new Set<number>();
  for (let i = 0; ; i++) {
    const usesSticky = (w: LineWin) => w.cells.some(([r, row]) => locked[r][row]);
    const wins = evalLines(board).filter((w) => !(usesSticky(w) && stickyPaid.has(w.line)));
    for (const w of wins) if (usesSticky(w)) stickyPaid.add(w.line);
    const mult = CASCADE_MULTS[Math.min(i, CASCADE_MULTS.length - 1)];
    const win = wins.reduce((s, w) => s + w.pay, 0) * mult;
    steps.push({ board: cloneBoard(board), locked: cloneLocks(locked), wins, mult, win });
    if (!wins.length) break;
    total += win;
    // remove winning symbols (sticky Wilds stay), drop the rest, refill from the strip above
    const remove = emptyLocks();
    for (const w of wins) for (const [r, row] of w.cells) if (!locked[r][row]) remove[r][row] = true;
    for (let r = 0; r < REELS; r++) {
      const slots = [0, 1, 2].filter((row) => !locked[r][row]);
      const survivors = slots.filter((row) => !remove[r][row]).map((row) => board[r][row]);
      const k = slots.length - survivors.length;
      if (!k) continue;
      const strip = strips[r];
      const fresh: Sym[] = [];
      for (let j = k - 1; j >= 0; j--) fresh.push(strip[mod(ptr[r] - j, strip.length)]);
      ptr[r] -= k;
      const col = [...fresh, ...survivors];
      slots.forEach((row, j) => { board[r][row] = col[j]; });
    }
    lockNewWilds();
    if (i > 200) break; // safety: cannot happen with real strips
  }
  return { stops: st, steps, win: total, finalBoard: cloneBoard(board), finalLocked: cloneLocks(locked) };
}

// ======================= Omikuji =======================

export interface OmikujiResult {
  /** slips drawn in order: a Kyo is followed by a guaranteed good slip */
  draws: SlipKey[];
  pay: number;
}
export function drawOmikuji(rng: Rng, force?: SlipKey): OmikujiResult {
  const first = force ? OMIKUJI_SLIPS.find((s) => s.key === force)! : pickWeighted(rng, OMIKUJI_SLIPS);
  const draws: SlipKey[] = [first.key];
  let prize = first;
  if (first.key === 'kyo') {
    prize = pickWeighted(rng, OMIKUJI_SLIPS.filter((s) => s.key !== 'kyo'));
    draws.push(prize.key);
  }
  return { draws, pay: prize.pay };
}

// ======================= Torii Path =======================

export type ToriiSpace =
  | { type: 'start' }
  | { type: 'gate'; gate: number; pay: number }
  | { type: 'summit'; pay: number }
  | { type: 'offering'; pay: number }
  | { type: 'lantern' } | { type: 'ema' } | { type: 'fox' } | { type: 'mist' };

export interface ToriiRoll {
  die: number;
  from: number;
  /** space reached by the die */
  to: number;
  /** final position after a Fox spirit jump (else = to) */
  end: number;
  /** gates paid on this roll (index into TORII.gates), in order */
  gates: number[];
  /** what happened on the landing space */
  effect: 'offering' | 'lantern' | 'ema' | 'fox' | 'mist' | 'gate' | 'summit';
  /** prize collected on this roll in x bet (gates + offering + summit), before the lantern multiplier */
  pay: number;
  rollsLeft: number;
  mult: number;
  /** running total before the multiplier */
  collected: number;
}
export interface ToriiResult {
  spaces: ToriiSpace[];
  startRolls: number;
  rolls: ToriiRoll[];
  /** sum of prizes before the lantern multiplier, x bet */
  collected: number;
  mult: number;
  summit: boolean;
  /** final win in x bet (collected x mult, capped by the caller) */
  win: number;
}

/** Random layout of the 24-space path: gates at 5/10/15/20, summit at 24, the rest weighted. */
export function makeToriiLayout(rng: Rng): ToriiSpace[] {
  const spaces: ToriiSpace[] = [{ type: 'start' }];
  const lastGate = TORII.gates[TORII.gates.length - 1];
  for (let i = 1; i < TORII.length; i++) {
    const g = TORII.gates.indexOf(i);
    if (g >= 0) { spaces.push({ type: 'gate', gate: g, pay: TORII.gatePays[g] }); continue; }
    const items = (Object.entries(TORII.spaceWeights) as [ToriiSpaceType, number][])
      .filter(([t]) => !(t === 'fox' && i > lastGate))
      .map(([type, weight]) => ({ type, weight }));
    const t = pickWeighted(rng, items).type;
    if (t === 'offering') spaces.push({ type: 'offering', pay: pickWeighted(rng, TORII.offerings).pay });
    else spaces.push({ type: t } as ToriiSpace);
  }
  spaces.push({ type: 'summit', pay: TORII.summitPay });
  return spaces;
}

export function playTorii(rng: Rng, layout?: ToriiSpace[], dice?: number[]): ToriiResult {
  const spaces = layout ?? makeToriiLayout(rng);
  let pos = 0, rolls = TORII.startRolls, mult = 1, collected = 0, nextGate = 0, summit = false;
  const out: ToriiRoll[] = [];
  const passGates = (to: number, list: number[]) => {
    let pay = 0;
    while (nextGate < TORII.gates.length && TORII.gates[nextGate] <= to) { pay += TORII.gatePays[nextGate]; list.push(nextGate); nextGate++; }
    return pay;
  };
  let di = 0;
  while (rolls > 0) {
    rolls--;
    const die = dice && di < dice.length ? dice[di++] : 1 + Math.floor(rng() * 6);
    const from = pos;
    const to = Math.min(TORII.length, pos + die);
    const gates: number[] = [];
    let pay = passGates(to, gates);
    let end = to;
    let effect: ToriiRoll['effect'];
    if (to >= TORII.length) {
      effect = 'summit'; pay += TORII.summitPay; summit = true;
    } else {
      const sp = spaces[to];
      switch (sp.type) {
        case 'offering': effect = 'offering'; pay += sp.pay; break;
        case 'lantern': effect = 'lantern'; mult = Math.min(TORII.maxMult, mult + 1); break;
        case 'ema': effect = 'ema'; rolls++; break;
        case 'fox': {
          effect = 'fox';
          const g = TORII.gates.find((x) => x > to);
          if (g !== undefined) { end = g; pay += passGates(g, gates); }
          break;
        }
        case 'gate': effect = 'gate'; break;
        default: effect = 'mist';
      }
    }
    pos = end;
    collected += pay;
    out.push({ die, from, to, end, gates, effect, pay, rollsLeft: summit ? 0 : rolls, mult, collected });
    if (summit) break;
  }
  return { spaces, startRolls: TORII.startRolls, rolls: out, collected, mult, summit, win: collected * mult };
}

// ======================= Lantern Festival Free Spins =======================

export interface FreeSpin {
  /** 1-based spin number */
  n: number;
  /** spins left after this one (including any added by it) */
  left: number;
  /** sticky Wild positions at the start of the spin (after drifting one reel left) */
  stickyStart: Cell[];
  cascade: CascadeResult;
  bells: number;
  /** lantern multiplier used for this spin */
  mult: number;
  lanternsAfter: number;
  /** spins added by this spin (every 3 lanterns: +4) */
  added: number;
  multAfter: number;
  /** spin win in x bet (cascade x lantern multipliers) */
  win: number;
}
export interface FreeSpinsResult {
  bells: number;
  awarded: number;
  scatterPay: number;
  spins: FreeSpin[];
  lanterns: number;
  retriggers: number;
  finalMult: number;
  /** total in x bet, including the scatter pay */
  win: number;
  capped: boolean;
}

export function playFreeSpins(rng: Rng, bells: number, capX = MAX_WIN_X): FreeSpinsResult {
  const idx = Math.max(0, Math.min(2, bells - 3));
  const awarded = FREE_SPINS.spins[idx];
  const scatterPay = FREE_SPINS.scatterPay[idx];
  let left = awarded, mult = 1, lanterns = 0, retriggers = 0, n = 0, win = Math.min(scatterPay, capX), capped = scatterPay >= capX;
  let sticky = emptyLocks();
  const spins: FreeSpin[] = [];
  while (left > 0 && n < FREE_SPINS.maxSpins && !capped) {
    left--; n++;
    // sticky Wilds drift one reel left; those on reel 1 leave
    const drifted = emptyLocks();
    for (let r = 1; r < REELS; r++) for (let row = 0; row < ROWS; row++) if (sticky[r][row]) drifted[r - 1][row] = true;
    const stickyStart: Cell[] = [];
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) if (drifted[r][row]) stickyStart.push([r, row]);
    const cascade = runCascades(rng, FS_STRIPS, drifted, true);
    const b = countSym(cascade.finalBoard, SYM.BELL);
    const usedMult = mult;
    let spinWin = cascade.win * usedMult;
    if (win + spinWin >= capX) { spinWin = capX - win; capped = true; }
    win += spinWin;
    const before = Math.floor(lanterns / FREE_SPINS.lanternsPerStep);
    lanterns += b;
    const steps = Math.floor(lanterns / FREE_SPINS.lanternsPerStep) - before;
    let added = 0;
    for (let s = 0; s < steps; s++) {
      added += FREE_SPINS.extraSpins; retriggers++;
      mult = Math.min(FREE_SPINS.maxMult, mult + 1);
    }
    left += added;
    sticky = cascade.finalLocked;
    spins.push({ n, left: capped ? 0 : left, stickyStart, cascade, bells: b, mult: usedMult, lanternsAfter: lanterns, added, multAfter: mult, win: spinWin });
  }
  return { bells, awarded, scatterPay, spins, lanterns, retriggers, finalMult: mult, win, capped };
}

// ======================= spins & buys =======================

export type FeatureKind = 'freespins' | 'torii';
export interface ForceOptions {
  /** force this feature to trigger on the next spin */
  feature?: FeatureKind | 'omikuji';
  /** free spins trigger size */
  bells?: 3 | 4 | 5;
  /** Omikuji: first slip drawn */
  slip?: SlipKey;
  /** Torii Path reaches the summit */
  summit?: boolean;
  /** free spins include at least one lantern retrigger */
  retrigger?: boolean;
}

export interface SpinResult {
  kind: 'spin' | 'buy';
  bought: FeatureKind | null;
  bet: number;
  cost: number;
  /** base game cascades (null for a bonus buy) */
  base: CascadeResult | null;
  baseWin: number;
  bells: number;
  masks: number;
  omikuji: OmikujiResult | null;
  freeSpins: FreeSpinsResult | null;
  torii: ToriiResult | null;
  /** total in x bet after the cap */
  winX: number;
  /** total win in money (winX x bet) */
  totalWin: number;
  capped: boolean;
  forced: boolean;
}

const money = (x: number, bet: number) => Math.round(x * bet * 1e6) / 1e6;

/** Plays the features a spin triggered and assembles the result (cap applied in order: base, scatter+free spins, Torii, Omikuji). */
function settle(rng: Rng, bet: number, base: CascadeResult | null, opts: {
  kind: 'spin' | 'buy'; bought: FeatureKind | null; cost: number; fs: number; torii: boolean; omikuji: boolean; force?: ForceOptions | null;
}): SpinResult {
  const force = opts.force ?? undefined;
  let winX = Math.min(base?.win ?? 0, MAX_WIN_X);
  let capped = (base?.win ?? 0) >= MAX_WIN_X;
  let freeSpins: FreeSpinsResult | null = null, torii: ToriiResult | null = null, omikuji: OmikujiResult | null = null;
  if (opts.fs && !capped) {
    for (let tries = 0; ; tries++) {
      freeSpins = playFreeSpins(rng, opts.fs, MAX_WIN_X - winX);
      if (!force?.retrigger || freeSpins.retriggers > 0 || tries > 5000) break;
    }
    winX += freeSpins.win;
    capped = capped || freeSpins.capped;
  }
  if (opts.torii && !capped) {
    for (let tries = 0; ; tries++) {
      torii = playTorii(rng);
      if (!force?.summit || torii.summit || tries > 20000) break;
    }
    const room = MAX_WIN_X - winX;
    if (torii.win >= room) { torii.win = room; capped = true; }
    winX += torii.win;
  }
  if (opts.omikuji && !capped) {
    omikuji = drawOmikuji(rng, force?.slip);
    winX += Math.min(omikuji.pay, MAX_WIN_X - winX);
  }
  return {
    kind: opts.kind, bought: opts.bought, bet, cost: opts.cost, base,
    baseWin: money(Math.min(base?.win ?? 0, MAX_WIN_X), bet),
    bells: base ? countSym(base.finalBoard, SYM.BELL) : 0,
    masks: base ? [0, 2, 4].filter((r) => reelHas(base.finalBoard, r, SYM.MASK)).length : 0,
    omikuji, freeSpins, torii, winX, totalWin: money(winX, bet), capped, forced: !!force,
  };
}

/** Which features a finished base board triggers. */
export function baseTriggers(base: CascadeResult) {
  const bells = Math.min(5, countSym(base.finalBoard, SYM.BELL));
  const torii = [0, 2, 4].every((r) => reelHas(base.finalBoard, r, SYM.MASK));
  return { fs: bells >= 3 ? bells : 0, torii };
}

/**
 * Debug: reel stops that show a Shrine Bell on exactly `bells` randomly chosen reels and none on the others.
 * They are real strip positions, so the board is one the game can really produce; cascades may still drop
 * extra Bells, which the caller checks.
 */
function bellStops(rng: Rng, bells: number): number[] {
  const reels = [0, 1, 2, 3, 4].sort(() => rng() - 0.5).slice(0, bells);
  return STRIPS.map((strip, r) => {
    const want = reels.includes(r);
    const ok: number[] = [];
    for (let s = 0; s < strip.length; s++) {
      const has = [0, 1, 2].some((k) => strip[(s + k) % strip.length] === SYM.BELL);
      if (has === want) ok.push(s);
    }
    return ok[Math.floor(rng() * ok.length)];
  });
}

/** One paid base-game spin. `force` (debug) re-rolls until the requested event happens. */
export function playSpin(rng: Rng, bet: number, force?: ForceOptions | null): SpinResult {
  const wantBells = force?.feature === 'freespins' ? (force.bells ?? 3) : 0;
  for (let tries = 0; ; tries++) {
    // forced free spins start from stops that already show the Bells (searching blind for 5 could take seconds)
    const base = runCascades(rng, STRIPS, null, false, wantBells ? bellStops(rng, wantBells) : undefined);
    const trig = baseTriggers(base);
    const noWin = base.win === 0 && !trig.fs && !trig.torii;
    const omikuji = noWin && (force?.feature === 'omikuji' || rng() < OMIKUJI_CHANCE);
    if (force?.feature && tries < 2_000_000) {
      const want = force.feature;
      const ok = want === 'freespins' ? trig.fs >= (force.bells ?? 3) && (!force.bells || trig.fs === force.bells) && !trig.torii
        : want === 'torii' ? trig.torii && !trig.fs
        : noWin;
      if (!ok) continue;
    }
    return settle(rng, bet, base, { kind: 'spin', bought: null, cost: bet, fs: trig.fs, torii: trig.torii, omikuji, force });
  }
}

export const bonusBuyCost = (kind: FeatureKind, bet: number) => money(BONUS_BUY[kind], bet);

/** Bonus buy: goes straight to the feature (free spins as a 3-Bell trigger with its 2x pay). */
export function playBonusBuy(rng: Rng, bet: number, kind: FeatureKind, force?: ForceOptions | null): SpinResult {
  return settle(rng, bet, null, {
    kind: 'buy', bought: kind, cost: bonusBuyCost(kind, bet), fs: kind === 'freespins' ? 3 : 0, torii: kind === 'torii', omikuji: false, force,
  });
}

/** Strips as two-letter codes (for `npm run strips`). */
export function stripText(strips = STRIPS) {
  return strips.map((s, i) => `Reel ${i + 1} (${s.length}): ` + s.map((x) => ['KO', 'TO', 'FA', 'KA', 'LA', 'MO', 'TE', 'CR', 'BA', 'MN', 'WD', 'BL', 'MK'][x]).join(' ')).join('\n');
}
