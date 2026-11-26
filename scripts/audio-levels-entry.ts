// Renders every sound effect and music track offline (inside Electron) and measures its level.
// Used by scripts/audio-levels.cjs (npm run audio:levels).
import { Audio } from '../src/renderer/audio';

const SR = 44100;
type Row = { name: string; peakDb: number; rmsDb: number; activeS: number; brightness: number };

const db = (x: number) => (x <= 1e-9 ? -120 : 20 * Math.log10(x));

function analyse(name: string, buf: AudioBuffer): Row {
  const a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
  let peak = 0, sum = 0, n = 0, diffSum = 0, absSum = 0;
  for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]), Math.abs(b[i]));
  // active region: samples within 50 dB of the peak (ignores the silent tail)
  const floor = peak * 0.00316;
  for (let i = 1; i < a.length; i++) {
    const m = (a[i] + b[i]) / 2;
    if (Math.abs(m) > floor) { sum += m * m; n++; }
    // high-frequency share: energy of the first difference vs the signal (rough "harshness")
    const d = m - (a[i - 1] + b[i - 1]) / 2;
    diffSum += d * d; absSum += m * m;
  }
  return { name, peakDb: +db(peak).toFixed(1), rmsDb: +db(Math.sqrt(sum / Math.max(1, n))).toFixed(1), activeS: +(n / SR).toFixed(2), brightness: +Math.sqrt(diffSum / Math.max(1e-12, absSum)).toFixed(3) };
}

/** Renders one sound with every volume at maximum (worst case for clipping). */
async function render(name: string, seconds: number, play: (a: Audio, setT: (t: number) => void) => void): Promise<Row> {
  let fakeT = 0;
  (window as any).AudioContext = class extends OfflineAudioContext { constructor() { super(2, Math.ceil(SR * seconds), SR); } };
  const a = new Audio();
  Object.defineProperty(a.ctx, 'currentTime', { get: () => fakeT });
  a.settings = { master: 1, music: 1, sfx: 1, muted: false };
  a.apply();
  play(a, (t) => (fakeT = t));
  const timer = (a as any).timer;
  if (timer) clearInterval(timer);
  fakeT = 0;
  const buf = await (a.ctx as unknown as OfflineAudioContext).startRendering();
  return analyse(name, buf);
}

(window as any).runLevels = async () => {
  const rows: Row[] = [];
  const sfx: [string, number, (a: Audio) => void][] = [
    ['click', 0.5, (a) => a.click()],
    ['spinStart', 1, (a) => a.spinStart()],
    ['reelStop', 1.5, (a) => a.reelStop(0)],
    ['lineTick', 1, (a) => a.lineTick(2)],
    ['countTick', 0.5, (a) => a.countTick()],
    ['win small', 2.5, (a) => a.win(1)],
    ['win big', 2.5, (a) => a.win(4)],
    ['cascade x1', 1.5, (a) => a.cascade(0)],
    ['cascade x5', 1.5, (a) => a.cascade(4)],
    ['scatter bell', 5, (a) => a.scatter()],
    ['scatterLand', 5, (a) => a.scatterLand(3)],
    ['maskLand', 1.5, (a) => a.maskLand()],
    ['featureStart', 4, (a) => a.featureStart()],
    ['bigWin', 3, (a) => a.bigWin()],
    ['tier', 2.5, (a) => a.tier()],
    ['omikujiShake', 1.5, (a) => a.omikujiShake()],
    ['omikujiDraw', 1, (a) => a.omikujiDraw()],
    ['slip good', 2.5, (a) => a.slipReveal(true)],
    ['slip kyo', 2.5, (a) => a.slipReveal(false)],
    ['dieRoll', 1, (a) => a.dieRoll()],
    ['hop', 0.5, (a) => a.hop()],
    ['gate', 1.5, (a) => a.gate()],
    ['land offering', 2.5, (a) => a.land('offering')],
    ['land lantern', 2.5, (a) => a.land('lantern')],
    ['land ema', 1, (a) => a.land('ema')],
    ['land fox', 1.5, (a) => a.land('fox')],
    ['land mist', 1.5, (a) => a.land('mist')],
    ['summit', 5, (a) => a.summit()],
    ['lanternLit', 2.5, (a) => a.lanternLit()],
    ['stickyLock', 1.5, (a) => a.stickyLock()],
    ['retrigger', 2.5, (a) => a.retrigger()],
    ['error', 1, (a) => a.error()],
  ];
  for (const [name, s, fn] of sfx) rows.push(await render(name, s, (a) => fn(a)));
  for (const track of ['base', 'night', 'climb'] as const) {
    rows.push(await render('music ' + track, 20, (a, setT) => {
      a.playMusic(track);
      for (let t = 0; t < 19.6; t += 0.05) { setT(t); a.schedule(); }
    }));
  }
  return rows;
};
(window as any).levelsReady = true;
