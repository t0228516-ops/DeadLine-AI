/* Stickman-slides engine: rough primitives, stickman rig, props, backgrounds, render loop.
   Scenes live in a deck.js (see examples/rome/deck.js). */

const INK='#1d1d1f', GOLD='#FFD23F'; let RED='#D7263D';
const W=840,H=840,G=700, D2R=Math.PI/180;
let SEED=1, CT=0;
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function R(){return mul(SEED*7919+(CT++)*104729+13)}
const f2=v=>v.toFixed(1);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,u)=>a+(b-a)*u;
const EASE={l:u=>u,io:u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2,o:u=>1-Math.pow(1-u,3),i:u=>u*u*u,
 back:u=>{const c=1.9;return 1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2)},
 bounce:u=>{const n=7.5625,d=2.75;if(u<1/d)return n*u*u;if(u<2/d)return n*(u-=1.5/d)*u+.75;if(u<2.5/d)return n*(u-=2.25/d)*u+.9375;return n*(u-=2.625/d)*u+.984375}};
const seg=(t,a,b,e='io')=>EASE[e](clamp((t-a)/(b-a),0,1));
function track(keys){let cur={},full=[];for(const [t,p,e] of keys){cur={...cur,...p};full.push([t,{...cur},e||'io'])}
 return t=>{if(t<=full[0][0])return{...full[0][1]};for(let i=0;i<full.length-1;i++){const[t0,a]=full[i],[t1,b,e]=full[i+1];
  if(t<=t1){const u=EASE[e]((t-t0)/(t1-t0)),o={};for(const k in b){const va=a[k]??b[k];o[k]=typeof b[k]==='number'?va+(b[k]-va)*u:(u<1?va:b[k])}return o}}
  return{...full[full.length-1][1]}}}
function lerpC(c1,c2,u){const p=c=>[1,3,5].map(i=>parseInt(c.substr(i,2),16));const a=p(c1),b=p(c2);return'#'+a.map((v,i)=>Math.round(lerp(v,b[i],u)).toString(16).padStart(2,'0')).join('')}

/* ---------- rough primitives ---------- */
function line(x1,y1,x2,y2,o={}){const r=R(),w=o.w??8,c=o.c??INK,j=o.j??1;
 const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
 const jt=()=>(r()-.5)*2.4*j, off=(r()-.5)*Math.min(L*.07,7)*j;
 const mx=(x1+x2)/2+nx*off,my=(y1+y2)/2+ny*off;
 let s=`<path d="M${f2(x1+jt())} ${f2(y1+jt())}Q${f2(mx)} ${f2(my)} ${f2(x2+jt())} ${f2(y2+jt())}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" ${o.op!=null?`opacity="${o.op}"`:''}/>`;
 return s}
function smooth(pts,closed=true){const n=pts.length;let d=`M${f2(pts[0][0])} ${f2(pts[0][1])}`;
 const last=closed?n:n-1;for(let i=0;i<last;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
  const a=closed||i>0?p0:p1,b=closed||i<n-2?p3:p2;
  d+=`C${f2(p1[0]+(p2[0]-a[0])/6)} ${f2(p1[1]+(p2[1]-a[1])/6)} ${f2(p2[0]-(b[0]-p1[0])/6)} ${f2(p2[1]-(b[1]-p1[1])/6)} ${f2(p2[0])} ${f2(p2[1])}`}
 return d+(closed?'Z':'')}
function blob(pts,o={}){const r=R(),j=o.j??1.6;const q=pts.map(([x,y])=>[x+(r()-.5)*2*j,y+(r()-.5)*2*j]);
 return `<path d="${o.sharp?'M'+q.map(p=>f2(p[0])+' '+f2(p[1])).join('L')+'Z':smooth(q)}" fill="${o.f??'none'}" stroke="${o.c??INK}" stroke-width="${o.w??6}" stroke-linejoin="round" ${o.op!=null?`opacity="${o.op}"`:''}/>`}
function ell(cx,cy,rx,ry,o={}){const n=o.n??16,rot=(o.rot??0)*D2R,pts=[];
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2;const x=Math.cos(a)*rx,y=Math.sin(a)*ry;pts.push([cx+x*Math.cos(rot)-y*Math.sin(rot),cy+x*Math.sin(rot)+y*Math.cos(rot)])}
 return blob(pts,{j:(o.j??1)*Math.min(2.2,Math.max(rx,ry)*.05),...o})}
const circ=(cx,cy,r,o={})=>ell(cx,cy,r,r,o);
function rect(x,y,w,h,o={}){return blob([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],{sharp:true,j:1.4,...o})}
function txt(x,y,s,o={}){return `<text x="${f2(x)}" y="${f2(y)}" font-family="${o.font??'Caveat'}" font-weight="${o.fw??700}" font-size="${o.fs??40}" fill="${o.f??INK}" text-anchor="${o.a??'middle'}" ${o.stroke?`stroke="${o.stroke}" stroke-width="${o.sw??6}" paint-order="stroke fill" stroke-linejoin="round"`:''} ${o.rot!=null?`transform="rotate(${o.rot} ${f2(x)} ${f2(y)})"`:''} ${o.op!=null?`opacity="${o.op}"`:''}>${s}</text>`}
const g=(s,tr,op)=>`<g${tr?` transform="${tr}"`:''}${op!=null?` opacity="${op}"`:''}>${s}</g>`;
function star(cx,cy,r,o={}){const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5+(o.rot??0),rr=i%2?r*.45:r;p.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr])}
 return blob(p,{sharp:true,j:.8,f:o.f??GOLD,w:o.w??4})}
function burst(cx,cy,r,label,t,t0,t1,o={}){if(t<t0||t>t1+.25)return'';const s=t<t0+.28?EASE.back(seg(t,t0,t0+.28,'l')):1;const op=t>t1?1-seg(t,t1,t1+.25,'l'):1;
 const p=[];const n=14;for(let i=0;i<n*2;i++){const a=i/(n*2)*Math.PI*2,rr=i%2?r*.68:r;p.push([Math.cos(a)*rr*1.25,Math.sin(a)*rr])}
 return g(blob(p,{sharp:true,j:3,f:o.f??GOLD,w:6})+txt(0,o.fs?o.fs*.36:18,label,{font:'Mont',fw:900,fs:o.fs??52,f:o.tc??RED,stroke:'#fff',sw:8}),`translate(${cx} ${cy}) rotate(${o.rot??-8}) scale(${s})`,op)}
function dust(cx,cy,t,t0,o={}){const u=(t-t0)/(o.d??.9);if(u<0||u>1)return'';const r=R();let s='';
 for(let i=0;i<(o.n??6);i++){const a=Math.PI+i/((o.n??6)-1)*Math.PI;const d=(o.sp??90)*EASE.o(u);s+=circ(cx+Math.cos(a)*d*1.4+(r()-.5)*10,cy+Math.sin(a)*d*.35-8,(o.r??26)*(1-u*.4),{f:'#E9E2D2',w:4,op:1-u})}return s}
function sweat(x,y,s=1){return blob([[x,y-14*s],[x+8*s,y+2*s],[x,y+10*s],[x-8*s,y+2*s]],{f:'#7CCBFF',w:3.5,j:.6})}
function note(x,y,s=1){return ell(x,y,9*s,7*s,{f:INK,w:3,rot:-20})+line(x+8*s,y,x+8*s,y-34*s,{w:4})+line(x+8*s,y-34*s,x+20*s,y-24*s,{w:4})}
function zip(x,y,len,n=3,o={}){let s='';for(let i=0;i<n;i++)s+=line(x,y+i*(o.gap??22),x+len*(1-i*.18),y+i*(o.gap??22),{w:o.w??5,c:o.c??INK,op:.75});return s}

/* ---------- stickman ---------- */
const BASE={x:0,y:0,lean:0,head:0,lua:-16,lfa:-8,rua:16,rfa:8,lth:-9,lsh:-4,rth:9,rsh:4,face:1,expr:'normal',sc:1};
const dv=a=>[Math.sin(a*D2R),Math.cos(a*D2R)];
function joints(p){const s=p.sc,T=100*s,UA=56*s,FA=52*s,TH=68*s,SH=66*s,HR=33*s;const hip=[p.x,p.y];
 const up=[Math.sin(p.lean*D2R),-Math.cos(p.lean*D2R)];const neck=[hip[0]+up[0]*T,hip[1]+up[1]*T];
 const sh=[hip[0]+up[0]*(T-10*s),hip[1]+up[1]*(T-10*s)];const ha=p.lean+p.head;
 const hc=[neck[0]+Math.sin(ha*D2R)*(HR+3*s),neck[1]-Math.cos(ha*D2R)*(HR+3*s)];
 const L=(o,a,l)=>[o[0]+dv(a)[0]*l,o[1]+dv(a)[1]*l];
 const le=L(sh,p.lua,UA),lh=L(le,p.lfa,FA),re=L(sh,p.rua,UA),rh=L(re,p.rfa,FA);
 const lk=L(hip,p.lth,TH),lf=L(lk,p.lsh,SH),rk=L(hip,p.rth,TH),rf=L(rk,p.rsh,SH);
 return{s,T,HR,hip,up,neck,sh,ha,hc,le,lh,re,rh,lk,lf,rk,rf}}
function face(J,p,t){const{hc,HR,s}=J,f=p.face,fx=f*7*s,e=p.expr;let o='';const ey=-5*s,ex1=fx-11*s,ex2=fx+11*s;
 const dot=(x,y,r=4.6)=>circ(x,y,r*s,{f:INK,w:0,n:8,j:.2});
 const W4={w:4.5*s};
 if(e==='blank'){o+=line(fx-9*s,16*s,fx+9*s,16*s,W4)}
 else if(e==='smug'){o+=line(ex1-6*s,ey,ex1+5*s,ey+1*s,W4)+line(ex2-5*s,ey+1*s,ex2+6*s,ey,W4)+line(ex1-7*s,ey-9*s,ex1+5*s,ey-12*s,{w:3.5*s})+line(ex2-5*s,ey-12*s,ex2+7*s,ey-9*s,{w:3.5*s});
  o+=`<path d="M${f2(hc[0]+fx-10*s)} ${f2(hc[1]+12*s)}Q${f2(hc[0]+fx+2*s)} ${f2(hc[1]+17*s)} ${f2(hc[0]+fx+12*s)} ${f2(hc[1]+6*s)}" stroke="${INK}" stroke-width="${4.5*s}" fill="none" stroke-linecap="round" transform="translate(${-hc[0]} ${-hc[1]})"/>`}
 else if(e==='happy'){for(const ex of[ex1,ex2])o+=`<path d="M${f2(ex-6*s)} ${f2(ey+2*s)}Q${f2(ex)} ${f2(ey-8*s)} ${f2(ex+6*s)} ${f2(ey+2*s)}" stroke="${INK}" stroke-width="${4.5*s}" fill="none" stroke-linecap="round"/>`;
  o+=`<path d="M${f2(fx-13*s)} ${f2(6*s)}Q${f2(fx)} ${f2(28*s)} ${f2(fx+13*s)} ${f2(6*s)}Z" fill="${INK}" stroke="${INK}" stroke-width="${3*s}" stroke-linejoin="round"/>`+`<path d="M${f2(fx-6*s)} ${f2(17*s)}Q${f2(fx)} ${f2(13*s)} ${f2(fx+6*s)} ${f2(17*s)}" fill="#F2727F"/>`}
 else if(e==='shock'||e==='scream'){for(const ex of[ex1,ex2])o+=circ(ex,ey-2*s,7.5*s,{f:'#fff',w:3.2*s,n:10,j:.3})+dot(ex+f*1.5*s,ey-2*s,3.3);
  o+=e==='scream'?ell(fx,17*s,10*s,13*s,{f:INK,w:2,j:.3}):ell(fx,16*s,6*s,8*s,{f:INK,w:2,j:.3})}
 else if(e==='worry'||e==='sad'){o+=dot(ex1,ey)+dot(ex2,ey)+line(ex1-7*s,ey-8*s,ex1+5*s,ey-13*s,{w:3.5*s})+line(ex2-5*s,ey-13*s,ex2+7*s,ey-8*s,{w:3.5*s});
  o+=e==='sad'?`<path d="M${f2(fx-9*s)} ${f2(17*s)}Q${f2(fx)} ${f2(8*s)} ${f2(fx+9*s)} ${f2(17*s)}" stroke="${INK}" stroke-width="${4.5*s}" fill="none" stroke-linecap="round"/>`:
  `<path d="M${f2(fx-11*s)} ${f2(14*s)}q${f2(5.5*s)} ${f2(-5*s)} ${f2(11*s)} 0t${f2(11*s)} 0" stroke="${INK}" stroke-width="${4*s}" fill="none" stroke-linecap="round"/>`}
 else if(e==='dizzy'){for(const ex of[ex1,ex2])o+=line(ex-5*s,ey-5*s,ex+5*s,ey+5*s,{w:4*s})+line(ex-5*s,ey+5*s,ex+5*s,ey-5*s,{w:4*s});
  o+=`<path d="M${f2(fx-11*s)} ${f2(14*s)}q${f2(5.5*s)} ${f2(-5*s)} ${f2(11*s)} 0t${f2(11*s)} 0" stroke="${INK}" stroke-width="${4*s}" fill="none" stroke-linecap="round"/>`}
 else if(e==='strain'||e==='angry'){if(e==='strain'){o+=line(ex1-5*s,ey-5*s,ex1+4*s,ey,W4)+line(ex1+4*s,ey,ex1-5*s,ey+5*s,W4)+line(ex2+5*s,ey-5*s,ex2-4*s,ey,W4)+line(ex2-4*s,ey,ex2+5*s,ey+5*s,W4)}
  else{o+=dot(ex1,ey+1*s)+dot(ex2,ey+1*s)+line(ex1-7*s,ey-11*s,ex1+6*s,ey-5*s,{w:4.5*s})+line(ex2-6*s,ey-5*s,ex2+7*s,ey-11*s,{w:4.5*s})}
  o+=rect(fx-11*s,10*s,22*s,10*s,{f:'#fff',w:3.5*s,j:.4})+line(fx-4*s,10*s,fx-4*s,20*s,{w:2.5*s})+line(fx+4*s,10*s,fx+4*s,20*s,{w:2.5*s})}
 else{o+=dot(ex1,ey)+dot(ex2,ey)+`<path d="M${f2(fx-8*s)} ${f2(10*s)}Q${f2(fx)} ${f2(17*s)} ${f2(fx+8*s)} ${f2(10*s)}" stroke="${INK}" stroke-width="${4.5*s}" fill="none" stroke-linecap="round"/>`}
 return g(o,`translate(${f2(hc[0])} ${f2(hc[1])}) rotate(${f2(J.ha)})`)}
function helmet(J,p,o){const{hc,HR,s}=J;const d=(o.drop||0)*34*s-13*s;const c=o.hc??'#AEB7C1';let h='';
 const pts=[];for(let i=0;i<=12;i++){const a=Math.PI+i/12*Math.PI;pts.push([Math.cos(a)*(HR+5*s),Math.sin(a)*(HR+5*s)-2*s])}
 pts.push([HR+9*s,4*s]);pts.push([-HR-9*s,4*s]);
 h+=`<path d="M${pts.map(q=>f2(q[0])+' '+f2(q[1])).join('L')}Z" fill="${c}" stroke="${INK}" stroke-width="${5*s}" stroke-linejoin="round"/>`;
 h+=line(-HR-10*s,4*s,HR+10*s,4*s,{w:6*s});
 if(o.crest!==false){const cr=o.crestC??RED,cw=(o.crestW??.9)*HR,chh=(o.crestH??34)*s;
  h+=`<path d="M${f2(-cw)} ${f2(-HR-2*s)}Q${f2(-cw*.6)} ${f2(-HR-chh*1.35)} 0 ${f2(-HR-chh*1.3)}Q${f2(cw*.6)} ${f2(-HR-chh*1.35)} ${f2(cw)} ${f2(-HR-2*s)}Z" fill="${cr}" stroke="${INK}" stroke-width="${4.5*s}" stroke-linejoin="round"/>`;
  for(let i=-3;i<=3;i++)h+=line(i*cw/4,-HR-4*s,i*cw/4*1.05,-HR-chh*(1.2-Math.abs(i)*.09),{w:2.4*s,c:'#7a0f1d'})}
 return g(h,`translate(${f2(hc[0])} ${f2(hc[1]+d)}) rotate(${f2(J.ha)})`)}
function toga(J,p){const{hip,neck,s}=J;const pts=[[neck[0]-24*s,neck[1]+14*s],[neck[0]+22*s,neck[1]+10*s],[hip[0]+30*s,hip[1]+4*s],[hip[0]+40*s,hip[1]+78*s],[hip[0]-38*s,hip[1]+80*s],[hip[0]-30*s,hip[1]+4*s]];
 return blob(pts,{f:'#FFFDF7',w:5*s,j:1.2})+line(neck[0]-20*s,neck[1]+16*s,hip[0]+30*s,hip[1]+14*s,{w:9*s,c:'#7B3FA0'})+line(hip[0]-30*s,hip[1]+40*s,hip[0]+34*s,hip[1]+40*s,{w:3*s,c:'#c9c2b0'})}
function stick(p,o={}){p={...BASE,...p};const J=joints(p);const W=9*J.s;let s='';
 const foot=(f,k)=>line(f[0],f[1],f[0]+p.face*15*J.s,f[1]+2*J.s,{w:W});
 if(o.behind)s+=o.behind(J,p);
 s+=line(...J.hip,...J.lk,{w:W})+line(...J.lk,...J.lf,{w:W})+foot(J.lf)+line(...J.hip,...J.rk,{w:W})+line(...J.rk,...J.rf,{w:W})+foot(J.rf);
 s+=line(...J.hip,...J.neck,{w:W});
 if(o.toga)s+=toga(J,p);
 if(o.backArm)s+=o.backArm(J,p);
 s+=line(...J.sh,...J.le,{w:W})+line(...J.le,...J.lh,{w:W})+line(...J.sh,...J.re,{w:W})+line(...J.re,...J.rh,{w:W});
 if(o.beard)s+=o.beard(J,p);
 s+=circ(...J.hc,J.HR,{f:'#fff',w:7*J.s,n:18});
 if(!o.noFace)s+=face(J,p);
 if(o.helmet)s+=helmet(J,p,o.helmet);
 if(o.front)s+=o.front(J,p);
 return s}
function walk(ph,amp=1,f=1){const s=Math.sin(ph),c=Math.cos(ph);const th1=26*s*amp,th2=-26*s*amp;
 return{lth:th1*f,lsh:(th1-38*Math.max(0,c)*amp)*f,rth:th2*f,rsh:(th2-38*Math.max(0,-c)*amp)*f,lua:-22*s*amp*f,lfa:(-22*s*amp+18*amp)*f,rua:22*s*amp*f,rfa:(22*s*amp+18*amp)*f,bob:-Math.abs(c)*6*amp}}
function run(ph,f=1){const s=Math.sin(ph),c=Math.cos(ph);const th1=46*s,th2=-46*s;
 return{lth:th1*f,lsh:(th1-70*Math.max(0,c))*f,rth:th2*f,rsh:(th2-70*Math.max(0,-c))*f,lua:-55*s*f,lfa:(-55*s+70)*f,rua:55*s*f,rfa:(55*s+70)*f,bob:-Math.abs(c)*14,lean:14*f}}
const HIPY=G-132;

/* ---------- props ---------- */
function sword(x,y,a,len=62,o={}){const d=dv(a);const ex=x+d[0]*len,ey=y+d[1]*len;const n=[-d[1],d[0]];
 return line(x-d[0]*10,y-d[1]*10,x+d[0]*4,y+d[1]*4,{w:9,c:'#6b4a2b'})+line(x+n[0]*13+d[0]*5,y+n[1]*13+d[1]*5,x-n[0]*13+d[0]*5,y-n[1]*13+d[1]*5,{w:7})+
  blob([[x+d[0]*6+n[0]*7,y+d[1]*6+n[1]*7],[ex+n[0]*4,ey+n[1]*4],[ex+d[0]*12,ey+d[1]*12],[ex-n[0]*4,ey-n[1]*4],[x+d[0]*6-n[0]*7,y+d[1]*6-n[1]*7]],{sharp:true,f:'#DDE3E8',w:4,j:.6})}
function scutum(x,y,o={}){return g(blob([[-34,-52],[34,-52],[38,0],[34,52],[-34,52],[-38,0]],{f:RED,w:6,j:1.4})+line(-34,0,34,0,{w:4,c:'#F4C542'})+line(0,-48,0,48,{w:4,c:'#F4C542'})+circ(0,0,12,{f:'#F4C542',w:4}),`translate(${f2(x)} ${f2(y)}) rotate(${o.rot??0}) scale(${o.sc??1})`)}
function rshield(x,y,r=40){return circ(x,y,r,{f:'#C98A3B',w:6})+circ(x,y,r*.62,{w:3,c:'#7a4f1d'})+circ(x,y,r*.25,{f:'#F4C542',w:4})}
function laurel(cx,cy,rx,ry,part='all'){let s='';const n=16;
 const arc=(a0,a1)=>{const pts=[];for(let i=0;i<=10;i++){const a=a0+(a1-a0)*i/10;pts.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry])}return `<path d="${smooth(pts,false)}" stroke="#2F7D32" stroke-width="7" fill="none" stroke-linecap="round"/>`};
 const want=a=>part==='all'||(part==='back'?Math.sin(a)<0:Math.sin(a)>=0);
 if(part!=='front')s+=arc(Math.PI,2*Math.PI);if(part!=='back')s+=arc(0,Math.PI);
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2+.1;if(!want(a))continue;const x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;s+=ell(x,y-3,11,6,{f:'#5DBB4A',w:3,rot:Math.cos(a)*40+(i%2?25:-25),n:10,j:.4})}
 return s}
function slipper(x,y,a){return g(ell(0,0,30,14,{f:'#FF8FB1',w:5})+`<path d="M-6 -12Q8 -22 22 -6" stroke="${INK}" stroke-width="5" fill="#FFC6D6"/>`+circ(10,-12,5,{f:'#fff',w:3}),`translate(${f2(x)} ${f2(y)}) rotate(${a})`)}
function sign(x,y,label,o={}){return line(x,y,x,y-(o.h??70),{w:7,c:'#6b4a2b'})+rect(x-(o.w??70)/2,y-(o.h??70)-(o.bh??52),(o.w??70),(o.bh??52),{f:'#F3D9A4',w:5})+txt(x,y-(o.h??70)-(o.bh??52)/2+14,label,{fs:o.fs??40})}

/* ---------- backgrounds ---------- */
function sky(c1,c2){return `<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#sk)"/>`}
function ground(c='#E8C987',y=G){return blob([[-20,y],[W+20,y],[W+20,H+20],[-20,H+20]],{sharp:true,f:c,w:7,j:2})}
function cloud(x,y,s=1){return blob([[x-60*s,y+10*s],[x-50*s,y-14*s],[x-20*s,y-26*s],[x+12*s,y-30*s],[x+42*s,y-18*s],[x+62*s,y+4*s],[x+40*s,y+16*s],[x-30*s,y+18*s]],{f:'#fff',w:5,j:2})}
function hills(off=0,c='#A7D58C',y=G-10){let p=[[-20,H]];for(let x=-60;x<=W+80;x+=40){const xx=x-(off%240);p.push([xx,y-60-Math.sin((x+ (Math.floor(off/240)*240))*0.026)*28-Math.sin(x*.011)*20])}p.push([W+60,H]);return blob(p,{sharp:true,f:c,w:6,j:1.5})}
function column(x,yb,h,w=86,o={}){let s='';s+=rect(x-w/2-10,yb-22,w+20,22,{f:'#F4EFE6',w:5});s+=rect(x-w/2,yb-h+30,w,h-52,{f:'#FBF8F2',w:5});
 for(let i=1;i<4;i++)s+=line(x-w/2+i*w/4,yb-h+40,x-w/2+i*w/4,yb-30,{w:2.6,c:'#b9b1a2'});
 s+=rect(x-w/2-16,yb-h+8,w+32,24,{f:'#F4EFE6',w:5})+circ(x-w/2-10,yb-h+22,11,{f:'#F4EFE6',w:4})+circ(x+w/2+10,yb-h+22,11,{f:'#F4EFE6',w:4});return s}

/* ---------- left column content ---------- */
const CHECK=`<svg width="38" height="34" viewBox="0 0 38 34"><path d="M4 18 L14 28 L34 4" fill="none" stroke="${RED}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const NUMC=`<svg viewBox="0 0 62 62"><path d="M31 4C47 3 58 15 57 31C56 47 45 58 30 57C14 56 4 45 5 30C6 16 18 5 34 6" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></svg>`;

/* ---------- deck registry (filled by deck.js) ---------- */
const SCENES={}, LEFT={}, NOTES={}; let THEME={};
/* ---------- layout + render loop ---------- */
function leftHTML(L){
 if(L.type==='title')return `<div class="kick"><span class="pill">${L.kicker}</span></div>
<div class="title"><h1>${L.title}</h1></div>${L.sub?`<p class="sub">${L.sub}</p>`:''}
${L.chips?`<div class="chips">${L.chips.map(c=>`<span class="chip">${c}</span>`).join('')}</div>`:''}${L.who?`<p class="who">${L.who}</p>`:''}`;
 return `<div class="kick"><span class="pill">${L.kicker}</span>${L.num?`<span class="num">${NUMC}${L.num}</span>`:''}</div>
<h1><span>${L.title}</span></h1>${L.big?`<div class="fact"><b>${L.big}</b><i>${L.label||''}</i></div>`:''}<ul>${(L.bullets||[]).map(b=>`<li>${CHECK}${b}</li>`).join('')}</ul>`}
function fit(el,max){let fs=58;el.style.fontSize=fs+'px';while(el.scrollWidth>max&&fs>30){fs-=2;el.style.fontSize=fs+'px'}}
function border(){CT=0;SEED=9;return blob([[8,8],[W-8,8],[W-8,H-8],[8,H-8]],{sharp:true,w:12,j:2.5})}
let SC,capT,capB,panel;
window.render=function(t){const F=.6;SEED=Math.floor(t*8)+1;CT=0;
 let body=SC.draw(t);
 if(t>SC.D-F){CT=0;body+=g(SC.draw(0),'',seg(t,SC.D-F,SC.D,'l'))}
 panel.innerHTML=`<defs><clipPath id="cp"><rect x="8" y="8" width="${W-16}" height="${H-16}"/></clipPath></defs><g clip-path="url(#cp)">${body}</g>`+border();
 const bv=SC.bot&&t>=SC.botAt&&t<SC.D-F*.8;const pop=bv?EASE.back(seg(t,SC.botAt,SC.botAt+.25,'l')):0;
 capB.style.opacity=bv?1:0;capB.style.transform=`scale(${.6+.4*pop})`;};
window.deckMeta=()=>({title:DECK_TITLE,slides:Object.keys(SCENES).map(Number).sort((a,b)=>a-b).map(n=>({n,D:SCENES[n].D,notes:NOTES[n]||'',poster:SCENES[n].poster??.6}))});
let DECK_TITLE='deck';
if(!window.CINEMA)window.ready=new Promise((res,rej)=>{const q=new URLSearchParams(location.search);const N=+(q.get('s')||1);
 const sc=document.createElement('script');sc.src=q.get('deck');sc.onerror=()=>rej(new Error('deck not found: '+q.get('deck')));
 sc.onload=async()=>{for(const[k,v]of Object.entries(THEME))document.documentElement.style.setProperty('--'+k,v);
  if(THEME.accent)RED=THEME.accent;
  document.getElementById('left').innerHTML=leftHTML(LEFT[N]);SC=SCENES[N];
  capT=document.getElementById('capTop');capB=document.getElementById('capBot');panel=document.getElementById('panel');
  capT.textContent=SC.top||'';capB.textContent=SC.bot||'';await document.fonts.ready;fit(capT,780);fit(capB,780);render(0);res(SC.D)};
 document.head.appendChild(sc)});
