import sys

path = r"D:\Vibe Coded Programs\framegrab\index.html"
with open(path, 'r', encoding='utf-8') as f:
    s = f.read()

# 1) Add scanov to canvas wrapper
old = '   <div class="cvw"><canvas id="tcv"></canvas><div class="bgsheen" aria-hidden="true"><i></i></div><div class="bgscan" aria-hidden="true"><i></i><b>Removing the background…</b></div><div class="bgzoom"><button data-x="bgzout" aria-label="Zoom out">&#8722;</button><b id="bgzoomv">100%</b><button data-x="bgzin" aria-label="Zoom in">+</button></div></div>'
new = '   <div class="cvw"><canvas id="tcv"></canvas><div class="bgsheen" aria-hidden="true"><i></i></div><div class="bgscan" aria-hidden="true"><i></i><b>Removing the background…</b></div><div class="scanov" aria-hidden="true"><i></i><b id="scanovt">Processing…</b></div><div class="bgzoom"><button data-x="bgzout" aria-label="Zoom out">&#8722;</button><b id="bgzoomv">100%</b><button data-x="bgzin" aria-label="Zoom in">+</button></div></div>'
if old not in s:
    print('MISS1')
    sys.exit(1)
s = s.replace(old, new)

# 2) Add helpers
helpers = """function showScan(msg){const cv=$('.cvw'),b=$('#scanovt');if(b&&msg)b.textContent=msg;if(cv)cv.classList.add('scanbusy')}
function hideScan(){const cv=$('.cvw');if(cv)cv.classList.remove('scanbusy')}"""
oldh = "/* ---- OCR ---- */"
if oldh not in s:
    print('MISS2'); sys.exit(1)
s = s.replace(oldh, helpers + "\n/* ---- OCR ---- */")

# 3) Wire runOcr
oldocr = """async function runOcr(){
  if(xBusy)return;xBusy=true;const out=$('#oto');
  try{
   toast('Reading the image\u2026');await new Promise(r=>setTimeout(r,60));
   const eng=await ocrInit(OSL),full=document.createElement('canvas');pipe(full,true);const k=Math.min(1,2600/Math.max(full.width,full.height)),c=document.createElement('canvas');c.width=Math.round(full.width*k);c.height=Math.round(full.height*k);const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(full,0,0,c.width,c.height);"""
newocr = """async function runOcr(){
  if(xBusy)return;xBusy=true;const out=$('#oto');
  try{
   showScan('Reading the image\u2026');toast('Reading the image\u2026');await new Promise(r=>setTimeout(r,60));
   const eng=await ocrInit(OSL),full=document.createElement('canvas');pipe(full,true);const k=Math.min(1,2600/Math.max(full.width,full.height)),c=document.createElement('canvas');c.width=Math.round(full.width*k);c.height=Math.round(full.height*k);const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(full,0,0,c.width,c.height);"""
if oldocr not in s:
    print('MISS3'); sys.exit(1)
s = s.replace(oldocr, newocr)
oldocrf = """   haptic('success');toast(OCRT?'Text recognized':'No text found');
  }catch(e){toast((OTD[OSL]?'Text recognition isn\u2019t available in this view.':'Couldn\u2019t load the language data for '+OSL+'.'))}finally{xBusy=false}
  }"""
newocrf = """   hideScan();haptic('success');toast(OCRT?'Text recognized':'No text found');
  }catch(e){hideScan();toast((OTD[OSL]?'Text recognition isn\u2019t available in this view.':'Couldn\u2019t load the language data for '+OSL+'.'))}finally{xBusy=false}
  }"""
if oldocrf not in s:
    print('MISS3b'); sys.exit(1)
s = s.replace(oldocrf, newocrf)

# 4) scanImage
oldsi = """async function scanImage(){
  const f=document.createElement('canvas');pipe(f,true);const k=Math.min(1,1800/Math.max(f.width,f.height)),c=document.createElement('canvas');c.width=Math.round(f.width*k);c.height=Math.round(f.height*k);c.getContext('2d',{willReadFrequently:true}).drawImage(f,0,0,c.width,c.height);
  toast('Scanning\u2026');await new Promise(r=>setTimeout(r,40));const r=await detectCodes(c);showCodes(r);if(r.length)haptic('success');
  }"""
newsi = """async function scanImage(){
  showScan('Scanning\u2026');const f=document.createElement('canvas');pipe(f,true);const k=Math.min(1,1800/Math.max(f.width,f.height)),c=document.createElement('canvas');c.width=Math.round(f.width*k);c.height=Math.round(f.height*k);c.getContext('2d',{willReadFrequently:true}).drawImage(f,0,0,c.width,c.height);
  toast('Scanning\u2026');await new Promise(r=>setTimeout(r,40));const r=await detectCodes(c);hideScan();showCodes(r);if(r.length)haptic('success');
  }"""
if oldsi not in s:
    print('MISS4'); sys.exit(1)
s = s.replace(oldsi, newsi)

# 5) docScan
oldds = """function docScan(){
  if(!DOC.q)return toast('Move the four corners onto the page first');const c=document.createElement('canvas');pipe(c,true);const q=DOC.q.map(p=>[p[0]*c.width,p[1]*c.height]),out=warpQuad(c,q);enhanceDoc(out,T.dm);
  DOC.orig=TI;TI=out;DOC.for=out;DOC.q=[[.02,.02],[.98,.02],[.98,.98],[.02,.98]];DSC.push(out);if(DSC.length>20)DSC.shift();T=Object.assign(defT(),{});panel();draw();haptic('success');toast('Page '+DSC.length+' flattened \u2014 take another photo to scan more');
  }"""
newds = """function docScan(){
  if(!DOC.q)return toast('Move the four corners onto the page first');showScan('Scanning page\u2026');const c=document.createElement('canvas');pipe(c,true);const q=DOC.q.map(p=>[p[0]*c.width,p[1]*c.height]),out=warpQuad(c,q);enhanceDoc(out,T.dm);
  DOC.orig=TI;TI=out;DOC.for=out;DOC.q=[[.02,.02],[.98,.02],[.98,.98],[.02,.98]];DSC.push(out);if(DSC.length>20)DSC.shift();T=Object.assign(defT(),{});hideScan();panel();draw();haptic('success');toast('Page '+DSC.length+' flattened \u2014 take another photo to scan more');
  }"""
if oldds not in s:
    print('MISS5'); sys.exit(1)
s = s.replace(oldds, newds)

# 6) Toolbox
oldemp = """function emptyPanel(){
  const e=EMPTY[curTool]||['Choose an image','This tool works on an image from your device or your stills.','Choose an image'];
  return `<div class="empty2"><div class="ei"><svg class="i"><use href="#${(TL.find(x=>x[0]===curTool)||[])[2]||'img'}"/></svg></div><b>${e[0]}</b><p>${e[1]}</p><div class="btns"><button class="btn fill" data-x="e_pick">${e[2]}</button><button class="btn glass" data-x="e_stills">From stills</button></div>${(curTool==='doc'||curTool==='pdf')?'<button class="btn glass" data-x="e_cam" style="width:100%;margin-top:10px">Take a photo</button>':''}</div>`;
  }"""
newemp = """function emptyPanel(){
  if(curTool==='ocr'){return `<div class="empty2"><div class="ei"><svg class="i"><use href="#txt"/></svg></div><b>OCR</b><p>Extract text from an image or photo.</p><div class="btns"><button class="btn fill" data-x="e_cam">Use camera</button><button class="btn glass" data-x="e_pick">Pick image</button></div><button class="btn glass" data-x="e_stills" style="width:100%;margin-top:10px">From stills</button></div>`;}
  if(curTool==='doc'){return `<div class="empty2"><div class="ei"><svg class="i"><use href="#frm"/></svg></div><b>Document scanner</b><p>Scan a page with your camera or from an image.</p><div class="btns"><button class="btn fill" data-x="e_cam">Use camera</button><button class="btn glass" data-x="e_pick">Pick image</button></div><button class="btn glass" data-x="e_stills" style="width:100%;margin-top:10px">From stills</button></div>`;}
  if(curTool==='qrs'){return `<div class="empty2"><div class="ei"><svg class="i"><use href="#qr"/></svg></div><b>QR &amp; barcode scanner</b><p>Scan a code with your camera or from an image.</p><div class="btns"><button class="btn fill" data-x="e_cam">Use camera</button><button class="btn glass" data-x="e_pick">Pick image</button></div><button class="btn glass" data-x="e_stills" style="width:100%;margin-top:10px">From stills</button></div>`;}
  const e=EMPTY[curTool]||['Choose an image','This tool works on an image from your device or your stills.','Choose an image'];
  return `<div class="empty2"><div class="ei"><svg class="i"><use href="#${(TL.find(x=>x[0]===curTool)||[])[2]||'img'}"/></svg></div><b>${e[0]}</b><p>${e[1]}</p><div class="btns"><button class="btn fill" data-x="e_pick">${e[2]}</button><button class="btn glass" data-x="e_stills">From stills</button></div>${(curTool==='doc'||curTool==='pdf')?'<button class="btn glass" data-x="e_cam" style="width:100%;margin-top:10px">Take a photo</button>':''}</div>`;
  }'''
if oldemp not in s:
    print('MISS6'); sys.exit(1)
s = s.replace(oldemp, newemp)

# 7) openTool
oldop = """function openTool(id){
  curTool=id;const k=kindOf(id);
  if(k==='file'){showTW();if(id!=='pdf'&&!FL.length){$('#tff').accept=id==='rename'?'':'image/*';$('#tff').click()}}
  else if(id==='clg'){showTW();if(!CI.length)$('#tfm').click()}
  else if(id==='qrgen')showTW();
  else if(id==='astudio')srcPickStudio();
  else if(!TI)$('#tf').click();
  else showTW();
  }"""
newop = """function openTool(id){
  curTool=id;const k=kindOf(id);
  if(id==='ocr'){showTW();if(!TI){srcPickScan();return}}
  if(id==='doc'){showTW();if(!TI){srcPickDoc();return}}
  if(id==='qrs'){showTW();if(!TI){srcPickQR();return}}
  if(k==='file'){showTW();if(id!=='pdf'&&!FL.length){$('#tff').accept=id==='rename'?'':'image/*';$('#tff').click()}}
  else if(id==='clg'){showTW();if(!CI.length)$('#tfm').click()}
  else if(id==='qrgen')showTW();
  else if(id==='astudio')srcPickStudio();
  else if(!TI)$('#tf').click();
  else showTW();
  }"""
if oldop not in s:
    print('MISS7'); sys.exit(1)
s = s.replace(oldop, newop)

with open(path, 'w', encoding='utf-8') as f:
    f.write(s)
print('done')
