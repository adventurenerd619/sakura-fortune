/**
 * RTP simulator. Usage:
 *   npm run sim                         (10,000,000 base spins + 1,000,000 of each bonus buy)
 *   npm run sim -- --spins 2000000 --buys 200000 --seed 7
 * Writes sim-report.txt and exits with code 1 if any target is missed.
 */
import fs from 'fs';
import { playSpin, playBonusBuy, STRIPS, FS_STRIPS, type SpinResult } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { BONUS_BUY, MAX_WIN_X, OMIKUJI_SLIPS } from '../src/config/math';

const args = process.argv.slice(2);
const arg = (name: string, def: number) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const SPINS = arg('spins', 10_000_000);
const BUYS = arg('buys', 1_000_000);
const SEED = arg('seed', 2026);

const rng = makeRng(SEED);
const bet = 1;
const lines: string[] = [];
const out = (s = '') => { console.log(s); lines.push(s); };
const pct = (a: number, b: number) => ((100 * a) / b).toFixed(2) + '%';
const oneIn = (n: number, k: number) => (k ? `1 in ${(n / k).toFixed(1)}` : 'never');
const DIST_LABELS = ['none', '<1x', '1-5x', '5-10x', '10-25x', '25-50x', '50-250x', '250-1000x', '1000x+'];
const bucket = (x: number) => (x === 0 ? 0 : x < 1 ? 1 : x < 5 ? 2 : x < 10 ? 3 : x < 25 ? 4 : x < 50 ? 5 : x < 250 ? 6 : x < 1000 ? 7 : 8);

let base = 0, scatter = 0, fsWin = 0, toriiWin = 0, omiWin = 0, hits = 0, wsq = 0;
let fsCount = 0, toriiCount = 0, omiCount = 0, both = 0, maxWin = 0, capped = 0, cascades = 0, cascadeSpins = 0, summits = 0, retrig = 0;
const fsBells = [0, 0, 0];
const slipCount: Record<string, number> = {};
const dist = new Array(DIST_LABELS.length).fill(0);
let maxDesc = '';
const t0 = Date.now();

const describe = (r: SpinResult) => [r.baseWin ? `base ${r.baseWin.toFixed(2)}x` : '', r.freeSpins ? `free spins ${r.freeSpins.win.toFixed(2)}x (${r.freeSpins.spins.length} spins, mult x${r.freeSpins.finalMult})` : '', r.torii ? `Torii ${r.torii.win.toFixed(2)}x${r.torii.summit ? ' (summit)' : ''}` : '', r.omikuji ? `Omikuji ${r.omikuji.pay}x` : ''].filter(Boolean).join(' + ');

for (let i = 0; i < SPINS; i++) {
  const r = playSpin(rng, bet);
  const x = r.winX;
  base += r.baseWin;
  if (r.base!.steps.length > 1) { cascadeSpins++; cascades += r.base!.steps.length - 2; }
  if (r.freeSpins) {
    fsCount++; fsBells[r.freeSpins.bells - 3]++;
    scatter += r.freeSpins.scatterPay; fsWin += r.freeSpins.win - r.freeSpins.scatterPay;
    retrig += r.freeSpins.retriggers;
  }
  if (r.torii) { toriiCount++; toriiWin += r.torii.win; if (r.torii.summit) summits++; }
  if (r.freeSpins && r.torii) both++;
  if (r.omikuji) { omiCount++; omiWin += r.omikuji.pay; for (const d of r.omikuji.draws) slipCount[d] = (slipCount[d] || 0) + 1; }
  if (x > 0) hits++;
  wsq += x * x;
  dist[bucket(x)]++;
  if (r.capped) capped++;
  if (x > maxWin) { maxWin = x; maxDesc = describe(r); }
  if (i > 0 && i % 2_000_000 === 0) process.stderr.write(`  ${i.toLocaleString()} spins...\n`);
}

const total = base + scatter + fsWin + toriiWin + omiWin;
const rtp = (100 * total) / SPINS;
const mean = total / SPINS;
const sd = Math.sqrt(wsq / SPINS - mean * mean);
out('================ SAKURA FORTUNE RTP SIMULATION ================');
out(`Spins: ${SPINS.toLocaleString()}  buys: ${BUYS.toLocaleString()} each  seed ${SEED}`);
out(`Strip lengths: base ${STRIPS.map((s) => s.length).join(', ')} | free spins ${FS_STRIPS.map((s) => s.length).join(', ')}`);
out('');
out(`TOTAL RTP:              ${rtp.toFixed(2)}%   (std dev per spin ${sd.toFixed(2)}x, ±${(196 * sd / Math.sqrt(SPINS)).toFixed(2)}% at 95%)`);
out(`  Base game + cascades: ${pct(base, SPINS)}`);
out(`  Omikuji Fortune Draw: ${pct(omiWin, SPINS)}`);
out(`  Torii Path:           ${pct(toriiWin, SPINS)}`);
out(`  Free Spins:           ${pct(fsWin + scatter, SPINS)}  (of which Bell scatter pays ${pct(scatter, SPINS)})`);
out(`Hit rate:               ${pct(hits, SPINS)}  (1 in ${(SPINS / hits).toFixed(2)})`);
out(`Cascading spins:        ${pct(cascadeSpins, SPINS)} of spins win; ${(cascades / Math.max(1, cascadeSpins)).toFixed(3)} extra cascades per winning spin`);
out(`Free Spins trigger:     ${oneIn(SPINS, fsCount)}  (3/4/5 Bells: ${fsBells.join(' / ')}; avg ${(fsWin / Math.max(1, fsCount) + scatter / Math.max(1, fsCount)).toFixed(2)}x; ${(retrig / Math.max(1, fsCount)).toFixed(2)} lantern retriggers each)`);
out(`Torii Path trigger:     ${oneIn(SPINS, toriiCount)}  (avg ${(toriiWin / Math.max(1, toriiCount)).toFixed(2)}x; summit ${pct(summits, Math.max(1, toriiCount))} of climbs)`);
out(`Both on one spin:       ${both}`);
out(`Omikuji draw:           ${oneIn(SPINS, omiCount)}  (avg ${(omiWin / Math.max(1, omiCount)).toFixed(2)}x)  slips: ${OMIKUJI_SLIPS.map((s) => `${s.name} ${slipCount[s.key] || 0}`).join(', ')}`);
out(`Biggest win:            ${maxWin.toFixed(2)}x  (${maxDesc})`);
out(`Spins hitting the ${MAX_WIN_X.toLocaleString()}x cap: ${capped}`);
out('Win distribution (x bet):');
DIST_LABELS.forEach((l, i) => out(`  ${l.padEnd(10)} ${pct(dist[i], SPINS).padStart(8)}   ${dist[i] ? oneIn(SPINS, dist[i]) : ''}`));

const buyRtp: Record<string, number> = {};
for (const kind of ['torii', 'freespins'] as const) {
  let cost = 0, win = 0, sq = 0, mx = 0, sum = 0;
  for (let i = 0; i < BUYS; i++) {
    const r = playBonusBuy(rng, bet, kind);
    cost += r.cost; win += r.winX; sq += r.winX * r.winX; mx = Math.max(mx, r.winX);
    if (r.torii?.summit) sum++;
  }
  const m = win / BUYS, s = Math.sqrt(sq / BUYS - m * m);
  buyRtp[kind] = (100 * win) / cost;
  out('');
  out(`BONUS BUY ${kind === 'torii' ? 'TORII PATH' : 'FREE SPINS'} (${BONUS_BUY[kind]}x bet): RTP ${buyRtp[kind].toFixed(2)}%  (±${(196 * s / Math.sqrt(BUYS) / BONUS_BUY[kind]).toFixed(2)}%)`);
  out(`  avg win ${m.toFixed(2)}x, std dev ${s.toFixed(2)}x, biggest ${mx.toFixed(2)}x${kind === 'torii' ? `, summit ${pct(sum, BUYS)}` : ''}`);
}

const checks: [string, boolean][] = [
  ['Total RTP 95.5-96.5%', rtp >= 95.5 && rtp <= 96.5],
  ['Torii Path buy RTP 95.5-96.5%', buyRtp.torii >= 95.5 && buyRtp.torii <= 96.5],
  ['Free Spins buy RTP 95.5-96.5%', buyRtp.freespins >= 95.5 && buyRtp.freespins <= 96.5],
  ['Hit rate 25-30%', hits / SPINS >= 0.25 && hits / SPINS <= 0.3],
  ['Free Spins about 1 in 280 (240-330)', SPINS / fsCount >= 240 && SPINS / fsCount <= 330],
  ['Torii Path about 1 in 240 (200-280)', SPINS / toriiCount >= 200 && SPINS / toriiCount <= 280],
  [`Max win within ${MAX_WIN_X}x`, maxWin <= MAX_WIN_X + 1e-9],
];
out('');
for (const [name, ok] of checks) out(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
out(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
fs.writeFileSync('sim-report.txt', lines.join('\n') + '\n');
if (checks.some(([, ok]) => !ok)) process.exit(1);
