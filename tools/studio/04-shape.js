
/* --- shape: warps, crop, curves, masks, lights --------------------- */
const AST_CURVES=[
 ['identity','Identity',[[0,0],[1,1]]],
 ['contrast','Contrast',[[0,0],[0.5,0.42],[1,1]]],
 ['punch','Punch',[[0,0],[0.25,0.12],[0.75,0.88],[1,1]]],
 ['lift','Lift',[[0,0.12],[1,1]]],
 ['crush','Crush',[[0,0],[1,0.88]]],
 ['fade','Fade',[[0,0.18],[0.5,0.5],[1,0.82]]],
 ['invert','Invert',[[0,1],[1,0]]]
];
const AST_CURVE_CH=[['rgb','RGB'],['red','Red'],['green','Green'],['blue','Blue']];

function astWarpOn(type){return (AST_RAW.warps||[]).some(w=>w.type===type&&w.enabled!==false)}
function astWarpToggle(type){
 const list=AST_RAW.warps||(AST_RAW.warps=[]);
 const i=list.findIndex(w=>w.type===type);
 if(i>=0){list.splice(i,1)}
 else{
  const def=AST_WARP.find(w=>w.value===type)||{};
  list.push({type,enabled:true,amount:.35,x:.5,y:.5,radius:.55,angle:0,frequency:5});
 }
 astApply();
}
function astWarpSet(i,k,v){
 const w=(AST_RAW.warps||[])[i];if(!w)return;
 w[k]=v;astApply();
}
function astCurveSet(ch,pts){
 const c=AST_RAW.color.curves||(AST_RAW.color.curves={});
 c[ch]=pts.map(p=>[p[0],p[1]]);
 astApply();
}
function astMaskOn(){return !!(AST_RAW.mask&&AST_RAW.mask.enabled)}
function astMaskToggle(){
 const m=AST_RAW.mask||(AST_RAW.mask={enabled:false,invert:false,shapes:[]});
 m.enabled=!m.enabled;
 if(m.enabled&&!m.shapes.length)m.shapes=[{kind:'ellipse',x:.5,y:.5,width:.7,height:.8}];
 astApply();
}
function astLightOn(){return !!(AST_RAW.lights&&AST_RAW.lights.length)}
function astLightToggle(){
 const l=AST_RAW.lights||(AST_RAW.lights=[]);
 if(l.length)AST_RAW.lights=[];
 else AST_RAW.lights=[{x:.75,y:.2,radius:.28,intensity:.28,color:'#f4efe4'}];
 astApply();
}

function astSecShape(){
 const R=AST_RAW;
 const warps=R.warps||[];
 const warpChips=AST_WARP.map(w=>'<button class="chip '+(astWarpOn(w.value)?'c1':'')+'" data-x="astwarp" data-v="'+w.value+'" aria-pressed="'+(astWarpOn(w.value)?'true':'false')+'">'+w.label+'</button>').join('');
 const warpRows=warps.map((w,i)=>{
  const def=AST_WARP.find(x=>x.value===w.type)||{};
  return'<div class="lbl">'+def.label+'<span>'+Math.round((w.amount||0)*100)+'%</span></div>'
   +'<input type="range" data-sk="warps.'+i+'.amount" min="-1" max="1" step="any" value="'+(w.amount||0)+'" style="--p:'+((w.amount||0)+1)/2*100+'%">'
   +'<div class="lbl">Radius<span>'+Math.round((w.radius||0)*100)+'%</span></div>'
   +'<input type="range" data-sk="warps.'+i+'.radius" min="0.05" max="2" step="any" value="'+(w.radius||0)+'" style="--p:'+((w.radius||0)-0.05)/1.95*100+'%">'
   +(def.direction?'<div class="lbl">Angle<span>'+Math.round(w.angle||0)+'\u00b0</span></div><input type="range" data-sk="warps.'+i+'.angle" min="-180" max="180" step="any" value="'+(w.angle||0)+'" style="--p:'+((w.angle||0)+180)/360*100+'%">':'')
   +(def.frequency?'<div class="lbl">Frequency<span>'+Math.round(w.frequency||5)+'</span></div><input type="range" data-sk="warps.'+i+'.frequency" min="1" max="24" step="any" value="'+(w.frequency||5)+'" style="--p:'+((w.frequency||5)-1)/23*100+'%">':'');
 }).join('');
 const m=R.mask||{enabled:false,invert:false,shapes:[]};
 const sh=m.shapes&&m.shapes[0];
 const light=(R.lights&&R.lights[0])||null;

 return'<div class="lbl">Warps<span>'+warps.length+' of '+AST_WARP.length+'</span></div>'
  +'<div class="chips">'+warpChips+'</div>'
  +(warps.length?'<div class="hint" style="margin:6px 0 0;text-align:left">Tap a warp again to remove it. Warps shape the source before the characters are drawn.</div>':'')
  +warpRows
  +'<div class="lbl">Crop</div>'
  +asl('crop.zoom','Zoom',.2,4,' \u00d7')
  +asl('crop.rotation','Rotation',-180,180,'\u00b0')
  +asl('crop.x','Centre X',0,1,'')
  +asl('crop.y','Centre Y',0,1,'')
  +'<div class="lbl">Tone curve</div>'
  +aseg('__curvech',AST.curveCh||'rgb',AST_CURVE_CH)
  +'<div class="chips">'+AST_CURVES.map(([v,n])=>'<button class="chip '+(astCurveActive(v)?'c1':'')+'" data-x="astcurve" data-v="'+v+'">'+n+'</button>').join('')+'</div>'
  +'<div class="lbl">Mask</div>'
  +asw('__maskon','Mask the artwork','Keep the characters only inside the shape',astMaskOn())
  +(m.enabled&&sh?'<div class="lbl">Shape</div>'
   +aseg('__maskkind',sh.kind,[['rectangle','Rectangle'],['ellipse','Ellipse']])
   +asl('mask.shapes.0.width','Width',.05,1,'')
   +asl('mask.shapes.0.height','Height',.05,1,'')
   +asl('mask.shapes.0.x','Centre X',0,1,'')
   +asl('mask.shapes.0.y','Centre Y',0,1,'')
   +asw('mask.invert','Invert the mask','Keep what is outside the shape',m.invert):'')
  +'<div class="lbl">Light</div>'
  +asw('__light','Add a light','Move the light across the artwork',astLightOn())
  +(light?'<div class="lbl">Position</div>'
   +asl('lights.0.x','Light X',0,1,'')
   +asl('lights.0.y','Light Y',0,1,'')
   +asl('lights.0.radius','Light radius',.02,1,'')
   +asl('lights.0.intensity','Light strength',0,1,'')
   +ascol('lights.0.color','Light colour',light.color):'');
}
function astCurveActive(v){
 const c=(AST_RAW.color.curves||{})[AST.curveCh||'rgb'];
 const pts=AST_CURVES.find(x=>x[0]===v);
 if(!pts||!c)return false;
 return JSON.stringify(c.map(p=>[+p[0],+p[1]]))===JSON.stringify(pts[2]);
}
