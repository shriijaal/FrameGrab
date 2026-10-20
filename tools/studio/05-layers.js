
/* --- layered projects (up to 8 layers) ----------------------------- */
const AST_MAXL=AE?AE.studio.MAX_STUDIO_LAYERS:8;
const AST_BLEND=['source-over','multiply','screen','overlay','soft-light','hard-light','color-dodge','color-burn','hue','saturation','color','luminosity'];

function astLayer(){return AST.layers[AST.layerSel]||null}
function astProjectInput(){
 return{width:AST.projW,height:AST.projH,background:AST.projBg,pointerMode:'top',
  layers:AST.layers.map(l=>({id:l.id,source:l.source,name:l.name,visible:l.visible,opacity:l.opacity,blend:l.blend,placement:l.placement,settings:l.settings}))};
}
function astProjectSources(){
 const o={};
 AST.layers.forEach(l=>{o[l.source]=l.kind==='text'?{text:l.text,font:l.font,ink:'#f4efe4'}:l.src});
 return o;
}
function astSaveLayer(){
 const L=astLayer();if(!L)return;
 L.settings=JSON.parse(JSON.stringify(AST_RAW));
}
function astSelectLayer(i){
 if(i<0||i>=AST.layers.length)return;
 astSaveLayer();
 AST.layerSel=i;
 const L=astLayer();
 if(L)Object.assign(AST_RAW,AE.studio.normalizeStudioSettings(L.settings||{}));
 astDestroy();astMount();panel();
}
async function astAddImageLayer(){
 if(!AE)return;
 if(AST.layers.length>=AST_MAXL)return toast('Eight layers is the maximum');
 const c=document.createElement('canvas');pipe(c,true);
 const blob=await new Promise(r=>c.toBlob(r,'image/png'));
 if(!blob)return toast('Could not read that image');
 const url=URL.createObjectURL(blob);
 const id='l'+Date.now()+Math.random().toString(36).slice(2,6);
 AST.layers.push({id:id,source:id,name:'Image '+(AST.layers.length+1),kind:'image',src:url,visible:true,opacity:1,blend:'source-over',
  placement:{x:.5,y:.5,width:1,height:1,rotation:0,flipX:false,flipY:false},settings:JSON.parse(JSON.stringify(AST_RAW))});
 astSelectLayer(AST.layers.length-1);
 toast('Layer added');
}
function astAddTextLayer(){
 if(!AE)return;
 if(AST.layers.length>=AST_MAXL)return toast('Eight layers is the maximum');
 const id='l'+Date.now()+Math.random().toString(36).slice(2,6);
 const s=JSON.parse(JSON.stringify(AST_RAW));
 s.style='ascii';s.cellSize=8;s.backdrop={mode:'solid',color:'#0b0b0a',color2:'#1d1d1b',blur:12,opacity:1};
 AST.layers.push({id:id,source:id,name:'Text '+(AST.layers.length+1),kind:'text',text:AST.text||'HELLO',font:AST.font||'Standard',visible:true,opacity:1,blend:'source-over',
  placement:{x:.5,y:.5,width:1,height:1,rotation:0,flipX:false,flipY:false},settings:s});
 astSelectLayer(AST.layers.length-1);
 toast('Text layer added');
}
function astRemoveLayer(i){
 const L=AST.layers[i];if(!L)return;
 if(L.kind==='image'&&L.src&&L.src.startsWith('blob:'))URL.revokeObjectURL(L.src);
 AST.layers.splice(i,1);
 AST.layerSel=Math.max(0,Math.min(AST.layerSel,AST.layers.length-1));
 const L2=astLayer();
 if(L2)Object.assign(AST_RAW,AE.studio.normalizeStudioSettings(L2.settings||{}));
 astDestroy();astMount();panel();
}
function astMoveLayer(i,d){
 const j=i+d;if(j<0||j>=AST.layers.length)return;
 const t=AST.layers[i];AST.layers[i]=AST.layers[j];AST.layers[j]=t;
 AST.layerSel=j;
 astDestroy();astMount();panel();
}
function astLayerSet(i,k,v){
 const L=AST.layers[i];if(!L)return;
 if(k==='visible')L.visible=!L.visible;
 else if(k==='opacity')L.opacity=+v;
 else if(k==='blend')L.blend=v;
 else if(k==='name')L.name=String(v);
 else if(k.indexOf('placement.')===0)L.placement[k.slice(10)]=+v;
 astApply();
}
/* A slider bound to a layer rather than to the studio settings. */
function aslL(i,p,l,mn,mx,u){
 const L=AST.layers[i];if(!L)return'';
 const v=p.indexOf('placement.')===0?L.placement[p.slice(10)]:L[p];
 const id='av-l'+i+'-'+p.replace(/\./g,'-');
 return'<div class="lbl">'+l+'<span id="'+id+'">'+v+(u||'')+'</span></div><input type="range" data-lk="'+p+'" data-lv="'+i+'" data-u="'+astEsc(u||'')+'" min="'+mn+'" max="'+mx+'" step="any" value="'+v+'" style="--p:'+((v-mn)/(mx-mn)*100)+'%">';
}
function astSecLayers(){
 const L=astLayer();
 const rows=AST.layers.map((l,i)=>'<div class="fi"><div><b>'+astEsc(l.name)+'</b><small>'+(l.kind==='text'?'Text \u00b7 '+astEsc(l.font):'Image')+' \u00b7 '+Math.round(l.opacity*100)+'%</small></div>'
  +'<div class="btns" style="margin:0;gap:4px;flex:none">'
  +'<button class="btn glass" style="height:32px;flex:none;padding:0 10px" data-x="astlayvis" data-v="'+i+'" aria-label="Show or hide">'+(l.visible?'\u25cf':'\u25cb')+'</button>'
  +'<button class="btn glass" style="height:32px;flex:none;padding:0 10px" data-x="astlayup" data-v="'+i+'" aria-label="Move up">\u2191</button>'
  +'<button class="btn glass" style="height:32px;flex:none;padding:0 10px" data-x="astlaydn" data-v="'+i+'" aria-label="Move down">\u2193</button>'
  +'<button class="btn glass" style="height:32px;flex:none;padding:0 10px" data-x="astlayrm" data-v="'+i+'" aria-label="Remove">\u00d7</button>'
  +'</div></div>').join('');
 const body='<div class="lbl">Layers<span>'+AST.layers.length+' of '+AST_MAXL+'</span></div>'
  +(rows?'<div class="flist">'+rows+'</div>':'<div class="info">No layers yet. Add the current image or a text banner to start a composition.</div>')
  +'<div class="btns" style="margin-top:12px"><button class="btn glass" data-x="astlayadd">Add current image</button><button class="btn glass" data-x="astlaytext">Add text</button></div>'
  +(L?'<div class="lbl">Selected layer</div>'
   +'<div class="btns"><input class="tin" data-lk="name" data-lv="'+AST.layerSel+'" value="'+astEsc(L.name)+'" aria-label="Layer name"></div>'
   +aslL(AST.layerSel,'opacity','Opacity',0,1,'')
   +'<div class="lbl">Blend</div>'
   +'<div class="chips">'+AST_BLEND.map(b=>'<button class="chip '+(L.blend===b?'c1':'')+'" data-x="astlayblend" data-v="'+astEsc(b)+'">'+astEsc(b)+'</button>').join('')+'</div>'
   +'<div class="lbl">Placement</div>'
   +aslL(AST.layerSel,'placement.x','Centre X',0,1,'')
   +aslL(AST.layerSel,'placement.y','Centre Y',0,1,'')
   +aslL(AST.layerSel,'placement.width','Width',.05,2,'')
   +aslL(AST.layerSel,'placement.height','Height',.05,2,'')
   +aslL(AST.layerSel,'placement.rotation','Rotation',-180,180,'\u00b0'):'')
  +'<div class="lbl">Canvas</div>'
  +'<div class="btns"><input class="tin numin" type="number" min="64" max="4000" data-sk="__projw" value="'+AST.projW+'" aria-label="Canvas width"><input class="tin numin" type="number" min="64" max="4000" data-sk="__projh" value="'+AST.projH+'" aria-label="Canvas height"></div>'
  +ascol('__projbg','Canvas colour',AST.projBg)
  +'<div class="hint">Each layer keeps its own style. Pick a layer to edit it with the panels above \u2014 the settings travel with that layer.</div>';
 return body;
}
