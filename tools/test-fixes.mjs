/**
 * Checks the four fixes: the stills three-dot menu, the background remover
 * viewport, the compact navigation and the ASCII Studio's video picker.
 *
 *   node test-fixes.mjs
 */
import { launch } from './cdp.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const page = await launch();

try {
  /* ── the stills three-dot menu ───────────────────────────────────── */
  await page.run(`(()=>{
    const c=document.createElement('canvas');c.width=400;c.height=400;const x=c.getContext('2d');
    x.fillStyle='#3a7bd5';x.fillRect(0,0,400,400);
    stills.unshift({url:c.toDataURL('image/png'),t:0,w:400,h:400,edit:0,name:'one'});
    stills.unshift({url:c.toDataURL('image/png'),t:0,w:400,h:400,edit:0,name:'two'});
    render();
    return true;
  })()`);
  await page.sleep(400);

  const menu = await page.run(`(()=>{
    go('stills');
    const b=document.querySelector('[data-more="0"]');
    if(!b)return {ok:false,why:'no button'};
    b.click();
    const m=document.querySelector('.tmenu[data-menu="0"]');
    if(!m)return {ok:false,why:'no menu'};
    const mr=m.getBoundingClientRect(),tile=m.closest('.tile').getBoundingClientRect();
    const hit=document.elementFromPoint(mr.left+mr.width/2,mr.top+mr.height/2);
    return {ok:true,hidden:m.hidden,
      visible:mr.top>=0&&mr.bottom<=innerHeight+1,
      onTop:!!(hit&&hit.closest('.tmenu')),
      menuH:Math.round(mr.height),tileH:Math.round(tile.height),
      open:!!m.closest('.tile').classList.contains('open')};
  })()`);
  check('the three-dot menu opens above its neighbours',
    menu.ok && !menu.hidden && menu.onTop && menu.open && menu.visible, JSON.stringify(menu));

  const closed = await page.run(`(()=>{
    document.querySelector('[data-more="0"]').click();
    const m=document.querySelector('.tmenu[data-menu="0"]');
    return {hidden:m.hidden,open:!!m.closest('.tile').classList.contains('open')};
  })()`);
  check('closing the menu clears the raised card', closed.hidden && !closed.open, JSON.stringify(closed));

  /* ── the background remover viewport ─────────────────────────────── */
  await page.run(`(()=>{
    const c=document.createElement('canvas');c.width=900;c.height=600;const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,900,600);g.addColorStop(0,'#e07a2c');g.addColorStop(1,'#1a1024');
    x.fillStyle=g;x.fillRect(0,0,900,600);
    loadTI(c.toDataURL('image/png'),'bg');
    return true;
  })()`);
  await page.sleep(600);
  await page.run(`go('tools');showTW();T.bgm='q';T.bgi=1;T.bg=0;setTool('bg');true`);
  await page.sleep(800);

  const vp = await page.run(`(()=>{
    const c=document.querySelector('.cvw'),z=document.querySelector('.bgzoom');
    const cs=getComputedStyle(c);
    return {isBounded:c.classList.contains('bgz'),h:Math.round(c.clientHeight),
      overflow:cs.overflowY,zoomVisible:!!z&&getComputedStyle(z).display!=='none',
      zoomIn:!!(z&&z.querySelector('[data-x=bgzin]')),out:!!(z&&z.querySelector('[data-x=bgzout]')),
      readout:document.querySelector('#bgzoomv')?document.querySelector('#bgzoomv').textContent:null};
  })()`);
  check('the background preview is a bounded viewport',
    vp.isBounded && vp.h > 100 && vp.h < 600 && vp.overflow === 'auto',
    `height ${vp.h}px, overflow ${vp.overflow}`);
  check('the zoom buttons sit inside the viewport',
    vp.zoomVisible && vp.zoomIn && vp.out && vp.readout === '100%', JSON.stringify(vp));

  const zoom = await page.run(`(()=>{
    const c=document.querySelector('.cvw'),cv=document.querySelector('#tcv');
    const before=cv.getBoundingClientRect().width;
    document.querySelector('.bgzoom [data-x=bgzin]').click();
    const after=cv.getBoundingClientRect().width;
    const z=parseFloat(getComputedStyle(c).getPropertyValue('--bz'));
    return {before:Math.round(before),after:Math.round(after),z,grows:after>before+5};
  })()`);
  check('zooming in magnifies inside the viewport',
    zoom.grows && zoom.z > 1, `${zoom.before}px -> ${zoom.after}px at ${zoom.z}x`);

  const contained = await page.run(`(()=>{
    const c=document.querySelector('.cvw');
    const before=document.body.scrollHeight;
    c.scrollLeft=200;c.scrollTop=200;
    const scrolled=c.scrollLeft>0||c.scrollTop>0;
    return {scrolled,stable:document.body.scrollHeight===before};
  })()`);
  check('the frame scrolls instead of growing the page', contained.scrolled && contained.stable,
    `scrolls=${contained.scrolled}, page height stable=${contained.stable}`);

  /* ── the compact navigation ──────────────────────────────────────── */
  await page.run(`navMin=1;navCompact(true);true`);
  await page.sleep(600); // the nav animates its size
  const nav = await page.run(`(()=>{
    const n=document.querySelector('#nav');
    const btn=n.querySelector('button.on')||n.querySelector('button');
    const b=btn.getBoundingClientRect();
    const p=document.querySelector('.pill').getBoundingClientRect();
    return {compact:n.classList.contains('min'),bw:Math.round(b.width),pw:Math.round(p.width),
      bh:Math.round(b.height),ph:Math.round(p.height),
      aligned:Math.abs(b.left-p.left)<3&&Math.abs(b.top-p.top)<3};
  })()`);
  check('the compact navigation keeps the sliding pill on the active button',
    nav.compact && nav.bw === nav.pw && nav.bh === nav.ph && nav.aligned, JSON.stringify(nav));
  await page.run(`navCompact(false);navMin=0;true`);

  /* ── the ASCII Studio picker takes a video ───────────────────────── */
  const pick = await page.run(`(()=>{
    go('tools');showTW();setTool('astudio');
    // openPick() sets the accept when the picker opens
    openPick();
    return {accept:document.querySelector('#tf').accept};
  })()`);
  check('the studio picker allows video files',
    /video/.test(pick.accept || ''), pick.accept);

  const routed = await page.run(`(()=>{
    const f=new File([new Uint8Array([0,0,0,0])],'clip.mp4',{type:'video/mp4'});
    const dt=new DataTransfer();dt.items.add(f);
    const inp=document.querySelector('#tf');inp.files=dt.files;
    inp.dispatchEvent(new Event('change'));
    return {src:AST.src,name:AST.file?AST.file.name:null,type:AST.file?AST.file.type:null};
  })()`);
  check('a picked video goes to the studio as its source',
    routed.src === 'file' && routed.name === 'clip.mp4' && routed.type === 'video/mp4',
    JSON.stringify(routed));

  const other = await page.run(`(()=>{
    setTool('resize');openPick();
    return {accept:document.querySelector('#tf').accept};
  })()`);
  check('other tools keep the image-only picker', !/video/.test(other.accept || ''), other.accept);

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
