import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sakura', {
  loadSave: (): Promise<{ data: string | null; status: 'ok' | 'new' | 'recovered' | 'reset' }> => ipcRenderer.invoke('save:load'),
  writeSave: (data: string): Promise<boolean> => ipcRenderer.invoke('save:write', data),
  writeSaveSync: (data: string): boolean => ipcRenderer.sendSync('save:writeSync', data),
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:fullscreen'),
  quit: () => ipcRenderer.invoke('app:quit'),
  isElectron: true,
  /** true in dev runs or when the app is launched with --debug */
  isDev: process.argv.includes('--sf-dev'),
});
