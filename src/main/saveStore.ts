/**
 * Save-file storage: atomic writes, a rolling backup of the last good save,
 * and recovery when the main file is unreadable. Used by the Electron main
 * process (and the smoke test, which loads the same code).
 */
import * as fs from 'fs';
import * as path from 'path';

export type LoadStatus = 'ok' | 'new' | 'recovered' | 'reset';

export function createSaveStore(dir: string) {
  const main = path.join(dir, 'sakura-save.json');
  const bak = path.join(dir, 'sakura-save.bak.json');

  /** A save is usable if it parses and has a numeric balance. */
  const readValid = (file: string): string | null => {
    try {
      if (!fs.existsSync(file)) return null;
      const text = fs.readFileSync(file, 'utf-8');
      const obj = JSON.parse(text);
      return obj && typeof obj === 'object' && Number.isFinite(obj.balance) ? text : null;
    } catch {
      return null;
    }
  };

  /** Keep a copy of an unreadable save so nothing is destroyed. */
  const quarantine = (file: string) => {
    try {
      if (fs.existsSync(file)) fs.copyFileSync(file, file.replace(/\.json$/, `.corrupt-${Date.now()}.json`));
    } catch (e) { console.error(e); }
  };

  return {
    files: { main, bak },
    load(): { data: string | null; status: LoadStatus } {
      const good = readValid(main);
      if (good) return { data: good, status: 'ok' };
      const mainExists = fs.existsSync(main);
      const backup = readValid(bak);
      if (backup) {
        if (mainExists) quarantine(main);
        return { data: backup, status: 'recovered' };
      }
      if (mainExists) { quarantine(main); return { data: null, status: 'reset' }; }
      return { data: null, status: 'new' };
    },
    write(data: string): boolean {
      const tmp = main + '.tmp';
      try {
        JSON.parse(data); // never write something we couldn't read back
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(tmp, data, 'utf-8');
        // the previous good save becomes the backup, then the new file takes its place
        if (readValid(main)) fs.copyFileSync(main, bak);
        fs.renameSync(tmp, main);
        return true;
      } catch (e) {
        console.error('save failed', e);
        return false;
      }
    },
  };
}
