import { Container, Sprite } from 'pixi.js';
import { TEX } from '../art/textures';
import { L } from '../layout';
import { tween } from '../tween';

export type SceneName = 'dusk' | 'night' | 'mountain';

interface Drifter { s: Sprite; vx: number; vy: number; spin: number; sway: number; phase: number; kind: 'petal' | 'lantern' }

/** Scene art plus ambient motion: falling petals at dusk, floating lanterns at night. Respects reduced motion. */
export class Background extends Container {
  scenes: Record<SceneName, Sprite> = {
    dusk: new Sprite(TEX.dusk), night: new Sprite(TEX.night), mountain: new Sprite(TEX.mountain),
  };
  ambient = new Container();
  drifters: Drifter[] = [];
  current: SceneName = 'dusk';
  reducedMotion = false;
  constructor() {
    super();
    for (const k of Object.keys(this.scenes) as SceneName[]) { this.addChild(this.scenes[k]); this.scenes[k].alpha = k === 'dusk' ? 1 : 0; }
    this.addChild(this.ambient);
    this.relayout();
  }
  relayout() {
    for (const s of Object.values(this.scenes)) { s.scale.set(L.bg.s); s.position.set(L.bg.x, L.bg.y); }
  }
  async show(name: SceneName, ms = 900) {
    if (name === this.current) return;
    const from = this.scenes[this.current], to = this.scenes[name];
    this.current = name;
    this.setChildIndex(to, 2);
    await Promise.all([tween(to, { alpha: 1 }, ms), tween(from, { alpha: 0 }, ms)]);
    for (const d of this.drifters) d.s.destroy();
    this.drifters = [];
  }
  private spawn() {
    const night = this.current === 'night';
    if (this.current === 'mountain') return;
    const s = new Sprite(night ? TEX.floatLantern : Math.random() < 0.3 ? TEX.petalWhite : TEX.petal);
    s.anchor.set(0.5);
    const d: Drifter = night
      ? { s, kind: 'lantern', vx: (Math.random() - 0.5) * 0.01, vy: -(0.02 + Math.random() * 0.025), spin: 0, sway: 10, phase: Math.random() * 6 }
      : { s, kind: 'petal', vx: 0.02 + Math.random() * 0.04, vy: 0.04 + Math.random() * 0.05, spin: (Math.random() - 0.5) * 0.004, sway: 30, phase: Math.random() * 6 };
    s.scale.set(night ? 0.5 + Math.random() * 0.5 : 0.5 + Math.random() * 0.6);
    s.alpha = night ? 0.85 : 0.9;
    if (night) s.position.set(Math.random() * L.w, L.h + 60);
    else s.position.set(Math.random() * L.w - 200, -30);
    this.ambient.addChild(s);
    this.drifters.push(d);
  }
  update(dt: number) {
    const max = this.reducedMotion ? 0 : this.current === 'night' ? 14 : 34;
    if (this.drifters.length < max && Math.random() < dt * (this.current === 'night' ? 0.002 : 0.006)) this.spawn();
    for (let i = this.drifters.length - 1; i >= 0; i--) {
      const d = this.drifters[i];
      d.phase += dt * 0.0015;
      d.s.x += d.vx * dt + Math.sin(d.phase) * d.sway * 0.002 * dt;
      d.s.y += d.vy * dt;
      d.s.rotation += d.spin * dt;
      if (d.kind === 'petal') d.s.scale.x = Math.abs(d.s.scale.y) * Math.cos(d.phase * 2);
      if (d.s.y > L.h + 60 || d.s.y < -120 || d.s.x > L.w + 60 || this.reducedMotion) {
        d.s.destroy();
        this.drifters.splice(i, 1);
      }
    }
  }
}
