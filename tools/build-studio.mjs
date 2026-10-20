/**
 * Assembles the ASCII Studio block and splices it into index.html.
 *
 *   node build-studio.mjs
 *
 * The block lives in tools/studio/*.js so it can be edited as a normal file;
 * this script keeps index.html in sync. The look gallery is inlined as JSON
 * from ascii/looks.json so the app needs no fetch at runtime.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const read = (p) => readFileSync(resolve(HERE, p), 'utf8');
const looks = JSON.parse(readFileSync(resolve(ROOT, 'ascii/looks.json'), 'utf8'));

// The gallery, trimmed to what the app renders.
const slim = looks.map((l) => ({
  id: l.id,
  name: l.name,
  category: l.category,
  use: l.use,
  ...(l.engineLook ? { engineLook: l.engineLook } : {}),
  settings: l.settings,
  ...(l.overrides ? { overrides: l.overrides } : {}),
  ...(l.exportSize ? { exportSize: l.exportSize } : {}),
}));

const looksConst =
  '/* the engine look gallery, extracted from its reference docs */\n' +
  'const AST_LOOKS=' + JSON.stringify(slim) + ';\n';

const START = '/* ASCII-STUDIO:START */';
const END = '/* ASCII-STUDIO:END */';

const block = [
  START,
  '/* ---- ASCII STUDIO (asciify-engine) ---- */',
  read('studio/01-core.js'),
  looksConst,
  read('studio/02-panel.js'),
  read('studio/03-events.js'),
  read('studio/04-shape.js'),
  read('studio/05-layers.js'),
  END,
].join('\n');

const HTML = resolve(ROOT, 'index.html');
let html = readFileSync(HTML, 'utf8');

const from = html.indexOf(START);
const to = html.indexOf(END);
if (from !== -1 && to !== -1 && to > from) {
  html = html.slice(0, from) + block + html.slice(to + END.length);
} else {
  const MARK = '/* ---- ASCII ---- */';
  const at = html.indexOf(MARK);
  if (at === -1) throw new Error('ASCII marker not found in index.html');
  const anchor = html.indexOf('/* ---- generator ---- */', at);
  if (anchor === -1) throw new Error('generator marker not found in index.html');
  html = html.slice(0, anchor) + block + '\n' + html.slice(anchor);
}
writeFileSync(HTML, html, 'utf8');
console.log(`spliced ASCII Studio (${(block.length / 1024).toFixed(1)} kB, ${slim.length} looks) into index.html`);
