import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { createSaveStore } from './saveStore';

/** Debug tools (Ctrl+D panel, F12 dev tools) only in dev runs, or when launched with --debug. */
const DEV = !app.isPackaged || process.argv.includes('--debug');
/** Start fullscreen on Steam Deck / SteamOS Game Mode, or when launched with --fullscreen. */
const START_FULLSCREEN = process.argv.includes('--fullscreen') || process.env.SteamDeck === '1' || process.env.SteamGamepadUI === '1' || process.env.SteamOS === '1';
let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#1F2A44',
    title: 'Sakura Fortune',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    useContentSize: true,
    fullscreen: START_FULLSCREEN,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      additionalArguments: DEV ? ['--sf-dev'] : [],
    },
  });
  Menu.setApplicationMenu(null);
  win.setAspectRatio(16 / 9);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win!.setFullScreen(!win!.isFullScreen());
      event.preventDefault();
    }
    if (input.key === 'F12' && DEV) win!.webContents.toggleDevTools();
  });
  win.on('closed', () => { win = null; });
}

// ---------------- save file: atomic writes, rolling backup, recovery ----------------
let store: ReturnType<typeof createSaveStore>;
const getStore = () => (store ??= createSaveStore(app.getPath('userData')));

ipcMain.handle('save:load', () => getStore().load());
ipcMain.handle('save:write', (_e, data: string) => getStore().write(data));
ipcMain.on('save:writeSync', (e, data: string) => { e.returnValue = getStore().write(data); });

ipcMain.handle('window:fullscreen', () => {
  if (win) win.setFullScreen(!win.isFullScreen());
  return win?.isFullScreen();
});
ipcMain.handle('app:quit', () => app.quit());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
