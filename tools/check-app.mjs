/**
 * Syntax-checks every inline script in index.html.
 *
 *   node check-app.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'framegrab-check-'));

let bad = 0;
let n = 0;
const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
for (const m of html.matchAll(re)) {
  const attrs = m[1];
  const code = m[2];
  if (!code.trim()) continue;
  // Skip non-JScript payloads: the app embeds gzipped WASM as base64 text.
  const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
  if (type && !/^(?:module|text\/javascript|application\/javascript|application\/ecmascript)$/i.test(type[1])) continue;
  if (/\bsrc\s*=/i.test(attrs)) continue;
  const lines = code.split('\n');
  n++;
  const file = join(dir, `block-${n}.js`);
  writeFileSync(file, code, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    bad++;
    const out = (err.stderr || Buffer.from('')).toString();
    const msg = out.split('\n').filter((l) => /Error|error/.test(l)).slice(0, 2).join(' | ');
    const where = /block-(\d+)\.js:(\d+)/.exec(out);
    console.log(`block ${n} FAILED  ${msg}`);
    if (where) {
      const at = +where[2];
      const ctx = lines.slice(Math.max(0, at - 2), at + 1).map((l) => l.slice(0, 160)).join('\n      ');
      console.log(`      at line ${at}:\n      ${ctx}`);
    }
  }
}
console.log(`\n${n} inline script block(s) checked, ${bad} failed`);
process.exit(bad ? 1 : 0);
