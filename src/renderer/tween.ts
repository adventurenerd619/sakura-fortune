import type { Ticker } from 'pixi.js';

export type Ease = (t: number) => number;
export const ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t: number) => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce: (t: number) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

interface Job { update(dtMs: number): boolean }
const jobs: Job[] = [];
export const clock = { speed: 1, now: 0 };
/** Reduced motion: bounces and pops become plain eases. */
export const motion = { reduced: false };
/** The given ease, or a plain one when reduced motion is on. */
export const calm = (e: Ease): Ease => (motion.reduced ? ease.outQuad : e);

export function initTweens(ticker: Ticker) {
  ticker.add((t) => {
    const dt = t.deltaMS * clock.speed;
    clock.now += dt;
    for (let i = jobs.length - 1; i >= 0; i--) {
      if (!jobs[i].update(dt)) jobs.splice(i, 1);
    }
  });
}

/** Tween numeric properties (dot paths supported, e.g. 'scale.x'). */
export function tween(target: any, props: Record<string, number>, ms: number, e: Ease = ease.outQuad, delay = 0): Promise<void> {
  return new Promise((resolve) => {
    const keys = Object.keys(props);
    const get = (k: string) => k.split('.').reduce((o, p) => o[p], target);
    const set = (k: string, v: number) => {
      const parts = k.split('.');
      const last = parts.pop()!;
      const o = parts.reduce((o, p) => o[p], target);
      o[last] = v;
    };
    let from: number[] | null = null;
    let t = -delay;
    jobs.push({
      update(dt) {
        if (target.destroyed) { resolve(); return false; }
        t += dt;
        if (t < 0) return true;
        if (!from) from = keys.map(get);
        const p = Math.min(1, t / Math.max(1, ms));
        const v = e(p);
        keys.forEach((k, i) => set(k, from![i] + (props[k] - from![i]) * v));
        if (p >= 1) { resolve(); return false; }
        return true;
      },
    });
  });
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    let t = 0;
    jobs.push({ update(dt) { t += dt; if (t >= ms) { resolve(); return false; } return true; } });
  });
}

/** Run a callback every frame for `ms` (Infinity allowed); return false to stop early. */
export function every(fn: (dt: number, elapsed: number) => boolean | void, ms = Infinity): Promise<void> {
  return new Promise((resolve) => {
    let t = 0;
    jobs.push({
      update(dt) {
        t += dt;
        const r = fn(dt, t);
        if (r === false || t >= ms) { resolve(); return false; }
        return true;
      },
    });
  });
}

/** A wait that can be cut short by calling skip(). */
export class Skipper {
  skipped = false;
  private waiters: (() => void)[] = [];
  skip() { this.skipped = true; this.waiters.forEach((w) => w()); this.waiters = []; }
  wait(ms: number) {
    if (this.skipped) return Promise.resolve();
    return Promise.race([wait(ms), new Promise<void>((r) => this.waiters.push(r))]);
  }
}
