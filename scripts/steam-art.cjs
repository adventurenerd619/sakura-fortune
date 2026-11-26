// Generates Steam library artwork for the SteamOS build into steamos/art/.
// Usage: npx electron scripts/steam-art.cjs
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'steamos', 'art');
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sakura-art-'));

app.whenReady().then(async () => {
  try {
    await esbuild.build({ entryPoints: [path.join(__dirname, 'steam-art-entry.ts')], bundle: true, format: 'iife', platform: 'browser', outfile: path.join(tmp, 'art.js'), logLevel: 'error' });
    fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><meta charset="utf-8"><body><script src="art.js"></script></body>');
    const win = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { offscreen: true } });
    await win.loadFile(path.join(tmp, 'index.html'));
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    const art = await win.webContents.executeJavaScript('makeArt()');
    fs.mkdirSync(outDir, { recursive: true });
    const names = { logo: 'logo.png', hero: 'hero.png', capsuleWide: 'capsule-wide.png', capsuleTall: 'capsule-tall.png', icon: 'icon.png' };
    for (const [k, file] of Object.entries(names)) {
      fs.writeFileSync(path.join(outDir, file), Buffer.from(art[k].split(',')[1], 'base64'));
      console.log('wrote steamos/art/' + file);
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  app.exit(process.exitCode || 0);
});
