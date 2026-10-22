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
      readout:document.querySelector('#bgzoomv')?document.querySelector('#bgzoomv').textContent:null,
      zoom:parseFloat(getComputedStyle(c).getPropertyValue('--bz'))};
  })()`);
  check('the background preview is a bounded viewport',
    vp.isBounded && vp.h > 100 && vp.h < 600 && vp.overflow === 'auto',
    `height ${vp.h}px, overflow ${vp.overflow}`);
  check('the zoom buttons sit inside the viewport',
    vp.zoomVisible && vp.zoomIn && vp.out && vp.readout === Math.round(vp.zoom * 100) + '%',
    JSON.stringify(vp));

  const zoom = await page.run(`(()=>{
    const c=document.querySelector('.cvw'),cv=document.querySelector('#tcv');
    const before=cv.getBoundingClientRect().width, z0=parseFloat(getComputedStyle(c).getPropertyValue('--bz'));
    document.querySelector('.bgzoom [data-x=bgzin]').click();
    const after=cv.getBoundingClientRect().width, z1=parseFloat(getComputedStyle(c).getPropertyValue('--bz'));
    return {before:Math.round(before),after:Math.round(after),z0,z1,grows:after>before+5};
  })()`);
  check('zooming in magnifies inside the viewport',
    zoom.grows && zoom.z1 > zoom.z0, `${zoom.before}px -> ${zoom.after}px at ${zoom.z0}x -> ${zoom.z1}x`);

  // 100% must be the picture's own size, and you must be able to zoom out.
  const actual = await page.run(`(()=>{
    const cv=document.querySelector('#tcv');
    bgSetZoom(1);
    const cssW=parseFloat(getComputedStyle(cv).width);
    const natural=cv.width;
    return {cssW:Math.round(cssW),natural};
  })()`);
  check('100% shows the picture at its own pixel size',
    Math.abs(actual.cssW - actual.natural) <= 1,
    `shown ${actual.cssW}px, picture is ${actual.natural}px`);

  const out = await page.run(`(()=>{
    const b=document.querySelector('.bgzoom [data-x=bgzout]');
    for(let i=0;i<4;i++)b.click();
    const c=document.querySelector('.cvw');
    return {z:parseFloat(getComputedStyle(c).getPropertyValue('--bz')),
      w:Math.round(document.querySelector('#tcv').getBoundingClientRect().width)};
  })()`);
  check('zooming out below 100% works', out.z < 1 && out.z >= 0.1,
    `${out.z}x (${out.w}px wide)`);

  const fit = await page.run(`(()=>{
    const c=document.querySelector('.cvw');
    document.querySelector('#tp [data-x="bgzfit"]').click();
    const cv=document.querySelector('#tcv');
    return {w:Math.round(cv.getBoundingClientRect().width),
      frame:Math.round(c.clientWidth-20)};
  })()`);
  check('Fit the picture fits it in the frame', fit.w <= fit.frame + 2,
    `${fit.w}px in a ${fit.frame}px frame`);

  // the picture stays in the middle of the frame, in and out
  const zoomCentre = await page.run(`(()=>{
    const c=document.querySelector('.cvw'),cv=document.querySelector('#tcv');
    const mid=()=>{
      const cr=c.getBoundingClientRect(),vr=cv.getBoundingClientRect();
      return {dx:Math.round((vr.left+vr.width/2)-(cr.left+cr.clientWidth/2)),
              dy:Math.round((vr.top+vr.height/2)-(cr.top+cr.clientHeight/2))};
    };
    const out=[];
    bgSetZoom(2.2); out.push(mid());
    bgSetZoom(0.45); out.push(mid());
    bgSetZoom(1.6); out.push(mid());
    return out;
  })()`);
  const worstCentre = Math.max(...zoomCentre.map((p) => Math.max(Math.abs(p.dx), Math.abs(p.dy))));
  check('the picture stays centred while zooming in and out',
    worstCentre <= 2, `worst offset ${worstCentre}px (${zoomCentre.map((p) => p.dx + ',' + p.dy).join(' / ')})`);

  const sizeInfo = await page.run(`(()=>{
    const i=document.querySelector('#bgzinfo');
    return i?i.textContent:'';
  })()`);
  check('the panel states the picture\'s real size',
    /\d+\s*×\s*\d+\s*px/.test(sizeInfo), sizeInfo);

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

  const icons = await page.run(`(()=>{
    navCompact(true);
    return true;
  })()`);
  await page.sleep(600);
  const centred = await page.run(`(()=>{
    const n=document.querySelector('#nav');
    const out=[];
    for(const b of n.querySelectorAll('button')){
      const i=b.querySelector('.i');
      const br=b.getBoundingClientRect(), ir=i.getBoundingClientRect();
      out.push(Math.round((ir.left+ir.width/2)-(br.left+br.width/2)));
      out.push(Math.round((ir.top+ir.height/2)-(br.top+br.height/2)));
    }
    return out;
  })()`);
  await page.run(`navCompact(false);navMin=0;true`);
  const worst = Math.max(...centred.map(Math.abs));
  check('the compact navigation centres its icons',
    worst <= 1, `worst offset ${worst}px (${centred.join(',')})`);

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

  // the toolbox card asks what to draw
  const card = await page.run(`(()=>{
    go('tools');
    const b=document.querySelector('#tgrid [data-t="astudio"]');
    if(!b)return {ok:false,why:'no card'};
    b.click();
    const open=document.querySelector('#srcp').classList.contains('on');
    const title=document.querySelector('#srcpt').textContent;
    const opts=[...document.querySelectorAll('#srcops [data-srcop]')].map(x=>x.textContent);
    document.querySelector('#srccancel').click();
    return {ok:true,open,title,opts,closed:!document.querySelector('#srcp').classList.contains('on')};
  })()`);
  check('the ASCII Studio card asks what to draw',
    card.ok && card.open && card.closed && card.opts.length >= 3 &&
    /image/i.test(card.opts.join(' ')) && /video/i.test(card.opts.join(' ')) && /text/i.test(card.opts.join(' ')),
    JSON.stringify(card));

  // a picture picked for the studio opens the studio
  const opened = await page.run(`(async()=>{
    go('tools');
    const c=document.createElement('canvas');c.width=300;c.height=200;const x=c.getContext('2d');
    x.fillStyle='#2a6ad4';x.fillRect(0,0,300,200);
    const blob=await (await fetch(c.toDataURL('image/png'))).blob();
    const f=new File([blob],'pic.png',{type:'image/png'});
    const dt=new DataTransfer();dt.items.add(f);
    const inp=document.querySelector('#tf');inp.files=dt.files;
    curTool='astudio';
    inp.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,1500));
    return {tool:curTool,src:AST.src,file:AST.file?AST.file.name:null,
      shown:!document.querySelector('#tw').hidden,mounted:!!ASRT,err:AST.err};
  })()`);
  check('a picture picked for the studio opens the studio',
    opened.tool === 'astudio' && opened.src === 'file' && opened.shown && opened.mounted,
    JSON.stringify(opened));

  /* ── the scanners offer the camera alongside the upload ───────────── */
  const cam = await page.run(`(()=>{
    go('tools');showTW();setTool('ocr');
    document.querySelector('#tsup').click();
    const open=document.querySelector('#srcp').classList.contains('on');
    const opts=[...document.querySelectorAll('#srcops [data-srcop]')].map(x=>x.textContent);
    document.querySelector('#srccancel').click();
    return {open,opts};
  })()`);
  check('the OCR upload also offers the camera',
    cam.open && cam.opts.length === 2 && /image/i.test(cam.opts.join(' ')) && /camera/i.test(cam.opts.join(' ')),
    JSON.stringify(cam));

  /* ── the Studio: undo, reset and a visible change ────────────────── */
  const studio = await page.run(`(async()=>{
    go('tools');showTW();setTool('astudio');
    await new Promise(r=>setTimeout(r,900));
    AST.sec='style';panel();
    await new Promise(r=>setTimeout(r,200));
    const inp=document.querySelector('#tp input[data-sk="cellSize"]');
    if(!inp)return {err:'no cell size slider'};
    const before=AST_RAW.cellSize;
    inp.value=String(before+5);
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(r=>setTimeout(r,250));
    const changed=AST_RAW.cellSize;
    const hasReset=!!document.querySelector('#tp [data-x="astreset"]');
    undo();
    await new Promise(r=>setTimeout(r,300));
    const undone=AST_RAW.cellSize;
    // change again and reset
    inp.value=String(before+9);
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(r=>setTimeout(r,200));
    document.querySelector('#tp [data-x="astreset"]').click();
    await new Promise(r=>setTimeout(r,300));
    const reset=AST_RAW.cellSize;
    return {before,changed,undone,reset,hasReset};
  })()`);
  check('the Studio has a reset button', studio.hasReset === true, JSON.stringify(studio));
  check('undo takes a Studio change back',
    studio.changed === studio.before + 5 && studio.undone === studio.before,
    `${studio.before} -> ${studio.changed} -> ${studio.undone}`);
  check('Reset the Studio restores the defaults',
    studio.reset === 6, `cell size now ${studio.reset}`);

  /* ── the removal animation while the model works ──────────────────── */
  const anim = await page.run(`(()=>{
    go('tools');showTW();T.bgm='q';T.bgi=1;setTool('bg');
    BGST.busy=1;bgRenderModels();
    const c=document.querySelector('.cvw');
    const busy=c.classList.contains('bgbusy');
    const scan=document.querySelector('.bgscan');
    const shown=scan?getComputedStyle(scan).display!=='none':false;
    BGST.busy=0;bgRenderModels();
    return {busy,shown,off:!c.classList.contains('bgbusy')};
  })()`);
  check('the preview animates while the background is removed',
    anim.busy && anim.shown && anim.off, JSON.stringify(anim));

  /* ── sound effects ───────────────────────────────────────────────── */
  const sound = await page.run(`(()=>{
    const sw=document.querySelector('[data-t="sound"]');
    let played=0,tones=0;
    const old=window.AudioContext;
    window.AudioContext=function(){played++;
      return {state:'running',currentTime:0,resume:()=>{},
        createOscillator:()=>{tones++;return {type:'',frequency:{setValueAtTime:()=>{}},connect:()=>{},start:()=>{},stop:()=>{}}},
        createGain:()=>({gain:{setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},connect:()=>{}}),destination:{}};
    };
    ACX=null;
    S.sound=true;
    haptic('success');haptic('fail');haptic('tap');
    window.AudioContext=old;ACX=null;
    return {hasSwitch:!!sw,on:sw?sw.classList.contains('on'):false,played,tones,
      setting:S.sound!==false};
  })()`);
  check('sound effects are a setting and play for success and failure',
    sound.hasSwitch && sound.on && sound.setting && sound.tones >= 5,
    JSON.stringify(sound));

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
