/**
 * Web Audio synth: every sound and all music are generated in code.
 *   instruments: koto (plucked string), shakuhachi-style flute, taiko and shime drums,
 *                wind chime, temple bell, wooden clapper
 *   music: base (dusk village), night (lantern festival free spins), climb (Torii Path)
 */
export type Track = 'base' | 'night' | 'climb';

interface TrackDef {
  bpm: number;
  root: number; // MIDI note
  scale: number[]; // semitone offsets, one octave
  /** called for each 16th step; schedule notes at `t` */
  step: (a: Audio, step: number, t: number, bar: number, spb: number) => void;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  reverb: ConvolverNode;
  wet: GainNode;
  noise: AudioBuffer;
  settings = { master: 0.8, music: 0.55, sfx: 0.8, muted: false };
  private track: Track | null = null;
  private timer: number | null = null;
  private nextT = 0;
  private stepN = 0;
  private trackGain: GainNode | null = null;
  private melody: number[] = [];

  constructor() {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.reverb = this.ctx.createConvolver();
    this.wet = this.ctx.createGain();
    this.wet.gain.value = 0.28;
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.music.connect(this.reverb);
    this.sfx.connect(this.reverb);
    this.reverb.connect(this.wet).connect(this.master);
    this.master.connect(this.ctx.destination);
    // a simple decaying-noise impulse response (hall)
    const len = this.ctx.sampleRate * 2.2;
    const ir = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.reverb.buffer = ir;
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.apply();
  }

  apply() {
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
    this.music.gain.setTargetAtTime(s.music * 0.5, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
  }
  resume() { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  get now() { return this.ctx.currentTime; }

  // ======================= instruments =======================

  /** Koto: bright plucked string with a quick decay and a little pitch bend at the attack. */
  koto(freq: number, t = this.now, vol = 0.3, dest: AudioNode = this.sfx, decay = 1.4) {
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(9000, freq * 9), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 2), t + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    for (const [mul, type, v] of [[1, 'triangle', 1], [2, 'sawtooth', 0.18], [3, 'sine', 0.12]] as [number, OscillatorType, number][]) {
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq * mul * 1.012, t);
      o.frequency.exponentialRampToValueAtTime(freq * mul, t + 0.05);
      og.gain.value = v;
      o.connect(og).connect(f);
      o.start(t); o.stop(t + decay + 0.05);
    }
    // pluck noise
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const ng = this.ctx.createGain();
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = freq * 4; nf.Q.value = 2;
    ng.gain.setValueAtTime(vol * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(nf).connect(ng).connect(g);
    n.start(t); n.stop(t + 0.04);
    f.connect(g).connect(dest);
  }

  /** Shakuhachi-style flute: soft sine/triangle with vibrato and breath noise. */
  flute(freq: number, t: number, dur: number, vol = 0.16, dest: AudioNode = this.music) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.12);
    g.gain.setValueAtTime(vol, t + Math.max(0.12, dur - 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 5.2;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(freq * 0.012, t + dur * 0.6);
    lfo.connect(lg);
    for (const [type, v] of [['sine', 1], ['triangle', 0.25]] as [OscillatorType, number][]) {
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = type;
      // shakuhachi "meri" scoop into the note
      o.frequency.setValueAtTime(freq * 0.97, t);
      o.frequency.linearRampToValueAtTime(freq, t + 0.12);
      lg.connect(o.frequency);
      og.gain.value = v;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + dur + 0.35);
    }
    lfo.start(t); lfo.stop(t + dur + 0.35);
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise; n.loop = true;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = freq * 2; nf.Q.value = 1.5;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(vol * 0.35, t + 0.06);
    ng.gain.exponentialRampToValueAtTime(vol * 0.08, t + 0.4);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    n.connect(nf).connect(ng).connect(g);
    n.start(t); n.stop(t + dur + 0.35);
    g.connect(dest);
  }

  /** Taiko: deep pitched drum with a skin slap. */
  taiko(t = this.now, vol = 0.6, pitch = 95, dest: AudioNode = this.sfx) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.55, t + 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + 0.85);
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'lowpass'; nf.frequency.value = 900;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.6, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    n.connect(nf).connect(ng).connect(dest);
    n.start(t); n.stop(t + 0.1);
  }
  /** Shime-daiko: small high drum / rim tap. */
  shime(t = this.now, vol = 0.2, dest: AudioNode = this.music) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 1800; nf.Q.value = 3;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(vol, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(nf).connect(ng).connect(dest);
    n.start(t); n.stop(t + 0.08);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.08);
    g.gain.setValueAtTime(vol * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(dest); o.start(t); o.stop(t + 0.12);
  }
  /** Bell-like tone with inharmonic partials. */
  private bell(freq: number, t: number, vol: number, decay: number, partials: [number, number][], dest: AudioNode = this.sfx) {
    for (const [ratio, amp] of partials) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay * (1.2 - ratio * 0.08));
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + decay * 1.2);
    }
  }
  /** Wind chime: a few glassy high notes. */
  chime(n = 4, t = this.now, vol = 0.12) {
    const notes = [86, 88, 91, 93, 95, 98, 100];
    for (let i = 0; i < n; i++) this.bell(mtof(notes[Math.floor(Math.random() * notes.length)]), t + i * (0.07 + Math.random() * 0.08), vol, 1.6, [[1, 1], [2.76, 0.35], [5.4, 0.15]]);
  }
  /** Temple bell (Shrine Bell scatter). */
  templeBell(t = this.now, vol = 0.32) {
    this.bell(mtof(55), t, vol, 3.5, [[0.5, 0.5], [1, 1], [1.19, 0.4], [1.56, 0.3], [2.0, 0.25], [2.74, 0.15], [3.6, 0.08]]);
  }
  /** Small shrine bell (suzu) shake. */
  suzu(t = this.now, vol = 0.16) {
    for (let i = 0; i < 5; i++) this.bell(mtof(96 + (i % 2) * 3), t + i * 0.045, vol, 0.5, [[1, 1], [2.3, 0.4]]);
  }
  /** Hyoshigi-style wooden clapper (UI clicks, die). */
  wood(t = this.now, vol = 0.18, pitch = 1200) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(pitch, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.7, t + 0.04);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = pitch; f.Q.value = 5;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.07);
  }
  /** Soft wind / petal whoosh. */
  whoosh(t = this.now, vol = 0.12, dur = 0.5) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise; n.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(this.sfx);
    n.start(t); n.stop(t + dur + 0.05);
  }

  // ======================= game sounds =======================
  private readonly PENTA = [62, 63, 67, 69, 70, 74, 75, 79]; // in-scale on D
  click() { this.wood(this.now, 0.12, 1500); }
  spinStart() { this.whoosh(this.now, 0.06, 0.35); this.koto(mtof(50), this.now, 0.12, this.sfx, 0.6); }
  reelStop(i: number) { this.koto(mtof(this.PENTA[i + 1]), this.now, 0.26); }
  win(level: number) { this.chime(2 + Math.min(4, level), this.now, 0.1 + Math.min(0.08, level * 0.02)); }
  lineTick(i: number) { this.koto(mtof(this.PENTA[(i % 6) + 2]), this.now, 0.14, this.sfx, 0.8); }
  cascade(level: number) {
    this.whoosh(this.now, 0.12, 0.45);
    const t = this.now;
    for (let i = 0; i <= Math.min(level, 4); i++) this.koto(mtof(this.PENTA[i + 2] + 12), t + i * 0.05, 0.15, this.sfx, 0.7);
  }
  scatter() { this.templeBell(); }
  scatterLand(n: number) { this.templeBell(this.now, 0.2 + n * 0.05); }
  maskLand() { this.koto(mtof(57), this.now, 0.2); this.flute(mtof(69), this.now, 0.6, 0.12, this.sfx); }
  featureStart() {
    const t = this.now;
    // taiko roll building to a big hit
    for (let i = 0; i < 10; i++) this.taiko(t + i * (0.18 - i * 0.012), 0.25 + i * 0.04, 90);
    this.taiko(t + 1.45, 0.9, 70);
    this.templeBell(t + 1.45, 0.25);
  }
  bigWin() { const t = this.now; this.taiko(t, 0.7, 80); this.taiko(t + 0.25, 0.7, 80); this.chime(6, t + 0.3, 0.14); }
  tier() { this.taiko(this.now, 0.6, 85); this.chime(4, this.now, 0.12); }
  countTick() { this.koto(mtof(86 + Math.floor(Math.random() * 3) * 2), this.now, 0.05, this.sfx, 0.3); }
  omikujiShake() { const t = this.now; for (let i = 0; i < 6; i++) this.wood(t + i * 0.07, 0.1, 700 + Math.random() * 300); this.suzu(t, 0.08); }
  omikujiDraw() { this.wood(this.now, 0.2, 900); this.whoosh(this.now + 0.05, 0.08, 0.3); }
  slipReveal(good: boolean) { if (good) { this.chime(5, this.now, 0.13); this.koto(mtof(74), this.now, 0.25); } else { this.koto(mtof(50), this.now, 0.25, this.sfx, 2); this.koto(mtof(51), this.now + 0.2, 0.2, this.sfx, 2); } }
  dieRoll() { const t = this.now; for (let i = 0; i < 6; i++) this.wood(t + i * 0.06, 0.12, 900 + Math.random() * 600); }
  hop() { this.wood(this.now, 0.07, 2000); }
  gate() { this.taiko(this.now, 0.35, 120); this.suzu(this.now + 0.05, 0.12); }
  land(effect: string) {
    if (effect === 'offering') this.chime(3, this.now, 0.12);
    else if (effect === 'lantern') { this.koto(mtof(79), this.now, 0.2); this.chime(2, this.now + 0.1, 0.1); }
    else if (effect === 'ema') this.wood(this.now, 0.2, 800);
    else if (effect === 'fox') { this.flute(mtof(81), this.now, 0.5, 0.12, this.sfx); this.whoosh(this.now, 0.1, 0.5); }
    else this.whoosh(this.now, 0.06, 0.6);
  }
  summit() { this.templeBell(this.now, 0.35); this.featureStartSmall(); this.chime(6, this.now + 0.3, 0.14); }
  private featureStartSmall() { const t = this.now; this.taiko(t, 0.7, 80); this.taiko(t + 0.2, 0.7, 80); }
  lanternLit() { this.koto(mtof(81), this.now, 0.16); this.chime(2, this.now, 0.1); }
  stickyLock() { this.koto(mtof(69), this.now, 0.18, this.sfx, 0.9); this.suzu(this.now, 0.06); }
  retrigger() { this.taiko(this.now, 0.6, 90); this.chime(5, this.now + 0.1, 0.14); }
  error() { this.koto(mtof(45), this.now, 0.2, this.sfx, 0.5); }

  // ======================= music =======================
  private tracks: Record<Track, TrackDef> = {
    base: {
      bpm: 84, root: 50, scale: [0, 1, 5, 7, 8], // miyako-bushi on D
      step: (a, s, t, bar, spb) => {
        const deg = (d: number) => mtof(a.tracks.base.root + 12 + a.scaleNote(a.tracks.base.scale, d));
        // koto arpeggio on 8ths
        if (s % 2 === 0) {
          const pat = [0, 2, 4, 5, 7, 5, 4, 2];
          const shift = [0, 0, -2, 1][bar % 4];
          a.koto(deg(pat[(s / 2) % 8] + shift), t, 0.07, a.music, 1.1);
        }
        if (s % 8 === 0) a.koto(mtof(a.tracks.base.root - 12 + [0, 0, -2, 5][bar % 4]), t, 0.12, a.music, 2.2);
        if (s === 0) a.taiko(t, 0.18, 85, a.music);
        if (s === 10 && bar % 2 === 1) a.shime(t, 0.07);
        // flute phrase every other bar
        if (bar % 4 === 2 && s % 4 === 0) {
          const m = a.melody[(bar * 4 + s / 4) % a.melody.length];
          if (m !== -99) a.flute(deg(m + 7), t, spb * 3.6, 0.07);
        }
      },
    },
    night: {
      bpm: 66, root: 45, scale: [0, 2, 3, 7, 8], // hirajoshi on A
      step: (a, s, t, bar, spb) => {
        const deg = (d: number) => mtof(a.tracks.night.root + 12 + a.scaleNote(a.tracks.night.scale, d));
        if (s % 4 === 0) a.koto(deg([0, 4, 2, 5, 3, 7, 4, 2][(s / 4 + bar) % 8]), t, 0.05, a.music, 1.8);
        if (s === 0) a.koto(mtof(a.tracks.night.root - 12 + [0, -4, 3, -2][bar % 4]), t, 0.1, a.music, 3);
        if (s === 0 && bar % 2 === 0) a.taiko(t, 0.12, 70, a.music);
        if (s % 8 === 0) {
          const m = a.melody[(bar * 2 + s / 8) % a.melody.length];
          if (m !== -99) a.flute(deg(m + 5), t, spb * 7, 0.09);
        }
        if (s === 6 && Math.random() < 0.35) a.chime(2, t, 0.03);
      },
    },
    climb: {
      bpm: 104, root: 50, scale: [0, 2, 5, 7, 9], // yo scale on D
      step: (a, s, t, bar, spb) => {
        const deg = (d: number) => mtof(a.tracks.climb.root + 12 + a.scaleNote(a.tracks.climb.scale, d));
        // driving taiko pattern
        if ([0, 6, 8, 11].includes(s)) a.taiko(t, s === 0 ? 0.26 : 0.16, s === 0 ? 80 : 100, a.music);
        if (s % 2 === 1) a.shime(t, 0.05);
        if (s % 2 === 0) a.koto(deg([0, 4, 2, 4, 1, 4, 2, 4][(s / 2) % 8] + [0, 0, 2, -1][bar % 4]), t, 0.06, a.music, 0.7);
        if (bar % 2 === 1 && s % 4 === 0) {
          const m = a.melody[(bar * 4 + s / 4) % a.melody.length];
          if (m !== -99) a.flute(deg(m + 5), t, spb * 3.5, 0.07);
        }
      },
    },
  };
  scaleNote(scale: number[], d: number) {
    const o = Math.floor(d / scale.length), i = ((d % scale.length) + scale.length) % scale.length;
    return o * 12 + scale[i];
  }

  playMusic(track: Track | null) {
    if (track === this.track) return;
    // fade out the current track
    if (this.trackGain) {
      const g = this.trackGain;
      g.gain.setTargetAtTime(0, this.now, 0.4);
      setTimeout(() => g.disconnect(), 2500);
    }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.track = track;
    if (!track) return;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(1, this.now + 0.3, 0.6);
    g.connect(this.music);
    this.trackGain = g;
    // a new phrase each time the track starts (rests are -99)
    this.melody = Array.from({ length: 16 }, (_, i) => (i % 4 === 3 && Math.random() < 0.5 ? -99 : Math.floor(Math.random() * 6) - 1));
    this.nextT = this.now + 0.1;
    this.stepN = 0;
    const def = this.tracks[track];
    const realMusic = this.music;
    this.timer = window.setInterval(() => {
      const spb = 60 / def.bpm / 4;
      while (this.nextT < this.now + 0.25) {
        const bar = Math.floor(this.stepN / 16), s = this.stepN % 16;
        // route this track's notes through its own fade gain
        this.music = g as unknown as GainNode;
        try { def.step(this, s, this.nextT, bar, spb * 4); } finally { this.music = realMusic; }
        this.nextT += spb;
        this.stepN++;
      }
    }, 50);
  }
}
