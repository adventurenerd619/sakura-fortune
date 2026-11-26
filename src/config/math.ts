/**
 * SAKURA FORTUNE - MATH CONFIGURATION
 * ------------------------------------------------------------
 * Every number that affects game outcomes lives in this file:
 * paytable, paylines, reel strips, cascade multipliers, Omikuji slips,
 * Torii Path spaces and prizes, free spins awards, bonus buy prices,
 * the max-win cap and the win tiers.
 *
 * After editing, run `npm run sim` to measure RTP.
 * All "x bet" values are multiples of the TOTAL bet per spin.
 */

// ---------- Symbols ----------
export const SYM = {
  KOI: 0, TORII: 1, FAN: 2, KABUTO: 3, LANTERN: 4,
  MOCHI: 5, TEACUP: 6, CRANE: 7, BAMBOO: 8, MON: 9,
  WILD: 10, BELL: 11, MASK: 12,
} as const;
export type Sym = number;

export const SYMBOL_NAMES = [
  'Golden Koi', 'Torii Gate', 'Paper Fan', 'Kabuto Helmet', 'Paper Lantern',
  'Sakura Mochi', 'Teacup', 'Origami Crane', 'Bamboo', 'Mon Crest',
  'Maneki-neko', 'Shrine Bell', 'Kitsune Mask',
];
/** Two-letter codes (strip printout, tests). */
export const SYMBOL_CODES = ['KO', 'TO', 'FA', 'KA', 'LA', 'MO', 'TE', 'CR', 'BA', 'MN', 'WD', 'BL', 'MK'];
export const NUM_SYMBOLS = 13;

/** Line pays for 3 / 4 / 5 of a kind, in x TOTAL bet. Scatter and Kitsune Mask have no line pay. */
export const PAYTABLE: Record<number, [number, number, number]> = {
  [SYM.KOI]: [1, 3, 10],
  [SYM.TORII]: [0.8, 2, 6],
  [SYM.FAN]: [0.6, 1.5, 4],
  [SYM.KABUTO]: [0.5, 1.2, 3],
  [SYM.LANTERN]: [0.4, 1, 2.5],
  [SYM.MOCHI]: [0.2, 0.5, 1.2],
  [SYM.TEACUP]: [0.2, 0.4, 1],
  [SYM.CRANE]: [0.15, 0.3, 0.8],
  [SYM.BAMBOO]: [0.1, 0.25, 0.6],
  [SYM.MON]: [0.1, 0.2, 0.5],
  [SYM.WILD]: [2, 5, 25],
};
export const isPaying = (s: Sym) => s <= SYM.WILD;

// ---------- Grid & paylines ----------
export const REELS = 5;
export const ROWS = 3;
/** 25 fixed paylines: row index (0 = top) on each reel, left to right. */
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1],
  [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2], [1, 0, 2, 0, 1], [1, 2, 0, 2, 1], [0, 2, 2, 2, 0], [2, 0, 0, 0, 2],
];

// ---------- Bets & wallet ----------
/** Bet ladder in credits per spin; the dollar bet = credits x denomination. */
export const BET_CREDITS = [25, 50, 75, 100, 250, 500, 1000];
export const DEFAULT_BET_INDEX = 0;
/** Denominations: dollar value of one credit. RTP is identical at every denomination. */
export const DENOMINATIONS = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1];
export const DEFAULT_DENOM_INDEX = 0;
/** Wallet amounts (starting balance, add-credit options) are in dollars. */
export const STARTING_CREDITS = 100;
export const ADD_CREDIT_OPTIONS = [100, 500, 1000];
export const ADD_CREDIT_MAX = 1000;

// ---------- Reel strips ----------
/**
 * Symbol counts per reel (order = symbol ids 0..12). Strips are built deterministically
 * from these with STRIP_SEED. Wild only on reels 2-4 in the base game; Kitsune Mask only on 1, 3, 5.
 */
//                       KO TO FA KA LA MO TE CR BA MN WD BL MK
export const BASE_COUNTS: number[][] = [
  [10, 8, 8, 8, 8, 6, 6, 6, 6, 7, 0, 2, 4],
  [10, 8, 8, 8, 8, 6, 6, 6, 6, 5, 3, 1, 0],
  [10, 8, 8, 8, 8, 7, 7, 7, 7, 7, 3, 2, 4],
  [8, 8, 8, 8, 8, 6, 6, 6, 6, 7, 3, 2, 0],
  [8, 8, 8, 8, 8, 6, 6, 6, 6, 8, 0, 2, 4],
];
/** Free spins strips: no Kitsune Masks; Wilds on reels 2-5 (they drift left as sticky Wilds). */
export const FS_COUNTS: number[][] = [
  [5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 0, 1, 0],
  [5, 6, 6, 7, 7, 7, 7, 7, 7, 8, 4, 1, 0],
  [5, 6, 6, 7, 7, 7, 7, 7, 7, 7, 5, 1, 0],
  [5, 6, 6, 7, 7, 7, 7, 7, 7, 7, 4, 1, 0],
  [5, 6, 6, 7, 7, 7, 7, 7, 7, 7, 4, 1, 0],
];
export const STRIP_SEED = 20260401;
/** Minimum distance on a strip between two Bells / two Masks / two Wilds. */
export const SPECIAL_GAP = { [SYM.BELL]: 4, [SYM.MASK]: 4, [SYM.WILD]: 3 } as Record<number, number>;

// ---------- Sakura Cascade ----------
/** Multiplier for the 1st, 2nd, 3rd, 4th+ win evaluation in one spin (cap = last value). */
export const CASCADE_MULTS = [1, 2, 3, 5];

// ---------- Omikuji Fortune Draw ----------
/** On a paid base spin with no win: chance the shrine box shakes. */
export const OMIKUJI_CHANCE = 1 / 75;
export type SlipKey = 'daikichi' | 'chukichi' | 'shokichi' | 'kichi' | 'kyo';
export const OMIKUJI_SLIPS: { key: SlipKey; kanji: string; name: string; meaning: string; pay: number; weight: number }[] = [
  { key: 'daikichi', kanji: '大吉', name: 'Daikichi', meaning: 'Great blessing', pay: 50, weight: 2 },
  { key: 'chukichi', kanji: '中吉', name: 'Chukichi', meaning: 'Middle blessing', pay: 15, weight: 10 },
  { key: 'shokichi', kanji: '小吉', name: 'Shokichi', meaning: 'Small blessing', pay: 5, weight: 28 },
  { key: 'kichi', kanji: '吉', name: 'Kichi', meaning: 'Blessing', pay: 2, weight: 45 },
  { key: 'kyo', kanji: '凶', name: 'Kyo', meaning: 'Bad luck (tie it to the pine branch and draw again)', pay: 0, weight: 15 },
];

// ---------- Torii Path ----------
export const TORII = {
  /** 3 Kitsune Masks (one each on reels 1, 3, 5) trigger it. */
  length: 24,
  gates: [5, 10, 15, 20],
  gatePays: [5, 10, 20, 40],
  summitPay: 250,
  startRolls: 3,
  maxMult: 5,
  /** Space weights (percent) for the 19 stones that aren't gates. Fox spirits never sit past the last gate. */
  spaceWeights: { offering: 43, lantern: 18, ema: 23, fox: 10, mist: 6 } as Record<ToriiSpaceType, number>,
  /** Offering prize in x bet (1x-10x) and its weight. */
  offerings: [
    { pay: 1, weight: 14 }, { pay: 2, weight: 14 }, { pay: 3, weight: 13 }, { pay: 4, weight: 12 }, { pay: 5, weight: 11 },
    { pay: 6, weight: 10 }, { pay: 7, weight: 8 }, { pay: 8, weight: 7 }, { pay: 9, weight: 6 }, { pay: 10, weight: 4 },
  ],
};
export type ToriiSpaceType = 'offering' | 'lantern' | 'ema' | 'fox' | 'mist';

// ---------- Lantern Festival Free Spins ----------
export const FREE_SPINS = {
  /** 3 / 4 / 5 Shrine Bells */
  spins: [8, 12, 16],
  scatterPay: [2, 5, 20],
  lanternsPerStep: 3,
  extraSpins: 4,
  maxMult: 3,
  /** safety limit on total free spins in one feature */
  maxSpins: 200,
};

// ---------- Bonus buy ----------
export const BONUS_BUY = { torii: 60, freespins: 80 };

// ---------- Caps & presentation ----------
export const MAX_WIN_X = 5000;
/** Win celebration tiers in x bet. */
export const WIN_TIERS = [
  { name: 'Daikichi Win', x: 50 },
  { name: 'Mega Win', x: 25 },
  { name: 'Big Win', x: 10 },
];
