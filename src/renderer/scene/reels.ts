import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { SymbolView, CELL_W, CELL_H, textStyle } from './symbols';
import { L, REELS_W, REELS_H } from '../layout';
import { tween, wait, ease, every, calm, motion } from '../tween';
import { REELS, ROWS, PAYLINES, SYM } from '../../config/math';
import type { Board, Cell, LineWin } from '../../engine/game';
import { TEX } from '../art/textures';

const LINE_COLORS = [0xc8102e, 0xd4a84b, 0x3f7fbf, 0x5f8a4a, 0xa0508a, 0xe8862e, 0x2e9c9c, 0xb04040, 0x7a6ad0, 0xc0a020];
const cx = (reel: number) => reel * CELL_W + CELL_W / 2;
const cy = (row: number) => row * CELL_H + CELL_H / 2;

/** One reel column: three row views, plus a scrolling strip shown while spinning. */
class Reel extends Container {
  views: SymbolView[] = [];
  spinViews: SymbolView[] = [];
  spinning = false;
  speed = 0;
  offset = 0;
  constructor(public index: number, private randomSym: () => number) {
    super();
    for (let r = 0; r < ROWS; r++) {
      const v = new SymbolView(randomSym());
      v.position.set(CELL_W / 2, cy(r));
      this.views.push(v);
      this.addChild(v);
    }
    for (let i = 0; i < ROWS + 1; i++) {
      const v = new SymbolView(randomSym());
      v.visible = false;
      v.alpha = 0.9;
      v.x = CELL_W / 2;
      this.spinViews.push(v);
      this.addChild(v);
    }
  }
  setBoard(col: number[]) { col.forEach((s, r) => { this.views[r].set(s); this.views[r].position.set(CELL_W / 2, cy(r)); this.views[r].scale.set(1); this.views[r].alpha = 1; this.views[r].visible = true; }); }
  startSpin() {
    this.spinning = true;
    this.speed = 0;
    this.offset = 0;
    for (const v of this.views) v.visible = false;
    this.spinViews.forEach((v, i) => { v.visible = true; v.set(this.randomSym()); v.y = cy(i - 1); });
  }
  update(dt: number) {
    if (!this.spinning) return;
    this.speed = Math.min(4.2, this.speed + dt * 0.02);
    this.offset += this.speed * dt;
    while (this.offset >= CELL_H) {
      this.offset -= CELL_H;
      // rotate: bottom view goes to the top with a new symbol
      const last = this.spinViews.pop()!;
      last.set(this.randomSym());
      this.spinViews.unshift(last);
    }
    this.spinViews.forEach((v, i) => { v.y = cy(i - 1) + this.offset; v.scale.y = 1.08; });
  }
  async stop(col: number[], fast: boolean) {
    this.spinning = false;
    for (const v of this.spinViews) v.visible = false;
    this.setBoard(col);
    for (const v of this.views) v.y -= motion.reduced ? 0 : 46;
    await Promise.all(this.views.map((v, r) => tween(v, { y: cy(r) }, fast ? 120 : 220, calm(ease.outBack))));
  }
}

export class Reels extends Container {
  reels: Reel[] = [];
  body = new Container();
  maskG = new Graphics();
  stickyMask = new Graphics();
  lineLayer = new Graphics();
  labelLayer = new Container();
  stickyLayer = new Container();
  stickyViews = new Map<string, SymbolView>();
  board: Board = [];
  randomPool: number[] = [];
  constructor() {
    super();
    this.addChild(this.body, this.maskG, this.stickyMask, this.stickyLayer, this.lineLayer, this.labelLayer);
    this.maskG.rect(0, 0, REELS_W, REELS_H).fill(0xffffff);
    this.stickyMask.rect(0, 0, REELS_W, REELS_H).fill(0xffffff);
    this.body.mask = this.maskG;
    this.stickyLayer.mask = this.stickyMask;
    for (let r = 0; r < REELS; r++) {
      const reel = new Reel(r, () => this.randomPool[Math.floor(Math.random() * this.randomPool.length)] ?? 5);
      reel.x = r * CELL_W;
      this.reels.push(reel);
      this.body.addChild(reel);
    }
    this.relayout();
  }
  relayout() { this.position.set(L.reelX, L.reelY); }
  /** Symbols shown while the reels blur past (from the active strips). */
  setPool(strips: number[][]) { this.randomPool = strips.flat().filter((s) => s !== SYM.MASK || Math.random() < 0.5); }
  setBoard(b: Board) { this.board = b.map((c) => c.slice()); b.forEach((col, r) => this.reels[r].setBoard(col)); }
  update(dt: number) { for (const r of this.reels) r.update(dt); }

  startSpin() { this.clearWins(); for (const r of this.reels) r.startSpin(); }
  /** Stops the reels one by one; onStop(reel) is called as each lands. */
  async stopAll(b: Board, opts: { turbo: boolean; fast: () => boolean; onStop: (reel: number) => void; anticipate?: number }) {
    this.board = b.map((c) => c.slice());
    for (let r = 0; r < REELS; r++) {
      const fast = opts.turbo || opts.fast();
      if (opts.anticipate !== undefined && r >= opts.anticipate && !fast) await wait(500);
      const p = this.reels[r].stop(b[r], fast);
      opts.onStop(r);
      if (r < REELS - 1) await wait(fast ? 60 : 160); else await p;
    }
  }

  view(reel: number, row: number) { return this.reels[reel].views[row]; }

  // ---------------- wins ----------------
  clearWins() {
    this.lineLayer.clear();
    this.labelLayer.removeChildren().forEach((c) => c.destroy());
    for (const r of this.reels) for (const v of r.views) { v.setGlow(false); v.alpha = 1; }
  }
  /** Draws one payline and lights its winning cells. */
  showLine(w: LineWin, label: string) {
    this.clearWins();
    const color = LINE_COLORS[w.line % LINE_COLORS.length];
    const rows = PAYLINES[w.line];
    const pts = rows.map((row, reel) => [cx(reel), cy(row)]);
    this.lineLayer.moveTo(-14, pts[0][1]);
    for (const [x, y] of pts) this.lineLayer.lineTo(x, y);
    this.lineLayer.lineTo(REELS_W + 14, pts[4][1]);
    this.lineLayer.stroke({ width: 12, color: 0x1b1a2e, alpha: 0.55, join: 'round' });
    this.lineLayer.moveTo(-14, pts[0][1]);
    for (const [x, y] of pts) this.lineLayer.lineTo(x, y);
    this.lineLayer.lineTo(REELS_W + 14, pts[4][1]);
    this.lineLayer.stroke({ width: 6, color, alpha: 0.95, join: 'round' });
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) this.view(r, row).alpha = 0.45;
    for (const [reel, row] of w.cells) {
      const v = this.view(reel, row);
      v.alpha = 1;
      v.setGlow(true);
      this.lineLayer.roundRect(reel * CELL_W + 6, row * CELL_H + 6, CELL_W - 12, CELL_H - 12, 18).stroke({ width: 5, color, alpha: 0.95 });
    }
    const [lx, ly] = pts[w.count - 1];
    const t = new Text({ text: label, style: textStyle(34, '#F2D27A') });
    t.anchor.set(0.5);
    t.position.set(lx, ly + 52);
    this.labelLayer.addChild(t);
    void pulse(w.cells.map(([r, row]) => this.view(r, row)));
  }
  /** Lights every winning cell at once (before they burst). */
  showAll(cells: Cell[]) {
    this.clearWins();
    for (const [reel, row] of cells) this.view(reel, row).setGlow(true);
  }

  // ---------------- cascades ----------------
  /** Winning symbols burst (scale up and fade); returns the stage positions of the bursts. */
  async burst(cells: Cell[], locked: boolean[][], fast: boolean): Promise<{ x: number; y: number }[]> {
    const pos: { x: number; y: number }[] = [];
    const jobs: Promise<void>[] = [];
    for (const [reel, row] of cells) {
      if (locked[reel][row]) continue;
      const v = this.view(reel, row);
      pos.push({ x: L.reelX + cx(reel), y: L.reelY + cy(row) });
      jobs.push(tween(v, { 'scale.x': 1.25, 'scale.y': 1.25, alpha: 0 }, fast ? 140 : 280, ease.outQuad));
    }
    await Promise.all(jobs);
    return pos;
  }
  /** Survivors fall into the gaps; new symbols drop in from above. Sticky cells stay put. */
  async drop(next: Board, removed: Set<string>, locked: boolean[][], fast: boolean) {
    const jobs: Promise<void>[] = [];
    for (let r = 0; r < REELS; r++) {
      const reel = this.reels[r];
      const slots = [0, 1, 2].filter((row) => !locked[r][row]);
      const gone = slots.filter((row) => removed.has(`${r},${row}`));
      if (!gone.length) continue;
      const survivors = slots.filter((row) => !removed.has(`${r},${row}`));
      // views in their new order: new ones first (top), then survivors
      const oldViews = reel.views.slice();
      const newOrder: { v: SymbolView; fromY: number }[] = [];
      gone.forEach((row, i) => {
        const v = oldViews[row];
        newOrder.push({ v, fromY: -CELL_H * (gone.length - i) + 10 });
      });
      for (const row of survivors) newOrder.push({ v: oldViews[row], fromY: oldViews[row].y });
      slots.forEach((row, j) => {
        const { v, fromY } = newOrder[j];
        reel.views[row] = v;
        v.set(next[r][row]);
        v.alpha = 1; v.scale.set(1); v.setGlow(false);
        v.y = fromY;
        jobs.push(tween(v, { y: cy(row) }, (fast ? 160 : 300) + j * 30, calm(ease.outBounce)));
      });
    }
    await Promise.all(jobs);
    this.board = next.map((c) => c.slice());
  }

  // ---------------- sticky Wilds (free spins) ----------------
  /** Shows sticky Wilds at the given cells (instantly). */
  setSticky(locked: boolean[][] | null) {
    this.stickyLayer.removeChildren().forEach((c) => c.destroy());
    this.stickyViews.clear();
    if (!locked) return;
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) if (locked[r][row]) this.addSticky(r, row);
  }
  private addSticky(r: number, row: number) {
    const v = new SymbolView(SYM.WILD);
    v.position.set(cx(r), cy(row));
    v.sticky = true;
    const ring = new Sprite(TEX.glow);
    ring.anchor.set(0.5); ring.scale.set(0.9); ring.tint = 0xff8a6a; ring.alpha = 0.55; ring.blendMode = 'add';
    v.addChildAt(ring, 0);
    this.stickyLayer.addChild(v);
    this.stickyViews.set(`${r},${row}`, v);
    return v;
  }
  /** Marks newly landed Wilds as sticky (pop animation). */
  async lockNew(locked: boolean[][]) {
    const jobs: Promise<void>[] = [];
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) {
      if (locked[r][row] && !this.stickyViews.has(`${r},${row}`)) {
        const v = this.addSticky(r, row);
        if (!motion.reduced) {
          v.scale.set(1.4);
          jobs.push(tween(v, { 'scale.x': 1, 'scale.y': 1 }, 260, ease.outBack));
        }
      }
    }
    await Promise.all(jobs);
  }
  /** Sticky Wilds drift one reel left; those on reel 1 drift off and fade. */
  async drift(fast: boolean) {
    const jobs: Promise<void>[] = [];
    const next = new Map<string, SymbolView>();
    for (const [key, v] of this.stickyViews) {
      const [r, row] = key.split(',').map(Number);
      if (r === 0) jobs.push(tween(v, { x: v.x - CELL_W * 0.8, alpha: 0 }, fast ? 180 : 420, ease.inQuad).then(() => v.destroy()));
      else { jobs.push(tween(v, { x: cx(r - 1) }, fast ? 180 : 420, ease.inOutQuad)); next.set(`${r - 1},${row}`, v); }
    }
    this.stickyViews = next;
    await Promise.all(jobs);
  }
}

/** Gentle pulse on winning symbols. */
async function pulse(views: SymbolView[]) {
  if (motion.reduced) return;
  await every((_dt, t) => {
    const s = 1 + Math.sin(t / 90) * 0.05;
    for (const v of views) if (!v.destroyed) v.sprite.scale.set((170 / 300) * s);
  }, 700);
  for (const v of views) if (!v.destroyed) v.sprite.scale.set(170 / 300);
}
