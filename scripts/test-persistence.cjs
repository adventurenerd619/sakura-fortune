// Electron test for save safety and debug gating. Uses the real save store (app/saveStore.js).
// Usage: npm run test:persist
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createSaveStore } = require('../app/saveStore.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-persist-'));
app.setPath('userData', dir);
const store = createSaveStore(dir);
ipcMain.handle('save:load', () => store.load());
ipcMain.handle('save:write', (_e, d) => store.write(d));
ipcMain.on('save:writeSync', (e, d) => { e.returnValue = store.write(d); });
ipcMain.handle('window:fullscreen', () => false);
ipcMain.handle('app:quit', () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) failures++; };
const readFileBalance = () => JSON.parse(fs.readFileSync(store.files.main, 'utf-8')).balance;

async function open(dev) {
  const win = new BrowserWindow({
    width: 1280, height: 720, show: true,
    webPreferences: { preload: path.join(__dirname, '..', 'app', 'preload.js'), contextIsolation: true, backgroundThrottling: false, additionalArguments: dev ? ['--sf-dev'] : [] },
  });
  await win.loadFile(path.join(__dirname, '..', 'app', 'renderer', 'index.html'));
  await waitReady(win);
  return win;
}
async function waitReady(win) {
  for (let i = 0; i < 100; i++) {
    try { if (await win.webContents.executeJavaScript('!!(window.game && game.hud && game.reels)')) { await sleep(300); return; } } catch {}
    await sleep(100);
  }
  throw new Error('game did not load');
}
const js = (win, code) => win.webContents.executeJavaScript(code);
const run = (win, code) => win.webContents.executeJavaScript('(()=>{' + code + ';return 0})()');

app.whenReady().then(async () => {
  try {
    // ---- 1. debug panel gating ----
    const win = await open(true);
    const prod = await open(false);
    check('release build: debug not allowed', (await js(prod, 'game.debugAllowed')) === false);
    await js(prod, 'game.toggleDebug()');
    check('release build: Ctrl+D panel stays hidden', (await js(prod, 'getComputedStyle(game.hud.debug).display')) === 'none');
    prod.destroy();
    await sleep(500);
    await win.webContents.reload(); await waitReady(win);
    check('dev build: debug allowed', (await js(win, 'game.debugAllowed')) === true);
    await js(win, 'game.toggleDebug()');
    check('dev build: Ctrl+D panel opens', (await js(win, 'getComputedStyle(game.hud.debug).display')) === 'block');
    await js(win, 'game.toggleDebug()');

    // ---- 2. crash in the middle of a bought Lantern Festival ----
    await run(win, 'game.addCredits(100, true)');
    await sleep(300);
    const startBal = await js(win, 'game.save.balance');
    await run(win, "game.save.settings.turbo = false; game.refreshAll(); game.buyBonus('freespins')");
    let inFeature = false;
    for (let i = 0; i < 60 && !inFeature; i++) { await sleep(250); inFeature = await js(win, 'game.inFeature'); }
    await sleep(800);
    check('feature is mid-presentation', await js(win, 'game.inFeature && game.busy'));
    const real = await js(win, 'game.save.balance');
    const shown = await js(win, 'game.displayBalance()');
    const res = await js(win, '({cost: game.lastResult.cost, win: game.lastResult.totalWin})');
    const pending = await js(win, 'game.pendingWin');
    check('buy cost and full win already applied to the real balance', Math.abs(real - (startBal - res.cost + res.win)) < 1e-6, `start ${startBal}, real ${real}, ${JSON.stringify(res)}`);
    check('screen still hides the unrevealed part of the win', Math.abs(shown - (real - pending)) < 1e-6, `shown ${shown}, pending ${pending}`);
    check('save file on disk already has the win', Math.abs(readFileBalance() - real) < 1e-6, `file ${readFileBalance()}`);
    win.webContents.forcefullyCrashRenderer();
    await sleep(500);
    win.webContents.reload();
    await waitReady(win);
    const after = await js(win, 'game.save.balance');
    check('after crash + relaunch, balance includes the feature win', Math.abs(after - real) < 1e-6, `before crash ${real}, after ${after}`);
    check('after relaunch, game is idle (not stuck mid-feature)', (await js(win, 'game.busy')) === false);
    check('the buy was recorded in stats before the crash', (await js(win, 'game.save.session.buysFreeSpins')) === 1);

    // a normal (non-debug) spin is recorded in stats immediately
    const spins0 = await js(win, 'game.save.session.spins');
    await run(win, 'game.spin()');
    await sleep(200);
    check('stats recorded at the start of the spin animation', (await js(win, 'game.save.session.spins')) === spins0 + 1);
    for (let i = 0; i < 80 && (await js(win, 'game.busy')); i++) await sleep(250);

    // ---- 3. corrupted save: recovered from backup ----
    await js(win, 'game.addCredits(123, false)');
    await sleep(300);
    await run(win, 'game.secondTick()'); await sleep(600); await run(win, 'game.secondTick()'); await sleep(600);
    const goodBal = readFileBalance();
    const bakBal = JSON.parse(fs.readFileSync(store.files.bak, 'utf-8')).balance;
    check('backup file exists and is readable', Number.isFinite(bakBal), `backup balance ${bakBal}`);
    win.webContents.forcefullyCrashRenderer();
    await sleep(300);
    fs.writeFileSync(store.files.main, '{"balance": 12, "broken');
    win.webContents.reload();
    await waitReady(win);
    const rec = await js(win, 'game.save.balance');
    check('damaged save restored from backup', Math.abs(rec - bakBal) < 1e-6, `restored ${rec} (main was ${goodBal}, backup ${bakBal})`);
    await sleep(1200);
    check('player told about the recovery', /restored from the most recent backup/.test(await js(win, 'game.hud.toast.textContent')));
    check('damaged file kept as .corrupt copy', fs.readdirSync(dir).some((f) => f.includes('.corrupt-')));

    // ---- 4. both files unreadable: fresh start, with notice ----
    win.webContents.forcefullyCrashRenderer();
    await sleep(300);
    fs.writeFileSync(store.files.main, 'garbage');
    fs.writeFileSync(store.files.bak, 'garbage too');
    win.webContents.reload();
    await waitReady(win);
    check('unreadable save + backup: new game at $100', (await js(win, 'game.save.balance')) === 100);
    await sleep(1200);
    check('player told about the reset', /could not be read/.test(await js(win, 'game.hud.toast.textContent')));

    // ---- 5. mute and settings are remembered ----
    await run(win, 'game.toggleMute()');
    await sleep(600);
    win.webContents.reload();
    await waitReady(win);
    check('mute is remembered across restarts', (await js(win, 'game.save.settings.muted')) === true && (await js(win, 'game.audio.settings.muted')) === true);
    win.destroy();
  } catch (e) {
    console.log('ERROR', e && e.stack || e);
    failures++;
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may still hold the folder */ }
  app.exit(failures ? 1 : 0);
});
