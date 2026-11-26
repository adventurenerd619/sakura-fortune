/**
 * Engine tests: paylines, line evaluation, Sakura Cascade, Omikuji, Torii Path,
 * Lantern Festival Free Spins, bonus buys, forcing and the max-win cap.
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYM, PAYLINES, PAYTABLE, CASCADE_MULTS, TORII, FREE_SPINS, BONUS_BUY, MAX_WIN_X, OMIKUJI_SLIPS, REELS, ROWS,
} from '../src/config/math';
import {
  evalLines, runCascades, drawOmikuji, playTorii, makeToriiLayout, playFreeSpins, playSpin, playBonusBuy,
  STRIPS, FS_STRIPS, countSym, capTorii, type Board, type ToriiSpace,
} from '../src/engine/game';
import { makeRng } from '../src/engine/rng';

const { KOI, TORII: TO, FAN, KABUTO, LANTERN, MOCHI, TEACUP, CRANE, BAMBOO, MON, WILD, BELL, MASK } = SYM;
const LOWS = [MON, BAMBOO, CRANE, TEACUP, MOCHI];

/** Board where every cell differs from its neighbours on adjacent reels, so nothing wins by itself. */
function quietBoard(): Board {
  // reel r uses symbols that never appear on reel r+1 (no Wilds)
  const sets = [[MON, BAMBOO, CRANE], [TEACUP, MOCHI, LANTERN], [MON, BAMBOO, CRANE], [TEACUP, MOCHI, LANTERN], [MON, BAMBOO, CRANE]];
  return sets.map((s) => s.slice());
}

// ---------------------------------------------------------------- paylines

test('there are 25 distinct paylines over a 5x3 grid', () => {
  assert.equal(PAYLINES.length, 25);
  const keys = new Set(PAYLINES.map((l) => l.join('')));
  assert.equal(keys.size, 25);
  for (const l of PAYLINES) {
    assert.equal(l.length, REELS);
    for (const row of l) assert.ok(row >= 0 && row < ROWS);
  }
});

test('quiet board has no wins', () => {
  assert.deepEqual(evalLines(quietBoard()), []);
});

for (let li = 0; li < PAYLINES.length; li++) {
  test(`payline ${li + 1} (${PAYLINES[li].map((r) => r + 1).join('-')}) pays 5 Golden Koi`, () => {
    const b = quietBoard();
    PAYLINES[li].forEach((row, reel) => { b[reel][row] = KOI; });
    const wins = evalLines(b);
    const w = wins.find((x) => x.line === li);
    assert.ok(w, 'line wins');
    assert.equal(w!.sym, KOI);
    assert.equal(w!.count, 5);
    assert.equal(w!.pay, 10);
    assert.deepEqual(w!.cells, PAYLINES[li].map((row, reel) => [reel, row]));
    // every other winning line must also be all-Koi over its own first 3+ cells
    for (const o of wins) for (const [r, row] of o.cells) assert.equal(b[r][row], KOI);
  });

  test(`payline ${li + 1}: 3 of a kind from the left pays, a gap on reel 1 does not`, () => {
    const b = quietBoard();
    PAYLINES[li].slice(0, 3).forEach((row, reel) => { b[reel][row] = FAN; });
    const w = evalLines(b).find((x) => x.line === li);
    assert.ok(w);
    assert.equal(w!.count, 3);
    assert.equal(w!.pay, PAYTABLE[FAN][0]);
    // same symbols on reels 2-4 only (reel 1 broken): no win on this line
    const c = quietBoard();
    PAYLINES[li].slice(1, 4).forEach((row, i) => { c[i + 1][row] = FAN; });
    assert.equal(evalLines(c).find((x) => x.line === li), undefined);
  });
}

// ---------------------------------------------------------------- line rules

const lineBoard = (syms: number[]) => { const b = quietBoard(); syms.forEach((s, r) => { b[r][1] = s; }); return b; };

test('pays for every symbol match the paytable (3/4/5)', () => {
  for (const s of [KOI, TO, FAN, KABUTO, LANTERN, MOCHI, TEACUP, CRANE, BAMBOO, MON]) {
    for (const n of [3, 4, 5]) {
      const syms = [0, 1, 2, 3, 4].map((r) => (r < n ? s : r % 2 ? TEACUP : MON));
      if (n < 5 && syms[n] === s) syms[n] = s === MON ? BAMBOO : MON;
      const w = evalLines(lineBoard(syms)).find((x) => x.line === 0)!;
      assert.equal(w.pay, PAYTABLE[s][n - 3], `symbol ${s} x${n}`);
    }
  }
});

test('Wild substitutes, and the highest win per line counts', () => {
  // W W W K K: 5 Koi (10x) beats 3 Wilds (2x)
  let w = evalLines(lineBoard([WILD, WILD, WILD, KOI, KOI])).find((x) => x.line === 0)!;
  assert.equal(w.sym, KOI); assert.equal(w.count, 5); assert.equal(w.pay, 10);
  // W W W W Mon: 4 Wilds (5x) beats 5 Mon (0.5x)
  w = evalLines(lineBoard([WILD, WILD, WILD, WILD, MON])).find((x) => x.line === 0)!;
  assert.equal(w.sym, WILD); assert.equal(w.count, 4); assert.equal(w.pay, 5);
  // 5 Wilds pay 25x
  w = evalLines(lineBoard([WILD, WILD, WILD, WILD, WILD])).find((x) => x.line === 0)!;
  assert.equal(w.pay, 25);
  // Koi W Koi: 3 Koi
  w = evalLines(lineBoard([KOI, WILD, KOI, MON, BAMBOO])).find((x) => x.line === 0)!;
  assert.equal(w.count, 3); assert.equal(w.pay, 1);
  // only one win per line
  const wins = evalLines(lineBoard([WILD, WILD, WILD, KOI, KOI]));
  assert.equal(wins.filter((x) => x.line === 0).length, 1);
});

test('Wild does not substitute for Shrine Bell or Kitsune Mask, and they have no line pay', () => {
  assert.equal(evalLines(lineBoard([BELL, BELL, BELL, BELL, BELL])).find((x) => x.line === 0), undefined);
  assert.equal(evalLines(lineBoard([MASK, WILD, MASK, MON, MASK])).find((x) => x.line === 0), undefined);
  // Koi W Bell: only 2 long
  assert.equal(evalLines(lineBoard([KOI, WILD, BELL, KOI, KOI])).find((x) => x.line === 0), undefined);
  // W W W Bell: the Wilds pay on their own
  const w = evalLines(lineBoard([WILD, WILD, WILD, BELL, MON])).find((x) => x.line === 0)!;
  assert.equal(w.sym, WILD); assert.equal(w.count, 3);
});

// ---------------------------------------------------------------- strips

test('base strips: Wild only on reels 2-4, Kitsune Mask only on reels 1, 3, 5', () => {
  STRIPS.forEach((s, r) => {
    assert.equal(s.includes(WILD), r >= 1 && r <= 3, `wild on reel ${r + 1}`);
    assert.equal(s.includes(MASK), r === 0 || r === 2 || r === 4, `mask on reel ${r + 1}`);
    assert.ok(s.includes(BELL));
  });
  for (const s of FS_STRIPS) assert.ok(!s.includes(MASK), 'no masks in free spins');
  assert.ok(!FS_STRIPS[0].includes(WILD));
});

// ---------------------------------------------------------------- cascades

/** Hand-built strips (length 8): rows 0-2 are the board at stop 0, index 7/6 drop in first, then 5. */
function cascadeStrips() {
  const board = [[MON, FAN, KOI], [BAMBOO, FAN, KOI], [CRANE, FAN, KOI], [TEACUP, MOCHI, LANTERN], [KABUTO, TO, MON]];
  const above = [[TO, TEACUP, KABUTO], [FAN, MOCHI, KABUTO], [KOI, LANTERN, KABUTO], [MON, MON, MON], [MON, MON, MON]]; // [X(5), A(6), B(7)]
  return board.map((col, r) => [...col, MON, BAMBOO, ...above[r]]);
}

test('cascade: winning symbols burst, symbols fall, new ones drop from the strip, multipliers x1 then x2', () => {
  const res = runCascades(makeRng(1), cascadeStrips(), null, false, [0, 0, 0, 0, 0]);
  assert.equal(res.steps.length, 3);
  const [s1, s2, s3] = res.steps;
  // step 1: Fan on the middle line and Koi on the bottom line
  assert.equal(s1.mult, 1);
  assert.deepEqual(s1.wins.map((w) => [w.line, w.sym, w.count]).sort(), [[0, FAN, 3], [2, KOI, 3]].sort());
  assert.ok(Math.abs(s1.win - 1.6) < 1e-9);
  // step 2: reels 1-3 lost rows 1 and 2; the top symbol fell to the bottom; two new from the strip above
  assert.equal(s2.mult, 2);
  assert.deepEqual(s2.board[0], [TEACUP, KABUTO, MON]);
  assert.deepEqual(s2.board[1], [MOCHI, KABUTO, BAMBOO]);
  assert.deepEqual(s2.board[2], [LANTERN, KABUTO, CRANE]);
  assert.deepEqual(s2.board[3], [TEACUP, MOCHI, LANTERN]); // untouched reel
  assert.deepEqual(s2.wins.map((w) => [w.line, w.sym, w.count]), [[0, KABUTO, 3]]);
  assert.ok(Math.abs(s2.win - 0.5 * 2) < 1e-9);
  // step 3: one more symbol dropped per reel, no win, cascade ends
  assert.deepEqual(s3.board[0], [TO, TEACUP, MON]);
  assert.equal(s3.wins.length, 0);
  assert.equal(s3.mult, 3);
  assert.ok(Math.abs(res.win - 2.6) < 1e-9);
});

test('cascade multiplier ladder is x1, x2, x3, x5 and caps at x5; steps follow strip continuity', () => {
  assert.deepEqual(CASCADE_MULTS, [1, 2, 3, 5]);
  const rng = makeRng(77);
  let longest = 0;
  for (let n = 0; n < 4000; n++) {
    const res = runCascades(rng, STRIPS, null, false);
    longest = Math.max(longest, res.steps.length);
    let sum = 0;
    res.steps.forEach((st, i) => {
      assert.equal(st.mult, CASCADE_MULTS[Math.min(i, 3)]);
      const pay = st.wins.reduce((s, w) => s + w.pay, 0);
      assert.ok(Math.abs(st.win - pay * st.mult) < 1e-9);
      sum += st.win;
      if (i + 1 < res.steps.length) {
        // survivors keep their order at the bottom of each reel; Bells and Masks never burst
        const next = res.steps[i + 1].board;
        for (let r = 0; r < REELS; r++) {
          const removed = new Set(st.wins.flatMap((w) => w.cells.filter(([rr]) => rr === r).map(([, row]) => row)));
          const survivors = [0, 1, 2].filter((row) => !removed.has(row)).map((row) => st.board[r][row]);
          assert.deepEqual(next[r].slice(3 - survivors.length), survivors);
          const strip = STRIPS[r];
          // the dropped symbols are the ones directly above on the strip
          const k = removed.size;
          if (k) {
            const col = next[r].slice(0, k);
            const idx = strip.findIndex((_, j) => col.every((s, m) => strip[(j + m) % strip.length] === s));
            assert.ok(idx >= 0);
          }
        }
        assert.ok(st.wins.length > 0);
      } else assert.equal(st.wins.length, 0);
    });
    assert.ok(Math.abs(sum - res.win) < 1e-9);
    assert.equal(countSym(res.steps[0].board, BELL) <= countSym(res.finalBoard, BELL), true);
  }
  assert.ok(longest >= 4, 'some spins cascade at least 3 times');
});

test('sticky Wilds hold their cell, other symbols fall past them, and a line through a sticky Wild pays once per spin', () => {
  const rng = makeRng(5);
  for (let n = 0; n < 3000; n++) {
    const locked = Array.from({ length: REELS }, () => [false, false, false]);
    locked[1 + (n % 4)][n % 3] = true;
    const res = runCascades(rng, FS_STRIPS, locked, true);
    const paidSticky = new Set<number>();
    for (const st of res.steps) {
      for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) {
        if (locked[r][row]) { assert.equal(st.board[r][row], WILD); assert.ok(st.locked[r][row]); }
        if (st.board[r][row] === WILD) assert.ok(st.locked[r][row], 'every Wild in free spins is sticky');
      }
      for (const w of st.wins) if (w.cells.some(([r, row]) => st.locked[r][row])) {
        assert.ok(!paidSticky.has(w.line), 'line through a sticky Wild paid twice');
        paidSticky.add(w.line);
      }
    }
  }
});

// ---------------------------------------------------------------- Omikuji

test('Omikuji slip odds and prizes match the rules', () => {
  const byKey = Object.fromEntries(OMIKUJI_SLIPS.map((s) => [s.key, s]));
  assert.deepEqual(OMIKUJI_SLIPS.map((s) => [s.key, s.pay, s.weight]), [['daikichi', 50, 2], ['chukichi', 15, 10], ['shokichi', 5, 28], ['kichi', 2, 45], ['kyo', 0, 15]]);
  const rng = makeRng(9);
  const counts: Record<string, number> = {};
  const N = 200000;
  for (let i = 0; i < N; i++) {
    const r = drawOmikuji(rng);
    counts[r.draws[0]] = (counts[r.draws[0]] || 0) + 1;
    if (r.draws[0] === 'kyo') {
      assert.equal(r.draws.length, 2);
      assert.notEqual(r.draws[1], 'kyo', 'redraw is always a good slip');
      assert.equal(r.pay, byKey[r.draws[1]].pay);
    } else {
      assert.equal(r.draws.length, 1);
      assert.equal(r.pay, byKey[r.draws[0]].pay);
    }
  }
  for (const s of OMIKUJI_SLIPS) assert.ok(Math.abs(counts[s.key] / N - s.weight / 100) < 0.005, s.key);
});

test('Omikuji only happens on a paid base spin with no win, and can be forced to each slip', () => {
  const rng = makeRng(10);
  let seen = 0;
  for (let i = 0; i < 60000; i++) {
    const r = playSpin(rng, 1);
    if (r.omikuji) {
      seen++;
      assert.equal(r.base!.win, 0);
      assert.equal(r.freeSpins, null);
      assert.equal(r.torii, null);
    }
  }
  assert.ok(seen > 300 && seen < 900, `about 1 in 75 of non-winning spins (${seen})`);
  for (const s of OMIKUJI_SLIPS) {
    const r = playSpin(rng, 2, { feature: 'omikuji', slip: s.key });
    assert.equal(r.omikuji!.draws[0], s.key);
    assert.equal(r.base!.win, 0);
    assert.ok(Math.abs(r.totalWin - r.omikuji!.pay * 2) < 1e-9);
  }
});

// ---------------------------------------------------------------- Torii Path

const mistPath = (): ToriiSpace[] => {
  const l = makeToriiLayout(makeRng(1));
  return l.map((s) => (s.type === 'gate' || s.type === 'start' || s.type === 'summit' ? s : { type: 'mist' }));
};

test('Torii Path layout: 24 spaces, gates at 5/10/15/20, shrine at 24, no fox past the last gate', () => {
  const rng = makeRng(3);
  for (let i = 0; i < 2000; i++) {
    const l = makeToriiLayout(rng);
    assert.equal(l.length, 25);
    assert.equal(l[0].type, 'start');
    assert.deepEqual(l[24], { type: 'summit', pay: 250 });
    TORII.gates.forEach((g, gi) => assert.deepEqual(l[g], { type: 'gate', gate: gi, pay: [5, 10, 20, 40][gi] }));
    for (let p = 21; p < 24; p++) assert.notEqual(l[p].type, 'fox');
    for (const s of l) if (s.type === 'offering') assert.ok(s.pay >= 1 && s.pay <= 10);
  }
  assert.equal(TORII.startRolls, 3);
});

test('Torii Path: passing or landing on gates pays 5x, 10x, 20x, 40x in order', () => {
  const r = playTorii(makeRng(1), mistPath(), [5, 6, 6]);
  assert.deepEqual(r.rolls.map((x) => x.end), [5, 11, 17]);
  assert.deepEqual(r.rolls.map((x) => x.gates), [[0], [1], [2]]);
  assert.equal(r.collected, 35);
  assert.equal(r.win, 35);
  assert.equal(r.summit, false);
});

test('Torii Path: offering, ema (+1 roll), lantern (+1 multiplier, cap x5), fox (jump to next gate)', () => {
  const l = mistPath();
  l[2] = { type: 'offering', pay: 7 };
  l[3] = { type: 'ema' };
  l[4] = { type: 'lantern' };
  l[6] = { type: 'fox' };
  const r = playTorii(makeRng(1), l, [2, 1, 1, 2, 1]);
  // 3 rolls + 1 from the ema: 0->2 offering 7; 2->3 ema; 3->4 lantern x2; 4->6 passes gate 5 (5x), fox jumps to 10 (10x)
  assert.deepEqual(r.rolls.map((x) => x.effect), ['offering', 'ema', 'lantern', 'fox']);
  assert.deepEqual(r.rolls.map((x) => x.end), [2, 3, 4, 10]);
  assert.deepEqual(r.rolls.map((x) => x.rollsLeft), [2, 2, 1, 0]);
  assert.equal(r.rolls[3].pay, 15);
  assert.equal(r.collected, 7 + 5 + 10);
  assert.equal(r.mult, 2);
  assert.equal(r.win, 44);
  // lantern multiplier caps at x5 (with 3 rolls at most 3 non-Ema landings happen, so test the cap with more rolls)
  const saved = TORII.startRolls;
  TORII.startRolls = 7;
  try {
    const lan = mistPath();
    for (const p of [1, 2, 3, 4, 6, 7]) lan[p] = { type: 'lantern' };
    const r2 = playTorii(makeRng(1), lan, [1, 1, 1, 1, 2, 1, 1]);
    assert.deepEqual(r2.rolls.map((x) => x.mult), [2, 3, 4, 5, 5, 5, 5]);
    assert.equal(r2.mult, TORII.maxMult);
  } finally { TORII.startRolls = saved; }
});

test('Torii Path: reaching the shrine pays 250x and ends early; all prizes x lantern multiplier', () => {
  const l = mistPath();
  l[1] = { type: 'lantern' };
  l[6] = { type: 'ema' }; l[12] = { type: 'ema' }; l[18] = { type: 'ema' };
  // 0->1 lantern x2; ->6 gate 5, ema; ->12 gate 10, ema; ->18 gate 15, ema; ->24 gate 20 + shrine with a roll to spare
  const r = playTorii(makeRng(1), l, [1, 5, 6, 6, 6, 6]);
  assert.equal(r.summit, true);
  assert.equal(r.rolls.length, 5);
  const last = r.rolls[r.rolls.length - 1];
  assert.equal(last.effect, 'summit');
  assert.deepEqual(last.gates, [3]);
  assert.equal(last.rollsLeft, 0);
  assert.equal(r.collected, 5 + 10 + 20 + 40 + 250);
  assert.equal(r.win, (5 + 10 + 20 + 40 + 250) * 2);
});

// ---------------------------------------------------------------- free spins

test('free spins: 3/4/5 Bells award 8/12/16 spins and 2x/5x/20x', () => {
  assert.deepEqual(FREE_SPINS.spins, [8, 12, 16]);
  assert.deepEqual(FREE_SPINS.scatterPay, [2, 5, 20]);
  const rng = makeRng(4);
  for (const b of [3, 4, 5]) {
    const r = playFreeSpins(rng, b);
    assert.equal(r.awarded, FREE_SPINS.spins[b - 3]);
    assert.equal(r.scatterPay, FREE_SPINS.scatterPay[b - 3]);
    assert.equal(r.spins.length, r.awarded + 4 * r.retriggers);
  }
});

test('free spins: every 3 lanterns add 4 spins and raise the multiplier x1 -> x2 -> x3 (cap); multipliers multiply', () => {
  const rng = makeRng(8);
  let sawCap = false;
  for (let n = 0; n < 400; n++) {
    const r = playFreeSpins(rng, 3);
    let lanterns = 0, mult = 1;
    let sum = r.scatterPay;
    for (const s of r.spins) {
      assert.equal(s.mult, mult);
      assert.equal(s.bells, countSym(s.cascade.finalBoard, BELL));
      const before = Math.floor(lanterns / 3);
      lanterns += s.bells;
      const steps = Math.floor(lanterns / 3) - before;
      assert.equal(s.added, steps * 4);
      mult = Math.min(3, mult + steps);
      assert.equal(s.multAfter, mult);
      assert.equal(s.lanternsAfter, lanterns);
      if (!r.capped) assert.ok(Math.abs(s.win - s.cascade.win * s.mult) < 1e-9);
      sum += s.win;
      if (mult === 3) sawCap = true;
    }
    assert.ok(Math.abs(sum - r.win) < 1e-6);
  }
  assert.ok(sawCap);
});

test('free spins: sticky Wilds drift one reel left each spin until they leave reel 1', () => {
  const rng = makeRng(12);
  let drifted = 0;
  for (let n = 0; n < 300; n++) {
    const r = playFreeSpins(rng, 3);
    for (let i = 1; i < r.spins.length; i++) {
      const prev = r.spins[i - 1].cascade.finalLocked;
      const expect: [number, number][] = [];
      for (let reel = 1; reel < REELS; reel++) for (let row = 0; row < ROWS; row++) if (prev[reel][row]) expect.push([reel - 1, row]);
      assert.deepEqual(r.spins[i].stickyStart, expect);
      drifted += expect.length;
      // sticky Wilds are on the board at the start of the next spin
      for (const [reel, row] of expect) assert.equal(r.spins[i].cascade.steps[0].board[reel][row], WILD);
    }
    assert.deepEqual(r.spins[0].stickyStart, []);
  }
  assert.ok(drifted > 0);
});

test('free spins never award the Torii Path or Omikuji', () => {
  const rng = makeRng(13);
  for (let i = 0; i < 200; i++) {
    const r = playBonusBuy(rng, 1, 'freespins');
    assert.equal(r.torii, null);
    assert.equal(r.omikuji, null);
    for (const s of r.freeSpins!.spins) assert.equal(countSym(s.cascade.finalBoard, MASK), 0);
  }
});

// ---------------------------------------------------------------- spins, buys, forcing, cap

test('base spins: triggers follow the board (3+ Bells anywhere, Masks on reels 1, 3 and 5)', () => {
  const rng = makeRng(14);
  for (let i = 0; i < 40000; i++) {
    const r = playSpin(rng, 1);
    const b = r.base!.finalBoard;
    const bells = countSym(b, BELL);
    assert.equal(!!r.freeSpins, bells >= 3);
    if (r.freeSpins) assert.equal(r.freeSpins.bells, Math.min(5, bells));
    assert.equal(!!r.torii, b[0].includes(MASK) && b[2].includes(MASK) && b[4].includes(MASK));
    assert.ok(!b[1].includes(MASK) && !b[3].includes(MASK));
    assert.ok(!b[0].includes(WILD) && !b[4].includes(WILD));
    const sum = Math.min(MAX_WIN_X, r.base!.win + (r.freeSpins?.win ?? 0) + (r.torii?.win ?? 0) + (r.omikuji?.pay ?? 0));
    assert.ok(Math.abs(r.winX - sum) < 1e-6);
    assert.ok(Math.abs(r.totalWin - r.winX) < 1e-6);
    assert.equal(r.cost, 1);
  }
});

test('bonus buys cost 60x (Torii Path) and 80x (Free Spins) and play the feature', () => {
  const rng = makeRng(15);
  const t = playBonusBuy(rng, 2, 'torii');
  assert.equal(t.cost, BONUS_BUY.torii * 2);
  assert.equal(t.cost, 120);
  assert.ok(t.torii && !t.freeSpins && !t.base);
  const f = playBonusBuy(rng, 0.25, 'freespins');
  assert.equal(f.cost, 20);
  assert.ok(f.freeSpins && !f.torii);
  assert.equal(f.freeSpins!.awarded, 8);
  assert.equal(f.freeSpins!.scatterPay, 2);
});

test('debug forcing: each feature, 4 and 5 Bells, a summit climb and a lantern retrigger', () => {
  const rng = makeRng(16);
  assert.ok(playSpin(rng, 1, { feature: 'freespins' }).freeSpins);
  assert.equal(playSpin(rng, 1, { feature: 'freespins', bells: 4 }).freeSpins!.bells, 4);
  assert.equal(playSpin(rng, 1, { feature: 'freespins', bells: 5 }).freeSpins!.bells, 5);
  assert.ok(playSpin(rng, 1, { feature: 'torii' }).torii);
  assert.ok(playSpin(rng, 1, { feature: 'torii', summit: true }).torii!.summit);
  assert.ok(playSpin(rng, 1, { feature: 'freespins', retrigger: true }).freeSpins!.retriggers > 0);
  assert.ok(playBonusBuy(rng, 1, 'torii', { summit: true }).torii!.summit);
  // forced Bell triggers are built from real stops, not searched for blindly: fast even for 5 Bells
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) {
    const r = playSpin(rng, 1, { feature: 'freespins', bells: 5 });
    assert.equal(r.freeSpins!.bells, 5);
    assert.equal(countSym(r.base!.finalBoard, BELL), 5);
  }
  assert.ok(Date.now() - t0 < 3000, `20 forced 5-Bell spins took ${Date.now() - t0}ms`);
  const forced = playSpin(rng, 1, { feature: 'torii' });
  assert.equal(forced.forced, true);
  assert.equal(playSpin(rng, 1).forced, false);
});

test('a Torii Path cut short by the cap keeps its uncapped total for the presentation', () => {
  const t = playTorii(makeRng(1), mistPath(), [5, 5, 5]);
  assert.equal(t.win, 35);
  assert.equal(capTorii(t, 100), false);
  assert.equal(t.capped, undefined);
  assert.equal(capTorii(t, 20), true);
  assert.equal(t.win, 20);
  assert.equal(t.uncappedWin, 35);
  assert.equal(t.capped, true);
});

test('max win is capped at 5,000x bet', () => {
  assert.equal(MAX_WIN_X, 5000);
  const rng = makeRng(17);
  const small = playFreeSpins(rng, 5, 30);
  assert.ok(small.win <= 30 + 1e-9);
  assert.ok(small.capped);
  for (let i = 0; i < 300; i++) assert.ok(playBonusBuy(rng, 1, 'freespins').winX <= MAX_WIN_X);
});
