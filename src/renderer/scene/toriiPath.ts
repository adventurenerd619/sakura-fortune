import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEX } from '../art/textures';
import { textStyle, fmt } from './symbols';
import { L } from '../layout';
import { tween, ease, wait } from '../tween';
import { TORII } from '../../config/math';
import type { ToriiSpace, ToriiRoll } from '../../engine/game';
import type { Effects } from './effects';

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** The Torii Path board bonus: a 24-space stone path up the mountain to the shrine. */
export class ToriiPath extends Container {
  board = new Container();
  fox = new Sprite(TEX.fox);
  die = new Container();
  dieG = new Graphics();
  panel = new Container();
  rollsText!: Text;
  multText!: Text;
  wonText!: Text;
  gates: Sprite[] = [];
  spaces: ToriiSpace[] = [];
  bet = 1;
  pos = 0;
  constructor(private fx: Effects) {
    super();
    this.fox.anchor.set(0.5, 0.92);
    this.die.addChild(this.dieG);
    this.addChild(this.board, this.fox, this.die, this.panel);
    this.visible = false;
  }

  build(spaces: ToriiSpace[], bet: number, startRolls: number) {
    this.spaces = spaces;
    this.bet = bet;
    this.board.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.panel.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.gates = [];
    const s = L.pathScale;
    // faint trail between stones
    const trail = new Graphics();
    L.path.forEach((p, i) => (i ? trail.lineTo(p.x, p.y) : trail.moveTo(p.x, p.y)));
    trail.stroke({ width: 26 * s, color: 0xcbb48a, alpha: 0.45, join: 'round', cap: 'round' });
    this.board.addChild(trail);
    spaces.forEach((sp, i) => {
      const p = L.path[i];
      if (sp.type === 'summit') {
        const shrine = new Sprite(TEX.shrine); shrine.anchor.set(0.5, 0.92); shrine.scale.set(0.62 * s); shrine.position.set(p.x, p.y + 10);
        this.board.addChild(shrine);
        this.addLabel(`SHRINE ${fmt(sp.pay * bet)}`, p.x, p.y + 30, '#F2D27A', 30);
        return;
      }
      const stone = new Sprite(sp.type === 'gate' ? TEX.stoneGate : TEX.stone);
      stone.anchor.set(0.5); stone.scale.set(0.56 * s); stone.position.set(p.x, p.y);
      this.board.addChild(stone);
      if (sp.type === 'gate') {
        const g = new Sprite(TEX.gate); g.anchor.set(0.5, 0.95); g.scale.set(0.62 * s); g.position.set(p.x, p.y + 8);
        this.board.addChild(g);
        this.gates.push(g);
        this.addLabel(fmt(sp.pay * bet), p.x, p.y - 122 * s, '#F5EEDC', 26);
      } else if (sp.type !== 'start') {
        const icon = new Sprite(TEX['sp_' + sp.type]); icon.anchor.set(0.5, 0.8); icon.scale.set(0.42 * s); icon.position.set(p.x, p.y);
        this.board.addChild(icon);
        if (sp.type === 'offering') this.addLabel(fmt(sp.pay * bet), p.x, p.y + 26 * s, '#F2D27A', 22);
      } else this.addLabel('START', p.x, p.y + 30 * s, '#F5EEDC', 22);
    });
    this.fox.scale.set(0.62 * s);
    this.pos = 0;
    this.fox.position.set(L.path[0].x, L.path[0].y);
    // info panel
    const landscape = L.orientation === 'landscape';
    const bg = new Graphics().roundRect(0, 0, 330, 210, 18).fill({ color: 0x1F2A44, alpha: 0.88 }).stroke({ width: 4, color: 0xd4a84b });
    this.panel.addChild(bg);
    const title = new Text({ text: 'TORII PATH', style: textStyle(34, '#F2D27A') }); title.position.set(165, 14); title.anchor.set(0.5, 0);
    this.rollsText = new Text({ text: '', style: textStyle(30) }); this.rollsText.position.set(24, 66);
    this.multText = new Text({ text: '', style: textStyle(30, '#ff9a7a') }); this.multText.position.set(24, 108);
    this.wonText = new Text({ text: '', style: textStyle(30, '#F2D27A') }); this.wonText.position.set(24, 150);
    this.panel.addChild(title, this.rollsText, this.multText, this.wonText);
    this.panel.position.set(landscape ? 40 : 30, landscape ? 40 : 40);
    this.die.position.set(landscape ? 1780 : 940, landscape ? 250 : 170);
    this.drawDie(1);
    this.setInfo(startRolls, 1, 0);
  }
  private addLabel(text: string, x: number, y: number, color: string, size: number) {
    const t = new Text({ text, style: textStyle(size, color, 5) });
    t.anchor.set(0.5); t.position.set(x, y);
    this.board.addChild(t);
  }
  setInfo(rolls: number, mult: number, collected: number) {
    this.rollsText.text = `Rolls left: ${rolls}`;
    this.multText.text = `Lantern multiplier: x${mult}`;
    this.wonText.text = `Collected: ${fmt(collected * this.bet)}`;
  }
  drawDie(n: number) {
    const g = this.dieG.clear();
    g.roundRect(-60, -60, 120, 120, 22).fill(0xf5eedc).stroke({ width: 6, color: 0x1b1a2e });
    for (const [x, y] of PIPS[n]) g.circle(x * 30, y * 30, 12).fill(n === 1 ? 0xc8102e : 0x1b1a2e);
  }

  async rollDie(value: number, fast: boolean) {
    const n = fast ? 4 : 10;
    for (let i = 0; i < n; i++) {
      this.drawDie(1 + Math.floor(Math.random() * 6));
      this.die.rotation = (Math.random() - 0.5) * 0.8;
      await wait(fast ? 40 : 60);
    }
    this.die.rotation = 0;
    this.drawDie(value);
    this.die.scale.set(1.3);
    await tween(this.die, { 'scale.x': 1, 'scale.y': 1 }, 200, ease.outBack);
  }
  /** Animates one roll: die, hops (gates light and pay as the fox passes), landing effect. */
  async playRoll(r: ToriiRoll, fast: boolean, sfx: { hop: () => void; gate: () => void; land: (effect: string) => void; summit: () => void }) {
    await this.rollDie(r.die, fast);
    for (let i = r.from + 1; i <= r.to; i++) {
      const p = L.path[i];
      const fromY = this.fox.y;
      sfx.hop();
      await Promise.all([
        tween(this.fox, { x: p.x }, fast ? 110 : 210, ease.linear),
        (async () => { await tween(this.fox, { y: Math.min(fromY, p.y) - 40 }, fast ? 55 : 105, ease.outQuad); await tween(this.fox, { y: p.y }, fast ? 55 : 105, ease.inQuad); })(),
      ]);
      this.pos = i;
      this.passGate(i, sfx.gate);
    }
    if (r.effect === 'fox' && r.end !== r.to) {
      sfx.land('fox');
      this.fx.sparkles(this.fox.x, this.fox.y - 40, 16, 120, 'sparkleBlue');
      this.fx.floatText('Fox spirit!', this.fox.x, this.fox.y - 120, 40, '#bfe6ff');
      await tween(this.fox, { alpha: 0 }, fast ? 100 : 220);
      const p = L.path[r.end];
      this.fox.position.set(p.x, p.y);
      await tween(this.fox, { alpha: 1 }, fast ? 100 : 220);
      this.pos = r.end;
      this.passGate(r.end, sfx.gate);
    } else if (r.effect === 'summit') {
      sfx.summit();
      this.fx.sparkles(this.fox.x, this.fox.y - 80, 40, 300);
      this.fx.floatText(`SHRINE ${fmt(TORII.summitPay * this.bet)}`, this.fox.x, this.fox.y - 160, 56);
    } else {
      sfx.land(r.effect);
      const sp = this.spaces[r.to];
      const y = this.fox.y - 120;
      if (sp.type === 'offering') { this.fx.floatText(`+${fmt(sp.pay * this.bet)}`, this.fox.x, y); this.fx.sparkles(this.fox.x, this.fox.y - 40, 12, 100); }
      else if (r.effect === 'lantern') this.fx.floatText(`Lantern x${r.mult}`, this.fox.x, y, 44, '#ff9a7a');
      else if (r.effect === 'ema') this.fx.floatText('+1 roll', this.fox.x, y, 44, '#F5EEDC');
      else if (r.effect === 'mist') this.fx.floatText('Mist…', this.fox.x, y, 36, '#c8cbd8');
    }
    this.setInfo(r.rollsLeft, r.mult, r.collected);
    await wait(fast ? 150 : 450);
  }
  private passGate(i: number, sfx: () => void) {
    const g = TORII.gates.indexOf(i);
    if (g < 0) return;
    const gate = this.gates[g];
    if (gate) gate.texture = TEX.gateLit;
    sfx();
    this.fx.floatText(`Gate +${fmt(TORII.gatePays[g] * this.bet)}`, L.path[i].x, L.path[i].y - 150, 46);
    this.fx.sparkles(L.path[i].x, L.path[i].y - 60, 16, 140);
  }
}
