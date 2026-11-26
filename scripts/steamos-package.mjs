// After `electron-builder --linux`: confirm the SteamOS tarball exists and contains the installer.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const tgz = path.join('dist', `Sakura Fortune-${version}-linux-x64.tar.gz`);
if (!fs.existsSync(tgz)) { console.error('Missing', tgz); process.exit(1); }
// list tar entries (ustar headers) to check the key files made it in
const tar = zlib.gunzipSync(fs.readFileSync(tgz));
const names = [];
for (let off = 0; off + 512 <= tar.length;) {
  const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/, '');
  if (!name) break;
  const prefix = tar.toString('utf8', off + 345, off + 500).replace(/\0.*$/, '');
  const size = parseInt(tar.toString('utf8', off + 124, off + 136).replace(/\0.*$/, '').trim() || '0', 8);
  names.push(prefix ? `${prefix}/${name}` : name);
  off += 512 + Math.ceil(size / 512) * 512;
}
// archives built on Windows lose the executable bit: set 0755 on the binaries and scripts
const EXEC = /(\/|^)(sakura-fortune|sakura-fortune\.sh|install\.sh|set-steam-art\.py|chrome_crashpad_handler|chrome-sandbox)$/;
let fixed = 0;
for (let off = 0; off + 512 <= tar.length;) {
  const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/, '');
  if (!name) break;
  const size = parseInt(tar.toString('utf8', off + 124, off + 136).replace(/\0.*$/, '').trim() || '0', 8);
  if (EXEC.test(name)) {
    tar.write('0000755\0', off + 100, 8, 'ascii');
    tar.fill(0x20, off + 148, off + 156); // checksum field counts as spaces
    let sum = 0;
    for (let i = off; i < off + 512; i++) sum += tar[i];
    tar.write(sum.toString(8).padStart(6, '0') + '\0 ', off + 148, 8, 'ascii');
    fixed++;
  }
  off += 512 + Math.ceil(size / 512) * 512;
}
if (fixed) fs.writeFileSync(tgz, zlib.gzipSync(tar, { level: 9 }));
console.log(`Set executable permission on ${fixed} files.`);
const need = ['sakura-fortune', 'sakura-fortune.sh', 'install.sh', 'set-steam-art.py', 'README-STEAMOS.txt', 'sakura-fortune.png', 'art/hero.png', 'art/logo.png', 'art/capsule-tall.png', 'art/capsule-wide.png', 'resources/app.asar'];
const missing = need.filter((n) => !names.some((x) => x.endsWith('/' + n) || x === n));
if (missing.length) { console.error('Tarball is missing:', missing.join(', ')); process.exit(1); }
console.log(`SteamOS package ready: ${tgz} (${(fs.statSync(tgz).size / 1048576).toFixed(1)} MB, ${names.length} entries)`);
