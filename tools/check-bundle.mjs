/**
 * Checks the built engine bundle: parses, and reports the public API surface
 * the app depends on. Run after build-engine.mjs.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(HERE, 'dist/asciify-engine.iife.js'), 'utf8');

// Parse check.
new vm.Script(code, { filename: 'asciify-engine.iife.js' });
console.log('parse OK');

// Load it with a minimal DOM so import-time code can run.
const noop = () => {};
const ctx = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: clearTimeout,
  navigator: { userAgent: 'node', mediaCapabilities: { decodingInfo: async () => ({ supported: false }) } },
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
  performance: { now: () => Date.now() },
  document: {
    createElement: () => ({
      style: {}, getContext: () => null, addEventListener: noop, setAttribute: noop,
      appendChild: noop, removeChild: noop, getBoundingClientRect: () => ({ width: 0, height: 0 }),
    }),
    addEventListener: noop, removeEventListener: noop,
    documentElement: { style: {} },
    body: { appendChild: noop, removeChild: noop },
    fonts: { add: noop },
    head: { appendChild: noop },
  },
  self: {},
  window: {},
  location: { href: 'https://framegrab.local/' },
};
ctx.self = ctx;
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx, { filename: 'asciify-engine.iife.js' });

const A = ctx.Asciify;
if (!A) throw new Error('Asciify global missing');

const want = {
  core: ['asciify', 'asciifyVideo', 'asciifyGif', 'asciifyWebcam', 'asciifyText', 'renderTextToCanvas', 'asciiText', 'asciiTextAnsi', 'captureSnapshot', 'snapshotAndDownload', 'CHARACTER_SETS', 'imageToAsciiFrame', 'renderTextFrameToCanvas'],
  studio: ['mountStudio', 'exportStudio', 'STUDIO_STYLES', 'STUDIO_LOOKS', 'STUDIO_PALETTES', 'DITHER_ALGORITHMS', 'STUDIO_WARPS', 'STUDIO_CHARACTER_SETS', 'STUDIO_HOVERS', 'STUDIO_MOTIONS', 'STUDIO_PRINT_STYLES', 'mountStudioProject', 'exportStudioProject', 'STUDIO_ANIMATION_PRESETS', 'loadStudioMedia', 'normalizeStudioSettings'],
  field: ['mountGlyphField', 'isGlyphFieldSupported', 'glyphFieldTier'],
  hover: ['mountHover', 'STUDIO_HOVERS', 'STUDIO_MOTIONS'],
  kit: ['background', 'fieldBackground', 'buttonLoading', 'statusOrb', 'toastStack', 'skeleton', 'odometer', 'pill', 'tabs', 'commandPalette', 'pageDissolve', 'disintegrate', 'likeBurst', 'swipeDeck', 'slideToConfirm', 'pullRefresh', 'dropzone', 'compare', 'accordion', 'artPanel', 'asciiVideo', 'beam', 'cursorTrail', 'wordmark', 'blockChart', 'thinking', 'streamText', 'setGlobalLook', 'setFieldBudget', 'mountSurface', 'swell', 'drift', 'halo', 'caustics', 'contour', 'ripple', 'mesh', 'interference', 'constellation', 'cascade', 'wordField', 'fluid'],
};

let bad = 0;
for (const [mod, names] of Object.entries(want)) {
  const m = A[mod];
  if (!m) { console.log(`MISSING MODULE ${mod}`); bad++; continue; }
  const missing = names.filter((n) => m[n] === undefined);
  if (missing.length) { console.log(`  ${mod}: MISSING ${missing.join(', ')}`); bad += missing.length; }
  else console.log(`  ${mod}: ok (${Object.keys(m).length} exports)`);
}

// Spot-check catalog sizes.
const s = A.studio;
console.log(`  styles ${s.STUDIO_STYLES.length}  dithers ${s.DITHER_ALGORITHMS.length}  palettes ${Object.keys(s.STUDIO_PALETTES).length}  looks ${s.STUDIO_LOOKS.length}  warps ${s.STUDIO_WARPS.length}  hovers ${s.STUDIO_HOVERS.length}  motions ${s.STUDIO_MOTIONS.length}`);
console.log(`  charsets ${Object.keys(A.core.CHARACTER_SETS).length}`);

if (bad) { console.log(`\n${bad} missing export(s)`); process.exit(1); }
console.log('\nall expected exports present');
