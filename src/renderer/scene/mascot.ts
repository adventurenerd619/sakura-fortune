import { Container, Sprite, Text } from 'pixi.js';
import { TEX } from '../art/textures';
import { FONT } from './symbols';

type Eyes = 'open' | 'happy' | 'closed' | 'wide';
type Mouth = 'smile' | 'open' | 'sleep';
type Mood = 'idle' | 'wave' | 'bow' | 'cheer' | 'surprise' | 'doze';

/** The Maneki-neko beside the reels: a part-based puppet animated procedurally. */
export class Mascot extends Container {
  rig = new Container();
  cushion = new Sprite(TEX.m_cushion);
  body = new Sprite(TEX.m_body);
  armUp = new Sprite(TEX.m_armUp);
  armDown = new Sprite(TEX.m_armDown);
  head = new Container();
  headBase = new Sprite(TEX.m_head);
  eyes = new Sprite(TEX.m_eyes_open);
  mouth = new Sprite(TEX.m_mouth_smile);
  zzz: Text[] = [];
  mood: Mood = 'idle';
  moodT = 0;
  moodDur = 0;
  t = 0;
  idleMs = 0;
  blinkT = 2500;
  /** reduced motion: smaller movements */
  calm = false;

  constructor() {
    super();
    // all parts share a 400x520 canvas; pivots in that space
    this.addChild(this.cushion, this.rig);
    this.rig.pivot.set(200, 440); this.rig.position.set(200, 440);
    this.armUp.pivot.set(258, 322); this.armUp.position.set(258, 322);
    this.armDown.pivot.set(142, 322); this.armDown.position.set(142, 322);
    this.head.pivot.set(200, 286); this.head.position.set(200, 286);
    this.head.addChild(this.headBase, this.eyes, this.mouth);
    this.rig.addChild(this.armUp, this.body, this.armDown, this.head);
    for (let i = 0; i < 3; i++) {
      const z = new Text({ text: 'z', style: { fontFamily: FONT, fontSize: 36 + i * 10, fontWeight: 'bold', fill: '#F5EEDC', stroke: { color: '#1b1a2e', width: 5 } } });
      z.visible = false;
      this.zzz.push(z);
      this.addChild(z);
    }
  }

  private face(e: Eyes, m: Mouth) {
    this.eyes.texture = TEX['m_eyes_' + e];
    this.mouth.texture = TEX['m_mouth_' + m];
  }

  react(mood: Mood, dur = 1800) {
    if (mood !== 'doze') this.idleMs = 0;
    this.mood = mood;
    this.moodT = 0;
    this.moodDur = dur;
    for (const z of this.zzz) z.visible = mood === 'doze';
  }
  /** Waves the raised paw (wins). */
  wave(d = 1800) { this.react('wave', d); }
  /** Bows (feature triggers). */
  bow(d = 1600) { this.react('bow', d); }
  /** Big celebration (big wins). */
  cheer(d = 3000) { this.react('cheer', d); }
  surprise(d = 1200) { this.react('surprise', d); }
  poke() { this.idleMs = 0; if (this.mood === 'doze') this.react('idle', 0); }

  update(dt: number) {
    this.t += dt;
    this.moodT += dt;
    this.idleMs += dt;
    if (this.mood !== 'idle' && this.mood !== 'doze' && this.moodT > this.moodDur) this.react('idle', 0);
    if (this.mood === 'idle' && this.idleMs > 25000) this.react('doze', Infinity);

    const t = this.t / 1000, k = this.calm ? 0.4 : 1;
    let bodyY = 0, bodyRot = 0, headRot = Math.sin(t * 1.2) * 0.025 * k, headY = 0, armUp = Math.sin(t * 2.2) * 0.06 * k, armDown = 0, squash = 1 + Math.sin(t * 2) * 0.01 * k;
    switch (this.mood) {
      case 'idle': {
        this.blinkT -= dt;
        if (this.blinkT < 0) { this.face('closed', 'smile'); if (this.blinkT < -140) this.blinkT = 2400 + Math.random() * 3000; }
        else this.face('open', 'smile');
        break;
      }
      case 'wave': {
        // beckoning: the raised paw curls forward and back
        this.face('happy', 'open');
        armUp = -0.15 + Math.sin(this.moodT / 110) * 0.38 * k;
        headRot = Math.sin(this.moodT / 220) * 0.06 * k;
        break;
      }
      case 'bow': {
        this.face('happy', 'smile');
        const p = Math.min(1, this.moodT / 350), back = this.moodT > this.moodDur - 400 ? Math.max(0, (this.moodDur - this.moodT) / 400) : 1;
        const b = p * back;
        headY = 34 * b; squash = 1 - 0.07 * b; armUp = 0.5 * b; armDown = -0.25 * b; headRot = 0;
        break;
      }
      case 'cheer': {
        this.face('happy', 'open');
        bodyY = -Math.abs(Math.sin(this.moodT / 130)) * 22 * k;
        bodyRot = Math.sin(this.moodT / 260) * 0.06 * k;
        armUp = -0.2 + Math.sin(this.moodT / 80) * 0.45 * k;
        armDown = Math.sin(this.moodT / 160) * 0.12 * k;
        break;
      }
      case 'surprise': {
        this.face('wide', 'open');
        const p = Math.min(1, this.moodT / 120);
        bodyY = -12 * p; armUp = -0.3 * p; squash = 1.03;
        break;
      }
      case 'doze': {
        this.face('closed', 'sleep');
        headRot = 0.14 + Math.sin(t * 0.9) * 0.03;
        headY = 6;
        armUp = 0.35;
        squash = 1 + Math.sin(t * 0.9) * 0.02;
        this.zzz.forEach((z, i) => {
          const p = ((t * 0.3 + i / 3) % 1);
          z.position.set(290 + p * 70 + Math.sin(p * 8) * 8, 130 - p * 110);
          z.alpha = Math.sin(p * Math.PI);
        });
        break;
      }
    }
    this.rig.rotation = bodyRot;
    this.rig.position.y = 440 + bodyY;
    this.rig.scale.set(1 / squash, squash);
    this.head.rotation = headRot;
    this.head.position.y = 286 + headY;
    this.armUp.rotation = armUp;
    this.armDown.rotation = armDown;
  }
}
