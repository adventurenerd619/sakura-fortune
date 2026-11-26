export type Rng = () => number;

/** Fast seeded PRNG (xoshiro128**) — used by the simulator and strip builder. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0 || 1, b = 0x9e3779b9, c = 0x243f6a88, d = 0xb7e15162;
  const next = () => {
    const t = b << 9;
    let r = a * 5;
    r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t;
    d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
  for (let i = 0; i < 20; i++) next();
  return next;
}

/** Game RNG: crypto-backed when available. */
export function makeGameRng(): Rng {
  const g: any = globalThis as any;
  if (g.crypto && g.crypto.getRandomValues) {
    const buf = new Uint32Array(256);
    let i = 256;
    return () => {
      if (i >= 256) { g.crypto.getRandomValues(buf); i = 0; }
      return buf[i++] / 4294967296;
    };
  }
  return Math.random;
}

export function pickWeighted<T extends { weight: number }>(rng: Rng, items: T[], total?: number): T {
  let t = total ?? items.reduce((s, x) => s + x.weight, 0);
  let r = rng() * t;
  for (const it of items) {
    r -= it.weight;
    if (r < 0) return it;
  }
  return items[items.length - 1];
}
