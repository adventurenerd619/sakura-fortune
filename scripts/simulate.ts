/**
 * RTP simulator. Usage:
 *   npm run sim                         (10,000,000 base spins + 1,000,000 of each bonus buy)
 *   npm run sim -- --spins 2000000 --buys 200000 --seed 7 --workers 8
 * The work is split into `--chunks` (default 8) pieces with their own seeds (derived from --seed) and run on
 * `--workers` threads (default: up to 8, by CPU count). Results depend only on --seed and --chunks, never on
 * the number of threads, so a report is reproducible on any machine.
 * Writes sim-report.txt and exits with code 1 if any target is missed.
 */
import fs from 'fs';
import os from 'os';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { playSpin, playBonusBuy, STRIPS, FS_STRIPS, type SpinResult } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { BONUS_BUY, MAX_WIN_X, OMIKUJI_SLIPS } from '../src/config/math';

const DIST_LABELS = ['none', '<1x', '1-5x', '5-10x', '10-25x', '25-50x', '50-250x', '250-1000x', '1000x+'];
const bucket = (x: number) => (x === 0 ? 0 : x < 1 ? 1 : x < 5 ? 2 : x < 10 ? 3 : x < 25 ? 4 : x < 50 ? 5 : x < 250 ? 6 : x < 1000 ? 7 : 8);
const BUY_KINDS = ['torii', 'freespins'] as const;

interface BuyAgg { cost: number; win: number; sq: number; mx: number; summits: number }
interface Agg {
  spins: number; buys: number;
  base: number; scatter: number; fsWin: number; toriiWin: number; omiWin: number; hits: number; wsq: number;
  fsCount: number; toriiCount: number; omiCount: number; both: number; maxWin: number; maxDesc: string; capped: number;
  cascades: number; cascadeSpins: number; summits: number; retrig: number;
  fsBells: number[]; slipCount: Record<string, number>; dist: number[];
  buy: Record<(typeof BUY_KINDS)[number], BuyAgg>;
}

const describe = (r: SpinResult) => [r.baseWin ? `base ${r.baseWin.toFixed(2)}x` : '', r.freeSpins ? `free spins ${r.freeSpins.win.toFixed(2)}x (${r.freeSpins.spins.length} spins, mult x${r.freeSpins.finalMult})` : '', r.torii ? `Torii ${r.torii.win.toFixed(2)}x${r.torii.summit ? ' (summit)' : ''}` : '', r.omikuji ? `Omikuji ${r.omikuji.pay}x` : ''].filter(Boolean).join(' + ');

/** Plays one chunk with its own seeded RNG. */
function runChunk(seed: number, spins: number, buys: number): Agg {
  const rng = makeRng(seed);
  const a: Agg = {
    spins, buys, base: 0, scatter: 0, fsWin: 0, toriiWin: 0, omiWin: 0, hits: 0, wsq: 0,
    fsCount: 0, toriiCount: 0, omiCount: 0, both: 0, maxWin: 0, maxDesc: '', capped: 0,
    cascades: 0, cascadeSpins: 0, summits: 0, retrig: 0, fsBells: [0, 0, 0], slipCount: {}, dist: new Array(DIST_LABELS.length).fill(0),
    buy: { torii: { cost: 0, win: 0, sq: 0, mx: 0, summits: 0 }, freespins: { cost: 0, win: 0, sq: 0, mx: 0, summits: 0 } },
  };
  for (let i = 0; i < spins; i++) {
    const r = playSpin(rng, 1);
    const x = r.winX;
    a.base += r.baseWin;
    if (r.base!.steps.length > 1) { a.cascadeSpins++; a.cascades += r.base!.steps.length - 2; }
    if (r.freeSpins) {
      a.fsCount++; a.fsBells[r.freeSpins.bells - 3]++;
      a.scatter += r.freeSpins.scatterPay; a.fsWin += r.freeSpins.win - r.freeSpins.scatterPay;
      a.retrig += r.freeSpins.retriggers;
    }
    if (r.torii) { a.toriiCount++; a.toriiWin += r.torii.win; if (r.torii.summit) a.summits++; }
    if (r.freeSpins && r.torii) a.both++;
    if (r.omikuji) { a.omiCount++; a.omiWin += r.omikuji.pay; for (const d of r.omikuji.draws) a.slipCount[d] = (a.slipCount[d] || 0) + 1; }
    if (x > 0) a.hits++;
    a.wsq += x * x;
    a.dist[bucket(x)]++;
    if (r.capped) a.capped++;
    if (x > a.maxWin) { a.maxWin = x; a.maxDesc = describe(r); }
  }
  for (const kind of BUY_KINDS) {
    const b = a.buy[kind];
    for (let i = 0; i < buys; i++) {
      const r = playBonusBuy(rng, 1, kind);
      b.cost += r.cost; b.win += r.winX; b.sq += r.winX * r.winX; b.mx = Math.max(b.mx, r.winX);
      if (r.torii?.summit) b.summits++;
    }
  }
  return a;
}

function merge(parts: Agg[]): Agg {
  const t = parts[0];
  for (const p of parts.slice(1)) {
    for (const k of ['spins', 'buys', 'base', 'scatter', 'fsWin', 'toriiWin', 'omiWin', 'hits', 'wsq', 'fsCount', 'toriiCount', 'omiCount', 'both', 'capped', 'cascades', 'cascadeSpins', 'summits', 'retrig'] as const) t[k] += p[k];
    if (p.maxWin > t.maxWin) { t.maxWin = p.maxWin; t.maxDesc = p.maxDesc; }
    p.fsBells.forEach((n, i) => (t.fsBells[i] += n));
    p.dist.forEach((n, i) => (t.dist[i] += n));
    for (const [k, n] of Object.entries(p.slipCount)) t.slipCount[k] = (t.slipCount[k] || 0) + n;
    for (const kind of BUY_KINDS) {
      const a = t.buy[kind], b = p.buy[kind];
      a.cost += b.cost; a.win += b.win; a.sq += b.sq; a.mx = Math.max(a.mx, b.mx); a.summits += b.summits;
    }
  }
  return t;
}

/** Splits n into k near-equal whole parts. */
const split = (n: number, k: number) => Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));

async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string, def: number) => { const i = args.indexOf('--' + name); return i >= 0 ? Number(args[i + 1]) : def; };
  const SPINS = arg('spins', 10_000_000);
  const BUYS = arg('buys', 1_000_000);
  const SEED = arg('seed', 2026);
  const CHUNKS = Math.max(1, arg('chunks', 8));
  const WORKERS = Math.max(1, Math.min(CHUNKS, arg('workers', Math.min(8, os.cpus().length))));
  const t0 = Date.now();
  const spinParts = split(SPINS, CHUNKS), buyParts = split(BUYS, CHUNKS);
  const jobs = spinParts.map((s, i) => ({ seed: (SEED * 1000003 + i * 7919) >>> 0, spins: s, buys: buyParts[i] }));
  const results: Agg[] = new Array(CHUNKS);
  // a small pool: each thread takes the next chunk until all are done
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (next < CHUNKS) {
      const i = next++;
      results[i] = await new Promise<Agg>((resolve, reject) => {
        const w = new Worker(__filename, { workerData: jobs[i] });
        w.once('message', resolve);
        w.once('error', reject);
      });
      done++;
      process.stderr.write(`  chunk ${done}/${CHUNKS} done (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
    }
  }));
  const a = merge(results);

  const lines: string[] = [];
  const out = (s = '') => { console.log(s); lines.push(s); };
  const pct = (x: number, y: number) => ((100 * x) / y).toFixed(2) + '%';
  const oneIn = (n: number, k: number) => (k ? `1 in ${(n / k).toFixed(1)}` : 'never');
  const total = a.base + a.scatter + a.fsWin + a.toriiWin + a.omiWin;
  const rtp = (100 * total) / SPINS;
  const mean = total / SPINS;
  const sd = Math.sqrt(a.wsq / SPINS - mean * mean);
  out('================ SAKURA FORTUNE RTP SIMULATION ================');
  out(`Spins: ${SPINS.toLocaleString()}  buys: ${BUYS.toLocaleString()} each  seed ${SEED}  (${CHUNKS} chunks)`);
  out(`Strip lengths: base ${STRIPS.map((s) => s.length).join(', ')} | free spins ${FS_STRIPS.map((s) => s.length).join(', ')}`);
  out('');
  out(`TOTAL RTP:              ${rtp.toFixed(2)}%   (std dev per spin ${sd.toFixed(2)}x, ±${((196 * sd) / Math.sqrt(SPINS)).toFixed(2)}% at 95%)`);
  out(`  Base game + cascades: ${pct(a.base, SPINS)}`);
  out(`  Omikuji Fortune Draw: ${pct(a.omiWin, SPINS)}`);
  out(`  Torii Path:           ${pct(a.toriiWin, SPINS)}`);
  out(`  Free Spins:           ${pct(a.fsWin + a.scatter, SPINS)}  (of which Bell scatter pays ${pct(a.scatter, SPINS)})`);
  out(`Hit rate:               ${pct(a.hits, SPINS)}  (1 in ${(SPINS / a.hits).toFixed(2)})`);
  out(`Cascading spins:        ${pct(a.cascadeSpins, SPINS)} of spins win; ${(a.cascades / Math.max(1, a.cascadeSpins)).toFixed(3)} extra cascades per winning spin`);
  out(`Free Spins trigger:     ${oneIn(SPINS, a.fsCount)}  (3/4/5 Bells: ${a.fsBells.join(' / ')}; avg ${((a.fsWin + a.scatter) / Math.max(1, a.fsCount)).toFixed(2)}x; ${(a.retrig / Math.max(1, a.fsCount)).toFixed(2)} lantern retriggers each)`);
  out(`Torii Path trigger:     ${oneIn(SPINS, a.toriiCount)}  (avg ${(a.toriiWin / Math.max(1, a.toriiCount)).toFixed(2)}x; summit ${pct(a.summits, Math.max(1, a.toriiCount))} of climbs)`);
  out(`Both on one spin:       ${a.both}`);
  out(`Omikuji draw:           ${oneIn(SPINS, a.omiCount)}  (avg ${(a.omiWin / Math.max(1, a.omiCount)).toFixed(2)}x)  slips: ${OMIKUJI_SLIPS.map((s) => `${s.name} ${a.slipCount[s.key] || 0}`).join(', ')}`);
  out(`Biggest win:            ${a.maxWin.toFixed(2)}x  (${a.maxDesc})`);
  out(`Spins hitting the ${MAX_WIN_X.toLocaleString()}x cap: ${a.capped}`);
  out('Win distribution (x bet):');
  DIST_LABELS.forEach((l, i) => out(`  ${l.padEnd(10)} ${pct(a.dist[i], SPINS).padStart(8)}   ${a.dist[i] ? oneIn(SPINS, a.dist[i]) : ''}`));
  const buyRtp: Record<string, number> = {};
  for (const kind of BUY_KINDS) {
    const b = a.buy[kind];
    const m = b.win / BUYS, s = Math.sqrt(b.sq / BUYS - m * m);
    buyRtp[kind] = (100 * b.win) / b.cost;
    out('');
    out(`BONUS BUY ${kind === 'torii' ? 'TORII PATH' : 'FREE SPINS'} (${BONUS_BUY[kind]}x bet): RTP ${buyRtp[kind].toFixed(2)}%  (±${((196 * s) / Math.sqrt(BUYS) / BONUS_BUY[kind]).toFixed(2)}%)`);
    out(`  avg win ${m.toFixed(2)}x, std dev ${s.toFixed(2)}x, biggest ${b.mx.toFixed(2)}x${kind === 'torii' ? `, summit ${pct(b.summits, BUYS)}` : ''}`);
  }
  const checks: [string, boolean][] = [
    ['Total RTP 95.5-96.5%', rtp >= 95.5 && rtp <= 96.5],
    ['Torii Path buy RTP 95.5-96.5%', buyRtp.torii >= 95.5 && buyRtp.torii <= 96.5],
    ['Free Spins buy RTP 95.5-96.5%', buyRtp.freespins >= 95.5 && buyRtp.freespins <= 96.5],
    ['Hit rate 25-30%', a.hits / SPINS >= 0.25 && a.hits / SPINS <= 0.3],
    ['Free Spins about 1 in 280 (240-330)', SPINS / a.fsCount >= 240 && SPINS / a.fsCount <= 330],
    ['Torii Path about 1 in 240 (200-280)', SPINS / a.toriiCount >= 200 && SPINS / a.toriiCount <= 280],
    [`Max win within ${MAX_WIN_X}x`, a.maxWin <= MAX_WIN_X + 1e-9],
  ];
  out('');
  for (const [name, ok] of checks) out(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  out(`(${((Date.now() - t0) / 1000).toFixed(1)}s on ${WORKERS} thread${WORKERS > 1 ? 's' : ''})`);
  fs.writeFileSync('sim-report.txt', lines.join('\n') + '\n');
  if (checks.some(([, ok]) => !ok)) process.exit(1);
}

if (isMainThread) void main();
else {
  const { seed, spins, buys } = workerData as { seed: number; spins: number; buys: number };
  parentPort!.postMessage(runChunk(seed, spins, buys));
}
