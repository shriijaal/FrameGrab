/**
 * Screenshots the app in headless Edge.
 *
 *   node shot.mjs <name> [setup-expression] [width] [height]
 *
 * The setup expression runs as an async function body in the page, so it can
 * await the app's own loaders.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { extname, join, resolve, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(ROOT, 'tools', 'shots');
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\EdgeCore\\155.0.4283.62\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const name = process.argv[2] || 'shot';
const setup = process.argv[3] || '';
const width = +(process.argv[4] || 900);
const height = +(process.argv[5] || 1400);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const profile = mkdtempSync(join(tmpdir(), 'fg-shot-'));
const port = 9800 + (process.pid % 300);
const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', `--window-size=${width},${height}`,
  '--force-device-scale-factor=2', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
});

for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`);
    const j = await r.json();
    if (j.webSocketDebuggerUrl) { ws = new WebSocket(j.webSocketDebuggerUrl); break; }
  } catch { /* waiting */ }
  await sleep(250);
}
await new Promise((r) => ws.addEventListener('open', r));
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  }
});

const { targetId } = await send('Target.createTarget', { url: `http://127.0.0.1:${PORT}/index.html` });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false }, sessionId);

for (let i = 0; i < 120; i++) {
  const r = await send('Runtime.evaluate', {
    expression: `typeof Asciify!=="undefined" && typeof setTool==='function' && typeof loadTI==='function' && document.querySelectorAll('#tgrid button').length>0`,
    returnByValue: true,
  }, sessionId);
  if (r.result?.value) break;
  await sleep(250);
}

if (setup) {
  const r = await send('Runtime.evaluate', {
    expression: `(async()=>{${setup}})()`,
    returnByValue: true, awaitPromise: true,
  }, sessionId);
  if (r.exceptionDetails) console.error('setup error:', r.exceptionDetails.exception?.description);
  else if (r.result?.value !== undefined) console.log('setup ->', JSON.stringify(r.result.value));
}
await sleep(1200);
await mkdir(OUT, { recursive: true });
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
await writeFile(resolve(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'));
console.log('wrote', resolve(OUT, `${name}.png`));

child.kill();
server.close();
try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
process.exit(0);
