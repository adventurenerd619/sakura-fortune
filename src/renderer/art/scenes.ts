/**
 * Background scenes (1920x1080), woodblock-print style: flat layered shapes,
 * "bokashi" sky gradients, horizontal cloud bands and ink outlines.
 *   dusk village (base game), lantern-lit night (free spins), mountain trail (Torii Path)
 */
const INK = '#1b1a2e';
const W = 1920, H = 1080;

/** Deterministic pseudo-random numbers so the scenes look the same every time. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const svg = (body: string, defs: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;
const lin = (id: string, stops: [number, string][]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

/** Ukiyo-e style horizontal cloud band. */
function cloudBand(x: number, y: number, w: number, h: number, fill: string, op: number) {
  return `<path d="M${x},${y + h} C${x - h},${y + h} ${x - h},${y} ${x},${y} L${x + w * 0.3},${y} C${x + w * 0.32},${y - h * 0.6} ${x + w * 0.42},${y - h * 0.6} ${x + w * 0.45},${y} L${x + w},${y} C${x + w + h},${y} ${x + w + h},${y + h} ${x + w},${y + h} Z" fill="${fill}" opacity="${op}" stroke="${INK}" stroke-width="2" stroke-opacity="${op * 0.5}"/>`;
}

function mountains(night: boolean) {
  const far = night ? '#2a3358' : '#7d7fae';
  const mid = night ? '#1c2443' : '#4b507e';
  return `
    <path d="M0,700 L180,600 L340,640 L560,520 L700,560 L820,500 L1000,580 L1180,470 L1260,430 L1340,470 L1520,560 L1700,520 L1920,600 L1920,800 L0,800 Z" fill="${far}" stroke="${INK}" stroke-width="2" stroke-opacity="0.4"/>
    <path d="M1180,470 L1260,430 L1340,470 L1310,480 L1280,466 L1250,484 L1222,470 Z" fill="${night ? '#c9cde0' : '#f5eedc'}" opacity="0.9"/>
    <path d="M0,760 L240,680 L420,720 L640,650 L860,720 L1060,660 L1300,730 L1500,670 L1720,720 L1920,680 L1920,840 L0,840 Z" fill="${mid}" stroke="${INK}" stroke-width="2" stroke-opacity="0.5"/>`;
}

function pagoda(x: number, y: number, s: number, night: boolean) {
  const roof = night ? '#151a30' : '#2b2f4a';
  const wall = night ? '#3a2a2a' : '#8a3a2e';
  let g = '';
  for (let i = 0; i < 5; i++) {
    const ty = -i * 70, w = 120 - i * 14;
    g += `<rect x="${-w / 2 + 12}" y="${ty - 40}" width="${w - 24}" height="40" fill="${wall}" stroke="${INK}" stroke-width="3"/>`;
    g += `<path d="M${-w},${ty - 34} C${-w / 2},${ty - 44} ${w / 2},${ty - 44} ${w},${ty - 34} L${w - 16},${ty - 54} L${-w + 16},${ty - 54} Z" fill="${roof}" stroke="${INK}" stroke-width="3"/>`;
    if (night) g += `<rect x="-8" y="${ty - 30}" width="16" height="20" fill="#ffcf6b" opacity="0.8"/>`;
  }
  g += `<path d="M-3,-336 L3,-336 L2,-420 L-2,-420 Z" fill="${INK}"/>`;
  for (let i = 0; i < 6; i++) g += `<ellipse cx="0" cy="${-350 - i * 11}" rx="${9 - i}" ry="3" fill="${INK}"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">${g}</g>`;
}

function houses(night: boolean, rnd: () => number) {
  const roof = night ? '#161b31' : '#2f3550';
  const wall = night ? '#4a4252' : '#efe3c4';
  let g = '';
  let x = -40;
  while (x < W + 40) {
    const w = 150 + rnd() * 120, h = 90 + rnd() * 60, base = 900 + rnd() * 20;
    g += `<rect x="${x}" y="${base - h}" width="${w}" height="${h + 200}" fill="${wall}" stroke="${INK}" stroke-width="3"/>`;
    for (let k = 1; k < 4; k++) g += `<path d="M${x + (w * k) / 4},${base - h} L${x + (w * k) / 4},${base + 200}" stroke="#5a4636" stroke-width="5" opacity="0.7"/>`;
    const win = rnd() < 0.6;
    if (win) {
      const wx = x + w * 0.34, wy = base - h + 26, ww = w * 0.32;
      g += `<rect x="${wx}" y="${wy}" width="${ww}" height="28" fill="${night ? '#f2b65a' : '#d9c79e'}" stroke="${INK}" stroke-width="2" opacity="${night ? 0.7 : 0.8}"/>`;
      for (let k = 1; k < 4; k++) g += `<path d="M${wx + (ww * k) / 4},${wy} L${wx + (ww * k) / 4},${wy + 28}" stroke="${INK}" stroke-width="1.5" opacity="0.6"/>`;
      g += `<path d="M${wx},${wy + 14} L${wx + ww},${wy + 14}" stroke="${INK}" stroke-width="1.5" opacity="0.6"/>`;
    }
    const r = 28 + rnd() * 10;
    g += `<path d="M${x - 24},${base - h + 6} C${x + w * 0.2},${base - h - 4} ${x + w * 0.8},${base - h - 4} ${x + w + 24},${base - h + 6} L${x + w - 10},${base - h - r} L${x + 10},${base - h - r} Z" fill="${roof}" stroke="${INK}" stroke-width="3"/>`;
    for (let k = 0; k < 6; k++) g += `<path d="M${x + 14 + (k * (w - 28)) / 5},${base - h - r + 4} L${x + 8 + (k * (w - 16)) / 5},${base - h + 2}" stroke="${night ? '#2a3050' : '#4b5272'}" stroke-width="2"/>`;
    x += w + 6 + rnd() * 30;
  }
  return g;
}

/** Sakura tree: dark trunk and branches with pink blossom clouds. */
function sakuraTree(x: number, y: number, s: number, flip: boolean, night: boolean, rnd: () => number) {
  const trunk = night ? '#1a1420' : '#3a2620';
  const pinks = night ? ['#9a6b8a', '#b9849f', '#7d5573'] : ['#f4b6c2', '#fbd9df', '#e89aaa'];
  let g = `<path d="M-30,0 C-26,-120 -40,-200 -10,-300 C10,-360 60,-400 120,-430 L128,-418 C80,-380 40,-340 26,-290 C60,-320 120,-330 180,-320 L178,-306 C120,-308 60,-290 30,-250 C18,-180 30,-100 34,0 Z" fill="${trunk}" stroke="${INK}" stroke-width="4"/>`;
  g += `<path d="M-14,-220 C-60,-260 -110,-280 -170,-280 L-168,-268 C-110,-262 -60,-240 -18,-200 Z" fill="${trunk}" stroke="${INK}" stroke-width="3"/>`;
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 26; i++) blobs.push([-200 + rnd() * 420, -520 + rnd() * 300, 50 + rnd() * 50]);
  for (const [bx, by, br] of blobs) g += `<circle cx="${bx}" cy="${by}" r="${br}" fill="${pinks[Math.floor(rnd() * 3)]}" stroke="${INK}" stroke-width="2.5" stroke-opacity="0.5"/>`;
  for (let i = 0; i < 40; i++) {
    const bx = -200 + rnd() * 420, by = -540 + rnd() * 320, r = 6 + rnd() * 6;
    g += `<circle cx="${bx}" cy="${by}" r="${r}" fill="${night ? '#d8a8c4' : '#fff4f6'}" opacity="0.8"/>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${g}</g>`;
}

/** Festival lantern string across the scene. */
function lanternString(night: boolean, y0: number, from: number, to: number) {
  let g = `<path d="M${from},${y0} Q${(from + to) / 2},${y0 + 90} ${to},${y0}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  const n = 9;
  for (let i = 1; i < n; i++) {
    const t = i / n, x = from + (to - from) * t, y = y0 + 4 * 90 * t * (1 - t) * 0.5 * 2;
    if (night) g += `<circle cx="${x}" cy="${y + 34}" r="46" fill="url(#lanternGlow)"/>`;
    g += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 12}" stroke="${INK}" stroke-width="2"/>`;
    g += `<ellipse cx="${x}" cy="${y + 34}" rx="17" ry="22" fill="${night ? '#ff5a46' : '#d8483a'}" stroke="${INK}" stroke-width="2.5"/>`;
    g += `<rect x="${x - 10}" y="${y + 10}" width="20" height="5" fill="${INK}"/><rect x="${x - 10}" y="${y + 53}" width="20" height="5" fill="${INK}"/>`;
    if (night) g += `<ellipse cx="${x}" cy="${y + 34}" rx="7" ry="13" fill="#ffe08a" opacity="0.7"/>`;
  }
  return g;
}

function village(night: boolean) {
  const rnd = prng(night ? 11 : 7);
  const sky = night
    ? lin('sky', [[0, '#0b1022'], [0.45, '#1F2A44'], [0.8, '#3a3560'], [1, '#4c3a5e']])
    : lin('sky', [[0, '#1F2A44'], [0.35, '#4a4a7a'], [0.62, '#c77d8e'], [0.85, '#f2b18a'], [1, '#f5d6a0']]);
  let stars = '';
  if (night) for (let i = 0; i < 140; i++) stars += `<circle cx="${rnd() * W}" cy="${rnd() * 560}" r="${0.8 + rnd() * 1.8}" fill="#f5eedc" opacity="${0.3 + rnd() * 0.6}"/>`;
  const orb = night
    ? `<circle cx="1530" cy="200" r="130" fill="url(#orbGlow)"/><circle cx="1530" cy="200" r="70" fill="#f5eedc" stroke="${INK}" stroke-width="3"/><circle cx="1510" cy="186" r="12" fill="#d9d0b6" opacity="0.6"/><circle cx="1552" cy="214" r="8" fill="#d9d0b6" opacity="0.6"/>`
    : `<circle cx="1240" cy="430" r="190" fill="url(#orbGlow)"/><circle cx="1240" cy="430" r="96" fill="#f7a07a" stroke="${INK}" stroke-width="3" stroke-opacity="0.5"/>`;
  const bandC = night ? '#2d3a66' : '#f5d6c6';
  const bands = cloudBand(140, 330, 520, 34, bandC, night ? 0.6 : 0.75) + cloudBand(1180, 420, 600, 30, bandC, night ? 0.5 : 0.7) + cloudBand(700, 210, 420, 26, bandC, night ? 0.4 : 0.55);
  const ground = `<path d="M0,920 L1920,920 L1920,1080 L0,1080 Z" fill="${night ? '#1a1d2e' : '#6b5a4a'}"/>
    <path d="M0,920 C400,940 1500,940 1920,920" fill="none" stroke="${INK}" stroke-width="3"/>
    <path d="M760,1080 L860,930 L1060,930 L1160,1080 Z" fill="${night ? '#2a2c3c' : '#9a8a72'}" stroke="${INK}" stroke-width="3"/>`;
  let fallen = '';
  for (let i = 0; i < 80; i++) fallen += `<ellipse cx="${rnd() * W}" cy="${930 + rnd() * 140}" rx="5" ry="3" fill="${night ? '#9a6b8a' : '#f4b6c2'}" opacity="0.8" transform="rotate(${rnd() * 180} 0 0)"/>`;
  const defs = sky + `<radialGradient id="orbGlow"><stop offset="0" stop-color="${night ? '#f5eedc' : '#ffd0a0'}" stop-opacity="0.6"/><stop offset="1" stop-color="${night ? '#f5eedc' : '#ffd0a0'}" stop-opacity="0"/></radialGradient>
    <radialGradient id="lanternGlow"><stop offset="0" stop-color="#ffcf6b" stop-opacity="0.7"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient>`;
  return svg(`<rect width="${W}" height="${H}" fill="url(#sky)"/>${stars}${orb}${bands}${mountains(night)}
    ${pagoda(1430, 840, 0.9, night)}${houses(night, rnd)}${ground}${fallen}
    ${sakuraTree(160, 1000, 1.25, false, night, rnd)}${sakuraTree(1790, 1010, 1.15, true, night, rnd)}
    ${lanternString(night, 70, 260, 1660)}`, defs);
}

export const duskSceneSvg = () => village(false);
export const nightSceneSvg = () => village(true);

/** Pine tree silhouette. */
function pine(x: number, y: number, s: number, c: string) {
  let g = `<rect x="-6" y="-30" width="12" height="40" fill="#3a2620"/>`;
  for (let i = 0; i < 4; i++) {
    const w = 70 - i * 14, ty = -30 - i * 36;
    g += `<path d="M${-w},${ty} C${-w / 2},${ty - 22} ${w / 2},${ty - 22} ${w},${ty} C${w / 2},${ty - 10} ${-w / 2},${ty - 10} ${-w},${ty} Z" fill="${c}" stroke="${INK}" stroke-width="2.5"/>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${s})">${g}</g>`;
}

export function mountainSceneSvg() {
  const rnd = prng(23);
  const defs = lin('sky', [[0, '#2c3a64'], [0.5, '#8a7aa8'], [0.85, '#f2b8a0'], [1, '#f5d6a0']]) +
    lin('mtn', [[0, '#5b6a8e'], [1, '#2a3354']]) + lin('mtn2', [[0, '#7c6f8e'], [1, '#3d3a5a']]);
  let pines = '';
  for (let i = 0; i < 26; i++) {
    const t = rnd();
    pines += pine(80 + t * 1760, 1000 - rnd() * 140, 0.6 + rnd() * 0.5, rnd() < 0.5 ? '#2f4a3a' : '#3c5a44');
  }
  let mist = '';
  for (let i = 0; i < 5; i++) mist += cloudBand(rnd() * 1500, 300 + i * 140, 380 + rnd() * 300, 26, '#f5eedc', 0.45);
  return svg(`<rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="1650" cy="260" r="80" fill="#f7a07a" opacity="0.85"/>
    ${cloudBand(200, 180, 600, 30, '#f5d6c6', 0.7)}${cloudBand(1100, 140, 500, 28, '#f5d6c6', 0.6)}
    <path d="M0,900 L300,640 L520,700 L760,420 L900,250 L960,120 L1020,250 L1180,440 L1420,620 L1640,580 L1920,760 L1920,1080 L0,1080 Z" fill="url(#mtn2)" stroke="${INK}" stroke-width="3"/>
    <path d="M900,250 L960,120 L1020,250 L996,262 L972,240 L948,264 L924,246 Z" fill="#f5eedc"/>
    <path d="M0,1000 L240,820 L480,860 L700,700 L880,760 L1100,640 L1320,760 L1560,700 L1920,880 L1920,1080 L0,1080 Z" fill="url(#mtn)" stroke="${INK}" stroke-width="3"/>
    ${mist}${pines}
    <path d="M0,1040 C600,1010 1300,1010 1920,1040 L1920,1080 L0,1080 Z" fill="#263224" stroke="${INK}" stroke-width="3"/>`, defs);
}
