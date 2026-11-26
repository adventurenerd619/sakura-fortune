// Bundles main, preload and renderer into ./app with esbuild.
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const watch = process.argv.includes('--watch');
const out = 'app';
fs.mkdirSync(path.join(out, 'renderer'), { recursive: true });
fs.copyFileSync('src/renderer/index.html', path.join(out, 'renderer', 'index.html'));
fs.copyFileSync('src/renderer/style.css', path.join(out, 'renderer', 'style.css'));

const common = { bundle: true, sourcemap: !process.argv.includes('--prod'), minify: process.argv.includes('--prod'), logLevel: 'info' };
const builds = [
  { ...common, entryPoints: ['src/main/main.ts'], outfile: `${out}/main.js`, platform: 'node', format: 'cjs', external: ['electron'], target: 'node20' },
  { ...common, entryPoints: ['src/main/saveStore.ts'], outfile: `${out}/saveStore.js`, platform: 'node', format: 'cjs', target: 'node20' },
  { ...common, entryPoints: ['src/main/preload.ts'], outfile: `${out}/preload.js`, platform: 'node', format: 'cjs', external: ['electron'], target: 'node20' },
  { ...common, entryPoints: ['src/renderer/main.ts'], outfile: `${out}/renderer/bundle.js`, platform: 'browser', format: 'iife', target: 'chrome110', define: { __DEV__: process.argv.includes('--prod') ? 'false' : 'true' } },
];

if (watch) {
  for (const b of builds) (await esbuild.context(b)).watch();
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
}
