/**
 * Screen layouts. The game is designed on a fixed stage that is scaled to fit the window:
 *   landscape 1920x1080 (desktop, Steam Deck, phones held sideways)
 *   portrait  1080 x 1920..2400 (phones held upright; the height follows the phone's shape)
 * Everything positioned in stage coordinates reads it from here.
 */
import { CELL_W, CELL_H } from './scene/symbols';

export type Orientation = 'landscape' | 'portrait';
export type Pt = { x: number; y: number };

export interface Layout {
  orientation: Orientation;
  w: number; h: number;
  /** centre for overlays (titles, celebrations) */
  cx: number; cy: number;
  /** top-left of the 5x3 reel window */
  reelX: number; reelY: number;
  mascot: { x: number; y: number; s: number };
  /** background art (1920x1080): scale and offset */
  bg: { s: number; x: number; y: number };
  /** Omikuji box position (centre bottom) and scale */
  omikuji: { x: number; y: number; s: number };
  /** lantern meter (free spins) */
  lanterns: { x: number; y: number; dx: number };
  /** Torii Path: the 25 stone positions (0 = start, 24 = shrine) */
  path: Pt[];
  pathScale: number;
}

export const REELS_W = CELL_W * 5;
export const REELS_H = CELL_H * 3;

/** Spaces placed evenly along a polyline by arc length. */
function alongPolyline(pts: Pt[], n: number): Pt[] {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); total += d; }
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    let d = (total * k) / (n - 1), i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const t = Math.min(1, d / seg[i]);
    out.push({ x: Math.round(pts[i].x + (pts[i + 1].x - pts[i].x) * t), y: Math.round(pts[i].y + (pts[i + 1].y - pts[i].y) * t) });
  }
  return out;
}

export const LANDSCAPE: Layout = {
  orientation: 'landscape', w: 1920, h: 1080, cx: 960, cy: 470,
  reelX: (1920 - REELS_W) / 2, reelY: 196,
  mascot: { x: 40, y: 330, s: 0.92 },
  bg: { s: 1, x: 0, y: 0 },
  omikuji: { x: 1690, y: 760, s: 0.9 },
  lanterns: { x: 1590, y: 560, dx: 92 },
  path: alongPolyline([{ x: 300, y: 845 }, { x: 1560, y: 815 }, { x: 1620, y: 735 }, { x: 420, y: 670 }, { x: 380, y: 585 }, { x: 1480, y: 520 }, { x: 1500, y: 430 }, { x: 760, y: 370 }, { x: 960, y: 220 }], 25),
  pathScale: 1,
};

/** Portrait control bar height (stage px); CSS #stage.portrait #hud uses the same value. */
export const PORTRAIT_HUD_H = 430;

function portrait(h: number): Layout {
  const reelY = h - PORTRAIT_HUD_H - 60 - REELS_H;
  const top = 250; // below the title
  const ms = Math.max(0.72, Math.min(0.9, (reelY - 60 - top) / 520));
  const pathTop = 330, pathBottom = h - PORTRAIT_HUD_H - 230;
  const rows = 6, rowH = (pathBottom - pathTop) / rows;
  const pts: Pt[] = [];
  for (let r = 0; r <= rows; r++) {
    const y = pathBottom - r * rowH;
    if (r === rows) { pts.push({ x: 540, y: pathTop - 10 }); break; }
    pts.push({ x: r % 2 ? 930 : 150, y }, { x: r % 2 ? 150 : 930, y: y - rowH * 0.25 });
  }
  return {
    orientation: 'portrait', w: 1080, h,
    cx: 540, cy: Math.round(h * 0.42),
    reelX: (1080 - REELS_W) / 2, reelY,
    mascot: { x: 30, y: top + Math.max(0, (reelY - 60 - top - 520 * ms) / 2), s: ms },
    bg: { s: h / 1080, x: 540 - 960 * (h / 1080), y: 0 },
    omikuji: { x: 860, y: reelY - 70, s: 0.8 },
    lanterns: { x: 560, y: top + 60, dx: 88 },
    path: alongPolyline(pts, 25),
    pathScale: 0.85,
  };
}

/** The active layout (mutated in place so importers always see the current one). */
export const L: Layout = { ...LANDSCAPE };

/** Portrait stage height for a viewport: follows the phone's shape (16:9 up to 20:9). */
export function portraitHeight(vw: number, vh: number) {
  return Math.max(1920, Math.min(2400, Math.round((1080 * vh) / vw)));
}

export function setLayout(o: Orientation, vw = 1080, vh = 1920) {
  Object.assign(L, o === 'portrait' ? portrait(portraitHeight(vw, vh)) : LANDSCAPE);
}

/** Which layout suits a viewport: portrait when it's clearly taller than wide. */
export function preferredOrientation(w: number, h: number): Orientation {
  return h > w * 1.1 ? 'portrait' : 'landscape';
}
