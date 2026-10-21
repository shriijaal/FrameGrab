/**
 * Drives the app in headless Edge over CDP and exercises the ASCII Studio.
 *
 *   node test-studio.mjs
 *
 * Serves the repo over HTTP (so blob workers behave like a real deployment),
 * opens index.html, then runs the checks below in the page and reports.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { extname, join, resolve, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\EdgeCore\\155.0.4283.62\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\Dell\\AppData\\Local\\imput\\Helium\\Application\\chrome.exe',
].find((p) => existsSync(p));

if (!EDGE) {
  console.error('No Chromium browser found.');
  process.exit(1);
}

// ── static server ──────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ── browser ────────────────────────────────────────────────────────────────
const profile = mkdtempSync(join(tmpdir(), 'fg-edge-'));
const port = 9333 + (process.pid % 500);
const child = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--allow-file-access-from-files',
  '--window-size=900,1200',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function debuggerUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('browser did not start');
}

// ── minimal CDP client ─────────────────────────────────────────────────────
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
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
      }, 120000);
    });
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(new CDP(ws)));
    ws.addEventListener('error', () => reject(new Error('ws error')));
  });
}

// ── run ────────────────────────────────────────────────────────────────────
let code = 1;
try {
  const cdp = await connect(await debuggerUrl());
  const { targetId } = await cdp.send('Target.createTarget', { url: `http://127.0.0.1:${PORT}/index.html` });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  const logs = [];
  const requests = [];
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  cdp.ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Network.requestWillBeSent') {
      requests.push(m.params.request.url);
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      logs.push('[error] ' + m.params.entry.text);
    }
  });

  // Wait for the app to be ready.
  let ready = false;
  for (let i = 0; i < 80; i++) {
    const r = await cdp.send('Runtime.evaluate', {
      expression: `typeof Asciify!=="undefined" && typeof setTool==='function' && typeof loadTI==='function' && document.querySelectorAll('#tgrid button').length>0`,
      returnByValue: true,
    }, sessionId).catch(() => ({ result: { value: false } }));
    if (r.result?.value) { ready = true; break; }
    await sleep(250);
  }
  if (!ready) {
    console.error('app did not initialise');
    console.error('logs:', logs.slice(0, 10).join('\n'));
    throw new Error('app did not initialise');
  }

  const run = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
    }, sessionId);
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  };

  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  // 1. engine present
  const mods = await run('Object.keys(Asciify).sort().join(",")');
  check('engine exposes all five modules', mods === 'core,field,hover,kit,studio', mods);

  // 2. a source image
  await run(`(()=>{
    const c=document.createElement('canvas');c.width=640;c.height=400;const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,640,400);g.addColorStop(0,'#f0a020');g.addColorStop(.5,'#2080f0');g.addColorStop(1,'#102030');
    x.fillStyle=g;x.fillRect(0,0,640,400);
    x.fillStyle='#fff';x.beginPath();x.arc(320,200,120,0,7);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(280,170,22,0,7);x.fill();x.beginPath();x.arc(360,170,22,0,7);x.fill();
    loadTI(c.toDataURL('image/png'),'test');
    return true;
  })()`);
  await sleep(500);

  // 3. open the studio
  await run(`setTool('astudio');true`);
  await sleep(2200);

  const mounted = await run('!!ASRT');
  check('studio mounts on the tool canvas', mounted === true);

  const painted = await run(`(()=>{
    const cv=document.querySelector('#tcv');
    if(!cv||!cv.width)return {w:0,h:0,ink:0,colours:0};
    const x=cv.getContext('2d');const d=x.getImageData(0,0,cv.width,cv.height).data;
    const seen=new Map();let ink=0;
    for(let i=0;i<d.length;i+=4){
      const k=(d[i]<<16)|(d[i+1]<<8)|d[i+2];
      seen.set(k,(seen.get(k)||0)+1);
    }
    // The backdrop is the most common colour; the characters are the rest.
    const sorted=[...seen.entries()].sort((a,b)=>b[1]-a[1]);
    const bg=sorted[0]?sorted[0][0]:0;
    for(const [k,n] of sorted){if(k!==bg)ink+=n}
    return {w:cv.width,h:cv.height,ink:ink,colours:sorted.length};
  })()`);
  check('studio draws characters onto the canvas',
    painted.ink > 2000 && painted.colours > 3,
    `${painted.w}x${painted.h}, ${painted.ink} character px, ${painted.colours} colours`);

  // 4. panel sections
  const sections = await run(`(()=>{
    const out=[];
    for(const s of ['style','color','dither','print','shape','motion','looks','layers','export']){
      AST.sec=s;const h=astPanel();
      out.push([s,h.length,h.includes('data-sk')||h.includes('data-x')||h.includes('data-lk')]);
    }
    AST.sec='style';
    return out;
  })()`);
  const allSections = sections.every(([, len, has]) => len > 400 && has);
  check('every panel section renders controls', allSections, sections.map(([n, l]) => `${n}:${l}`).join(' '));

  // 5. a look applies
  const look = await run(`(()=>{
    const before=AST_RAW.style;
    astApplyLook('print');
    const a={style:AST_RAW.style,algo:AST_RAW.dither.algorithm,ink:AST_RAW.ink,look:AST.look};
    astApplyLook('album');
    const b={style:AST_RAW.style,aspect:AST_RAW.aspectRatio,bloom:AST_RAW.effects.characterBloom};
    astApplyLook('riso');
    const c={style:AST_RAW.style,ink:AST_RAW.ink};
    return {before,a,b,c};
  })()`);
  check('an engine look rewrites the style settings',
    look.a.style === 'dither' && look.a.algo === 'floyd-steinberg',
    `print -> ${look.a.style}/${look.a.algo}`);
  check('a documented look rewrites the style settings',
    look.b.style === 'dots' && look.b.aspect === '1:1' && look.b.bloom > 0.3,
    `album -> ${look.b.style}, ${look.b.aspect}, bloom ${look.b.bloom}`);
  check('a look with an ink override applies',
    look.c.ink === '#1f3b73', `riso -> ink ${look.c.ink}`);

  // 6. changing a setting reaches the renderer
  const changed = await run(`(()=>{
    astSet('style','braille');astSet('cellSize',9);astSet('color.contrast',1.6);
    return {live:ASRT.settings.style,liveCell:ASRT.settings.cellSize};
  })()`);
  check('settings reach the live renderer', changed.live === 'braille' && changed.liveCell === 9,
    `live style ${changed.live}, cell ${changed.liveCell}`);

  // 7. all render styles apply
  const styles = await run(`(async()=>{
    const bad=[];
    for(const s of Asciify.studio.STUDIO_STYLES){
      try{astSet('style',s);await new Promise(r=>setTimeout(r,60));if(ASRT.settings.style!==s)bad.push(s)}
      catch(e){bad.push(s+':'+e.message)}
    }
    return bad;
  })()`);
  check('all render styles apply', styles.length === 0, styles.join(', ') || `${await run('Asciify.studio.STUDIO_STYLES.length')} styles`);

  // 8. text export
  const txt = await run(`(()=>{const t=astText(false);return {n:t.length,head:t.split('\\n')[0].slice(0,40)}})()`);
  check('plain-text export produces characters', txt.n > 200, `${txt.n} chars, first row "${txt.head}"`);

  // 9. PNG export
  const png = await run(`(async()=>{
    try{
      const blob=await Asciify.studio.exportStudio({frame:()=>document.querySelector('#tcv')},astSettings(),{format:'png',width:400,height:260});
      return {ok:true,size:blob.size,type:blob.type};
    }catch(e){return {ok:false,err:e.message}}
  })()`);
  check('PNG export works', png.ok && png.size > 1000, png.ok ? `${png.size} bytes ${png.type}` : png.err);

  // 10. GIF export
  const gif = await run(`(async()=>{
    try{
      const blob=await Asciify.studio.exportStudio({frame:()=>document.querySelector('#tcv')},astSettings(),{format:'gif',width:320,height:200,duration:1,fps:8});
      return {ok:true,size:blob.size,type:blob.type};
    }catch(e){return {ok:false,err:e.message}}
  })()`);
  check('GIF export works', gif.ok && gif.size > 500, gif.ok ? `${gif.size} bytes ${gif.type}` : gif.err);

  // 10b. video export
  for (const fmt of ['mp4', 'webm']) {
    const v = await run(`(async()=>{
      try{
        const blob=await Asciify.studio.exportStudio({frame:()=>document.querySelector('#tcv')},astSettings(),
          {format:'${fmt}',width:320,height:200,duration:1,fps:10});
        return {ok:true,size:blob.size,type:blob.type};
      }catch(e){return {ok:false,err:e.message}}
    })()`);
    check(`${fmt.toUpperCase()} export works`, v.ok && v.size > 1000,
      v.ok ? `${v.size} bytes ${v.type}` : v.err);
  }

  // 11. the toolbox lists the studio
  const listed = await run(`TL.filter(x=>x[0]==='astudio').map(x=>x[1]).join()`);
  check('toolbox lists the studio', !!listed, listed);

  // 12. warps
  const warps = await run(`(()=>{
    astWarpToggle('twirl');astWarpToggle('ripple');
    const n=(AST_RAW.warps||[]).length;
    astWarpSet(0,'amount',-.5);
    const a=AST_RAW.warps[0].amount;
    astWarpToggle('twirl');
    return {n,a,after:(AST_RAW.warps||[]).length,live:ASRT.settings.warps.length};
  })()`);
  check('source warps stack and reach the renderer',
    warps.n === 2 && warps.a === -0.5 && warps.after === 1 && warps.live === 1,
    `${warps.n} warps, amount ${warps.a}, ${warps.after} left, renderer sees ${warps.live}`);

  // 13. text banner source
  const banner = await run(`(async()=>{
    AST.src='text';AST.text='FRAMEGRAB';AST.font='Banner';
    await astMount();
    await new Promise(r=>setTimeout(r,600));
    return {mounted:!!ASRT,ascii:(AST.ascii||'').length,head:(AST.ascii||'').split('\\n')[0].slice(0,30)};
  })()`);
  check('a figlet banner becomes the source', banner.mounted && banner.ascii > 100,
    `${banner.ascii} chars, first row "${banner.head}"`);

  // 14. layered project
  const project = await run(`(async()=>{
    AST.src='image';
    await astMount();
    await new Promise(r=>setTimeout(r,400));
    AST.src='project';
    await astAddImageLayer();
    await new Promise(r=>setTimeout(r,300));
    astAddTextLayer();
    await new Promise(r=>setTimeout(r,900));
    const l=AST.layers.length;
    AST.layers[0].placement.width=.6;AST.layers[0].placement.height=.6;
    AST.layers[1].placement.y=.2;
    astApply();
    await new Promise(r=>setTimeout(r,400));
    return {layers:l,mounted:!!ASRT,types:AST.layers.map(x=>x.kind).join(',')};
  })()`);
  check('a layered project mounts', project.layers === 2 && project.mounted,
    `${project.layers} layers (${project.types})`);

  // 15. project export
  const pex = await run(`(async()=>{
    try{
      const blob=await Asciify.studio.exportStudioProject(astProjectInput(),astProjectSources(),{format:'png',width:600,height:400});
      return {ok:true,size:blob.size};
    }catch(e){return {ok:false,err:e.message}}
  })()`);
  check('a layered project exports', pex.ok && pex.size > 1000, pex.ok ? `${pex.size} bytes` : pex.err);

  // 16. back to the plain studio, then tear down
  await run(`(async()=>{AST.src='image';await astMount();setTool('resize');return true})()`);
  await sleep(600);
  const torn = await run('!ASRT');
  check('leaving the studio tears the renderer down', torn === true);

  const errors = logs.filter((l) => /^\[(exception|error)\]/.test(l));
  check('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));

  // 17. the offline promise: nothing leaves the device
  // The one documented exception is the Outfit webfont, fetched only when online.
  const external = requests.filter((u) =>
    !/^(http:\/\/127\.0\.0\.1|data:|blob:|about:)/.test(u) &&
    !/^https:\/\/fonts\.(gstatic|googleapis)\.com\//.test(u));
  check('the app makes no external requests', external.length === 0,
    external.slice(0, 3).join(' | ') ||
    `${requests.length} requests, all local apart from the Outfit webfont`);

  code = results.every((r) => r.ok) ? 0 : 1;
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
} catch (err) {
  console.error('HARNESS ERROR:', err.message);
  code = 1;
} finally {
  child.kill();
  server.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.exit(code);
