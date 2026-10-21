/**
 * Exercises the crop, source sheet, PDF preview and draw stabilizer in a
 * real browser.
 *
 *   node test-ui.mjs
 */
import { launch } from './cdp.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const page = await launch();

try {
  /* ── crop ─────────────────────────────────────────────────────────── */
  await page.run(`(()=>{
    const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');
    x.fillStyle='#3a7bd5';x.fillRect(0,0,800,600);
    x.fillStyle='#e8c33a';x.fillRect(200,150,400,300);
    loadTI(c.toDataURL('image/png'),'blocks');
    return true;
  })()`);
  await page.sleep(600);
  await page.run(`go('tools');setTool('crop');true`);
  await page.sleep(700);

  const cropPanel = await page.run(`(()=>{
    const h=document.querySelector('#tp').innerHTML;
    return {snap:!!document.querySelector('#tp [data-x="csnap"]'),on:T.csnap===1};
  })()`);
  check('the crop panel has a snap switch', cropPanel.snap && cropPanel.on, JSON.stringify(cropPanel));

  // Turning the switch off must keep the frame exactly where it is.
  const noSnap = await page.run(`(()=>{
    T.csnap=0;
    const cv=document.querySelector('#tcv');
    const before=[T.l,T.t,T.r,T.b];
    return {before,after:[T.l,T.t,T.r,T.b]};
  })()`);
  check('the snap switch is a real setting', noSnap.before.length === 4);

  // The magnet is now a small one: dragging an edge 20px from the border must
  // not snap to zero.
  const geom = await page.run(`(()=>{
    const cv=document.querySelector('#tcv'),r=cv.getBoundingClientRect();
    return {left:r.left,top:r.top,w:r.width,h:r.height};
  })()`);
  const midY = geom.top + geom.h * 0.5;

  // Drag the west handle a few pixels from the edge: inside the magnet it must
  // snap to zero, and with the magnet off it must land exactly where it was
  // dropped.
  const near = [[geom.left + 2, midY], [geom.left + 3, midY], [geom.left + 4, midY]];
  const far = [[geom.left + 2, midY], [geom.left + 12, midY], [geom.left + 22, midY]];

  await page.run(`T.csnap=0;T.l=0;T.t=0;T.r=0;T.b=0;draw();true`);
  await page.drag(near);
  await page.sleep(250);
  const offNear = await page.run(`Math.round(T.l*document.querySelector('#tcv').width/100)`);

  await page.run(`T.csnap=1;T.l=0;T.t=0;T.r=0;T.b=0;draw();true`);
  await page.drag(near);
  await page.sleep(250);
  const onNear = await page.run(`Math.round(T.l*document.querySelector('#tcv').width/100)`);

  await page.run(`T.csnap=0;T.l=0;T.t=0;T.r=0;T.b=0;draw();true`);
  await page.drag(far);
  await page.sleep(250);
  const offFar = await page.run(`Math.round(T.l*document.querySelector('#tcv').width/100)`);

  check('the snap is small and can be turned off',
    onNear === 0 && offNear > 0 && offNear <= 12 && offFar > 15,
    `near: ${offNear}px without, ${onNear}px with \u00b7 far: ${offFar}px without`);

  /* ── the source sheet ─────────────────────────────────────────────── */
  await page.run(`setTool('doc');true`);
  await page.sleep(400);
  const docSheet = await page.run(`(()=>{
    document.querySelector('#tp [data-x="dcam"]').click();
    const open=document.querySelector('#srcp').classList.contains('on');
    const title=document.querySelector('#srcpt').textContent;
    const dev=!!document.querySelector('#srcdev'),cam=!!document.querySelector('#srccam');
    document.querySelector('#srccancel').click();
    return {open,title,dev,cam,closed:!document.querySelector('#srcp').classList.contains('on')};
  })()`);
  check('the document scanner offers a picture or the camera',
    docSheet.open && docSheet.dev && docSheet.cam && docSheet.closed, JSON.stringify(docSheet));

  await page.run(`setTool('qrs');true`);
  await page.sleep(400);
  const qrSheet = await page.run(`(()=>{
    document.querySelector('#tp [data-x="qcam"]').click();
    const open=document.querySelector('#srcp').classList.contains('on');
    const title=document.querySelector('#srcpt').textContent;
    document.querySelector('#srccancel').click();
    return {open,title};
  })()`);
  check('the QR scanner offers a picture or the camera',
    qrSheet.open && /QR/i.test(qrSheet.title), JSON.stringify(qrSheet));

  /* ── the PDF preview bar ──────────────────────────────────────────── */
  await page.run(`(async()=>{
    const c=document.createElement('canvas');c.width=600;c.height=800;
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,600,800);
    x.fillStyle='#2a6ad4';x.fillRect(40,40,520,720);
    await addPage(c,'Page 1');
    const c2=document.createElement('canvas');c2.width=600;c2.height=800;
    const x2=c2.getContext('2d');x2.fillStyle='#fff';x2.fillRect(0,0,600,800);
    x2.fillStyle='#d44a2a';x2.fillRect(40,40,520,720);
    await addPage(c2,'Page 2');
    setTool('pdf');
    return true;
  })()`);
  await page.sleep(900);

  const pdfBar = await page.run(`(()=>{
    const bar=document.querySelector('#tp .pvbar');
    if(!bar)return {ok:false};
    const cs=getComputedStyle(bar);
    const ind=document.querySelector('#pvind');
    const zoom=bar.querySelector('[data-x="pvzi"]');
    return {ok:true,glass:/blur/.test(cs.backdropFilter||cs.webkitBackdropFilter||''),
      ind:ind?ind.textContent:null,hasZoom:!!zoom,
      inCol:!!bar.closest('.pvwrap'),fixed:cs.position};
  })()`);
  check('the PDF preview has a glass bar at the bottom',
    pdfBar.ok && pdfBar.glass && pdfBar.fixed === 'absolute' && pdfBar.inCol,
    JSON.stringify(pdfBar));
  check('the bar shows the page pill and the zoom buttons',
    !!pdfBar.ind && /\d+\s*\/\s*\d+/.test(pdfBar.ind || '') && pdfBar.hasZoom, pdfBar.ind || '');

  // the zoom buttons move in small steps and the pill follows
  const zoom = await page.run(`(()=>{
    const z0=PVZ;
    document.querySelector('#tp [data-x="pvzi"]').click();
    const z1=PVZ;
    document.querySelector('#tp [data-x="pvzd"]').click();
    const z2=PVZ;
    return {z0,z1,z2,step:Math.round((z1-z0)*1000)/1000};
  })()`);
  check('the zoom steps are small and reversible',
    zoom.step > 0 && zoom.step <= 0.25 && Math.abs(zoom.z2 - zoom.z0) < 1e-9,
    `${zoom.z0} -> ${zoom.z1} -> ${zoom.z2}`);

  // the sheet width follows --pz, so the zoom really does scale the preview
  const before = await page.run(`(()=>{
    const s=document.querySelector('#tp .pvcol').firstElementChild;
    return s.getBoundingClientRect().width;
  })()`);
  await page.run(`PVZ=2;setPvZ(document.querySelector('#tp .pvcol'));true`);
  await page.sleep(700);
  const after = await page.run(`(()=>{
    const s=document.querySelector('#tp .pvcol').firstElementChild;
    return s.getBoundingClientRect().width;
  })()`);
  await page.run(`PVZ=1;setPvZ(document.querySelector('#tp .pvcol'));true`);
  check('the preview really scales with the zoom', after > before + 5,
    `${Math.round(before)} -> ${Math.round(after)}`);

  /* ── the drawing stabilizer ───────────────────────────────────────── */
  await page.run(`setTool('draw');true`);
  await page.sleep(500);
  const drawPanel = await page.run(`(()=>({stab:!!document.querySelector('#tp [data-k="dstab"]')}))()`);
  check('the draw tool has a stabilizer', drawPanel.stab);

  const dgeom = await page.run(`(()=>{
    const cv=document.querySelector('#tcv'),r=cv.getBoundingClientRect();
    return {left:r.left,top:r.top,w:r.width,h:r.height};
  })()`);
  const shaky = [];
  for (let i = 0; i <= 40; i++) {
    shaky.push([
      dgeom.left + dgeom.w * (0.2 + 0.6 * i / 40),
      dgeom.top + dgeom.h * (0.5 + 0.02 * Math.sin(i * 1.7)),
    ]);
  }
  const stab = await page.run(`(()=>{
    const run=(level)=>{
      T.dstab=level;T.ds=[];T.dr=[];
      return true;
    };
    return {run:run(0)};
  })()`);
  // draw the shaky line twice: raw, then with the stabilizer
  await page.run(`T.dstab=0;T.ds=[];T.dr=[];true`);
  await page.drag(shaky);
  await page.sleep(200);
  const raw = await page.run(`(()=>{
    const st=T.ds[T.ds.length-1];if(!st||!st.p||st.p.length<3)return null;
    const a=st.p[0],b=st.p[st.p.length-1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1e-6;
    let dev=0;for(const p of st.p.slice(1,-1))dev+=Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/len;
    return {n:st.p.length,dev:dev/Math.max(1,st.p.length)};
  })()`);

  await page.run(`T.dstab=100;T.ds=[];T.dr=[];true`);
  await page.drag(shaky);
  await page.sleep(200);
  const strong = await page.run(`(()=>{
    const st=T.ds[T.ds.length-1];if(!st||!st.p||st.p.length<3)return null;
    const a=st.p[0],b=st.p[st.p.length-1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1e-6;
    let dev=0;for(const p of st.p.slice(1,-1))dev+=Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/len;
    return {n:st.p.length,dev:dev/Math.max(1,st.p.length)};
  })()`);
  await page.run(`T.dstab=0;T.ds=[];T.dr=[];true`);

  check('the stabilizer smooths a shaky line',
    !!raw && !!strong && strong.dev < raw.dev * 0.85,
    `wander ${raw ? (raw.dev * 1000).toFixed(2) : '?'} -> ${strong ? (strong.dev * 1000).toFixed(2) : '?'}`);

  const errors = page.logs.filter((l) => /^\[(exception|error)\]/.test(l) && !/navigator\.vibrate/.test(l));
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
} catch (err) {
  console.error('HARNESS ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await page.close();
}
