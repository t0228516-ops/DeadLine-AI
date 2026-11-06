#!/usr/bin/env node
// Render a cinema deck: every slide → MP4 (intro + living idle, no loop restart) + poster, then synthesise and mux sound
// (audio.py) and join a preview reel. Usage: node render_cinema.js <deck.js> <outDir> [--fps 24] [--only 2,5] [--par 4]
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const args=process.argv.slice(2);const deck=path.resolve(args[0]);const out=path.resolve(args[1]||'out');
const opt=k=>{const i=args.indexOf(k);return i>0?args[i+1]:null};const FPS=+(opt('--fps')||24);const PAR=+(opt('--par')||4);
const only=opt('--only')?opt('--only').split(',').map(Number):null;
fs.mkdirSync(out,{recursive:true});
const url=s=>'file://'+path.join(__dirname,'cinema.html')+'?s='+s+'&deck='+encodeURIComponent('file://'+deck);
async function one(b,s){const p=await b.newPage({viewport:{width:1920,height:1080}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(url(s));const D=await p.evaluate(()=>window.ready);const n=Math.round(D*FPS);
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','-','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,`slide${s}.mp4`)]);
 for(let i=0;i<n;i++){await p.evaluate(t=>render(t),i/FPS);const buf=await p.screenshot({type:'jpeg',quality:92});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r))}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));
 const meta=await p.evaluate(()=>deckMeta());const pt=meta.slides.find(x=>x.n===s).poster;
 await p.evaluate(t=>render(t),pt);await p.screenshot({path:path.join(out,`poster${s}.png`)});
 await p.close();if(errs.length)console.error('slide',s,'errors',errs);console.log('slide',s,n,'frames')}
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto(url(1));await p.evaluate(()=>window.ready);
 const meta=await p.evaluate(()=>deckMeta());await p.close();
 const list=meta.slides.map(x=>x.n).filter(n=>!only||only.includes(n));
 for(let i=0;i<list.length;i+=PAR)await Promise.all(list.slice(i,i+PAR).map(s=>one(b,s)));await b.close();
 fs.writeFileSync(path.join(out,'meta.json'),JSON.stringify(meta,null,1));
 execFileSync('python3',[path.join(__dirname,'audio.py'),out],{stdio:'inherit'});
 // preview: each slide's intro + 3 s of its idle, back to back
 const all=meta.slides.filter(x=>fs.existsSync(path.join(out,`slide${x.n}.mp4`)));
 const parts=[];for(const x of all){const f=path.join(out,`cut${x.n}.mp4`);parts.push(f);
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',path.join(out,`slide${x.n}.mp4`),'-t',String(Math.min(x.D,x.intro+3)),'-c:v','libx264','-preset','medium','-crf','21','-c:a','aac','-b:a','160k',f])}
 fs.writeFileSync(path.join(out,'list.txt'),parts.map(f=>`file '${f}'`).join('\n'));
 execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(out,'list.txt'),'-c','copy',path.join(out,'preview.mp4')]);
 console.log('done →',out)})();
