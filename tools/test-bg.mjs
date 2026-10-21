/**
 * Exercises the background remover in a real browser.
 *
 *   node test-bg.mjs
 *
 * Covers the magic eraser (picking regions that add up instead of replacing
 * each other), the magic restore, and the AI mode without a model.
 */
import { launch } from './cdp.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const page = await launch();

try {
  // A picture with four flat blocks, so a wand can pick one of them.
  await page.run(`(()=>{
    const c=document.createElement('canvas');c.width=400;c.height=400;const x=c.getContext('2d');
    x.fillStyle='#e04030';x.fillRect(0,0,200,200);
    x.fillStyle='#30a0e0';x.fillRect(200,0,200,200);
    x.fillStyle='#40c060';x.fillRect(0,200,200,200);
    x.fillStyle='#e0e040';x.fillRect(200,200,200,200);
    loadTI(c.toDataURL('image/png'),'blocks');
    return true;
  })()`);
  await page.sleep(600);

  // Open the tool in Quick mode (no model needed), with the background switch
  // off: the magic eraser has to work on its own. setTool turns the switch on
  // the first time you enter, so mark it as already seen first.
  await page.run(`go('tools');T.bgi=1;T.bgm='q';T.bg=0;T.bk='magic';setTool('bg');true`);
  await page.sleep(700);
  const bgOff = await page.run('T.bg');
  check('the background switch can be left off', bgOff === 0, `T.bg=${bgOff}`);

  // The panel offers the magic eraser.
  const panel = await page.run(`(()=>{
    const h=document.querySelector('#tp').innerHTML;
    return {magic:h.includes('Magic eraser'),restore:h.includes('Magic restore'),
            tol:h.includes('data-k="btol"'),grow:h.includes('data-k="bgrow"'),
            count:h.includes('data-x="bksel"')};
  })()`);
  check('the panel offers the magic eraser and magic restore',
    panel.magic && panel.restore && panel.tol && panel.grow && panel.count,
    JSON.stringify(panel));

  // Picking a region: simulate a pointer press on the canvas.
  const pick = async (fx, fy) => page.run(`(()=>{
    const cv=document.querySelector('#tcv'),r=cv.getBoundingClientRect();
    const x=r.left+${fx}*r.width,y=r.top+${fy}*r.height;
    const opt={bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:1};
    cv.dispatchEvent(new PointerEvent('pointerdown',opt));
    cv.dispatchEvent(new PointerEvent('pointerup',opt));
    return (T.bsel||[]).length;
  })()`);

  const n1 = await pick(0.25, 0.25);
  await page.sleep(500);
  check('a tap picks a region', n1 === 1, `${n1} region picked`);

  // The picked block is gone, the others are not.
  const afterOne = await page.run(`(()=>{
    const c=document.createElement('canvas');pipe(c,true);
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const at=(fx,fy)=>{const i=((Math.round(fy*c.height)*c.width)+Math.round(fx*c.width))*4;return [d[i],d[i+1],d[i+2],d[i+3]]};
    return {a:at(.25,.25),b:at(.75,.25),c:at(.25,.75),d:at(.75,.75)};
  })()`);
  check('the picked block is removed',
    afterOne.a[3] === 0 && afterOne.b[3] > 200 && afterOne.c[3] > 200 && afterOne.d[3] > 200,
    `A alpha ${afterOne.a[3]}, others ${afterOne.b[3]}/${afterOne.c[3]}/${afterOne.d[3]}`);

  // Pick a second region: the first must stay removed.
  const n2 = await pick(0.75, 0.75);
  await page.sleep(600);
  const afterTwo = await page.run(`(()=>{
    const c=document.createElement('canvas');pipe(c,true);
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const at=(fx,fy)=>{const i=((Math.round(fy*c.height)*c.width)+Math.round(fx*c.width))*4;return d[i+3]};
    return {a:at(.25,.25),b:at(.75,.25),c:at(.25,.75),d:at(.75,.75)};
  })()`);
  check('a second pick adds to the first instead of replacing it',
    n2 === 2 && afterTwo.a === 0 && afterTwo.d === 0 && afterTwo.b > 200 && afterTwo.c > 200,
    `${n2} regions; alphas A ${afterTwo.a} B ${afterTwo.b} C ${afterTwo.c} D ${afterTwo.d}`);

  // Undo one pick: the second goes, the first stays.
  await page.run(`document.querySelector('#tp [data-x="bkundo"]').click();true`);
  await page.sleep(500);
  const afterUndo = await page.run(`(()=>{
    const c=document.createElement('canvas');pipe(c,true);
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const at=(fx,fy)=>{const i=((Math.round(fy*c.height)*c.width)+Math.round(fx*c.width))*4;return d[i+3]};
    return {n:(T.bsel||[]).length,a:at(.25,.25),d:at(.75,.75)};
  })()`);
  check('undoing a pick takes back only that pick',
    afterUndo.n === 1 && afterUndo.a === 0 && afterUndo.d > 200,
    `${afterUndo.n} region left, A ${afterUndo.a}, D ${afterUndo.d}`);

  // Clear the picks.
  await page.run(`document.querySelector('#tp [data-x="bksel"]').click();true`);
  await page.sleep(500);
  const cleared = await page.run(`(()=>{
    const c=document.createElement('canvas');pipe(c,true);
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const i=((Math.round(.25*c.height)*c.width)+Math.round(.25*c.width))*4;
    return {n:(T.bsel||[]).length,a:d[i+3]};
  })()`);
  check('clearing the picks brings the picture back',
    cleared.n === 0 && cleared.a > 200, `${cleared.n} regions, A alpha ${cleared.a}`);

  // Magic restore: pick a region and put it back.
  await page.run(`T.bk='mrst';panel();true`);
  await page.sleep(300);
  await pick(0.25, 0.25);
  await page.sleep(500);
  const restored = await page.run(`(()=>{
    const c=document.createElement('canvas');pipe(c,true);
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const i=((Math.round(.25*c.height)*c.width)+Math.round(.25*c.width))*4;
    return d[i+3];
  })()`);
  check('magic restore keeps the picked region', restored > 200, `alpha ${restored}`);

  // AI mode with no model must not silently fall back to the colour method.
  await page.run(`T.bk='magic';T.bsel=[];T.bgm='ai';BGMASK={key:'',w:0,h:0,al:null};panel();true`);
  await page.sleep(400);
  const aiState = await page.run(`(()=>{
    const c=document.createElement('canvas');pipe(c,true);
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const i=((Math.round(.25*c.height)*c.width)+Math.round(.25*c.width))*4;
    const s=document.querySelector('#bgstatus');
    return {alpha:d[i+3],status:s?s.textContent.slice(0,90):null,
            hasDetect:!!document.querySelector('#tp [data-x="bgdetect"]')};
  })()`);
  check('AI mode without a model leaves the picture alone',
    aiState.alpha > 200, `alpha ${aiState.alpha}`);
  check('the AI panel explains the state and offers Detect subject',
    !!aiState.status && aiState.hasDetect && /model/i.test(aiState.status), aiState.status || '');

  // The status must change once a mask exists.
  const statusLive = await page.run(`(()=>{
    BGMASK={key:'x',w:10,h:10,al:new Float32Array(100).fill(1)};
    const s=document.querySelector('#bgstatus');bgRenderModels();
    return s?s.textContent.slice(0,90):null;
  })()`);
  check('the status says when the subject has been found',
    /detected/i.test(statusLive || ''), statusLive || '');

  const errors = page.logs.filter((l) =>
    /^\[(exception|error)\]/.test(l) && !/navigator\.vibrate/.test(l));
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
} catch (err) {
  console.error('HARNESS ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await page.close();
}
