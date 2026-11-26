/**
 * All Sakura Fortune art is authored here as code-generated SVG (original work), then
 * rasterized into Pixi textures at load time.
 *
 * Style: flat woodblock-print shapes with a dark indigo ink outline, few colours,
 * soft "bokashi" gradients only where a print would use them (sky, glow).
 */
export { duskSceneSvg, nightSceneSvg, mountainSceneSvg } from './scenes';

export const INK = '#1b1a2e';
export const PAL = {
  indigo: '#1F2A44', indigoL: '#34436a', indigoD: '#141b2e',
  red: '#C8102E', redD: '#8a0b20', redL: '#e8475e',
  pink: '#F4B6C2', pinkL: '#fbd9df', pinkD: '#d98798',
  cream: '#F5EEDC', creamD: '#e2d6b8',
  gold: '#D4A84B', goldL: '#F2D27A', goldD: '#8E6A22',
  green: '#5f8a4a', greenL: '#93b56f', greenD: '#34512a',
  wood: '#5a1a14', woodD: '#2b0b08', woodL: '#7b2a20',
  white: '#fbf7ee', black: '#24232f', orange: '#e8862e', purple: '#5b3a7a',
};

export const wrap = (w: number, h: number, body: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

/** Ink-outlined flat shape. */
const ink = (d: string, fill: string, w = 4) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const line = (d: string, c = INK, w = 3, op = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
const circ = (x: number, y: number, r: number, fill: string, w = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${w}"/>`;
const radial = (id: string, stops: [number, string, number?][], cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a ?? 1}"/>`).join('')}</radialGradient>`;
const linear = (id: string, stops: [number, string][], x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

/** Five-petal sakura blossom path centred on (cx, cy), radius r. */
export function sakuraPath(cx: number, cy: number, r: number, rot = -90) {
  let d = '';
  for (let k = 0; k < 5; k++) {
    const a = ((rot + k * 72) * Math.PI) / 180;
    const p = (ang: number, rr: number) => `${(cx + Math.cos(a + ang) * rr * r).toFixed(1)},${(cy + Math.sin(a + ang) * rr * r).toFixed(1)}`;
    d += `M${cx},${cy} C${p(-0.55, 0.55)} ${p(-0.42, 1.05)} ${p(-0.12, 1.0)} L${p(0, 0.86)} L${p(0.12, 1.0)} C${p(0.42, 1.05)} ${p(0.55, 0.55)} ${cx},${cy} Z `;
  }
  return d;
}
export const sakura = (cx: number, cy: number, r: number, fill = PAL.pink, w = 3, rot = -90) =>
  ink(sakuraPath(cx, cy, r, rot), fill, w) + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.16).toFixed(1)}" fill="${PAL.goldL}" stroke="${INK}" stroke-width="${Math.max(1, w * 0.6)}"/>`;

// ======================= symbol backings =======================

/** High symbols: indigo disc with a gold ring. */
function highDisc() {
  return `<circle cx="100" cy="104" r="90" fill="#000" opacity="0.25"/>
    <circle cx="100" cy="100" r="88" fill="url(#ring)" stroke="${INK}" stroke-width="4"/>
    <circle cx="100" cy="100" r="76" fill="url(#disc)" stroke="${INK}" stroke-width="3"/>
    ${line('M48,150 C60,140 74,140 86,150 C98,160 112,160 124,150 C136,140 150,140 160,150', PAL.indigoL, 3, 0.6)}
    ${line('M40,166 C52,156 66,156 78,166', PAL.indigoL, 3, 0.4)}`;
}
const highDefs = () => linear('ring', [[0, PAL.goldL], [0.5, PAL.gold], [1, PAL.goldD]]) + radial('disc', [[0, PAL.indigoL], [1, PAL.indigoD]], 0.45, 0.35, 0.7);
/** Low symbols: soft washi circle. */
const lowDisc = (tint: string) => `<circle cx="100" cy="102" r="80" fill="${tint}" opacity="0.55"/><circle cx="100" cy="102" r="80" fill="none" stroke="${INK}" stroke-width="2" opacity="0.25"/>`;

// ======================= high symbols =======================

export function koiSymbol() {
  const fish = `
    ${ink('M148,100 C160,84 172,70 188,62 C181,82 179,92 183,100 C179,108 181,118 188,138 C172,130 160,116 148,100 Z', PAL.orange)}
    ${line('M156,96 L180,72 M156,104 L180,128 M158,100 L182,100', INK, 2, 0.6)}
    ${ink('M70,70 C80,48 104,44 120,70 Z', PAL.orange)}
    ${ink('M30,100 C40,70 80,60 115,68 C137,73 150,86 154,100 C150,114 137,127 115,132 C80,140 40,130 30,100 Z', 'url(#koi)')}
    <path d="M70,72 C86,66 104,70 108,84 C100,96 84,92 74,86 Z" fill="${PAL.orange}" opacity="0.9"/>
    <path d="M110,108 C122,104 136,110 140,116 C130,126 116,126 108,120 Z" fill="${PAL.orange}" opacity="0.9"/>
    ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => line(`M${66 + c * 18 + r * 9},${86 + r * 14} q6,6 0,12`, PAL.goldD, 2, 0.55)).join('')).join('')}
    ${ink('M62,122 C56,140 70,152 86,142 C80,134 76,128 74,124 Z', PAL.orange, 3)}
    ${circ(48, 94, 6, PAL.white, 2.5)}<circle cx="49" cy="94" r="3" fill="${INK}"/>
    ${line('M33,106 C24,112 20,122 24,132', INK, 2.5)}${line('M38,110 C32,118 32,126 36,132', INK, 2)}
    ${line('M36,100 C38,96 40,94 42,92', INK, 2, 0.5)}`;
  return wrap(200, 200, highDisc() + `<g transform="translate(100 102) rotate(-16) scale(0.86) translate(-104 -100)">${fish}</g>`,
    highDefs() + linear('koi', [[0, PAL.goldL], [0.6, PAL.gold], [1, '#c98a2c']]));
}

export function toriiSymbol() {
  return wrap(200, 200, highDisc() + `
    ${ink('M56,74 L72,74 L74,170 L52,170 Z', PAL.red)}${ink('M128,74 L144,74 L148,170 L126,170 Z', PAL.red)}
    ${ink('M48,166 L78,166 L78,180 L48,180 Z', PAL.black, 3)}${ink('M122,166 L152,166 L152,180 L122,180 Z', PAL.black, 3)}
    ${ink('M36,100 L164,100 L164,112 L36,112 Z', PAL.red)}
    ${ink('M28,66 C64,74 136,74 172,66 L170,80 C136,86 64,86 30,80 Z', PAL.red)}
    ${ink('M18,50 C60,62 140,62 182,50 L186,40 C148,48 52,48 14,40 Z', PAL.black)}
    ${ink('M90,80 L110,80 L110,100 L90,100 Z', PAL.black, 3)}
    <rect x="94" y="84" width="12" height="12" fill="${PAL.gold}"/>
    ${line('M40,47 C70,54 130,54 160,47', '#fff', 2, 0.3)}`, highDefs());
}

export function fanSymbol() {
  const cx = 100, cy = 156, n = 10, a0 = 208, a1 = 332;
  const pt = (ang: number, r: number) => `${(cx + Math.cos((ang * Math.PI) / 180) * r).toFixed(1)},${(cy + Math.sin((ang * Math.PI) / 180) * r).toFixed(1)}`;
  let folds = '', ribs = '';
  for (let i = 0; i < n; i++) {
    const s = a0 + ((a1 - a0) * i) / n, e = a0 + ((a1 - a0) * (i + 1)) / n;
    folds += `<path d="M${pt(s, 46)} L${pt(s, 104)} A104,104 0 0 1 ${pt(e, 104)} L${pt(e, 46)} A46,46 0 0 0 ${pt(s, 46)} Z" fill="${i % 2 ? PAL.pinkL : PAL.pink}"/>`;
  }
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    ribs += line(`M${pt(a, 8)} L${pt(a, 46)}`, PAL.goldD, 4) + line(`M${pt(a, 46)} L${pt(a, 104)}`, INK, 1.5, 0.35);
  }
  return wrap(200, 200, highDisc() + `
    ${ribs}${folds}
    <path d="M${pt(a0, 46)} L${pt(a0, 104)} A104,104 0 0 1 ${pt(a1, 104)} L${pt(a1, 46)} A46,46 0 0 0 ${pt(a0, 46)} Z" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M${pt(a0 + 2, 97)} A97,97 0 0 1 ${pt(a1 - 2, 97)}" fill="none" stroke="${PAL.gold}" stroke-width="5"/>
    ${sakura(78, 88, 13, PAL.white, 2.5, -80)}${sakura(122, 80, 10, PAL.white, 2, -100)}${sakura(102, 104, 8, PAL.red, 2)}
    ${line('M66,112 C82,104 92,114 110,100 C122,92 132,96 140,94', PAL.redD, 2.5, 0.7)}
    ${circ(cx, cy, 7, PAL.gold, 3)}`, highDefs());
}

export function kabutoSymbol() {
  const horn = (s: number) => `<g transform="translate(100 0) scale(${s} 1) translate(-100 0)">${ink('M102,96 C90,80 72,52 58,22 L70,20 C84,46 100,72 110,90 Z', 'url(#hornG)', 3.5)}</g>`;
  return wrap(200, 200, highDisc() + `
    ${ink('M30,140 L170,140 L180,160 L20,160 Z', PAL.red)}
    ${ink('M38,124 L162,124 L172,142 L28,142 Z', PAL.red)}
    ${[0, 1].map((r) => Array.from({ length: 9 }, (_, i) => `<circle cx="${38 + i * 15.5 - r * 4}" cy="${133 + r * 18}" r="2.2" fill="${PAL.goldL}"/>`).join('')).join('')}
    ${ink('M24,118 C24,104 34,98 46,104 L50,128 C40,130 30,128 24,118 Z', PAL.indigo, 3)}${ink('M176,118 C176,104 166,98 154,104 L150,128 C160,130 170,128 176,118 Z', PAL.indigo, 3)}
    ${ink('M48,124 C48,72 74,48 100,48 C126,48 152,72 152,124 Z', 'url(#bowl)')}
    ${[64, 82, 100, 118, 136].map((x) => line(`M${x},${124 - Math.abs(x - 100) * 0.1} C${x + (x - 100) * 0.2},90 ${x + (x - 100) * 0.1},64 100,50`, PAL.indigoL, 2, 0.7)).join('')}
    ${ink('M56,120 C78,108 122,108 144,120 L140,130 C120,120 80,120 60,130 Z', PAL.black, 3)}
    ${horn(1)}${horn(-1)}
    ${circ(100, 100, 9, PAL.gold, 3)}${sakura(100, 100, 6, PAL.red, 1.5)}`,
    highDefs() + linear('bowl', [[0, PAL.indigoL], [1, PAL.indigoD]], 1, 1) + linear('hornG', [[0, PAL.goldL], [1, PAL.gold]]));
}

export function lanternSymbol() {
  let ribs = '';
  for (let i = -3; i <= 3; i++) {
    const y = 106 + i * 15, w = 58 * Math.sqrt(1 - (i * 15) ** 2 / 66 ** 2);
    ribs += line(`M${100 - w},${y} Q100,${y + 6} ${100 + w},${y}`, PAL.redD, 2, 0.8);
  }
  return wrap(200, 200, highDisc() + `
    <circle cx="100" cy="106" r="70" fill="url(#lglow)"/>
    ${line('M100,14 L100,36', INK, 3)}
    ${ink('M42,106 C42,62 70,40 100,40 C130,40 158,62 158,106 C158,150 130,172 100,172 C70,172 42,150 42,106 Z', 'url(#lbody)')}
    ${ribs}
    ${sakura(100, 106, 20, PAL.cream, 3)}
    ${ink('M72,30 L128,30 L128,44 L72,44 Z', PAL.black, 3.5)}${ink('M72,166 L128,166 L128,180 L72,180 Z', PAL.black, 3.5)}
    ${line('M96,180 L96,190 M104,180 L104,190', PAL.gold, 3)}`,
    highDefs() + radial('lglow', [[0, '#ffd36b', 0.7], [1, '#ffd36b', 0]]) + radial('lbody', [[0, '#ff6a5a'], [0.6, PAL.red], [1, PAL.redD]], 0.5, 0.45, 0.6));
}

// ======================= low symbols =======================

export function mochiSymbol() {
  let grains = '';
  for (let i = 0; i < 22; i++) {
    const a = i * 2.39, r = 10 + (i * 37) % 38;
    grains += `<ellipse cx="${(100 + Math.cos(a) * r * 1.2).toFixed(1)}" cy="${(96 + Math.sin(a) * r * 0.6).toFixed(1)}" rx="3" ry="1.8" fill="#fff" opacity="0.6"/>`;
  }
  return wrap(200, 200, lowDisc(PAL.pinkL) + `
    ${ink('M38,108 C38,70 70,58 100,58 C130,58 162,70 162,108 C162,138 130,148 100,148 C70,148 38,138 38,108 Z', PAL.pink)}
    ${grains}
    ${ink('M30,112 C40,156 160,156 170,112 C150,138 124,132 100,140 C76,132 50,138 30,112 Z', PAL.green)}
    ${line('M42,122 C70,142 130,142 158,122 M70,136 L62,146 M100,140 L100,150 M130,136 L138,146', PAL.greenD, 2.5, 0.8)}
    ${sakura(100, 74, 13, PAL.white, 2.5)}`);
}

export function teacupSymbol() {
  return wrap(200, 200, lowDisc('#d9e4c8') + `
    ${line('M86,48 C76,38 96,30 86,18 M112,50 C102,40 122,32 112,20', '#8c8c8c', 4, 0.6)}
    ${ink('M56,72 L144,72 L136,158 C136,168 64,168 64,158 Z', PAL.indigo)}
    <path d="M60,104 L140,104 L138,124 L62,124 Z" fill="${PAL.cream}"/>
    ${line('M64,114 C72,106 80,122 88,114 C96,106 104,122 112,114 C120,106 128,122 136,114', PAL.indigo, 3)}
    ${ink('M56,72 C56,62 144,62 144,72 C144,82 56,82 56,72 Z', PAL.cream, 3.5)}
    <ellipse cx="100" cy="72" rx="38" ry="6" fill="${PAL.greenL}"/>
    ${ink('M70,160 L130,160 L128,172 L72,172 Z', PAL.creamD, 3)}`);
}

export function craneSymbol() {
  return wrap(200, 200, lowDisc('#dfe3ef') + `<g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">
    <polygon points="100,104 36,34 92,88" fill="${PAL.pink}"/>
    <polygon points="100,104 174,28 110,90" fill="${PAL.pinkL}"/>
    <polygon points="58,116 100,96 142,116 100,136" fill="${PAL.pink}"/>
    <polygon points="100,96 142,116 100,136" fill="${PAL.pinkD}"/>
    <polygon points="58,116 26,68 38,70 72,118" fill="${PAL.pinkL}"/>
    <polygon points="26,68 16,80 32,72" fill="${PAL.red}"/>
    <polygon points="142,116 182,84 172,96 150,122" fill="${PAL.pinkL}"/>
    </g>${line('M100,104 L100,136', INK, 2, 0.5)}`);
}

export function bambooSymbol() {
  const stalk = (x: number, top: number, w: number) => {
    let nodes = '';
    for (let y = top + 34; y < 176; y += 38) nodes += ink(`M${x - w / 2 - 2},${y} L${x + w / 2 + 2},${y} L${x + w / 2 + 2},${y + 6} L${x - w / 2 - 2},${y + 6} Z`, PAL.greenD, 2.5);
    return ink(`M${x - w / 2},${top} L${x + w / 2},${top} L${x + w / 2},178 L${x - w / 2},178 Z`, 'url(#bam)') + nodes +
      line(`M${x - w / 4},${top + 6} L${x - w / 4},172`, '#fff', 2, 0.3);
  };
  const leaf = (x: number, y: number, a: number) => `<g transform="translate(${x} ${y}) rotate(${a})">${ink('M0,0 C14,-8 40,-6 56,0 C40,6 14,8 0,0 Z', PAL.greenL, 2.5)}</g>`;
  return wrap(200, 200, lowDisc('#d6e6c4') + stalk(76, 30, 22) + stalk(112, 50, 20) + stalk(140, 74, 16) +
    leaf(88, 58, -30) + leaf(90, 62, 10) + leaf(122, 90, -50) + leaf(64, 100, 200) + leaf(150, 104, -20),
  linear('bam', [[0, PAL.greenL], [1, PAL.green]], 1, 0));
}

export function monSymbol() {
  const petal = (a: number) => `<g transform="rotate(${a} 100 102)">${ink('M100,102 C88,88 86,62 100,46 C114,62 112,88 100,102 Z', PAL.cream, 3)}${line('M100,96 L100,60', PAL.creamD, 2)}</g>`;
  return wrap(200, 200, lowDisc('#f0d4d0') + `
    <circle cx="100" cy="102" r="66" fill="${PAL.red}" stroke="${INK}" stroke-width="4"/>
    <circle cx="100" cy="102" r="56" fill="none" stroke="${PAL.cream}" stroke-width="4"/>
    ${[0, 90, 180, 270].map(petal).join('')}
    ${[45, 135, 225, 315].map((a) => `<g transform="rotate(${a} 100 102)"><circle cx="100" cy="66" r="5" fill="${PAL.cream}" stroke="${INK}" stroke-width="2"/></g>`).join('')}
    ${circ(100, 102, 8, PAL.goldL, 3)}`);
}

// ======================= special symbols =======================

/** Maneki-neko bust used for the Wild (raised paw). */
function catBust() {
  return `
    ${ink('M50,190 C46,150 64,124 100,122 C136,124 154,150 150,190 Z', PAL.white)}
    <path d="M60,170 C64,150 80,142 90,146 C84,160 74,170 60,170 Z" fill="${PAL.orange}"/>
    ${ink('M132,140 C138,118 142,96 140,78 C150,72 164,76 164,90 C164,108 156,128 146,148 Z', PAL.white)}
    ${line('M146,80 L148,88 M154,79 L155,88', INK, 2)}
    <ellipse cx="153" cy="94" rx="6" ry="5" fill="${PAL.pink}"/>
    ${ink('M40,78 L46,34 L74,58 Z', PAL.white)}${ink('M160,78 L154,34 L126,58 Z', PAL.white)}
    <path d="M50,68 L52,46 L66,58 Z" fill="${PAL.pink}"/><path d="M150,68 L148,46 L134,58 Z" fill="${PAL.pink}"/>
    ${ink('M36,96 C36,58 64,44 100,44 C136,44 164,58 164,96 C164,128 136,140 100,140 C64,140 36,128 36,96 Z', PAL.white)}
    <path d="M130,52 C146,56 158,68 160,82 C148,80 136,70 130,52 Z" fill="${PAL.orange}"/>
    <path d="M44,74 C48,60 58,52 70,50 C66,62 58,70 44,74 Z" fill="${PAL.black}"/>
    ${line('M66,92 Q76,82 86,92', INK, 4)}${line('M114,92 Q124,82 134,92', INK, 4)}
    <ellipse cx="62" cy="108" rx="9" ry="6" fill="${PAL.pink}" opacity="0.8"/><ellipse cx="138" cy="108" rx="9" ry="6" fill="${PAL.pink}" opacity="0.8"/>
    ${ink('M94,102 L106,102 L100,109 Z', PAL.pinkD, 2)}
    ${line('M100,109 Q94,118 88,112 M100,109 Q106,118 112,112', INK, 3)}
    ${line('M30,100 L58,104 M30,112 L58,110 M170,100 L142,104 M170,112 L142,110', INK, 2, 0.8)}
    ${ink('M58,136 C80,148 120,148 142,136 L144,146 C120,160 80,160 56,146 Z', PAL.red, 3)}
    ${circ(100, 156, 10, PAL.gold, 3)}${line('M92,156 L108,156', INK, 2)}`;
}

export function wildSymbol() {
  return wrap(200, 200, `
    <rect x="8" y="12" width="184" height="184" rx="26" fill="#000" opacity="0.3"/>
    <rect x="6" y="6" width="188" height="188" rx="26" fill="url(#gold)" stroke="${INK}" stroke-width="4"/>
    <rect x="16" y="16" width="168" height="168" rx="18" fill="url(#lac)" stroke="${INK}" stroke-width="3"/>
    ${[30, 170].map((x) => [30, 170].map((y) => sakura(x, y, 9, PAL.goldL, 1.5)).join('')).join('')}
    <g transform="translate(100 96) scale(0.78) translate(-100 -110)">${catBust()}</g>
    <rect x="44" y="150" width="112" height="34" rx="8" fill="${PAL.gold}" stroke="${INK}" stroke-width="3"/>
    <text x="100" y="176" text-anchor="middle" font-family="Georgia, 'Palatino Linotype', serif" font-weight="bold" font-size="27" fill="${PAL.redD}" letter-spacing="3">WILD</text>`,
  linear('gold', [[0, PAL.goldL], [0.5, PAL.gold], [1, PAL.goldD]], 1, 1) + radial('lac', [[0, PAL.redL], [0.55, PAL.red], [1, PAL.redD]], 0.5, 0.4, 0.7));
}

export function bellSymbol() {
  let rays = '';
  for (let i = 0; i < 16; i++) rays += `<path d="M100,104 L${100 + Math.cos(i * 0.3927 - 0.1) * 96},${104 + Math.sin(i * 0.3927 - 0.1) * 96} L${100 + Math.cos(i * 0.3927 + 0.1) * 96},${104 + Math.sin(i * 0.3927 + 0.1) * 96} Z" fill="${PAL.goldL}" opacity="${i % 2 ? 0.25 : 0.45}"/>`;
  let rope = '';
  for (let i = 0; i < 6; i++) rope += ink(`M92,${8 + i * 9} L108,${12 + i * 9} L108,${20 + i * 9} L92,${16 + i * 9} Z`, i % 2 ? PAL.white : PAL.red, 2);
  return wrap(200, 200, `
    <circle cx="100" cy="104" r="94" fill="url(#bglow)"/>${rays}
    ${rope}
    ${ink('M84,60 C84,50 116,50 116,60 L112,66 L88,66 Z', PAL.goldD, 3)}
    ${ink('M42,116 C42,82 68,60 100,60 C132,60 158,82 158,116 C158,148 132,164 100,164 C68,164 42,148 42,116 Z', 'url(#bell)')}
    ${line('M46,104 C70,114 130,114 154,104', PAL.goldD, 4)}
    ${ink('M64,134 C78,128 122,128 136,134 L132,142 C118,138 82,138 68,142 Z', INK, 2)}
    <circle cx="100" cy="148" r="5" fill="${INK}"/>
    <ellipse cx="78" cy="84" rx="14" ry="8" fill="#fff" opacity="0.55" transform="rotate(-25 78 84)"/>
    <rect x="34" y="166" width="132" height="28" rx="8" fill="${PAL.red}" stroke="${INK}" stroke-width="3"/>
    <text x="100" y="187" text-anchor="middle" font-family="Georgia, 'Palatino Linotype', serif" font-weight="bold" font-size="18" fill="${PAL.goldL}" letter-spacing="2">SCATTER</text>`,
  radial('bglow', [[0, '#fff3c2', 0.9], [0.6, '#f2d27a', 0.35], [1, '#f2d27a', 0]]) + radial('bell', [[0, '#fff1b8'], [0.45, PAL.goldL], [1, PAL.goldD]], 0.38, 0.3, 0.8));
}

export function maskSymbol() {
  let fire = '';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.5, x = 100 + Math.cos(a) * 82, y = 104 + Math.sin(a) * 72;
    fire += `<path d="M${x},${y + 12} C${x - 10},${y} ${x - 4},${y - 10} ${x},${y - 18} C${x + 4},${y - 10} ${x + 10},${y} ${x},${y + 12} Z" fill="#8fd3ff" opacity="0.7"/>`;
  }
  return wrap(200, 200, `
    <circle cx="100" cy="104" r="92" fill="url(#mglow)"/>${fire}
    ${ink('M40,32 L72,70 C84,64 116,64 128,70 L160,32 L158,98 C154,132 124,166 100,178 C76,166 46,132 42,98 Z', PAL.white)}
    <path d="M48,44 L68,68 C62,70 56,74 52,80 Z" fill="${PAL.red}"/><path d="M152,44 L132,68 C138,70 144,74 148,80 Z" fill="${PAL.red}"/>
    ${ink('M60,102 C70,90 84,90 90,100 C80,106 70,108 60,102 Z', PAL.red, 2.5)}${ink('M140,102 C130,90 116,90 110,100 C120,106 130,108 140,102 Z', PAL.red, 2.5)}
    ${line('M66,100 Q76,94 86,100', INK, 3)}${line('M134,100 Q124,94 114,100', INK, 3)}
    <path d="M100,70 C92,80 92,90 100,96 C108,90 108,80 100,70 Z" fill="${PAL.red}"/>
    ${line('M70,124 C78,132 84,128 88,122 M130,124 C122,132 116,128 112,122', PAL.red, 3)}
    ${ink('M92,150 L108,150 L100,160 Z', INK, 2)}
    ${line('M100,160 Q92,168 84,164 M100,160 Q108,168 116,164', INK, 2.5)}
    ${line('M52,140 L76,136 M52,150 L76,144 M148,140 L124,136 M148,150 L124,144', INK, 2, 0.6)}
    <rect x="50" y="170" width="100" height="26" rx="8" fill="${PAL.purple}" stroke="${INK}" stroke-width="3"/>
    <text x="100" y="190" text-anchor="middle" font-family="Georgia, 'Palatino Linotype', serif" font-weight="bold" font-size="17" fill="${PAL.cream}" letter-spacing="2">BONUS</text>`,
  radial('mglow', [[0, '#c9a7ff', 0.75], [0.6, '#6a4c9c', 0.45], [1, '#3a2a5c', 0]]));
}

export const SYMBOL_SVGS = [koiSymbol, toriiSymbol, fanSymbol, kabutoSymbol, lanternSymbol, mochiSymbol, teacupSymbol, craneSymbol, bambooSymbol, monSymbol, wildSymbol, bellSymbol, maskSymbol];

// ======================= reel frame =======================

/** Lacquered wood frame with gold edges around a washi paper panel. w,h = outer size. */
export function frameSvg(w: number, h: number, night = false) {
  const m = 34;
  let fibres = '';
  for (let i = 0; i < 160; i++) {
    const x = m + ((i * 97) % (w - 2 * m)), y = m + ((i * 61) % (h - 2 * m)), l = 12 + (i % 7) * 6, a = (i * 0.7) % 3.14;
    fibres += `<path d="M${x},${y} l${(Math.cos(a) * l).toFixed(1)},${(Math.sin(a) * l).toFixed(1)}" stroke="#a89470" stroke-width="1" opacity="0.18"/>`;
  }
  let petals = '';
  for (let i = 0; i < 14; i++) petals += `<g opacity="0.1">${sakura(m + 40 + ((i * 211) % (w - 2 * m - 80)), m + 40 + ((i * 137) % (h - 2 * m - 80)), 16 + (i % 3) * 6, PAL.pinkD, 0)}</g>`;
  const corner = (x: number, y: number, sx: number, sy: number) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})">
    ${ink('M0,0 L46,0 L46,10 L10,10 L10,46 L0,46 Z', 'url(#fgold)', 2.5)}${circ(22, 22, 7, PAL.goldL, 2.5)}</g>`;
  return wrap(w, h, `
    <rect x="4" y="8" width="${w - 8}" height="${h - 8}" rx="22" fill="#000" opacity="0.4"/>
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="20" fill="url(#lacq)" stroke="${INK}" stroke-width="4"/>
    <rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="14" fill="none" stroke="${PAL.gold}" stroke-width="3"/>
    <path d="M24,18 L${w - 24},18" stroke="#fff" stroke-width="5" opacity="0.12" stroke-linecap="round"/>
    <rect x="${m - 6}" y="${m - 6}" width="${w - 2 * m + 12}" height="${h - 2 * m + 12}" rx="8" fill="url(#fgold)" stroke="${INK}" stroke-width="3"/>
    <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="4" fill="${night ? '#e9dfc4' : PAL.cream}"/>
    ${fibres}${petals}
    <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="4" fill="url(#vig)"/>
    ${corner(14, 14, 1, 1)}${corner(w - 14, 14, -1, 1)}${corner(14, h - 14, 1, -1)}${corner(w - 14, h - 14, -1, -1)}`,
  linear('lacq', [[0, PAL.woodL], [0.5, PAL.wood], [1, PAL.woodD]]) + linear('fgold', [[0, PAL.goldL], [0.5, PAL.gold], [1, PAL.goldD]], 1, 1) +
  radial('vig', [[0.6, '#000', 0], [1, '#5a3a20', 0.22]], 0.5, 0.5, 0.75));
}

// ======================= particles & small art =======================

export function petalSvg(c = PAL.pink) {
  return wrap(40, 40, ink('M20,36 C8,28 6,14 14,6 L20,12 L26,6 C34,14 32,28 20,36 Z', c, 2) + line('M20,32 L20,16', PAL.pinkD, 1.5, 0.6));
}
export function sparkleSvg(c = '#fff3c2') {
  return wrap(64, 64, `<path d="M32,2 C34,24 40,30 62,32 C40,34 34,40 32,62 C30,40 24,34 2,32 C24,30 30,24 32,2 Z" fill="${c}"/><circle cx="32" cy="32" r="6" fill="#fff"/>`);
}
export function glowSvg(c = '#ffe9a8') {
  return wrap(256, 256, `<circle cx="128" cy="128" r="128" fill="url(#g)"/>`, radial('g', [[0, c, 0.95], [0.35, c, 0.5], [1, c, 0]]));
}
/** Small floating sky lantern (free spins). */
export function floatLanternSvg() {
  return wrap(60, 84, `<ellipse cx="30" cy="44" rx="30" ry="38" fill="url(#fl)"/>
    ${ink('M12,18 L48,18 L44,66 L16,66 Z', '#f6a04a', 2.5)}
    <path d="M16,22 L44,22 L41,62 L19,62 Z" fill="#ffd27a" opacity="0.7"/>
    ${ink('M14,66 L46,66 L46,72 L14,72 Z', PAL.redD, 2)}`, radial('fl', [[0, '#ffcf6b', 0.6], [1, '#ffcf6b', 0]]));
}
/** Hanging festival lantern (night scene, lantern meter). */
export function paperLanternSvg(lit: boolean) {
  return wrap(80, 120, `${lit ? '<ellipse cx="40" cy="64" rx="40" ry="50" fill="url(#pl)"/>' : ''}
    ${line('M40,0 L40,16', INK, 2.5)}
    ${ink('M16,60 C16,34 28,22 40,22 C52,22 64,34 64,60 C64,86 52,98 40,98 C28,98 16,86 16,60 Z', lit ? '#ff5a46' : '#6b4a52', 3)}
    ${[-2, -1, 0, 1, 2].map((i) => line(`M${40 - Math.sqrt(1 - (i * 14) ** 2 / 38 ** 2) * 24},${60 + i * 14} Q40,${64 + i * 14} ${40 + Math.sqrt(1 - (i * 14) ** 2 / 38 ** 2) * 24},${60 + i * 14}`, lit ? PAL.redD : '#3e2a30', 1.5, 0.8)).join('')}
    ${lit ? `<ellipse cx="40" cy="60" rx="12" ry="22" fill="#ffe08a" opacity="0.55"/>` : ''}
    ${ink('M28,16 L52,16 L52,24 L28,24 Z', PAL.black, 2.5)}${ink('M28,96 L52,96 L52,104 L28,104 Z', PAL.black, 2.5)}
    ${line('M36,104 L36,116 M44,104 L44,116', PAL.gold, 2.5)}`,
  radial('pl', [[0, '#ffcf6b', 0.75], [1, '#ffcf6b', 0]]));
}

// ======================= Omikuji =======================

/** Hexagonal wooden omikuji box with a hole on top. */
export function omikujiBoxSvg() {
  return wrap(220, 320, `
    <ellipse cx="110" cy="306" rx="90" ry="12" fill="#000" opacity="0.3"/>
    ${ink('M40,60 L180,60 L196,90 L196,286 L180,300 L40,300 L24,286 L24,90 Z', 'url(#box)')}
    ${ink('M24,90 L196,90', 'none', 3)}${line('M70,90 L70,300 M150,90 L150,300', PAL.woodD, 3, 0.6)}
    ${ink('M40,60 L180,60 L196,90 L24,90 Z', '#a8743e')}
    <ellipse cx="110" cy="74" rx="16" ry="7" fill="${INK}"/>
    ${ink('M54,130 L166,130 L166,250 L54,250 Z', PAL.cream, 3)}
    ${sakura(110, 170, 24, PAL.pink, 3)}
    ${line('M70,214 L150,214 M70,228 L150,228', PAL.red, 4)}
    ${ink('M24,268 L196,268 L196,286 L180,300 L40,300 L24,286 Z', PAL.red, 3)}`,
  linear('box', [[0, '#c58a4c'], [1, '#8a5528']], 1, 0));
}
/** The drawn stick that pokes out of the box. */
export function omikujiStickSvg() {
  return wrap(24, 140, ink('M6,4 L18,4 L18,136 L6,136 Z', '#e7c88f', 2.5) + `<rect x="6" y="4" width="12" height="20" fill="${PAL.red}"/>`);
}
export function pineBranchSvg() {
  let needles = '';
  for (let i = 0; i < 9; i++) {
    const x = 30 + i * 22, y = 60 - i * 3;
    for (let k = -3; k <= 3; k++) needles += line(`M${x},${y} l${k * 5},${-22 - Math.abs(k) * 2}`, PAL.greenD, 2.5);
    for (let k = -3; k <= 3; k++) needles += line(`M${x},${y} l${k * 5},${22 + Math.abs(k) * 2}`, PAL.green, 2.5);
  }
  return wrap(240, 120, ink('M6,70 C60,60 140,54 236,40 L236,48 C140,62 60,68 6,78 Z', '#6b4a2c', 3) + needles);
}

// ======================= Torii Path pieces =======================

export function stoneSvg(tint = '#9a958a') {
  return wrap(120, 70, `<ellipse cx="60" cy="42" rx="56" ry="26" fill="#000" opacity="0.3"/>
    ${ink('M6,34 C8,16 40,8 64,8 C92,8 114,18 114,32 C114,48 90,58 60,58 C30,58 4,50 6,34 Z', tint, 3)}
    ${line('M20,28 C40,18 80,16 100,24', '#fff', 3, 0.3)}`);
}
export function smallToriiSvg(lit = false) {
  return wrap(150, 150, `${lit ? '<circle cx="75" cy="80" r="74" fill="url(#tg)"/>' : ''}
    ${ink('M40,40 L52,40 L54,140 L36,140 Z', PAL.red, 3)}${ink('M98,40 L110,40 L114,140 L96,140 Z', PAL.red, 3)}
    ${ink('M20,62 L130,62 L130,72 L20,72 Z', PAL.red, 3)}
    ${ink('M14,30 C50,40 100,40 136,30 L134,42 C100,50 50,50 16,42 Z', PAL.red, 3)}
    ${ink('M6,18 C50,28 100,28 144,18 L146,10 C100,18 50,18 4,10 Z', PAL.black, 3)}`,
  radial('tg', [[0, '#ffe08a', 0.8], [1, '#ffe08a', 0]]));
}
export function shrineSvg() {
  return wrap(300, 240, `
    <ellipse cx="150" cy="226" rx="140" ry="14" fill="#000" opacity="0.3"/>
    ${ink('M40,196 L260,196 L268,222 L32,222 Z', '#8a857a', 3)}
    ${ink('M64,110 L236,110 L236,198 L64,198 Z', PAL.red, 3)}
    ${ink('M96,130 L204,130 L204,198 L96,198 Z', '#3a2418', 3)}
    ${line('M114,130 L114,198 M132,130 L132,198 M150,130 L150,198 M168,130 L168,198 M186,130 L186,198', '#6a4a30', 3)}
    ${ink('M10,104 C70,96 120,64 150,40 C180,64 230,96 290,104 L280,120 C230,114 180,92 150,70 C120,92 70,114 20,120 Z', PAL.black, 3)}
    ${ink('M120,64 C130,56 140,48 150,40 C160,48 170,56 180,64 Z', PAL.indigo, 2)}
    ${line('M120,110 C130,124 170,124 180,110', PAL.gold, 4)}
    ${circ(150, 120, 9, PAL.gold, 2.5)}
    ${ink('M30,96 L40,104 L36,112 Z', PAL.gold, 2)}${ink('M270,96 L260,104 L264,112 Z', PAL.gold, 2)}`);
}
/** Little white fox token (original simple figure). */
export function foxTokenSvg() {
  return wrap(110, 130, `
    <ellipse cx="55" cy="122" rx="40" ry="8" fill="#000" opacity="0.3"/>
    ${ink('M70,112 C96,108 106,80 92,60 C104,82 92,100 74,98 Z', PAL.white, 3)}
    <path d="M92,60 C98,70 100,76 98,84 C94,74 92,68 92,60 Z" fill="${PAL.orange}"/>
    ${ink('M30,118 C26,92 34,70 54,64 C74,70 82,92 78,118 Z', PAL.white, 3)}
    ${ink('M28,44 L30,12 L48,32 Z', PAL.white, 3)}${ink('M82,44 L80,12 L62,32 Z', PAL.white, 3)}
    <path d="M33,38 L34,20 L44,32 Z" fill="${PAL.red}"/><path d="M77,38 L76,20 L66,32 Z" fill="${PAL.red}"/>
    ${ink('M24,50 C24,30 40,24 55,24 C70,24 86,30 86,50 C86,62 70,74 55,76 C40,74 24,62 24,50 Z', PAL.white, 3)}
    ${line('M36,48 Q42,44 48,48 M62,48 Q68,44 74,48', PAL.red, 3)}
    <ellipse cx="55" cy="66" rx="4" ry="3" fill="${INK}"/>
    ${ink('M38,86 C48,92 62,92 72,86 L72,92 C62,98 48,98 38,92 Z', PAL.red, 2)}
    ${circ(55, 96, 4, PAL.gold, 1.5)}`);
}
/** Space icons for the Torii Path. */
export function spaceIconSvg(kind: 'offering' | 'lantern' | 'ema' | 'fox' | 'mist') {
  switch (kind) {
    case 'offering': return wrap(80, 80, `${ink('M14,54 L66,54 L60,70 L20,70 Z', '#c58a4c', 2.5)}${ink('M10,46 L70,46 L70,54 L10,54 Z', '#e0b070', 2.5)}
      ${circ(28, 34, 10, PAL.goldL, 2.5)}${circ(52, 34, 10, PAL.goldL, 2.5)}${circ(40, 22, 10, PAL.goldL, 2.5)}
      ${line('M24,34 L32,34 M48,34 L56,34 M36,22 L44,22', PAL.goldD, 2)}`);
    case 'lantern': return wrap(80, 80, `<circle cx="40" cy="40" r="38" fill="url(#lg)"/>${ink('M22,40 C22,24 30,16 40,16 C50,16 58,24 58,40 C58,56 50,64 40,64 C30,64 22,56 22,40 Z', '#ff5a46', 2.5)}
      ${ink('M32,10 L48,10 L48,16 L32,16 Z', PAL.black, 2)}${ink('M32,64 L48,64 L48,70 L32,70 Z', PAL.black, 2)}
      <text x="40" y="47" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="18" fill="#fff3c2">+1</text>`, radial('lg', [[0, '#ffcf6b', 0.7], [1, '#ffcf6b', 0]]));
    case 'ema': return wrap(80, 80, `${line('M40,6 L40,18', '#c84a2e', 3)}${ink('M10,30 L40,14 L70,30 L70,68 L10,68 Z', '#d9a868', 2.5)}
      ${line('M10,30 L40,14 L70,30', '#8a5528', 4)}${sakura(40, 46, 9, PAL.pink, 1.5)}
      <text x="40" y="66" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="12" fill="${INK}">ROLL</text>`);
    case 'fox': return wrap(80, 80, `<path d="M40,74 C20,70 14,50 24,34 C26,46 32,50 36,48 C30,34 36,16 48,6 C46,22 58,30 60,44 C64,38 64,32 62,28 C72,40 70,68 40,74 Z" fill="#8fd3ff" stroke="#2a6aa0" stroke-width="2.5"/>
      <path d="M40,66 C30,62 28,50 34,42 C36,50 42,52 44,50 C42,42 46,32 52,26 C52,38 58,44 56,56 C54,62 48,66 40,66 Z" fill="#e6f7ff"/>`);
    default: return wrap(80, 80, `${line('M10,40 C20,30 34,30 40,38 C46,30 60,30 70,40', '#c8cbd8', 6)}${line('M16,54 C26,46 40,46 46,52 C52,46 62,46 68,54', '#dfe2ec', 6)}${line('M20,26 C30,20 44,22 48,28', '#b8bccb', 5)}`);
  }
}

// ======================= Maneki-neko mascot (rig parts, 400x520 canvas) =======================

export function mascotCushion() {
  return wrap(400, 520, `
    <ellipse cx="200" cy="506" rx="170" ry="14" fill="#000" opacity="0.3"/>
    ${ink('M50,446 C50,430 70,424 200,424 C330,424 350,430 350,446 L350,482 C350,496 330,502 200,502 C70,502 50,496 50,482 Z', PAL.purple)}
    ${line('M60,452 C120,446 280,446 340,452', PAL.gold, 4)}${line('M60,478 C120,484 280,484 340,478', PAL.gold, 3, 0.7)}
    ${[56, 344].map((x) => `${circ(x, 432, 8, PAL.gold, 3)}${line(`M${x},440 L${x - 6},464 M${x},440 L${x + 6},464 M${x},440 L${x},466`, PAL.gold, 3)}`).join('')}`);
}
export function mascotBody() {
  return wrap(400, 520, `
    <defs><clipPath id="bc"><path d="M112,448 C96,392 108,312 150,290 L250,290 C292,312 304,392 288,448 Z"/></clipPath></defs>
    ${ink('M112,448 C96,392 108,312 150,290 L250,290 C292,312 304,392 288,448 Z', PAL.white)}
    <g clip-path="url(#bc)">
      <path d="M100,380 C120,350 150,356 156,384 C160,412 130,430 100,420 Z" fill="${PAL.orange}"/>
      <path d="M260,320 C280,310 300,330 296,360 C280,364 262,350 260,320 Z" fill="${PAL.black}"/>
    </g>
    ${ink('M112,448 C96,392 108,312 150,290 L250,290 C292,312 304,392 288,448 Z', 'none')}
    ${ink('M120,440 C120,426 150,420 170,428 L172,448 L118,448 Z', PAL.white, 3.5)}${ink('M280,440 C280,426 250,420 230,428 L228,448 L282,448 Z', PAL.white, 3.5)}
    ${line('M136,432 L138,446 M150,430 L152,446 M264,432 L262,446 M250,430 L248,446', INK, 2.5)}
    ${ink('M140,292 C170,312 230,312 260,292 L264,306 C230,330 170,330 136,306 Z', PAL.red, 3.5)}
    ${ink('M200,312 C186,312 178,322 178,334 C178,346 188,354 200,354 C212,354 222,346 222,334 C222,322 214,312 200,312 Z', 'url(#mbell)', 3.5)}
    ${line('M182,330 L218,330', INK, 2.5)}<circle cx="200" cy="342" r="4" fill="${INK}"/>`,
  radial('mbell', [[0, '#fff1b8'], [0.5, PAL.goldL], [1, PAL.goldD]], 0.4, 0.3, 0.8));
}
/** Raised (beckoning) paw: pivot at the shoulder (258, 320). */
export function mascotArmUp() {
  return wrap(400, 520, `
    ${ink('M246,330 C262,290 276,250 282,214 C286,196 316,194 320,214 C322,240 300,290 282,338 Z', PAL.white)}
    <path d="M288,232 C300,226 312,234 312,246 C302,254 290,250 288,232 Z" fill="${PAL.orange}" opacity="0.9"/>
    ${line('M290,204 L292,214 M300,200 L301,212 M310,204 L309,214', INK, 2.5)}
    <ellipse cx="300" cy="222" rx="8" ry="6" fill="${PAL.pink}"/>`);
}
/** Lower paw holding a gold koban coin: pivot at the shoulder (142, 320). */
export function mascotArmDown() {
  return wrap(400, 520, `
    ${ink('M124,318 C110,344 112,380 132,400 L170,400 C156,376 150,350 156,326 Z', PAL.white)}
    ${ink('M150,352 C150,320 166,304 186,304 C206,304 222,320 222,352 C222,384 206,400 186,400 C166,400 150,384 150,352 Z', 'url(#koban)')}
    ${line('M164,336 L208,336 M164,352 L208,352 M164,368 L208,368', PAL.goldD, 2.5)}
    ${ink('M132,396 C130,380 150,374 168,382 C176,392 170,406 152,408 C140,408 134,404 132,396 Z', PAL.white, 3.5)}
    ${line('M146,384 L148,394 M156,382 L157,392', INK, 2)}`,
  linear('koban', [[0, PAL.goldL], [0.6, PAL.gold], [1, PAL.goldD]], 1, 1));
}
export function mascotHead() {
  return wrap(400, 520, `
    ${ink('M108,170 L118,82 L176,126 Z', PAL.white)}${ink('M292,170 L282,82 L224,126 Z', PAL.white)}
    <path d="M124,152 L130,106 L162,130 Z" fill="${PAL.pink}"/><path d="M276,152 L270,106 L238,130 Z" fill="${PAL.pink}"/>
    ${ink('M104,206 C104,142 148,116 200,116 C252,116 296,142 296,206 C296,262 254,290 200,290 C146,290 104,262 104,206 Z', PAL.white)}
    <path d="M248,124 C276,134 292,156 294,184 C270,180 252,160 248,124 Z" fill="${PAL.orange}"/>
    <path d="M112,170 C118,146 134,130 154,124 C150,146 134,162 112,170 Z" fill="${PAL.black}"/>
    <ellipse cx="146" cy="234" rx="18" ry="11" fill="${PAL.pink}" opacity="0.75"/><ellipse cx="254" cy="234" rx="18" ry="11" fill="${PAL.pink}" opacity="0.75"/>
    ${ink('M190,222 L210,222 L200,232 Z', PAL.pinkD, 3)}
    ${line('M92,214 L146,222 M92,234 L146,232 M308,214 L254,222 M308,234 L254,232', INK, 2.5, 0.85)}
    ${line('M200,148 L200,166 M188,150 L190,166 M212,150 L210,166', PAL.orange, 3, 0.8)}`);
}
export function mascotEyes(kind: 'open' | 'happy' | 'closed' | 'wide') {
  let b = '';
  if (kind === 'open') b = [164, 236].map((x) => `<ellipse cx="${x}" cy="200" rx="11" ry="15" fill="${INK}"/><circle cx="${x + 3}" cy="194" r="4" fill="#fff"/>`).join('');
  else if (kind === 'wide') b = [164, 236].map((x) => `<circle cx="${x}" cy="198" r="17" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cx="${x}" cy="200" r="9" fill="${INK}"/><circle cx="${x + 3}" cy="196" r="3" fill="#fff"/>`).join('');
  else if (kind === 'happy') b = line('M150,204 Q164,186 178,204', INK, 5) + line('M222,204 Q236,186 250,204', INK, 5);
  else b = line('M150,198 Q164,210 178,198', INK, 5) + line('M222,198 Q236,210 250,198', INK, 5);
  return wrap(400, 520, b);
}
export function mascotMouth(kind: 'smile' | 'open' | 'sleep') {
  if (kind === 'open') return wrap(400, 520, ink('M184,240 C186,262 214,262 216,240 Q200,246 184,240 Z', PAL.redD, 3) + line('M200,232 Q190,246 180,238 M200,232 Q210,246 220,238', INK, 3.5));
  if (kind === 'sleep') return wrap(400, 520, line('M192,240 Q200,244 208,240', INK, 3));
  return wrap(400, 520, line('M200,232 Q190,246 180,238 M200,232 Q210,246 220,238', INK, 3.5));
}
