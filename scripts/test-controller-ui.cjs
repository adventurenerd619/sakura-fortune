// Drives the game with simulated controller presses (via game.onPad): menus and panels, and gameplay
// (spin, bet, denomination, credits view, turbo, bonus buy, A to roll on the Torii Path, A to draw an Omikuji).
// Usage: npm run test:controller   (or: npx electron scripts/test-controller-ui.cjs <screenshotDir>)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createSaveStore } = require('../app/saveStore.js');

const out = path.resolve(process.argv[2] || 'controller-out');
fs.mkdirSync(out, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-pad-'));
app.setPath('userData', dir);
const store = createSaveStore(dir);
ipcMain.handle('save:load', () => store.load());
ipcMain.handle('save:write', (_e, d) => store.write(d));
ipcMain.on('save:writeSync', (e, d) => { e.returnValue = store.write(d); });
ipcMain.handle('window:fullscreen', () => false);
ipcMain.handle('app:quit', () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); if (!ok) fails++; };
const P = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 900, useContentSize: true, show: true,
    webPreferences: { preload: path.join(__dirname, '..', 'app', 'preload.js'), contextIsolation: true, backgroundThrottling: false, additionalArguments: ['--sf-dev'] } });
  await win.loadFile(path.join(__dirname, '..', 'app', 'renderer', 'index.html'));
  const js = (c) => win.webContents.executeJavaScript(c);
  const pad = async (b, wait = 120) => { await js(`game.onPad(${b}); 0`); await sleep(wait); };
  const shot = async (n) => fs.writeFileSync(path.join(out, n + '.png'), (await win.webContents.capturePage()).toPNG());
  const cursor = () => js("game.padCursor ? (game.padCursor.textContent.trim() || game.padCursor.tagName) + '|' + game.padCursor.classList.contains('pad-focus') : 'none'");
  const waitFor = async (cond, max = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (await js(cond)) return true; await sleep(150); } return false; };
  try {
    for (let i = 0; i < 60 && !(await js('!!(window.game && game.hud)')); i++) await sleep(100);
    await sleep(800);

    // ---- base game controls
    const bet0 = await js('game.save.betIndex');
    await pad(P.RIGHT);
    check('D-pad right raises the bet', (await js('game.save.betIndex')) === bet0 + 1);
    await pad(P.LEFT);
    check('D-pad left lowers the bet', (await js('game.save.betIndex')) === bet0);
    await pad(P.RB);
    check('RB raises the denomination', (await js('game.save.settings.denomIndex')) === 1);
    await pad(P.LB);
    check('LB lowers the denomination', (await js('game.save.settings.denomIndex')) === 0);
    const mode0 = await js('game.save.settings.moneyMode');
    await pad(P.LT);
    check('LT switches credits / dollars', (await js('game.save.settings.moneyMode')) !== mode0);
    await pad(P.LT);
    await pad(P.RT);
    check('RT turns turbo on', (await js('game.save.settings.turbo')) === true);
    const spins0 = await js('game.save.session.spins');
    await pad(P.A, 200);
    check('A spins', (await js('game.save.session.spins')) === spins0 + 1);
    await waitFor('!game.busy');

    // ---- auto-spin menu
    await pad(P.X, 200);
    check('X opens auto-spin with the cursor on the first option', (await cursor()) === '10 spins|true', await cursor());
    await pad(P.DOWN); await pad(P.DOWN);
    check('D-pad moves the highlighted option', (await cursor()) === '50 spins|true', await cursor());
    await shot('1-auto-menu-cursor');
    await pad(P.B);
    check('B closes the auto-spin menu', !(await js("game.hud.autoMenu.classList.contains('open')")));

    // ---- add funds: no keyboard until asked for
    await js('game.openCredits(); 0'); await sleep(300);
    check('Add Funds does not focus the amount box (no on-screen keyboard)', !(await js('document.activeElement === game.hud.creditInput')));
    check('cursor starts on the first quick option', (await cursor()).startsWith('+$100'), await cursor());
    await pad(P.DOWN); await pad(P.DOWN); await pad(P.DOWN);
    check('moving onto the amount box highlights it without focusing it', (await cursor()) === 'INPUT|true' && !(await js('document.activeElement === game.hud.creditInput')), await cursor());
    await shot('2-add-funds-cursor');
    await pad(P.A);
    check('A on the amount box focuses it (opens the keyboard on devices)', await js('document.activeElement === game.hud.creditInput'));
    await js('game.hud.creditInput.blur(); 0');
    await pad(P.B);

    // ---- settings: sliders and dropdown
    await js('game.openSettings(); 0'); await sleep(300);
    const vol0 = await js('game.save.settings.master');
    await pad(P.LEFT);
    check('left on a highlighted slider turns it down', Math.abs((await js('game.save.settings.master')) - (vol0 - 0.05)) < 1e-9, `${vol0} -> ${await js('game.save.settings.master')}`);
    await pad(P.RIGHT);
    for (let i = 0; i < 4; i++) await pad(P.DOWN);
    const motion0 = await js('game.save.settings.reducedMotion');
    await pad(P.A);
    check('A on the motion dropdown changes it', (await js('game.save.settings.reducedMotion')) !== motion0, `${motion0} -> ${await js('game.save.settings.reducedMotion')}`);
    await js(`game.hud.motionSel.value = ${JSON.stringify(motion0)}; game.hud.motionSel.dispatchEvent(new Event('change')); 0`);
    await pad(P.B);

    // ---- stats: LB / RB pages, LT / RT session / all time
    await pad(P.VIEW, 300);
    const t0 = await js('game.book.tab');
    await pad(P.RB); await pad(P.RB);
    check('RB moves forward through Stats pages', (await js('game.book.tab')) === (t0 + 2) % 5, `tab ${await js('game.book.tab')}`);
    await pad(P.LB);
    check('LB moves back', (await js('game.book.tab')) === (t0 + 1) % 5);
    for (let i = 0; i < 4; i++) await pad(P.RB);
    check('pages wrap around', (await js('game.book.tab')) === t0);
    const m0 = await js('game.book.mode');
    await pad(P.RT);
    check('RT switches This Session / All Time', (await js('game.book.mode')) !== m0);
    await pad(P.RB);
    check('active tab gets the cursor', (await cursor()).endsWith('|true'), await cursor());
    await shot('3-stats-page');
    await pad(P.B);

    // ---- rules / paytable (Start)
    await pad(P.START, 300);
    const p0 = await js('game.paytable.tab');
    await pad(P.RB);
    check('RB changes Rules page', (await js('game.paytable.tab')) === (p0 + 1) % 4);
    await pad(P.LB); await pad(P.LB);
    check('LB wraps backwards', (await js('game.paytable.tab')) === (p0 + 3) % 4);
    await shot('4-rules-page');
    await pad(P.B);
    check('menus closed again', !(await js('game.anyModalOpen()')));

    // ---- bonus buy with Y
    await pad(P.Y, 300);
    check('Y opens the bonus buy', await js('game.hud.buy.isOpen()'));
    await pad(P.B);

    // ---- A rolls the die on the Torii Path
    await js("game.save.settings.turbo = false; game.refreshAll(); game.force = {feature:'torii'}; game.spin(); 0");
    await waitFor('!!game.waiter && game.inFeature');
    await pad(P.A);
    check('A answers the Torii Path banner', await waitFor('game.torii.visible && !!game.waiter', 15000));
    const rolls = await js('game.lastResult.torii.rolls.length');
    for (let i = 0; i < rolls; i++) {
      await waitFor('!!game.waiter && game.torii.visible', 20000);
      await pad(P.A, 300);
      if (i === 0) { await shot('5-torii-roll'); check('A rolls the die', (await js('game.torii.pos')) > 0 || (await waitFor('game.torii.pos > 0', 5000))); }
    }
    for (let i = 0; i < 10 && (await js('game.busy')); i++) { if (await js('!!game.waiter')) await pad(P.A, 300); else await sleep(500); }
    await waitFor('!game.busy', 30000);
    check('Torii Path finished with the controller only', !(await js('game.busy')));

    // ---- A draws the Omikuji slip
    await js("game.force = {feature:'omikuji', slip:'kichi'}; game.spin(); 0");
    await waitFor('game.omikujiBox.visible && !!game.waiter', 15000);
    await pad(P.A, 300);
    check('A draws the Omikuji slip', await waitFor("game.hud.slip.classList.contains('show')", 5000));
    await waitFor('!!game.waiter', 5000);
    await pad(P.A);
    await waitFor('!game.busy', 15000);
    check('Omikuji finished with the controller only', !(await js('game.busy')));

    // ---- B stops auto-spin
    await js('game.startAuto(25); 0');
    await sleep(400);
    await pad(P.B);
    check('B stops auto-spin', (await js('game.autoLeft')) === 0);
    await waitFor('!game.busy', 30000);
  } catch (e) { console.log('ERROR', e); fails++; }
  console.log(fails ? `\n${fails} FAILED` : '\nAll controller UI checks passed');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may still hold the folder */ }
  app.exit(fails ? 1 : 0);
});
