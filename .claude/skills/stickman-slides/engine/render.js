#!/usr/bin/env node
// Render every slide of a deck to a looping MP4 (+poster PNG) and write meta.json for build_pptx.py.
// Usage: node render.js <deck.js> <outDir> [--fps 30] [--only 2,5]
const {chromium}=require('playwright');const {spawn}=require('child_process');const fs=require('fs');const path=require('path');
const args=process.argv.slice(2);const deck=path.resolve(args[0]);const out=path.resolve(args[1]||'out');
const opt=k=>{const i=args.indexOf(k);return i>0?args[i+1]:null};const FPS=+(opt('--fps')||30);
const only=opt('--only')?opt('--only').split(',').map(Number):null;
if(!args[0]){console.error('usage: node render.js <deck.js> <outDir> [--fps 30] [--only 2,5]');process.exit(1)}
fs.mkdirSync(out,{recursive:true});
const url=s=>'file://'+path.join(__dirname,'slide.html')+'?s='+s+'&deck='+encodeURIComponent('file://'+deck);
async function one(b,s){const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(url(s));const D=await p.evaluate(()=>window.ready);const n=Math.round(D*FPS);
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','-','-c:v','libx264','-preset','slow','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,`slide${s}.mp4`)]);
 for(let i=0;i<n;i++){await p.evaluate(t=>render(t),i/FPS);const buf=await p.screenshot({type:'png'});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r))}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));
 const meta=await p.evaluate(()=>deckMeta());const pt=meta.slides.find(x=>x.n===s).poster;
 await p.evaluate(t=>render(t),pt);await p.screenshot({path:path.join(out,`poster${s}.png`)});
 await p.close();if(errs.length)console.error('slide',s,'errors',errs);console.log('slide',s,n,'frames');return meta}
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto(url(1));await p.evaluate(()=>window.ready);
 const meta=await p.evaluate(()=>deckMeta());await p.close();
 const list=meta.slides.map(x=>x.n).filter(n=>!only||only.includes(n));
 await Promise.all(list.map(s=>one(b,s)));await b.close();
 fs.writeFileSync(path.join(out,'meta.json'),JSON.stringify(meta,null,1));
 // one-pass preview reel of all slides
 const all=meta.slides.map(x=>x.n).filter(n=>fs.existsSync(path.join(out,`slide${n}.mp4`)));
 fs.writeFileSync(path.join(out,'list.txt'),all.map(n=>`file 'slide${n}.mp4'`).join('\n'));
 await new Promise(r=>spawn('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(out,'list.txt'),'-c','copy',path.join(out,'preview.mp4')]).on('close',r));
 console.log('done →',out)})();
