#!/usr/bin/env node
// Quick QA: screenshot chosen moments of each slide and build contact sheets (needs python3 + Pillow).
// Usage: node snap.js <deck.js> <outDir> '{"1":[1,4.8],"2":[2.5]}'   (omit JSON → 4 evenly spaced moments per slide)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const [deckA,outA,planA]=process.argv.slice(2);const deck=path.resolve(deckA);const out=path.resolve(outA||'snap');fs.mkdirSync(out,{recursive:true});
const url=s=>'file://'+path.join(__dirname,'slide.html')+'?s='+s+'&deck='+encodeURIComponent('file://'+deck);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(url(1));await p.evaluate(()=>window.ready);const meta=await p.evaluate(()=>deckMeta());
 const plan=planA?JSON.parse(planA):Object.fromEntries(meta.slides.map(x=>[x.n,[.2,.4,.6,.8].map(f=>+(x.D*f).toFixed(2))]));
 const files=[];
 for(const [s,times] of Object.entries(plan)){await p.goto(url(s));await p.evaluate(()=>window.ready);
  const ov=await p.evaluate(()=>{const l=document.getElementById('left');const r=l.getBoundingClientRect();let worst=0;for(const c of l.children){worst=Math.max(worst,c.getBoundingClientRect().bottom)}return{over:l.scrollHeight>l.clientHeight+2||worst>r.bottom+2,bottom:Math.round(worst)}});
  if(ov.over)console.error(`WARN slide ${s}: left text column overflows (bottom ${ov.bottom}px) — shorten bullets/title`);
  for(const t of times){await p.evaluate(t=>render(t),t);const f=path.join(out,`s${s}_${t}.png`);await p.screenshot({path:f});files.push(f)}}
 await b.close();if(errs.length)console.error('PAGE ERRORS',errs);
 execFileSync('python3',[path.join(__dirname,'sheet.py'),out,...files],{stdio:'inherit'})})();
