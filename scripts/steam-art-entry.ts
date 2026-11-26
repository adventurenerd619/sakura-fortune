// Runs inside a hidden Electron window (see steam-art.cjs): composes Steam library art from the game's own SVG art.
import * as A from '../src/renderer/art/svg';

const load = (svg: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const i = new Image();
  i.onload = () => resolve(i);
  i.onerror = reject;
  i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/** "Sakura Fortune" logo with a blossom, transparent background. */
function logoSvg(w = 1280, h = 720) {
  const P = A.PAL, ink = A.INK, cx = w / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.goldL}"/><stop offset="0.55" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.goldD}"/></linearGradient>
      <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.6"/></filter>
    </defs>
    <g filter="url(#sh)">
      ${A.sakura(cx, 150, 92, P.pink, 6)}
      ${A.sakura(cx - 170, 210, 38, P.pinkL, 4, -70)}${A.sakura(cx + 170, 210, 38, P.pinkL, 4, -110)}
      <text x="${cx}" y="${h * 0.66}" text-anchor="middle" font-family="Georgia, 'Palatino Linotype', serif" font-weight="bold" font-size="${h * 0.2}" textLength="${w * 0.88}" lengthAdjust="spacingAndGlyphs"
        fill="url(#gd)" stroke="${ink}" stroke-width="${h * 0.018}" stroke-linejoin="round" paint-order="stroke">Sakura Fortune</text>
      <path d="M${cx - 330},${h * 0.78} H${cx - 50} M${cx + 50},${h * 0.78} H${cx + 330}" stroke="${P.red}" stroke-width="5"/>
      <circle cx="${cx}" cy="${h * 0.78}" r="12" fill="${P.red}" stroke="${ink}" stroke-width="3"/>
      <text x="${cx}" y="${h * 0.9}" text-anchor="middle" font-family="Georgia, 'Palatino Linotype', serif" font-weight="bold" font-size="${h * 0.062}" letter-spacing="${h * 0.018}"
        fill="${P.cream}" stroke="${ink}" stroke-width="5" paint-order="stroke">SPRING FESTIVAL SLOTS</text>
    </g>
  </svg>`;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, fx = 960, fy = 560, zoom = 1) {
  const s = Math.max(w / 1920, h / 1080) * zoom;
  let x = w / 2 - fx * s, y = h / 2 - fy * s;
  x = Math.min(0, Math.max(w - 1920 * s, x));
  y = Math.min(0, Math.max(h - 1080 * s, y));
  ctx.drawImage(img, x, y, 1920 * s, 1080 * s);
}
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.5) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(10,14,30,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

(window as any).makeArt = async () => {
  const [dusk, night] = await Promise.all([load(A.duskSceneSvg()), load(A.nightSceneSvg())]);
  // the Maneki-neko, waving, from its rig parts (all share a 400x520 canvas)
  const parts = await Promise.all([A.mascotCushion(), A.mascotArmUp(), A.mascotBody(), A.mascotArmDown(), A.mascotHead(), A.mascotEyes('happy'), A.mascotMouth('open')].map(load));
  const cat = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => { for (const p of parts) ctx.drawImage(p, x, y, 400 * s, 520 * s); };
  const [koi, torii, wild, bell, mask, lantern, petal] = await Promise.all([A.koiSymbol(), A.toriiSymbol(), A.wildSymbol(), A.bellSymbol(), A.maskSymbol(), A.floatLanternSvg(), A.petalSvg()].map(load));
  const logoImg = await load(logoSvg());
  const petals = (ctx: CanvasRenderingContext2D, w: number, h: number, n: number, seed = 1) => {
    let s = seed;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) {
      ctx.save(); ctx.translate(r() * w, r() * h); ctx.rotate(r() * 6); const z = 0.6 + r() * 0.9;
      ctx.drawImage(petal, -20 * z, -20 * z, 40 * z, 40 * z); ctx.restore();
    }
  };
  const out: Record<string, string> = {};

  { const c = canvas(1280, 720); c.getContext('2d')!.drawImage(logoImg, 0, 0); out.logo = c.toDataURL('image/png'); }

  // hero banner 1920x620 (Steam shows the logo over it, so no text)
  {
    const w = 1920, h = 620, c = canvas(w, h), x = c.getContext('2d')!;
    drawCover(x, dusk, w, h, 960, 560, 1.05);
    vignette(x, w, h, 0.45);
    cat(x, 1300, 60, 1.08);
    x.drawImage(koi, 220, 330, 220, 220); x.drawImage(torii, 470, 380, 190, 190); x.drawImage(bell, 40, 390, 180, 180);
    x.drawImage(wild, 980, 400, 180, 180);
    petals(x, w, h, 40, 7);
    out.hero = c.toDataURL('image/png');
  }

  // wide capsule 920x430
  {
    const w = 920, h = 430, c = canvas(w, h), x = c.getContext('2d')!;
    drawCover(x, night, w, h, 960, 500, 1.1);
    vignette(x, w, h, 0.55);
    for (const [lx, ly, s] of [[330, 340, 0.8], [820, 300, 0.9], [600, 360, 0.6]]) x.drawImage(lantern, lx, ly, 60 * s, 84 * s);
    cat(x, 10, 70, 0.68);
    x.drawImage(logoImg, 290, 30, 620, 349);
    out.capsuleWide = c.toDataURL('image/png');
  }

  // tall capsule 600x900
  {
    const w = 600, h = 900, c = canvas(w, h), x = c.getContext('2d')!;
    drawCover(x, dusk, w, h, 960, 560, 1.15);
    vignette(x, w, h, 0.5);
    x.drawImage(logoImg, 10, 20, 580, 326);
    cat(x, 100, 370, 0.98);
    x.drawImage(mask, 20, 700, 160, 160); x.drawImage(bell, 420, 700, 160, 160);
    petals(x, w, h, 26, 3);
    out.capsuleTall = c.toDataURL('image/png');
  }

  // square icon 512x512 (the Wild tile)
  { const c = canvas(512, 512), x = c.getContext('2d')!; x.drawImage(wild, 0, 0, 512, 512); out.icon = c.toDataURL('image/png'); }
  return out;
};
(window as any).artReady = true;
