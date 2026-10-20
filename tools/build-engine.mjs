/**
 * FrameGrab build tooling.
 *
 * Bundles asciify-engine into one browser IIFE and inlines it into index.html
 * between the ASCIIFY bundle markers. The app itself stays a single file with
 * no runtime network requests.
 *
 *   node build-engine.mjs            build + inject
 *   node build-engine.mjs --check    build only, report size
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const HTML = resolve(ROOT, 'index.html');
const OUT_DIR = resolve(HERE, 'dist');
const OUT = resolve(OUT_DIR, 'asciify-engine.iife.js');

const START = '<!--ASCIIFY:BUNDLE_START-->';
const END = '<!--ASCIIFY:BUNDLE_END-->';

const pkg = JSON.parse(readFileSync(resolve(HERE, 'node_modules/asciify-engine/package.json'), 'utf8'));

/**
 * `import x from './x?worker-source'` inlines a worker as a minified script
 * string. The engine's Studio starts its render worker from a Blob URL, so
 * hosts need no worker file and no extra request. Mirrors the plugin in the
 * engine's own tsup.config.ts.
 */
const workerSource = {
  name: 'worker-source',
  setup(build) {
    build.onResolve({ filter: /\?worker-source$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.replace(/\?worker-source$/, '.ts')),
      namespace: 'worker-source',
    }));
    build.onLoad({ filter: /.*/, namespace: 'worker-source' }, async (args) => {
      const result = await build({
        entryPoints: [args.path],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: ['es2020'],
        minify: true,
        legalComments: 'none',
      });
      return { contents: `export default ${JSON.stringify(result.outputFiles[0].text)};`, loader: 'js' };
    });
  },
};

const result = await build({
  entryPoints: [resolve(HERE, 'entry.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'Asciify',
  platform: 'browser',
  // Android 8 ships a Chrome 70-era WebView. esbuild lowers ??=, ||=, ?. and
  // class fields for it; nothing in the engine's runtime path needs a newer
  // built-in than Chrome 70 provides.
  target: ['chrome70', 'safari14', 'firefox78', 'es2019'],
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [workerSource],
  metafile: true,
  logLevel: 'warning',
});

const js = result.outputFiles[0].text;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, js, 'utf8');

// ── Report ──────────────────────────────────────────────────────────────────
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(`asciify-engine ${pkg.version}`);
console.log(`  bundle    ${kb(Buffer.byteLength(js))}`);
const outputs = Object.entries(result.metafile.outputs);
const bytesByInput = new Map();
for (const [, out] of outputs) {
  for (const [p, v] of Object.entries(out.inputs || {})) {
    bytesByInput.set(p, (bytesByInput.get(p) || 0) + v.bytesInOutput);
  }
}
const inputs = [...bytesByInput.entries()]
  .filter(([p]) => !p.startsWith('entry.ts'))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8);
for (const [p, v] of inputs) {
  console.log(`    ${kb(v).padStart(9)}  ${p.replace(/^node_modules\//, '')}`);
}

if (process.argv.includes('--check')) {
  console.log('  (not injected: --check)');
  process.exit(0);
}

// ── Inject ──────────────────────────────────────────────────────────────────
let html = readFileSync(HTML, 'utf8');
const before = Buffer.byteLength(html);
const block = `${START}\n<script>\n${js}\n</script>\n${END}`;

// Drop a previous bundle, wherever it was.
const oldStart = html.indexOf(START);
const oldEnd = html.indexOf(END);
if (oldStart !== -1 && oldEnd !== -1 && oldEnd > oldStart) {
  html = html.slice(0, oldStart) + html.slice(oldEnd + END.length);
}

// The engine must be on the page before the app script runs: the app reads
// window.Asciify while it initialises.
const ANCHOR = 'const $=s=>document.querySelector(s)';
const at = html.indexOf(ANCHOR);
if (at === -1) throw new Error('Could not find the app script in index.html.');
const tag = html.lastIndexOf('<script', at);
if (tag === -1) throw new Error('Could not find the app script tag in index.html.');

html = html.slice(0, tag) + block + '\n' + html.slice(tag);
writeFileSync(HTML, html, 'utf8');

const after = Buffer.byteLength(html);
console.log(`  index.html ${kb(before)} -> ${kb(after)}  (+${kb(after - before)})`);
console.log('  injected.');
