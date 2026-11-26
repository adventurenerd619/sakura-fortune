// Prints the measured level of every sound effect and music track (rendered offline at full volume)
// and fails if anything clips, is silent, or the music tracks are badly mismatched in loudness.
// Usage: npm run audio:levels
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const esbuild = require('esbuild');

app.whenReady().then(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-audio-'));
  let fails = 0;
  try {
    await esbuild.build({ entryPoints: [path.join(__dirname, 'audio-levels-entry.ts')], bundle: true, format: 'iife', platform: 'browser', outfile: path.join(tmp, 'a.js'), logLevel: 'error' });
    fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><meta charset="utf-8"><script src="a.js"></script>');
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    await win.loadFile(path.join(tmp, 'index.html'));
    const rows = await win.webContents.executeJavaScript('runLevels()');
    console.log('sound'.padEnd(16), 'peak dB'.padStart(8), 'RMS dB'.padStart(8), 'active s'.padStart(9), 'bright'.padStart(7));
    for (const r of rows) {
      const flag = r.peakDb > -0.5 ? '  <- clips' : r.peakDb < -45 ? '  <- nearly silent' : '';
      if (flag) fails++;
      console.log(r.name.padEnd(16), String(r.peakDb).padStart(8), String(r.rmsDb).padStart(8), String(r.activeS).padStart(9), String(r.brightness).padStart(7) + flag);
    }
    const music = rows.filter((r) => r.name.startsWith('music'));
    const spread = Math.max(...music.map((r) => r.rmsDb)) - Math.min(...music.map((r) => r.rmsDb));
    console.log(`\nmusic loudness spread: ${spread.toFixed(1)} dB${spread > 6 ? '  <- more than 6 dB apart' : ''}`);
    if (spread > 6) fails++;
    console.log(fails ? `\n${fails} level problem(s)` : '\nNo clipping, nothing silent, music tracks within 6 dB of each other');
  } catch (e) { console.error(e); fails++; }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows may still hold the folder */ }
  app.exit(fails ? 1 : 0);
});
