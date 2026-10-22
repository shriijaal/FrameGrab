
/* --- panel ---------------------------------------------------------- */
const AST_SECTIONS=[['style','Style'],['color','Color'],['dither','Dither'],['print','Print'],['shape','Shape'],['motion','Motion'],['looks','Looks'],['layers','Layers'],['export','Export']];
const AST_ASPECTS=[['original','Original'],['16:9','16:9'],['9:16','9:16'],['1:1','1:1'],['4:3','4:3'],['3:4','3:4'],['21:9','21:9']];
const AST_SCOPES=AE?AE.studio.HOVER_SCOPES.map(s=>[s.value,s.label]):[['all','Everywhere'],['subject','Subject'],['outside','Around']];

function astChip(p,v,label,on){return'<button class="chip '+(on?'c1':'')+'" data-x="astset" data-sk="'+p+'" data-v="'+astEsc(v)+'">'+label+'</button>'}

function astSecStyle(){
 const R=AST_RAW;
 return'<div class="lbl">Render style</div>'
  +'<div class="chips">'+AST_STYLES.map(s=>astChip('style',s,astLabel(s)+(AST_PRINT_IDS.indexOf(s)>=0?' \u2733':''),R.style===s)).join('')+'</div>'
  +'<div class="hint" style="margin:0 0 4px;text-align:left">'+astDesc('style',R.style)+'</div>'
  +asl('cellSize','Cell size',2,24,' px')
  +'<div class="lbl">Characters</div>'
  +'<div class="chips">'+Object.keys(AST_CHARS).map(k=>astChip('charset',AST_CHARS[k].chars,AST_CHARS[k].label,R.charset===AST_CHARS[k].chars)).join('')+'</div>'
  +'<input class="tin" data-skt="charset" value="'+astEsc(R.charset)+'" placeholder="Custom characters" style="margin-top:10px;font-family:ui-monospace,Menlo,Consolas,monospace">'
  +'<div class="lbl">Colour</div>'
  +aseg('colorMode',R.colorMode,[['source','Source'],['gray','Gray'],['accent','Accent']])
  +(R.colorMode==='accent'?ascol('ink','Ink',R.ink):'')
  +'<div class="lbl">Aspect</div>'
  +aseg('aspectRatio',R.aspectRatio,AST_ASPECTS)
  +'<div class="lbl">Quality<span>cells on screen</span></div>'
  +aseg('__cells',AST.cells,[[12000,'Draft'],[32768,'Normal'],[65536,'Fine'],[131072,'Ultra']]);
}

function astDesc(kind,v){
 if(kind==='style'){
  const p=AST_PRINT.find(x=>x.value===v);
  if(p)return p.description;
  const m={'ascii':'Characters, one per cell, ordered by measured ink.','blocks':'Tonal blocks from light to solid.','braille':'Braille dots: two columns and four rows per cell.','dots':'Halftone dots, sized by tone.','lines':'Horizontal rules whose length carries tone.','cross':'Crossed marks that thicken with tone.','diagonal':'Diagonal strokes that read as shade.','diamond':'Diamond glyphs from empty to solid.','mixed':'A mixed ramp of marks and letters.','pixel':'Square pixels, one per cell.','mosaic':'Mosaic tiles with a tessellated edge.','lego':'Studded bricks.','voxel':'Stacked cubes with volume.','disco':'Mirror-room tiles that reflect each other.','dither':'Ordered or error-diffused dithering between palette colours.','hex':'Hexagonal cells.','led':'A dot-matrix LED panel.','cmyk':'Four-colour separation, one pass per channel.'};
  return m[v]||'';
 }
 return'';
}

function astSecColor(){
 const R=AST_RAW,c=R.color,e=R.effects;
 return'<div class="lbl">Palette</div>'
  +'<div class="chips">'+Object.keys(AST_PAL).map(k=>astChip('dither.palette',k,astLabel(k),R.dither.palette===k)).join('')+'</div>'
  +'<div class="lbl">Tone</div>'
  +asl('color.brightness','Brightness',-1,1,'')
  +asl('color.contrast','Contrast',0,3,'')
  +asl('color.saturation','Saturation',0,3,'')
  +asl('color.grayscale','Grayscale',0,1,'')
  +asl('color.blackPoint','Black point',0,.99,'')
  +asl('color.whitePoint','White point',0,1,'')
  +asl('color.gamma','Gamma',.25,4,'')
  +asl('color.shadows','Shadows',-1,1,'')
  +asl('color.highlights','Highlights',-1,1,'')
  +'<div class="lbl">Levels</div>'
  +aseg('color.levels',R.color.levels,[['auto','Auto'],['none','None']])
  +'<div class="lbl">Clean up</div>'
  +asl('color.denoise','Denoise',0,1,'')
  +asl('effects.sharpen','Sharpen',0,1,'')
  +asl('effects.rgbSplit','RGB split',0,1,'')
  +'<div class="lbl">Finish</div>'
  +asl('effects.bloom','Bloom',0,1,'')
  +asl('effects.characterBloom','Character glow',0,1,'')
  +asl('effects.vignette','Vignette',0,1,'')
  +asl('effects.grain','Grain',0,1,'')
  +asl('effects.dust','Dust',0,1,'')
  +asl('effects.scanlines','Scanlines',0,1,'')
  +asl('effects.crt','CRT',0,1,'')
  +asl('effects.glitch','Glitch',0,1,'')
  +asl('effects.pixelate','Pixelate',0,1,'')
  +asl('effects.prism','Prism',0,1,'')
  +asl('effects.halftone','Halftone',0,1,'')
  +'<div class="lbl">Backdrop</div>'
  +aseg('backdrop.mode',R.backdrop.mode,[['solid','Solid'],['transparent','Clear'],['source','Source'],['blurred','Blurred'],['gradient','Gradient']])
  +(R.backdrop.mode==='gradient'?ascol('backdrop.color2','Second colour',R.backdrop.color2):'')
  +ascol('backdrop.color','Backdrop colour',R.backdrop.color)
  +asl('backdrop.blur','Backdrop blur',0,32,' px')
  +asl('backdrop.opacity','Backdrop opacity',0,1,'');
}

function astSecDither(){
 const R=AST_RAW,d=R.dither;
 return'<div class="lbl">Algorithm</div>'
  +'<div class="chips">'+AST_DITH.map(x=>astChip('dither.algorithm',x,astLabel(x),d.algorithm===x)).join('')+'</div>'
  +'<div class="lbl">Palette</div>'
  +'<div class="chips">'+Object.keys(AST_PAL).map(k=>astChip('dither.palette',k,astLabel(k),d.palette===k)).join('')+'</div>'
  +asl('dither.scale','Scale',1,12,' \u00d7')
  +asl('dither.amount','Amount',0,2,'')
  +asl('dither.threshold','Threshold',0,1,'')
  +asl('dither.direction','Direction',-180,180,'\u00b0')
  +'<div class="lbl">Dither drift</div>'
  +aseg('dither.motion',d.motion,[['none','Still'],['drift','Drift'],['shimmer','Shimmer']])
  +asl('dither.speed','Dither speed',.1,3,'');
}

function astSecPrint(){
 const R=AST_RAW,p=R.print||{};
 return'<div class="lbl">Print styles</div>'
  +'<div class="chips">'+AST_PRINT.map(x=>astChip('style',x.value,x.label,R.style===x.value)).join('')+'</div>'
  +'<div class="hint" style="margin:0 0 4px;text-align:left">'+(AST_PRINT.find(x=>x.value===R.style)||{description:''}).description+'</div>'
  +asl('print.density','Density',.1,3,'')
  +asl('print.weight','Weight',.1,3,'')
  +asl('print.angle','Angle',-180,180,'\u00b0')
  +asl('print.roughness','Roughness',0,1,'')
  +asl('print.registration','Registration',0,1,'')
  +asl('print.seed','Seed',0,100,'')
  +asw('print.invert','Invert ink','Dark ink on light paper')
  +ascol('print.secondaryInk','Second ink',p.secondaryInk||'#ec6752');
}

function astSecMotion(){
 const R=AST_RAW,m=R.motion,h=R.hover;
 return'<div class="lbl">Still motion</div>'
  +'<div class="chips">'+AST_MOT.map(x=>astChip('motion.type',x.value,x.label,m.type===x.value)).join('')+'</div>'
  +'<div class="hint" style="margin:0 0 4px;text-align:left">'+(AST_MOT.find(x=>x.value===m.type)||{description:''}).description+'</div>'
  +asl('motion.speed','Motion speed',0,5,'')
  +asl('motion.amount','Motion strength',0,1,'')
  +'<div class="lbl">Pointer effect</div>'
  +'<div class="chips">'+AST_HOV.map(x=>astChip('hover.effect',x.value,x.label,h.effect===x.value)).join('')+'</div>'
  +'<div class="hint" style="margin:0 0 4px;text-align:left">'+(AST_HOV.find(x=>x.value===h.effect)||{description:''}).description+'</div>'
  +asl('hover.strength','Pointer strength',0,1,'')
  +asl('hover.radius','Pointer radius',0,1,'')
  +'<div class="lbl">Where it acts</div>'
  +aseg('hover.scope',h.scope||'all',AST_SCOPES);
}

function astSecLooks(){
 const cats=[];AST_LOOKS.forEach(l=>{if(cats.indexOf(l.category)<0)cats.push(l.category)});
 const cur=AST.lookCat||cats[0];
 const list=AST_LOOKS.filter(l=>l.category===cur);
 return'<div class="lbl">Family</div>'
  +'<div class="chips">'+cats.map(c=>'<button class="chip '+(c===cur?'c1':'')+'" data-x="astcat" data-v="'+astEsc(c)+'">'+c+'</button>').join('')+'</div>'
  +'<div class="flist" style="margin-top:12px">'+list.map(l=>'<div class="fi"><div><b>'+astEsc(l.name)+'</b><small>'+astEsc(l.use||l.category)+'</small></div><button class="btn glass" style="height:34px;padding:0 12px" data-x="astlook" data-v="'+l.id+'">Apply</button></div>').join('')+'</div>'
  +'<div class="hint">'+list.length+' look'+(list.length===1?'':'s')+' in this family \u2014 each one sets the style, tone, ink and finish together.</div>';
}

function astSecExport(){
 const R=AST_RAW;
 const sizes=[['hd','1920 \u00d7 1080'],['sq','1080 \u00d7 1080'],['post','2400 \u00d7 3200'],['big','3000 \u00d7 3000'],['orig','Original']];
 return'<div class="lbl">Format</div>'
  +aseg('__exfmt',AST.exFormat,[['png','PNG'],['jpeg','JPEG'],['gif','GIF'],['mp4','MP4'],['webm','WebM']])
  +'<div class="lbl">Size</div>'
  +aseg('__expres',AST.exPres,sizes)
  +'<div class="lbl">Pixels</div>'
  +'<div class="btns"><input class="tin numin" type="number" min="64" max="8000" data-sk="__exw" value="'+AST.exW+'" aria-label="Export width"><input class="tin numin" type="number" min="64" max="8000" data-sk="__exh" value="'+AST.exH+'" aria-label="Export height"></div>'
  +(AST.exFormat==='gif'||AST.exFormat==='mp4'||AST.exFormat==='webm'
    ?'<div class="lbl">Animation</div>'+asl('__exfps','Frames per second',6,60,'')+asl('__exdur','Seconds',1,30,'')
    :'')
  +(AST.exFormat==='jpeg'?asl('__exq','Quality',.4,1,''):'')
  +'<button class="btn fill" data-x="astexport" style="width:100%;margin-top:16px"'+(AST.busy?' disabled':'')+'>'+(AST.busy?'Exporting\u2026':'Export '+AST.exFormat.toUpperCase())+'</button>'
  +'<progress id="astprog" max="1" value="0" style="width:100%;margin-top:10px" hidden></progress>'
  +'<div class="lbl">Plain text</div>'
  +'<div class="btns"><input class="tin numin" type="number" min="20" max="240" data-sk="__txtcols" value="'+AST.textCols+'" aria-label="Text columns"></div>'
  +'<div class="btns" style="margin-top:10px"><button class="btn glass" data-x="astcopy">Copy text</button><button class="btn glass" data-x="asttxt">Save .txt</button></div>'
  +'<div class="btns" style="margin-top:8px"><button class="btn glass" data-x="astansi">Save ANSI .txt</button></div>'
  +'<div class="hint">Text comes from the source at the column width above, using the same characters.</div>';
}

function astPanel(){
 if(!AE||!AST_RAW)return'<div class="info" style="border-color:#c0392b">The ASCII engine did not load.</div>';
 let body='';
 if(AST.sec==='style')body=astSecStyle();
 else if(AST.sec==='color')body=astSecColor();
 else if(AST.sec==='dither')body=astSecDither();
 else if(AST.sec==='print')body=astSecPrint();
 else if(AST.sec==='shape')body=astSecShape();
 else if(AST.sec==='motion')body=astSecMotion();
 else if(AST.sec==='looks')body=astSecLooks();
 else if(AST.sec==='layers')body=astSecLayers();
 else body=astSecExport();
 const srcs='<div class="lbl">Source</div>'
  +'<div class="seg">'+[['image','Image'],['video','Video'],['file','File'],['text','Text'],['project','Layers']].map(([v,n])=>'<button data-x="astsrc" data-v="'+v+'" class="'+(AST.src===v?'on':'')+'">'+n+'</button>').join('')+'</div>'
  +(AST.src==='project'?'<div class="hint">A composition of up to eight layers, each with its own style.</div>':'')
  +(AST.src==='file'?'<div class="btns" style="margin-top:10px"><button class="btn glass" data-x="astpick">Choose file</button></div><input type="file" id="astfile" accept="image/*,video/*,.gif" hidden>':'')
  +(AST.src==='text'?'<input class="tin" data-skt="__txt" value="'+astEsc(AST.text||'')+'" placeholder="Type a word" style="margin-top:12px;text-transform:none">'
   +'<div class="lbl">Banner font</div><div class="chips">'+AST_FONTS.map(f=>'<button class="chip '+(AST.font===f?'c1':'')+'" data-x="astfont" data-v="'+astEsc(f)+'">'+astEsc(f)+'</button>').join('')+'</div>':'')
  +(AST.src==='video'&&!vid.videoWidth?'<div class="hint">Load a video in the editor first, then come back.</div>':'');
 return'<div class="seg pre" style="margin-bottom:16px">'+AST_SECTIONS.map(([v,n])=>'<button data-x="astsec" data-v="'+v+'" class="'+(AST.sec===v?'on':'')+'">'+n+'</button>').join('')+'</div>'+srcs+body
  +'<div class="btns" style="margin-top:20px"><button class="btn glass" data-x="astreset" style="width:100%">Reset the Studio</button></div>';
}
