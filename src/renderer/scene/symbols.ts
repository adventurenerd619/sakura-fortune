import { Container, Sprite } from 'pixi.js';
import { TEX, RES } from '../art/textures';

export const CELL_W = 190;
export const CELL_H = 176;
export const SYMBOL_PX = 170;
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
export const denomLabel = (d: number) => (d < 1 ? `${Math.round(d * 100)}¢` : `$${d}`);

export function textStyle(size: number, fill: string = '#F5EEDC', strokeW = 6) {
  return {
    fontFamily: FONT, fontSize: size, fontWeight: 'bold' as const, fill,
    stroke: { color: '#1b1a2e', width: Math.max(2, Math.round(strokeW * 0.6)), join: 'round' as const },
    dropShadow: { color: '#000000', alpha: 0.5, blur: 6, distance: 3, angle: Math.PI / 2 },
    align: 'center' as const,
    letterSpacing: size >= 60 ? 3 : 0.5,
  };
}

/** One symbol on the reels. */
export class SymbolView extends Container {
  glow = new Sprite(TEX.glow);
  sprite = new Sprite();
  sym = 0;
  sticky = false;
  constructor(sym = 0) {
    super();
    this.glow.anchor.set(0.5);
    this.glow.visible = false;
    this.glow.blendMode = 'add';
    this.glow.scale.set(1.25);
    this.sprite.anchor.set(0.5);
    this.addChild(this.glow, this.sprite);
    this.set(sym);
  }
  set(sym: number) {
    this.sym = sym;
    this.sprite.texture = TEX['sym' + sym];
    this.sprite.scale.set(SYMBOL_PX / (200 * RES));
  }
  setGlow(on: boolean, tint = 0xffe9a8) { this.glow.visible = on; this.glow.tint = tint; }
}
