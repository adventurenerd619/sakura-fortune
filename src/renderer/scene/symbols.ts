import { Container, Sprite } from 'pixi.js';
import { TEX, RES } from '../art/textures';

export const CELL_W = 190;
export const CELL_H = 176;
export const SYMBOL_PX = 176;
export const FONT = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
/** Real Japanese fonts for the few kanji shown (with English alongside). */
export const JP_FONT = "'Yu Mincho', 'YuMincho', 'Hiragino Mincho ProN', 'MS Mincho', 'Noto Serif JP', serif";

/**
 * Money display. All amounts are dollars internally; the player can view them
 * as dollars or as credits at the current denomination.
 */
export const money = { mode: 'dollars' as 'credits' | 'dollars', denom: 0.01 };
const toCredits = (x: number) => Math.round((x / money.denom) * 100) / 100;
const num = (v: number, dec: number) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
/** Full amount: "$12.40" or "1,240" (credits show decimals only when fractional). */
export const fmt = (x: number) => {
  if (money.mode === 'dollars') return (x < 0 ? '-$' : '$') + num(Math.abs(Math.round(x * 100) / 100), 2);
  const c = toCredits(x);
  return num(c, Number.isInteger(c) ? 0 : 2);
};
/** Like fmt, but keeps a third decimal for dollar amounts between whole cents (e.g. $0.125 on the paytable). */
export const fmtExact = (x: number) => {
  if (money.mode !== 'dollars') return fmt(x);
  const tenths = Math.round(x * 1000);
  return tenths % 10 === 0 ? fmt(x) : '$' + num(tenths / 1000, 3);
};
export const denomLabel =(d: number) => (d < 1 ? `${Math.round(d * 100)}¢` : `$${d}`);

export function textStyle(size: number, fill: string = '#F5EEDC', strokeW = 6) {
  return {
    fontFamily: FONT, fontSize: size, fontWeight: 'bold' as const, fill,
    stroke: { color: '#1b1a2e', width: Math.max(2, Math.round(strokeW * 0.6)), join: 'round' as const },
    dropShadow: { color: '#000000', alpha: 0.5, blur: 6, distance: 3, angle: Math.PI / 2 },
    align: 'center' as const,
    letterSpacing: size >= 60 ? 3 : 0.5,
  };
}

/** Bonus symbols (Shrine Bell, Kitsune Mask) carry a pulsing aura so they are easy to spot. */
export const AURA_TINT: Record<number, number> = { 11: 0xffc94a, 12: 0xb27cff };
export const SPRITE_SCALE = SYMBOL_PX / (200 * RES);

/** One symbol on the reels. */
export class SymbolView extends Container {
  aura = new Sprite(TEX.glow);
  glow = new Sprite(TEX.glow);
  sprite = new Sprite();
  sym = 0;
  sticky = false;
  constructor(sym = 0) {
    super();
    for (const g of [this.aura, this.glow]) { g.anchor.set(0.5); g.blendMode = 'add'; }
    this.glow.visible = false;
    this.glow.scale.set(1.25);
    this.aura.scale.set(1.05);
    this.sprite.anchor.set(0.5);
    this.addChild(this.aura, this.glow, this.sprite);
    this.set(sym);
  }
  /** true for the Shrine Bell and Kitsune Mask */
  get special() { return this.sym in AURA_TINT; }
  set(sym: number) {
    this.sym = sym;
    this.sprite.texture = TEX['sym' + sym];
    this.sprite.scale.set(SPRITE_SCALE);
    this.aura.visible = this.special;
    if (this.special) this.aura.tint = AURA_TINT[sym];
  }
  setGlow(on: boolean, tint = 0xffe9a8) { this.glow.visible = on; this.glow.tint = tint; }
}
