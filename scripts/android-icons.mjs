// Writes Sakura Fortune launcher icons and splash screens into the Capacitor Android project.
//   node scripts/android-icons.mjs
import fs from 'fs';
import path from 'path';
import { renderIcon } from './make-icon.mjs';

const res = 'android/app/src/main/res';
if (!fs.existsSync(res)) { console.error('Run `npx cap add android` first.'); process.exit(1); }

const BG = [31, 42, 68]; // #1F2A44 indigo, matches the game's loading screen
// launcher icons: legacy (square + round) and adaptive foreground (108dp canvas, art inside the 66dp safe zone)
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const dir = path.join(res, `mipmap-${d}`);
  fs.mkdirSync(dir, { recursive: true });
  const s = Math.round(48 * k), f = Math.round(108 * k);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), renderIcon(s, s));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), renderIcon(s, s));
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), renderIcon(f, f, { scale: 0.6 }));
}
// adaptive icon background colour
const bgXml = path.join(res, 'values', 'ic_launcher_background.xml');
fs.writeFileSync(bgXml, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1F2A44</color>\n</resources>\n`);

// splash screens: replace every splash.png with the blossom on the indigo background, keeping each image's size
const pngSize = (file) => { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
let splashes = 0;
for (const dir of fs.readdirSync(res)) {
  const file = path.join(res, dir, 'splash.png');
  if (!dir.startsWith('drawable') || !fs.existsSync(file)) continue;
  const [w, h] = pngSize(file);
  fs.writeFileSync(file, renderIcon(w, h, { scale: 0.38, bg: BG }));
  splashes++;
}
console.log(`Android icons written (${Object.keys(dens).length} densities) and ${splashes} splash images replaced.`);
