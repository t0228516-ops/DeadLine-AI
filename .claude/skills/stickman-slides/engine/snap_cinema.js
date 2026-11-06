#!/usr/bin/env node
// QA for cinema decks: screenshot chosen moments and build a contact sheet.
// Usage: node snap_cinema.js <deck.js> <outDir> '{"1":[1,3,5],"2":[2,4.6]}'
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const [deckA,outA,planA]=process.argv.slice(2);const deck=path.resolve(deckA);const out=path.resolve(outA||'snap');fs.mkdirSync(out,{recursive:true});
const url=s=>'file://'+path.join(__dirname,'cinema.html')+'?s='+s+'&deck='+encodeURIComponent('file://'+deck);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(url(1));await p.evaluate(()=>window.ready);const meta=await p.evaluate(()=>deckMeta());
 const plan=planA?JSON.parse(planA):Object.fromEntries(meta.slides.map(x=>[x.n,[.15,.35,.55,.75,.95].map(f=>+(x.intro*f).toFixed(2))]));
 const files=[];
 for(const [s,times] of Object.entries(plan)){await p.goto(url(s));await p.evaluate(()=>window.ready);
  for(const t of times){await p.evaluate(t=>render(t),t);const f=path.join(out,`s${s}_${t}.png`);await p.screenshot({path:f});files.push(f)}}
 await b.close();if(errs.length)console.error('PAGE ERRORS',errs);
 execFileSync('python3',[path.join(__dirname,'sheet.py'),out,...files],{stdio:'inherit'})})();
