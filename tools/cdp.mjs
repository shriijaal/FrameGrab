/**
 * A small headless-Chromium harness: serves the repo over HTTP, opens
 * index.html, and lets you run expressions in the page.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { extname, join, resolve, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\EdgeCore\\155.0.4283.62\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\Dell\\AppData\\Local\\imput\\Helium\\Application\\chrome.exe',
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.onEvent = () => {};
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else if (m.method) this.onEvent(m);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 180000);
    });
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(new CDP(ws)));
    ws.addEventListener('error', () => reject(new Error('websocket error')));
  });
}

/**
 * Opens the app and returns helpers.
 * `logs` collects console output and exceptions; `requests` collects every
 * URL the page asked for.
 */
export async function launch({ width = 900, height = 1400, scale = 2 } = {}) {
  const browser = BROWSERS.find((p) => existsSync(p));
  if (!browser) throw new Error('No Chromium browser found.');

  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const profile = mkdtempSync(join(tmpdir(), 'fg-cdp-'));
  const basePort = 9000 + (process.pid % 900);
  let dport = basePort;
  let child = null;
  let wsUrl = null;
  // A previous browser may still hold the port, so walk to the next free one.
  for (let attempt = 0; attempt < 6 && !wsUrl; attempt++) {
    dport = basePort + attempt * 7;
    child = spawn(browser, [
      '--headless=new',
      `--remote-debugging-port=${dport}`,
      `--user-data-dir=${profile}`,
      '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--allow-file-access-from-files',
      `--window-size=${width},${height}`,
      '--force-device-scale-factor=' + scale,
      'about:blank',
    ], { stdio: 'ignore' });
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${dport}/json/version`);
        const j = await r.json();
        if (j.webSocketDebuggerUrl) { wsUrl = j.webSocketDebuggerUrl; break; }
      } catch { /* not up yet */ }
      await sleep(250);
    }
    if (!wsUrl) { child.kill(); child = null; await sleep(400); }
  }
  if (!wsUrl) throw new Error('browser did not start');

  const cdp = await connect(wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: `http://127.0.0.1:${port}/index.html` });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  const logs = [];
  const requests = [];
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false }, sessionId);

  cdp.onEvent = (m) => {
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      logs.push('[error] ' + m.params.entry.text);
    }
  };

  /** Runs an expression in the page and returns its value. */
  const run = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
    }, sessionId);
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  };

  /** Waits until the app has booted. */
  for (let i = 0; i < 120; i++) {
    const r = await run(`typeof Asciify!=="undefined" && typeof setTool==='function' && typeof loadTI==='function' && document.querySelectorAll('#tgrid button').length>0 && !document.getElementById('splash')`);
    if (r) break;
    await sleep(250);
  }

  const shot = async (path) => {
    const s = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, Buffer.from(s.data, 'base64'));
    return path;
  };

  /** Real mouse input, so the page sees genuine pointer events (a synthetic
   *  PointerEvent cannot be captured with setPointerCapture). */
  const mouse = (type, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', {
    type, x, y, button: 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount: 1, pointerType: 'mouse', ...extra,
  }, sessionId);

  /** Drags through a list of [x, y] points in CSS pixels. */
  const drag = async (points) => {
    if (!points.length) return;
    await mouse('mousePressed', points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) await mouse('mouseMoved', x, y);
    const last = points[points.length - 1];
    await mouse('mouseReleased', last[0], last[1]);
  };

  const close = async () => {
    child.kill();
    server.close();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  return { run, logs, requests, shot, mouse, drag, close, sleep, cdp, sessionId };
}
