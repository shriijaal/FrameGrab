
/* --- special (non-engine) studio values -------------------------------- */
const AST_SIZES={hd:[1920,1080],sq:[1080,1080],post:[2400,3200],big:[3000,3000]};
let ASTTXT=0;
function astSetSpecial(k,v){
 if(k==='cells'){AST.cells=+v;astDestroy();astMount();return}
 if(k==='txt'){AST.text=String(v);clearTimeout(ASTTXT);ASTTXT=setTimeout(()=>{astDestroy();astMount()},450);return}
 if(k==='curvech'){AST.curveCh=String(v);panel();return}
 if(k==='maskkind'){const sh=AST_RAW.mask&&AST_RAW.mask.shapes&&AST_RAW.mask.shapes[0];if(sh){sh.kind=String(v);astApply();panel()}return}
 if(k==='maskon'){astMaskToggle();panel();return}
 if(k==='lighton'){astLightToggle();panel();return}
 if(k==='exfmt'){AST.exFormat=String(v);return}
 if(k==='expres'){AST.exPres=String(v);if(AST_SIZES[v]){AST.exW=AST_SIZES[v][0];AST.exH=AST_SIZES[v][1]}else{const e=astSourceEl();if(e){AST.exW=e.naturalWidth||e.videoWidth||e.width||1920;AST.exH=e.naturalHeight||e.videoHeight||e.height||1080}}return}
 if(k==='exw'){AST.exW=+v;AST.exPres='custom';return}
 if(k==='exh'){AST.exH=+v;AST.exPres='custom';return}
 if(k==='exfps'){AST.exFps=+v;return}
 if(k==='exdur'){AST.exDur=+v;return}
 if(k==='exq'){AST.exQ=+v;return}
 if(k==='txtcols'){AST.textCols=+v;return}
 if(k==='projw'){AST.projW=Math.max(64,Math.min(4000,+v));astApply();return}
 if(k==='projh'){AST.projH=Math.max(64,Math.min(4000,+v));astApply();return}
 if(k==='projbg'){AST.projBg=String(v);astApply();return}
}
function astSet(p,v){
 if(p.indexOf('__')===0)return astSetSpecial(p.slice(2),v);
 const ks=p.split('.'),last=ks.pop();let o=AST_RAW;
 for(const k of ks){if(o[k]==null||typeof o[k]!=='object')o[k]={};o=o[k]}
 o[last]=v;
 AST.look='';
 astApply();
}
function astToggle(p){
 if(p.indexOf('__')===0)return astSetSpecial(p.slice(2),null);
 astSet(p,!astGet(AST_RAW,p));
}
function astAction(a,b,v){
 switch(a){
  case 'astsec':AST.sec=v;panel();break;
  case 'astcat':AST.lookCat=v;panel();break;
  case 'astset':astSet(b.dataset.sk,v);panel();break;
  case 'astsw':astToggle(b.dataset.sk);panel();break;
  case 'astlook':astApplyLook(v);break;
  case 'astsrc':AST.src=v;astDestroy();astMount();panel();break;
  case 'astfont':AST.font=String(v);astDestroy();astMount();panel();break;
  case 'astwarp':astWarpToggle(v);panel();break;
  case 'astlayadd':astAddImageLayer();break;
  case 'astlaytext':astAddTextLayer();break;
  case 'astlayrm':astRemoveLayer(+v);break;
  case 'astlayup':astMoveLayer(+v,-1);break;
  case 'astlaydn':astMoveLayer(+v,1);break;
  case 'astlayvis':astLayerSet(+v,'visible');panel();break;
  case 'astlayblend':astLayerSet(AST.layerSel,'blend',v);panel();break;
  case 'astcurve':{const c=AST_CURVES.find(x=>x[0]===v);if(c)astCurveSet(AST.curveCh||'rgb',c[2]);panel();break}
  case 'astpick':{const f=$('#astfile');if(f)f.click();break}
  case 'astexport':astExport();break;
  case 'astcopy':{const t=astText(false);if(!t)return toast('No text to copy');copyText(t);break}
  case 'asttxt':{const t=astText(false);if(!t)return toast('No text to save');deliver([{name:TN+'_ascii.txt',blob:new Blob([t],{type:'text/plain'})}]);break}
  case 'astansi':{const t=astText(true);if(!t)return toast('No text to save');deliver([{name:TN+'_ascii_ansi.txt',blob:new Blob([t],{type:'text/plain'})}]);break}
 }
}
/* --- events ---------------------------------------------------------- */
function astBind(){
 $('#tp').addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.skt){astSet(t.dataset.skt,t.value);return}
  if(t.dataset.lk){const i=+t.dataset.lv;astLayerSet(i,t.dataset.lk,+t.value);
   const lbl=document.getElementById('av-l'+i+'-'+t.dataset.lk.replace(/\./g,'-'));
   if(lbl)lbl.textContent=t.value+(t.dataset.u||'');
   t.style.setProperty('--p',((t.value-t.min)/(t.max-t.min)*100)+'%');
   return}
  const p=t.dataset.sk;if(!p)return;
  const num=t.type==='range'||t.type==='number';
  const v=num?+t.value:t.value;
  if(t.type==='range'){
   const lbl=document.getElementById('av-'+p.replace(/\./g,'-'));if(lbl)lbl.textContent=v+(t.dataset.u||'');
   t.style.setProperty('--p',((v-t.min)/(t.max-t.min)*100)+'%');
  }
  astSet(p,v);
 });
 $('#tp').addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.skt){astSet(t.dataset.skt,t.value);return}
  if(t.dataset.lk){astLayerSet(+t.dataset.lv,t.dataset.lk,t.type==='range'?+t.value:t.value);return}
  const p=t.dataset.sk;if(!p||t.type==='range'||t.type==='color')return;
  astSet(p,t.type==='number'?+t.value:t.value);
 });
 document.addEventListener('change',e=>{
  if(e.target.id==='astfile'){const f=e.target.files[0];e.target.value='';if(!f)return;AST.file=f;AST.src='file';astDestroy();astMount();panel()}
 });
 let rt=0;
 addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(curTool==='astudio')astApply()},200)});
}
if(typeof astBind==='function')astBind();
