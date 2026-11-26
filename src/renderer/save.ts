import { DEFAULT_BET_INDEX, STARTING_CREDITS, DENOMINATIONS, DEFAULT_DENOM_INDEX, BET_CREDITS } from '../config/math';
import { newStats, upgradeStats, type StatsBlock } from './stats';
import { kv } from './platform';

export interface Settings {
  master: number; music: number; sfx: number; muted: boolean; turbo: boolean;
  denomIndex: number; moneyMode: 'credits' | 'dollars'; moneyModeChosen?: boolean;
  /** 'auto' follows the system setting */
  reducedMotion: 'auto' | 'on' | 'off';
  /** auto-spin stops on a single win of at least this many x bet (0 = off) */
  autoStopWin: number;
  /** auto-spin stops once the balance has dropped by this many x bet since it started (0 = off) */
  autoStopLoss: number;
}
export interface SaveData {
  version: number;
  balance: number;
  betIndex: number;
  settings: Settings;
  session: StatsBlock;
  allTime: StatsBlock;
  sessionStart: string;
}

const KEY = 'sakura-save';
const BAK = 'sakura-save.bak';
/** A save string is usable if it parses and has a numeric balance. */
const isValidSave = (text: string | null): text is string => {
  if (!text) return false;
  try { const o = JSON.parse(text); return !!o && typeof o === 'object' && Number.isFinite(o.balance); } catch { return false; }
};
/** Last good save written (becomes the backup on the next write) — non-Electron platforms. */
let lastGood: string | null = null;
const api = (window as any).sakura as undefined | {
  loadSave(): Promise<{ data: string | null; status: LoadStatus } | string | null>; writeSave(d: string): Promise<boolean>; writeSaveSync(d: string): boolean;
};

/** How the save was loaded: fresh install, normal, restored from the backup, or unreadable and reset. */
export type LoadStatus = 'ok' | 'new' | 'recovered' | 'reset';
export let loadStatus: LoadStatus = 'new';

export function defaultSave(): SaveData {
  return {
    version: 1,
    balance: STARTING_CREDITS,
    betIndex: DEFAULT_BET_INDEX,
    settings: { master: 0.8, music: 0.55, sfx: 0.8, muted: false, turbo: false, denomIndex: DEFAULT_DENOM_INDEX, moneyMode: 'dollars', moneyModeChosen: false, reducedMotion: 'auto', autoStopWin: 0, autoStopLoss: 0 },
    session: newStats(STARTING_CREDITS),
    allTime: newStats(STARTING_CREDITS),
    sessionStart: new Date().toISOString(),
  };
}

export async function loadSave(): Promise<SaveData> {
  let raw: string | null = null;
  try {
    if (api) {
      const r = await api.loadSave();
      if (r && typeof r === 'object') { raw = r.data; loadStatus = r.status; } else { raw = r as string | null; loadStatus = raw ? 'ok' : 'new'; }
    } else {
      // Android / browser: same backup-and-recover behavior as the desktop save file
      const main = await kv.get(KEY);
      if (isValidSave(main)) { raw = main; loadStatus = 'ok'; }
      else {
        const bak = await kv.get(BAK);
        if (isValidSave(bak)) {
          if (main) await kv.set(`${KEY}.corrupt-${Date.now()}`, main);
          raw = bak; loadStatus = 'recovered';
        } else if (main) {
          await kv.set(`${KEY}.corrupt-${Date.now()}`, main);
          raw = null; loadStatus = 'reset';
        } else { raw = null; loadStatus = 'new'; }
      }
      lastGood = raw;
    }
  } catch { raw = null; loadStatus = 'reset'; }
  const d = defaultSave();
  if (!raw) return d;
  try {
    const s = JSON.parse(raw);
    const out: SaveData = { ...d, ...s };
    out.settings = { ...d.settings, ...(s.settings || {}) };
    if (!(out.settings.denomIndex >= 0 && out.settings.denomIndex < DENOMINATIONS.length)) out.settings.denomIndex = DEFAULT_DENOM_INDEX;
    // dollars is the default view unless the player has picked a view themselves
    if (!out.settings.moneyModeChosen || out.settings.moneyMode !== 'credits') out.settings.moneyMode = 'dollars';
    out.session = upgradeStats(s.session, out.balance);
    out.allTime = upgradeStats(s.allTime, STARTING_CREDITS);
    if (!(out.betIndex >= 0 && out.betIndex < BET_CREDITS.length)) out.betIndex = DEFAULT_BET_INDEX;
    if (!Number.isFinite(out.balance)) out.balance = STARTING_CREDITS;
    return out;
  } catch {
    loadStatus = 'reset';
    return d;
  }
}

let pending: number | null = null;
export function writeSave(data: SaveData, immediate = false) {
  const doWrite = () => {
    pending = null;
    const json = JSON.stringify(data);
    try {
      if (api) {
        if (immediate) api.writeSaveSync(json); else api.writeSave(json);
      } else {
        // previous good save becomes the backup, then the new one is stored
        if (lastGood && lastGood !== json) kv.set(BAK, lastGood);
        kv.set(KEY, json);
        lastGood = json;
      }
    } catch (e) { console.error('save failed', e); }
  };
  if (immediate) { if (pending) clearTimeout(pending); doWrite(); return; }
  if (pending) return;
  pending = window.setTimeout(doWrite, 400);
}
