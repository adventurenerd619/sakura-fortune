import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEX } from '../art/textures';
import { textStyle, fmt } from './symbols';
import { L } from '../layout';
import { tween, ease, every, Skipper } from '../tween';
import type { Effects } from './effects';

/** Full-screen moments: big-win celebrations and feature banners. */
export class Overlays extends Container {
  dim = new Graphics();
  layer = new Container();
  onDim: (on: boolean) => void = () => {};
  constructor(private fx: Effects) {
    super();
    this.addChild(this.dim, this.layer);
    this.dim.alpha = 0;
    this.relayout();
  }
  relayout() { this.dim.clear().rect(0, 0, L.w, L.h).fill(0x0b0f1e); }
  async setDim(a: number, ms = 300) { this.onDim(a > 0); await tween(this.dim, { alpha: a }, ms); }
  clear() { this.layer.removeChildren().forEach((c) => c.destroy({ children: true })); }

  /** Banner with a title, a subtitle, and an optional prompt line; resolves when `until` resolves. */
  async banner(title: string, sub: string, until: Promise<void>, prompt = '', color = '#F2D27A') {
    await this.setDim(0.6);
    const g = new Container();
    const glow = new Sprite(TEX.glow); glow.anchor.set(0.5); glow.scale.set(4, 2); glow.alpha = 0.35; glow.blendMode = 'add';
    const t = new Text({ text: title, style: { ...textStyle(L.orientation === 'portrait' ? 80 : 104, color), wordWrap: true, wordWrapWidth: L.w - 120 } });
    t.anchor.set(0.5);
    const s = new Text({ text: sub, style: { ...textStyle(42, '#F5EEDC'), wordWrap: true, wordWrapWidth: L.w - 160 } });
    s.anchor.set(0.5, 0); s.y = t.height / 2 + 24;
    const p = new Text({ text: prompt, style: textStyle(34, '#F4B6C2') });
    p.anchor.set(0.5, 0); p.y = s.y + s.height + 34;
    g.addChild(glow, t, s, p);
    g.position.set(L.cx, L.cy - 40);
    g.scale.set(0.6); g.alpha = 0;
    this.layer.addChild(g);
    void tween(g, { 'scale.x': 1, 'scale.y': 1, alpha: 1 }, 380, ease.outBack);
    let done = false;
    void until.then(() => { done = true; });
    void every((_dt, el) => { p.alpha = 0.55 + Math.sin(el / 260) * 0.45; return !done && !g.destroyed; });
    this.fx.sparkles(L.cx, L.cy - 40, 24, 700);
    await until;
    await tween(g, { alpha: 0 }, 220);
    g.destroy({ children: true });
    await this.setDim(0, 220);
  }

  /** Big / Mega / Daikichi win: counts up through the tiers. Skippable. */
  async bigWin(amount: number, bet: number, tiers: { name: string; x: number }[], skip: Skipper, onTier: (name: string) => void, onTick: (v: number) => void) {
    await this.setDim(0.55, 200);
    const g = new Container();
    const glow = new Sprite(TEX.glow); glow.anchor.set(0.5); glow.scale.set(4.5); glow.alpha = 0.4; glow.blendMode = 'add';
    const name = new Text({ text: '', style: textStyle(L.orientation === 'portrait' ? 96 : 120, '#F2D27A') });
    name.anchor.set(0.5); name.y = -90;
    const val = new Text({ text: fmt(0), style: textStyle(96, '#F5EEDC') });
    val.anchor.set(0.5); val.y = 60;
    g.addChild(glow, name, val);
    g.position.set(L.cx, L.cy);
    this.layer.addChild(g);
    const reached = tiers.filter((t) => amount >= t.x * bet).sort((a, b) => a.x - b.x);
    const dur = 1600 + reached.length * 1400;
    let shownTier = -1;
    await every((_dt, el) => {
      const p = skip.skipped ? 1 : Math.min(1, el / dur);
      const v = amount * ease.outQuad(p);
      val.text = fmt(v);
      onTick(v);
      let ti = -1;
      reached.forEach((t, i) => { if (v >= t.x * bet) ti = i; });
      if (ti !== shownTier && ti >= 0) {
        shownTier = ti;
        name.text = reached[ti].name.toUpperCase();
        name.scale.set(1.5);
        void tween(name, { 'scale.x': 1, 'scale.y': 1 }, 320, ease.outBack);
        onTier(reached[ti].name);
        this.fx.sparkles(L.cx, L.cy, 30, 900);
      }
      if (Math.random() < 0.3) this.fx.petalBurst(L.cx + (Math.random() - 0.5) * 900, L.cy + (Math.random() - 0.5) * 400, 3);
      return p < 1;
    });
    await skip.wait(1600);
    await tween(g, { alpha: 0 }, 250);
    g.destroy({ children: true });
    await this.setDim(0, 200);
  }
}
