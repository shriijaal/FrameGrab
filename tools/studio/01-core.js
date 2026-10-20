/* ---- ASCII STUDIO (asciify-engine) ---- */
const AE=window.Asciify||null;
const AST={sec:'style',src:'image',file:null,look:'',lookCat:'Projects',busy:0,err:'',textCols:120,cells:32768,
 text:'FRAMEGRAB',font:'Standard',ascii:'',curveCh:'rgb',
 layers:[],layerSel:0,projW:1600,projH:1000,projBg:'#0b0b0a',
 exFormat:'png',exW:1920,exH:1080,exFps:24,exDur:3,exQ:.92,exPres:'hd'};
const AST_STYLES=AE?AE.studio.STUDIO_STYLES:[];
const AST_PRINT=AE?AE.studio.STUDIO_PRINT_STYLES:[];
const AST_DITH=AE?AE.studio.DITHER_ALGORITHMS:[];
const AST_PAL=AE?AE.studio.STUDIO_PALETTES:{};
const AST_HOV=AE?AE.studio.STUDIO_HOVERS:[];
const AST_MOT=AE?AE.studio.STUDIO_MOTIONS:[];
const AST_WARP=AE?AE.studio.STUDIO_WARPS:[];
const AST_CHARS=AE?AE.core.CHARACTER_SETS:{};
const AST_FONTS=AE?AE.studio.STUDIO_TEXT_FONTS:[];
const AST_PRINT_IDS=AST_PRINT.map(p=>p.value);
let ASRT=null,ASMEDIA=null,ASSIG=0;

/* the engine's own settings shape, kept whole so every control maps 1:1 */
const AST_RAW=AE?AE.studio.normalizeStudioSettings({}):null;

const astGet=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
function astSet(p,v){
 const ks=p.split('.'),last=ks.pop();let o=AST_RAW;
 for(const k of ks){if(o[k]==null||typeof o[k]!=='object')o[k]={};o=o[k]}
 o[last]=v;
 astApply();
}
const astEsc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const astLabel=id=>String(id).replace(/^./,c=>c.toUpperCase());
const astNum=(v,d)=>typeof v==='number'&&isFinite(v)?v:d;

/* --- controls ------------------------------------------------------- */
const asl=(p,l,mn,mx,u,st)=>{const v=astGet(AST_RAW,p);return'<div class="lbl">'+l+'<span id="av-'+p.replace(/\./g,'-')+'">'+v+(u||'')+'</span></div><input type="range" data-sk="'+p+'" data-u="'+astEsc(u||'')+'" min="'+mn+'" max="'+mx+'" step="'+(st||'any')+'" value="'+v+'" style="--p:'+((v-mn)/(mx-mn)*100)+'%">'};
const aseg=(p,cur,list,extra)=>'<div class="seg'+(extra||'')+'">'+list.map(([v,n,dis])=>'<button data-x="astset" data-sk="'+p+'" data-v="'+astEsc(v)+'" class="'+(String(cur)===String(v)?'on':'')+(dis?' disabled':'')+'">'+n+'</button>').join('')+'</div>';
const asw=(p,l,on,sub)=>'<div class="row" style="padding:12px 0 0"><div>'+l+(sub?'<small>'+sub+'</small>':'')+'</div><button class="sw'+(on?' on':'')+'" data-x="astsw" data-sk="'+p+'" aria-label="'+l+'"></button></div>';
const ascol=(p,l,v)=>'<div class="btns"><label class="colr">'+l+'<input type="color" data-sk="'+p+'" value="'+v+'"></label></div>';

/* --- settings ------------------------------------------------------- */
function astSettings(){
 if(!AST_RAW)return null;
 const s=JSON.parse(JSON.stringify(AST_RAW));
 const pal=(AST_PAL[s.dither.palette]||['#080808','#e6e3da']).slice();
 s.dither.colors=pal;
 s.print=Object.assign({},s.print,{secondaryInk:s.print&&s.print.secondaryInk||'#ec6752'});
 return s;
}
/* a look's settings are written straight into the raw settings */
function astMerge(base,extra){
 if(!extra)return base;
 for(const k in extra){
  const v=extra[k];
  if(v&&typeof v==='object'&&!Array.isArray(v))base[k]=astMerge(base[k]&&typeof base[k]==='object'?base[k]:{},v);
  else base[k]=v;
 }
 return base;
}
function astApplyLook(id){
 const l=AST_LOOKS.find(x=>x.id===id);if(!l)return;
 let base={};
 if(l.engineLook){const e=AE.studio.STUDIO_LOOKS.find(x=>x.id===l.engineLook);if(e)base=JSON.parse(JSON.stringify(e.settings||{}))}
 astMerge(base,l.settings||{});
 astMerge(base,l.overrides||{});
 // A look sets its own framing, but a crop the user made by hand survives it.
 const c=AST_RAW.crop;
 const keepCrop=(c&&(c.zoom!==1||c.rotation!==0||c.x!==.5||c.y!==.5))?JSON.parse(JSON.stringify(c)):null;
 Object.assign(AST_RAW,AE.studio.normalizeStudioSettings(base));
 if(keepCrop)AST_RAW.crop=keepCrop;
 AST.look=id;
 astApply();panel();toast(l.name+' look');
}

/* --- source & mount ------------------------------------------------- */
function astSourceEl(){
 if(AST.src==='video'&&vid.videoWidth)return vid;
 if(AST.src==='file'&&AST.file)return null;
 return TI;
}
function astMedia(){
 if(AST.src==='file'&&AST.file)return null;
 if(AST.src==='video'&&vid.videoWidth)return{source:vid,width:vid.videoWidth,height:vid.videoHeight,duration:vid.duration||0,animated:true,seek:async t=>{if(Math.abs(vid.currentTime-t)>.01)vid.currentTime=t},frame:()=>vid,destroy:()=>{}};
 if(TI){const w=TI.naturalWidth||TI.width,h=TI.naturalHeight||TI.height;return{source:TI,width:w,height:h,duration:0,animated:false,seek:async()=>{},frame:()=>TI,destroy:()=>{}}}
 return null;
}
function astDestroy(){
 ASSIG++;
 if(ASRT){try{ASRT.destroy()}catch(e){}ASRT=null}
 if(ASMEDIA){try{ASMEDIA.destroy()}catch(e){}ASMEDIA=null}
}
async function astMount(){
 astDestroy();
 if(!AE||!AST_RAW)return;
 const cv=$('#tcv');if(!cv)return;
 const sig=++ASSIG;
 try{
  if(AST.src==='project'){
   if(!AST.layers.length){astPanel();return}
   astSaveLayer();
   const input=astProjectInput();
   ASRT=await AE.studio.mountStudioProject(cv,input,astProjectSources(),{width:input.width,height:input.height,maxCells:AST.cells});
   if(sig!==ASSIG){ASRT.destroy();ASRT=null;return}
   AST.err='';
   return;
  }
  let media=null;
  if(AST.src==='text'){
   const r=await AE.studio.createStudioText(AST.text||'FRAMEGRAB',AST.font,'#ece9e0','#0b0b0a');
   if(sig!==ASSIG)return;
   AST.ascii=r.ascii||'';
   media={source:r.canvas,width:r.canvas.width,height:r.canvas.height,duration:0,animated:false,seek:async()=>{},frame:()=>r.canvas,destroy:()=>{}};
  }
  else if(AST.src==='file'&&AST.file){media=await AE.studio.loadStudioMedia(AST.file);if(sig!==ASSIG){media.destroy();return}}
  else media=astMedia();
  if(!media)return;
  ASMEDIA=media;
  const w=media.width||1,h=media.height||1,k=Math.min(1,1280/Math.max(w,h));
  ASRT=AE.studio.mountStudioMedia(cv,media,{settings:astSettings(),width:Math.max(2,Math.round(w*k)),height:Math.max(2,Math.round(h*k)),maxCells:AST.cells,
   onError:e=>{AST.err=e&&e.message||'render failed';toast('ASCII: '+AST.err)}});
  ASRT.redraw();
  AST.err='';
 }catch(e){AST.err=e&&e.message||'failed';toast('ASCII studio: '+AST.err)}
}
function astApply(){
 if(AST.src==='project')astSaveLayer();
 if(!ASRT)return;
 try{
  if(AST.src==='project')ASRT.update(astProjectInput());
  else ASRT.update(astSettings());
 }catch(e){}
}
function astNeedsMount(){return !ASRT}

/* --- export --------------------------------------------------------- */
function astExt(f){return f==='jpeg'?'jpg':f}
async function astExport(){
 if(!AE)return toast('The ASCII engine is not available');
 const fmt=AST.exFormat,animated=fmt!=='png'&&fmt!=='jpeg';
 const el=astSourceEl();
 if(AST.src!=='project'&&!el&&!(AST.src==='file'&&AST.file))return toast('No source for the studio');
 AST.busy=1;
 const p=$('#astprog');
 try{
  if(p){p.hidden=false;p.value=0}
  if(AST.src==='project'){
   astSaveLayer();
   const input=astProjectInput();
   const blob=await AE.studio.exportStudioProject(input,astProjectSources(),{format:fmt,width:AST.exW,height:AST.exH,fps:AST.exFps,duration:AST.exDur,quality:AST.exQ,maxCells:131072,onProgress:v=>{if(p)p.value=v}});
   deliver([{name:TN+'_ascii.'+astExt(fmt),blob:blob}],TN+'_ascii');
   toast('Exported '+fmt.toUpperCase());
   return;
  }
  let media=null,frame;
  if(AST.src==='file'&&AST.file){media=await AE.studio.loadStudioMedia(AST.file);frame=t=>media.frame(t)}
  else frame=()=>el;
  const blob=await AE.studio.exportStudio({frame},astSettings(),{format:fmt,width:AST.exW,height:AST.exH,fps:AST.exFps,duration:AST.exDur,quality:AST.exQ,maxCells:131072,
   onProgress:v=>{if(p)p.value=v}});
  if(media)media.destroy();
  deliver([{name:TN+'_ascii.'+astExt(fmt),blob:blob}],TN+'_ascii');
  toast('Exported '+fmt.toUpperCase());
 }catch(e){
  toast('Export failed: '+(e&&e.message||'unknown'));
 }finally{
  AST.busy=0;if(p)p.hidden=true;
 }
}
/* plain text and ANSI text from the current source */
function astText(ansi){
 if(!AE)return'';
 if(AST.src==='text')return AST.ascii||'';
 let src=astSourceEl();
 if(!src&&AST.src==='file'&&AST.file)return'';
 try{
  const cols=Math.max(20,Math.min(240,AST.textCols|0)),fs=8;
  const opts={charset:AST_RAW.charset,colorMode:ansi?'fullcolor':'grayscale',fontSize:fs};
  return ansi?AE.core.asciiTextAnsi(src,opts,cols*fs):AE.core.asciiText(src,opts,cols*fs);
 }catch(e){return''}
}
