/**
 * Platform layer: the same game runs in Electron (Windows / SteamOS), in the Android
 * app (Capacitor) and in a plain browser (dev server). Everything platform-specific
 * goes through here.
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';

declare const __DEV__: boolean;

const electronApi = (window as any).sakura as undefined | { isDev?: boolean; quit(): void; toggleFullscreen(): Promise<boolean> };

export const isElectron = !!electronApi;
export const isNative = !isElectron && Capacitor.isNativePlatform();
export const isAndroid = isNative && Capacitor.getPlatform() === 'android';
export const platformName = isElectron ? 'desktop' : isAndroid ? 'android' : isNative ? Capacitor.getPlatform() : 'web';

/** Debug tools: Electron dev runs / --debug; the browser dev server; never in a release Android build. */
export const debugAllowed = isElectron ? !!electronApi!.isDev : isNative ? (typeof __DEV__ !== 'undefined' && __DEV__) : true;

/** Key/value storage for non-Electron platforms (Android: SharedPreferences; browser: localStorage). */
export const kv = {
  async get(key: string): Promise<string | null> {
    if (isNative) return (await Preferences.get({ key })).value;
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    if (isNative) { await Preferences.set({ key, value }); return; }
    try { localStorage.setItem(key, value); } catch { /* storage full or blocked */ }
  },
};

export function quitApp() {
  if (isElectron) electronApi!.quit();
  else if (isNative) App.exitApp();
  else window.close();
}

export function canToggleFullscreen() { return !isNative; }
export function toggleFullscreen() {
  if (isElectron) electronApi!.toggleFullscreen();
  else if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

/** Android hardware back button. */
export function onBackButton(cb: () => void) {
  if (isNative) App.addListener('backButton', cb);
}
/** App sent to background / brought back (Android), or tab hidden/shown (desktop/web). */
export function onPauseResume(pause: () => void, resume: () => void) {
  if (isNative) {
    App.addListener('pause', pause);
    App.addListener('resume', resume);
  } else {
    document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));
  }
}
