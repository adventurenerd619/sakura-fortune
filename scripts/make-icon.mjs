// Generates the Sakura Fortune icon procedurally (a sakura blossom on an indigo medallion).
// Pure JS rasterizer + PNG encoder, no external assets.
//   node scripts/make-icon.mjs            -> build/icon.png (512x512)
// Also exported: renderIcon(w, h, opts) -> PNG Buffer, used by scripts/android-icons.mjs.
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const PETALS = [0, 1, 2, 3, 4].map((k) => -Math.PI / 2 + (k * 2 * Math.PI) / 5);
/** Is (x,y) inside a petal pointing along angle a? Petal = ellipse pointing outwards with a notch at the tip. */
function inPetal(x, y, a, grow = 0) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const u = x * ca + y * sa, v = -x * sa + y * ca; // u along the petal, v across
  const e = ((u - 100) / (98 + grow)) ** 2 + (v / (66 + grow)) ** 2;
  if (e > 1) return false;
  if (Math.hypot(u - 206, v) < 30 - grow) return false; // notch at the tip
  return u > -10 - grow;
}

/** Colour of the icon at (x, y) in 512-unit icon space, or null if transparent. */
function shade(x, y, medallion) {
  const cx = x - 256, cy = y - 256;
  const r = Math.hypot(cx, cy);
  const outline = [31, 20, 34];
  if (medallion) {
    if (r > 250) return null;
    if (r > 238) return outline;
    if (r > 218) return [232, 190 - (y / 512) * 60, 80];
    if (r > 212) return outline;
  }
  const fx = cx / 0.92, fy = (cy + 4) / 0.92;
  const fr = Math.hypot(fx, fy);
  if (fr < 30) return fr < 24 ? [236, 196, 92] : outline;
  for (const a of PETALS) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const u = fx * ca + fy * sa, v = -fx * sa + fy * ca;
    if (u > 26 && u < 70 && Math.abs(v) < 3.5) return [200, 16, 46];
    if (Math.hypot(u - 74, v) < 8) return [200, 16, 46];
  }
  for (const a of PETALS) if (inPetal(fx, fy, a)) {
    const t = fr / 200;
    return [250 - t * 10, 214 - t * 50, 222 - t * 40];
  }
  for (const a of PETALS) if (inPetal(fx, fy, a, 7)) return outline;
  if (!medallion) return null;
  const t = r / 212;
  return [44 - t * 16, 58 - t * 20, 92 - t * 30];
}

/**
 * Render a PNG.
 * @param {number} W width  @param {number} H height
 * @param {{ scale?: number, bg?: number[] | null, medallion?: boolean }} opts
 *   scale: icon size as a fraction of min(W, H); bg: solid RGB background (null = transparent);
 *   medallion: draw the round medallion (false = blossom only)
 */
export function renderIcon(W, H, opts = {}) {
  const { scale = 1, bg = null, medallion = true } = opts;
  const size = Math.min(W, H) * scale;
  const ox = (W - size) / 2, oy = (H - size) / 2;
  const k = 512 / size;
  const ss = 3;
  const px = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    const inside = x >= ox - 1 && x <= ox + size + 1 && y >= oy - 1 && y <= oy + size + 1;
    if (inside) {
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = shade((x + (sx + 0.5) / ss - ox) * k, (y + (sy + 0.5) / ss - oy) * k, medallion);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
    }
    const i = (y * W + x) * 4, n = ss * ss, al = a / n;
    if (bg) {
      px[i] = (a ? r / a : 0) * al + bg[0] * (1 - al);
      px[i + 1] = (a ? g / a : 0) * al + bg[1] * (1 - al);
      px[i + 2] = (a ? b / a : 0) * al + bg[2] * (1 - al);
      px[i + 3] = 255;
    } else {
      px[i] = a ? r / a : 0; px[i + 1] = a ? g / a : 0; px[i + 2] = a ? b / a : 0; px[i + 3] = al * 255;
    }
  }
  return encodePng(W, H, px);
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
function encodePng(W, H, px) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  fs.mkdirSync('build', { recursive: true });
  fs.writeFileSync('build/icon.png', renderIcon(512, 512));
  console.log('build/icon.png written');
}
