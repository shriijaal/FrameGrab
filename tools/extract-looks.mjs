/**
 * Extracts the engine's look gallery into a FrameGrab preset file.
 *
 * The engine ships 12 looks as STUDIO_LOOKS (referenced in its docs through
 * the studioLook() helper). The rest of the gallery - the projects,
 * composed, finished, characters, dither, print and tiles families - is
 * documented in the engine's own reference docs, each with the exact
 * StudioSettings and export sizes.
 *
 * This reads those settings blocks and writes ascii/looks.json so the app can
 * offer every look as a one-tap preset. Settings that come from studioLook()
 * are marked with `engineLook` and resolved against STUDIO_LOOKS at runtime.
 *
 *   node extract-looks.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const REF = resolve(HERE, 'node_modules/asciify-engine/skills/asciify-engine/references/looks.md');
const OUT = resolve(ROOT, 'ascii/looks.json');

const md = readFileSync(REF, 'utf8');

/** Evaluates a JS object literal in an empty sandbox. The docs' blocks only
 *  ever contain literals, so nothing else is reachable from there. */
function literal(expr) {
  return vm.runInNewContext(`(${expr})`, Object.create(null), { timeout: 1000 });
}

/** The text of the value that follows `key:` up to its matching brace or
 *  bracket, respecting nesting and strings. */
function valueAfter(src, key) {
  const at = src.indexOf(key);
  if (at === -1) return null;
  let i = src.indexOf(':', at + key.length);
  if (i === -1) return null;
  i++;
  while (i < src.length && /\s/.test(src[i])) i++;
  const open = src[i];
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let quote = null;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (quote) {
      if (ch === '\\') { j++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return null;
}

const looks = [];

for (const sec of md.split(/\n(?=## )/)) {
  const head = sec.match(/^## ([a-z0-9\-]+): (.+)$/m);
  if (!head) continue;
  const [, id, name] = head;
  const category = (sec.match(/^Category: (.+)$/m) || [, ''])[1].trim();
  const use = (sec.match(/^Use it for: (.+)$/m) || [, ''])[1].trim();

  const blocks = [...sec.matchAll(/```ts\n([\s\S]*?)```/g)].map((m) => m[1]);
  const call = blocks.find((b) => b.includes('settings:')) || blocks.find((b) => b.includes('studioLook('));
  if (!call) continue;

  // settings may be an object literal, a bare studioLook('id'), or an object
  // literal that spreads a studioLook() and adds to it.
  const settingsText = valueAfter(call, 'settings');
  const spread = settingsText && settingsText.match(/^\{\s*\.\.\.studioLook\('([^']+)'\)\s*(?:,\s*([\s\S]*?)\s*)?\}$/);
  const bare = call.match(/studioLook\('([^']+)'\)/);

  let engineLook = null;
  let settings = {};
  try {
    if (spread) {
      engineLook = spread[1];
      if (spread[2]) settings = literal('{' + spread[2] + '}');
    } else if (settingsText && settingsText.startsWith('{')) {
      settings = literal(settingsText);
    } else if (bare) {
      engineLook = bare[1];
    } else {
      continue;
    }
  } catch (err) {
    console.warn(`  skip ${id}: ${err.message}`);
    continue;
  }

  // art.update({ ... }) carries extra settings the look adds on top.
  const upd = call.match(/art\.update\(\s*(\{[\s\S]*?\})\s*\)/);
  let overrides = null;
  if (upd) {
    try {
      overrides = literal(upd[1]);
    } catch { /* leave the look as documented */ }
  }

  // Export sizes: { format: 'png', width: 3000, height: 3000, ... }
  const exp = (call.match(/format:\s*'(\w+)'[^}]*?width:\s*(\d+)[^}]*?height:\s*(\d+)/) || []).slice(1);
  const exportSize = exp.length === 3 ? { format: exp[0], width: +exp[1], height: +exp[2] } : null;

  const maxCells = (call.match(/maxCells:\s*(\d+)/) || [])[1];

  looks.push({
    id,
    name: name.trim(),
    category,
    use,
    ...(engineLook ? { engineLook } : {}),
    settings,
    ...(overrides ? { overrides } : {}),
    ...(exportSize ? { exportSize } : {}),
    ...(maxCells ? { maxCells: +maxCells } : {}),
  });
}

// Keep the document's order: it is the gallery order on asciify.org, family
// by family (Projects, Composed, Finished, Characters, Dither, Print, Tiles).

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(looks, null, 1), 'utf8');

const byCat = {};
for (const l of looks) byCat[l.category] = (byCat[l.category] || 0) + 1;
console.log(`extracted ${looks.length} looks -> ascii/looks.json`);
for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(2)}  ${c}`);
}
console.log(`  ${looks.filter((l) => l.engineLook).length} resolve from STUDIO_LOOKS`);
console.log(`  ${looks.filter((l) => l.exportSize).length} with export sizes`);
