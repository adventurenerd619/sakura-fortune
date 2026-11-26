import { Container, Sprite, Text } from 'pixi.js';
import { TEX } from '../art/textures';
import { textStyle } from './symbols';
import { tween, ease } from '../tween';

interface P { s: Sprite; vx: number; vy: number; g: number; spin: number; life: number; max: number; fade: boolean }

/** Particle bursts: sakura petals when symbols burst, sparkles and floating amount labels. */
export class Effects extends Container {
  parts: P[] = [];
  reducedMotion = false;
  private add(tex: string, x: number, y: number, o: Partial<P> & { scale?: number; tint?: number }) {
    const s = new Sprite(TEX[tex]);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set(o.scale ?? 1);
    if (o.tint !== undefined) s.tint = o.tint;
    if (tex.startsWith('sparkle') || tex.startsWith('glow')) s.blendMode = 'add';
    this.addChild(s);
    this.parts.push({ s, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, spin: o.spin ?? 0, life: 0, max: o.max ?? 1000, fade: o.fade ?? true });
  }
  /** A symbol bursts into petals. */
  petalBurst(x: number, y: number, n = 14) {
    if (this.reducedMotion) n = 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.15 + Math.random() * 0.35;
      this.add(Math.random() < 0.35 ? 'petalWhite' : 'petal', x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.15, g: 0.0006, spin: (Math.random() - 0.5) * 0.02, max: 900 + Math.random() * 500, scale: 0.6 + Math.random() * 0.6 });
    }
    this.add('glow', x, y, { max: 350, scale: 0.6 });
  }
  sparkles(x: number, y: number, n = 10, w = 160, tex = 'sparkle') {
    if (this.reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      this.add(tex, x + (Math.random() - 0.5) * w, y + (Math.random() - 0.5) * w * 0.6, { vy: -0.05 - Math.random() * 0.08, max: 500 + Math.random() * 600, scale: 0.3 + Math.random() * 0.5, spin: 0.004 });
    }
  }
  /** Floating text that rises and fades (e.g. "+5x"). */
  floatText(text: string, x: number, y: number, size = 44, color = '#F2D27A') {
    const t = new Text({ text, style: textStyle(size, color) });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.addChild(t);
    void tween(t, { y: y - 70, alpha: 0 }, 1300, ease.outQuad, 300).then(() => t.destroy());
  }
  tick(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      p.vy += p.g * dt;
      p.s.x += p.vx * dt; p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      if (p.fade) p.s.alpha = Math.max(0, 1 - p.life / p.max);
      if (p.life >= p.max) { p.s.destroy(); this.parts.splice(i, 1); }
    }
  }
}
