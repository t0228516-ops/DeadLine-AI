/* Example deck: «Рим империясы» (history, Kazakh, 6 slides).
   A deck = THEME + per-slide LEFT (text column), SCENES (comic panel animation), NOTES (speaker notes).
   Everything else (stick(), walk(), burst(), sky()...) comes from engine/engine.js. */
DECK_TITLE='Рим империясы';
THEME={accent:'#D7263D',paper:'#FFFBF1',hl:'#FFE45C',note:'#FFF1A6'};

LEFT[1]={type:'title',kicker:'ТАРИХ · БАЯНДАМА',title:'<span>Рим</span><br>империясы',
 sub:'Шағын қаладан әлемдік державаға дейін — және кері қарай',chips:['б.з.д. 753','→ б.з. 476'],who:'Дайындаған: ____________________'};
LEFT[2]={kicker:'РИМ ИМПЕРИЯСЫ',num:'02',title:'Рим бір күнде салынған жоқ',big:'б.з.д. 753',label:'аңыз бойынша Рим қаласы негізделген жыл',bullets:[
 'Аңыз бойынша қаланы <b>Ромул</b> негіздеген — оны ағасы Реммен бірге қаншық қасқыр асыраған.',
 'Б.з.д. <b>509 жылы</b> римдіктер патшаны қуып, <b>республика</b> құрды: билік сенат пен консулдарда болды.',
 'Шағын қала бірнеше ғасыр бойы көршілерін жаулап, <b>бүкіл Италияны</b> бағындырды.']};
LEFT[3]={kicker:'РИМ ИМПЕРИЯСЫ',num:'03',title:'Республикадан — империяға',big:'б.з.д. 27',label:'Октавиан тұңғыш император болып, «Август» атанды',bullets:[
 '<b>Юлий Цезарь</b> — ұлы қолбасшы; б.з.д. 44 жылы сенатта қастандықпен өлтірілді.',
 'Август тұсында <b>«Рим бейбітшілігі»</b> басталды — 200 жылға жуық тыныш кезең.',
 '117 жылы <b>Траян</b> тұсында империя ең үлкен көлемге жетті — шамамен 5 млн км².']};
LEFT[4]={kicker:'РИМ ИМПЕРИЯСЫ',num:'04',title:'Легион — империяның тірегі',big:'30 км',label:'легионер бір күнде жүріп өтетін жол',bullets:[
 'Бір легионда <b>5 мыңға жуық</b> жауынгер болған.',
 'Әр легионер қару мен азығын қоса <b>30 кг-ға жуық</b> жүк көтерген.',
 'Римдіктер <b>80 мың км-ден астам</b> тас жол салды — кейбірі әлі күнге дейін бар.']};
LEFT[5]={kicker:'РИМ ИМПЕРИЯСЫ',num:'05',title:'Нан мен ойын-сауық',big:'50 000',label:'Колизейге сыйған көрермен саны',bullets:[
 'Колизей б.з. <b>80 жылы</b> ашылды: онда гладиаторлар жекпе-жегі мен аңдармен айқас өтті.',
 'Билеушілер халыққа <b>тегін нан</b> үлестіріп, ойын-сауық ұйымдастырған — наразылықтың алдын алу үшін.',
 'Гладиаторлардың көбі <b>құлдар мен тұтқындар</b> болған; кейбірі еркіндік алып, атақты болды.']};
LEFT[6]={kicker:'РИМ ИМПЕРИЯСЫ',num:'06',title:'Құлау және мұра',big:'476',label:'Батыс Рим империясы құлаған жыл',bullets:[
 '<b>395 жылы</b> империя Батыс және Шығыс болып екіге бөлінді.',
 'Шығыс Рим — <b>Византия</b> — 1453 жылға дейін өмір сүрді.',
 'Мұрасы бүгін де қасымызда: <b>латын әліпбиі, Рим құқығы, күнтізбе</b>, арка мен күмбез.']};

NOTES[1]='Сәлеметсіздер ме! Бүгін мен Рим империясы туралы айтамын: шағын қаладан әлемдік державаға дейін және оның құлауы.';
NOTES[2]='Аңыз бойынша Римді б.з.д. 753 жылы Ромул негіздеген. Б.з.д. 509 жылы римдіктер патшаны қуып, республика құрды. Бірнеше ғасырда шағын қала бүкіл Италияны бағындырды. Рим шынымен бір күнде салынған жоқ.';
NOTES[3]='Юлий Цезарь ұлы қолбасшы болды, б.з.д. 44 жылы сенатта өлтірілді. Б.з.д. 27 жылы Октавиан тұңғыш император болып, Август атанды. Рим бейбітшілігі 200 жылға жуық созылды, ал 117 жылы Траян тұсында империя ең үлкен көлемге жетті — шамамен 5 млн км².';
NOTES[4]='Империяның тірегі — легион. Бір легионда 5 мыңға жуық жауынгер болған. Легионер күніне 30 км-ге дейін жүріп, 30 кг-ға жуық жүк көтерген. Римдіктер 80 мың км-ден астам тас жол салған.';
NOTES[5]='Колизей б.з. 80 жылы ашылды, оған 50 мыңға жуық көрермен сыйған. Билеушілер халыққа тегін нан мен ойын-сауық беріп, наразылықтың алдын алған. Гладиаторлардың көбі құлдар мен тұтқындар болған.';
NOTES[6]='395 жылы империя Батыс және Шығыс болып бөлінді. Батыс Рим 476 жылы құлады, ал Шығыс Рим — Византия — 1453 жылға дейін өмір сүрді. Римнің мұрасы бүгін де бар: латын әліпбиі, Рим құқығы, күнтізбе, арка мен күмбез. Назарларыңызға рахмет!';

/* ---------- scenes (comic panel 840×840, ground y=G=700, stand hip y=HIPY) ---------- */
/* 1 — Title: Келдім. Көрдім. Сүріндім. */
SCENES[1]={D:6.2,poster:1.3,top:'КЕЛДІМ. КӨРДІМ.',bot:'...СҮРІНДІМ.',botAt:4.25,draw(t){let s=sky('#9ED8FF','#DDF2FF');
 s+=cloud(160+t*8,140,1)+cloud(620+t*5,210,.8);
 s+=g(column(690,G-30,190,40)+column(760,G-30,190,40)+rect(660,G-250,130,26,{f:'#F4EFE6',w:4}),'',.55);
 s+=hills(0,'#B4DE97',G+12);s+=ground('#E8C987');
 for(let i=0;i<9;i++)s+=rect(-30+i*100,G+30+(i%2)*14,80,22,{f:'#D6B271',w:4});
 const P=track([[0,{x:-110,expr:'smug',drop:0,lean:-5}],[2.0,{x:300},'l'],[2.25,{lean:-8,expr:'happy'}],[2.6,{drop:0}],[3.0,{drop:1,expr:'shock'},'bounce'],[3.25,{x:300}],[4.2,{x:612},'i'],[4.55,{x:520,lean:-82},'o'],[6.2,{x:520,lean:-82}]]);
 let p=P(t);let pose={x:p.x,y:HIPY,lean:p.lean,expr:p.drop>.55?'blank':p.expr,face:1};
 if(t<2.0){Object.assign(pose,walk((p.x+110)/34));pose.y+=pose.bob;pose.lean=-6}
 else if(t<2.6){const u=seg(t,2.0,2.3);Object.assign(pose,{rua:lerp(16,150,u),rfa:lerp(8,215,u),lua:-16,lfa:-8})}
 else if(t<3.25){const u=seg(t,2.6,3.2);Object.assign(pose,{rua:lerp(150,80,u),rfa:lerp(215,92,u),lua:lerp(-16,70,u),lfa:lerp(-8,95,u)});if(p.drop>.55)pose.expr='scream'}
 else if(t<4.2){Object.assign(pose,walk((p.x-300)/26,.8));pose.y+=pose.bob;Object.assign(pose,{rua:78,rfa:92,lua:66,lfa:95,expr:'scream'})}
 else{const u=seg(t,4.2,4.6,'o');pose.y=lerp(HIPY,G-24,EASE.bounce(clamp((t-4.2)/.5,0,1)));Object.assign(pose,{lua:lerp(70,150,u),lfa:lerp(95,200,u),rua:lerp(80,120,u),rfa:lerp(92,160,u),lth:lerp(-9,125+Math.sin(t*14)*8,u),lsh:lerp(-4,160,u),rth:lerp(9,150-Math.sin(t*14)*8,u),rsh:lerp(4,175,u),expr:'scream'})}
 s+=stick(pose,{helmet:{drop:p.drop},front:(J)=>t<2.6||t>4.2?scutum(J.lh[0]+6,J.lh[1]-4,{rot:t>4.2?-70:0,sc:.82}):''});
 if(t>4.2){const J=joints({...BASE,...pose});for(let i=0;i<3;i++){const a=t*5+i*2.09;s+=star(J.hc[0]+Math.cos(a)*55,J.hc[1]-50+Math.sin(a)*16,15,{rot:t*3})}}
 s+=burst(735,330,95,'БАМ!',t,4.2,5.6,{rot:10});
 if(t>4.18&&t<4.5)s+=line(W-14,250,W-14,560,{w:10,c:RED,op:.6});
 return s}};
/* 2 — Рим бір күнде салынбаған */
SCENES[2]={D:6.3,top:'РИМ БІР КҮНДЕ',bot:'САЛЫНБАҒАН',botAt:1.6,draw(t){
 const k=Math.max(0,Math.min(t,4.0)-0.8)*2.4;const night=t>0.8&&t<4.0?(1-Math.cos(2*Math.PI*k))/2:0;
 let s=sky(lerpC('#9ED8FF','#1B2350',night),lerpC('#E4F5FF','#3B3F7A',night));
 if(night>.3)for(let i=0;i<14;i++){const r=R();s+=star(40+r()*760,120+r()*260,6,{w:2,f:'#FFF6C8'})}
 const ang=Math.PI*((k%1));s+=t>0.8&&t<4?circ(420-Math.cos(ang)*380,500-Math.sin(ang)*330,34,{f:night>.5?'#F4F1DE':'#FFD23F',w:5}):circ(150,170,40,{f:'#FFD23F',w:5});
 s+=hills(0,lerpC('#B4DE97','#3E5A4C',night),G+10);s+=ground(lerpC('#E8C987','#6E6250',night));
 const prog=t<0.8?0.06:t<4.0?.06+.94*Math.pow(seg(t,.8,4.0,'l'),.8):1;const total=36,n=Math.floor(prog*total);
 for(let i=0;i<n;i++){const row=Math.floor(i/4),col=i%4;const bx=470+col*74+(row%2?-37:0),by=G-36-row*36;if(bx<450){s+=rect(470+(row%2?259:0)-37+ (row%2?0:0),by,36,34,{f:'#C8553D',w:4});continue}s+=rect(bx,by,72,34,{f:'#C8553D',w:4})}
 for(let r=1;r<9;r++)if(r*4<n&&r%2)s+=rect(470+4*74-37,G-36-r*36,36,34,{f:'#C8553D',w:4});
 const dayN=t<0.8?1:t<4?1+Math.round(Math.pow(seg(t,.8,4,'l'),2.2)*3649):3650;
 s+=sign(110,G+8,'КҮН: '+dayN,{w:190,bh:60,h:60,fs:40});
 let pose={x:330,y:HIPY,face:1,expr:'strain',lean:4};
 if(t<4.0){const ph=t>0.8?t*2*Math.PI*4.5:t*2*Math.PI*1.2;const w=(Math.sin(ph)+1)/2;Object.assign(pose,{rua:lerp(60,125,w),rfa:lerp(80,160,w),lua:30,lfa:70,y:HIPY+Math.sin(ph)*2})}
 else if(t<4.75){const u=seg(t,4.0,4.4);Object.assign(pose,{x:lerp(330,300,u),lean:lerp(4,-6,u),expr:'happy',rua:lerp(90,150,u),rfa:lerp(120,250,u),lua:-16,lfa:-8})}
 else{Object.assign(pose,{x:300,lean:-6,expr:t>4.95?'dizzy':'happy',rua:20,rfa:20,lua:-20,lfa:-20});if(t>4.95)pose.y=HIPY+8}
 const beardL=t<0.8?0:t<4?170*seg(t,.8,4,'o'):170;
 s+=stick(pose,{beard:(J)=>beardL<2?'':blob([[J.hc[0]-6,J.hc[1]+22],[J.hc[0]+28,J.hc[1]+18],[J.hc[0]+40+Math.sin(t*3)*4,J.hc[1]+22+beardL*.55],[J.hc[0]+34+Math.sin(t*4)*8,J.hc[1]+26+beardL],[J.hc[0]+14,J.hc[1]+20+beardL*.5]],{f:'#9E9E9E',w:4.5}),
  front:(J)=>t<4?blob([[J.rh[0],J.rh[1]],[J.rh[0]+26,J.rh[1]-8],[J.rh[0]+20,J.rh[1]+16]],{sharp:true,f:'#B9C2CB',w:4}):''});
 if(t>4.55){const J=joints({...BASE,...pose});const u=seg(t,4.55,4.95,'i');const by=lerp(-80,J.hc[1]-J.HR-30,u);
  if(t<4.95)s+=rect(J.hc[0]-36,by,72,34,{f:'#C8553D',w:4});else{const v=seg(t,4.95,5.6,'o');s+=g(rect(-36,-17,72,34,{f:'#C8553D',w:4}),`translate(${J.hc[0]+v*130} ${lerp(J.hc[1]-J.HR-13,G-17,EASE.bounce(v))}) rotate(${v*200})`)}
  if(t>4.95)for(let i=0;i<3;i++){const a=t*5+i*2.09;s+=star(J.hc[0]+Math.cos(a)*55,J.hc[1]-46+Math.sin(a)*16,14,{rot:t*3})}}
 s+=burst(560,250,82,'ТЫҚ!',t,4.95,5.7,{rot:-6,fs:46});
 return s}};
/* 3 — Император және үлкен гүлтәж */
SCENES[3]={D:6.2,top:'МЕН — ИМПЕРАТОРМЫН!',bot:'ГҮЛТӘЖ СӘЛ ҮЛКЕН ЕКЕН',botAt:1.95,draw(t){let s=`<rect x="0" y="0" width="${W}" height="${H}" fill="#FCEBD6"/>`;
 s+=`<path d="M0 0H${W}V60Q${W*.75} 130 ${W/2} 70Q${W*.25} 130 0 60Z" fill="#B3213A" stroke="${INK}" stroke-width="6"/>`;
 s+=column(95,G,520)+column(745,G,520);
 s+=ground('#E7DCCB');for(let i=0;i<10;i++)s+=line(i*96-20,G,i*96-80,H,{w:3,c:'#c9bba6'});
 let hula=t>2.2&&t<4.6;const ph=(t-2.2)*2*Math.PI*2.3;const sway=hula?Math.sin(ph):0;
 let pose={x:420+sway*20,y:HIPY,lean:-sway*7,face:0,expr:'smug'};
 if(t<1.0)Object.assign(pose,{rua:150,rfa:212,lua:-150,lfa:-212,y:HIPY+Math.sin(t*6)*2});
 else if(t<1.5){const u=seg(t,1.0,1.4);Object.assign(pose,{rua:lerp(150,120,u),rfa:lerp(212,205,u),lua:lerp(-150,-120,u),lfa:lerp(-212,-205,u)})}
 else if(t<2.2){const u=seg(t,1.5,1.8);Object.assign(pose,{rua:lerp(120,30,u),rfa:lerp(205,40,u),lua:lerp(-120,-30,u),lfa:lerp(-205,-40,u),expr:t>1.75?'shock':'smug',head:0})}
 else if(hula){const w=Math.sin(t*12);Object.assign(pose,{rua:150+w*10,rfa:165+w*14,lua:-150-w*10,lfa:-165-w*14,expr:'happy'})}
 else{Object.assign(pose,{rua:22,rfa:18,lua:-22,lfa:-18,expr:t>4.85?'smug':'shock'})}
 const J=joints({...BASE,...pose});
 let lc,lrx=56,lry=13;
 if(t<1.4){lc=[(J.lh[0]+J.rh[0])/2,Math.min(J.lh[1],J.rh[1])+6];if(t>1.0)lc=[J.hc[0],lerp(lc[1],J.hc[1]-J.HR+4,seg(t,1.0,1.4))]}
 else if(t<2.2){const u=EASE.bounce(seg(t,1.4,2.0,'l'));lc=[J.hc[0],lerp(J.hc[1]-J.HR+4,J.hip[1]-14,u)];lrx=lerp(56,64,u)}
 else if(hula){lc=[J.hip[0]-sway*30,J.hip[1]-14+Math.cos(ph)*3];lrx=64;lry=13}
 else{const u=EASE.bounce(seg(t,4.6,5.1,'l'));lc=[lerp(J.hip[0],420,u),lerp(J.hip[1]-14,G-4,u)];lrx=64;lry=lerp(13,15,u)}
 s+=laurel(lc[0],lc[1],lrx,lry,'back');
 s+=stick(pose,{toga:true});
 s+=laurel(lc[0],lc[1],lrx,lry,'front');
 if(hula){for(let i=0;i<3;i++){const u=((t-2.2)*.7+i/3)%1;s+=g(note(650+i*30,420-u*260,1.1),'',1-u)}
  s+=line(lc[0]-lrx-30,lc[1]-10,lc[0]-lrx-12,lc[1]-4,{w:4})+line(lc[0]+lrx+12,lc[1]-4,lc[0]+lrx+30,lc[1]-10,{w:4})}
 if(t>1.75&&t<2.3)s+=burst(610,330,70,'ОЙ!',t,1.8,2.2,{fs:48});
 return s}};
/* 4 — Легион: 30 км */
SCENES[4]={D:6.4,top:'КҮНІНЕ 30 КМ ЖҮРІС',bot:'+ 30 КГ ЖҮК',botAt:1.6,draw(t){let s=sky('#A6DBFF','#E8F6FF');
 const tw=Math.min(t,4.3);const dist=tw*190-tw*tw*9;
 s+=cloud(700-dist*.08,130,1)+cloud(250-dist*.08,200,.7);
 s+=hills(dist*.35,'#BFE2A2',G-20);s+=hills(dist*.6+120,'#A2D383',G+18);s+=ground('#E2C27F');
 for(let i=-1;i<12;i++){const x=i*90-(dist%90);s+=rect(x,G+26+(i%2)*10,70,20,{f:'#C9A363',w:4})}
 const nums=['I','II','III','IV','V'];for(let i=0;i<4;i++){const x=900+i*360-dist;if(x>-80&&x<W+80){s+=blob([[x-24,G+10],[x-24,G-70],[x-14,G-92],[x+14,G-92],[x+24,G-70],[x+24,G+10]],{f:'#D9D4CB',w:5,sharp:true})+txt(x,G-38,nums[i]+'',{font:'Mont',fw:900,fs:28})}}
 let pose={x:330,y:HIPY,face:1,expr:'strain'};const lean=lerp(8,22,seg(t,0,4.2,'l'));
 if(t<4.3){const ph=dist/30;Object.assign(pose,walk(ph,.9-seg(t,0,4,'l')*.25));pose.y+=pose.bob+seg(t,0,4,'l')*8;pose.lean=lean;Object.assign(pose,{rua:-20,rfa:-150,lua:-30,lfa:-150})}
 else if(t<4.75){const u=seg(t,4.3,4.75,'i');pose.expr='shock';pose.lean=lerp(lean,30,u);Object.assign(pose,{y:lerp(HIPY+8,HIPY+50,u),lth:lerp(-6,60,u),lsh:lerp(-3,-40,u),rth:lerp(6,50,u),rsh:lerp(3,-50,u),rua:-20,rfa:-150,lua:-30,lfa:-150})}
 else{const u=seg(t,4.75,4.95,'i');pose.expr='dizzy';Object.assign(pose,{lean:lerp(30,86,u),y:lerp(HIPY+50,G-20,u),lth:lerp(60,-80,u),lsh:lerp(-40,-90,u),rth:lerp(50,-95,u),rsh:lerp(-50,-100,u),rua:lerp(-20,150,u),rfa:lerp(-150,150,u),lua:lerp(-30,175,u),lfa:lerp(-150,175,u),head:lerp(0,-10,u)})}
 const J=joints({...BASE,...pose});
 const sq=t>4.75?1-seg(t,4.75,4.95)*.25:1;const swayP=Math.sin(dist/30)*3;
 const pack=(J)=>{const bx=J.sh[0]-50+(t>4.75?60:0),by=J.sh[1]+20+swayP+(t>4.75?-30:0);let o='';
  o+=line(J.sh[0]+14,J.sh[1]+4,bx-60,by-40,{w:8,c:'#6b4a2b'});
  o+=g(circ(0,0,62,{f:'#C89B62',w:6})+line(-50,-20,50,-26,{w:4,c:'#7a5a33'})+line(-44,26,52,20,{w:4,c:'#7a5a33'})+txt(0,14,'30 КГ',{font:'Mont',fw:900,fs:30,f:INK}),`translate(${f2(bx-30)} ${f2(by-50)}) scale(1 ${sq})`);
  o+=g(ell(0,0,26,18,{f:'#4a4a4a',w:5})+line(-26,-6,26,-6,{w:5}),`translate(${f2(bx-110)} ${f2(by+40)}) rotate(${swayP*4})`);
  o+=line(bx-90,by-30,bx-130,by+80,{w:6,c:'#6b4a2b'})+blob([[bx-138,by+80],[bx-118,by+80],[bx-112,by+112],[bx-146,by+112]],{sharp:true,f:'#9aa3ad',w:4});
  return o};
 s+=stick(pose,{helmet:{drop:0,crestH:24},behind:pack});
 if(t<4.3&&t>0.5){for(let i=0;i<2;i++){const u=((t*1.4)+i*.5)%1;s+=g(sweat(J.hc[0]-20-u*40,J.hc[1]-30+u*50,1),'',1-u)}}
 if(t>3.0){const u=seg(t,3.0,4.3,'l');const fx=lerp(620,J.sh[0]-100,u)+Math.sin(u*Math.PI*4)*40*(1-u),fy=lerp(150,J.sh[1]-170,u);
  s+=g(`<path d="M0 -30Q14 -6 0 30Q-14 -6 0 -30Z" fill="#fff" stroke="${INK}" stroke-width="4"/>`+line(0,-28,0,40,{w:3}),`translate(${f2(t>4.3?J.sh[0]-100+(t>4.75?40:0):fx)} ${f2(t>4.3?(t>4.75?G-140:J.sh[1]-170):fy)}) rotate(${Math.sin(u*Math.PI*4)*30-20})`)}
 if(t>4.25&&t<4.5)s+=txt(J.sh[0]-60,J.sh[1]-250,'!',{font:'Mont',fw:900,fs:80,f:RED});
 s+=dust(J.hip[0]+20,G,t,4.9,{n:7,sp:110,r:30});
 s+=burst(640,300,80,'ПЫРС!',t,4.95,5.8,{fs:44,rot:8});
 return s}};
/* 5 — Колизей: жоспар А / Б */
SCENES[5]={D:6.6,top:'ЖОСПАР А: ҚЫЛЫШ',bot:'ЖОСПАР Б: ТАПОЧКА',botAt:4.0,draw(t){let s=sky('#9ED8FF','#E2F4FF');
 s+=blob([[-20,170],[W+20,170],[W+20,G],[-20,G]],{sharp:true,f:'#F1D7AE',w:6});
 for(let r=0;r<3;r++){s+=line(-10,195+r*150,W+10,195+r*150,{w:5,c:'#B88A5A'});for(let i=0;i<9;i++){const x=30+i*95,y=215+r*150;s+=blob([[x,y+125],[x,y+45],[x+10,y+18],[x+29,y+6],[x+48,y+18],[x+58,y+45],[x+58,y+125]],{f:r===0?'#9C6B44':'#C08A5C',w:4,j:1})}}
 for(let i=0;i<22;i++){const x=10+i*38,b=Math.abs(Math.sin(t*9+i))*(t>2&&t<3.8?14:5);s+=circ(x,176-b,12,{f:['#F2C14E','#E86A5B','#7CC6FE','#9BD48A'][i%4],w:3,n:10})}
 s+=line(-10,170,W+10,170,{w:7});
 s+=ground('#EED9A9');for(let i=0;i<12;i++){const r=R();s+=circ(r()*W,G+30+r()*100,3,{f:'#c9ae74',w:0})}
 // gladiator
 let gl=null,swordState=null;
 if(t<2.4){let pose={x:260,y:HIPY,face:1,expr:'smug'};
  if(t<1.4){const f=Math.sin(t*7)>0;Object.assign(pose,f?{rua:120,rfa:205,lua:-120,lfa:-205,lean:-4}:{rua:150,rfa:170,lua:-60,lfa:-110,lean:3})}
  else if(t<2.0)Object.assign(pose,{rua:150,rfa:170,lua:-60,lfa:-110,lean:3});
  else{const u=seg(t,2.0,2.2,'o');Object.assign(pose,{expr:'scream',y:HIPY-50*Math.sin(Math.PI*seg(t,2.0,2.4,'l')),rua:150,rfa:200,lua:-150,lfa:-200,lth:-30,lsh:10,rth:30,rsh:-10})}
  gl={pose,o:{helmet:{crestH:18,crestW:.7,hc:'#D9A441',crestC:'#2F6FD6'},front:(J)=>rshield(J.lh[0]-4,J.lh[1],36)+(t<2.05?sword(J.rh[0],J.rh[1],pose.rfa,58):'')}}}
 else if(t<3.6){const x=lerp(260,-180,seg(t,2.4,3.4,'i'));let pose={x,y:HIPY,face:-1,expr:'scream',...run((t-2.4)*16,-1)};pose.y+=pose.bob;
  gl={pose,o:{helmet:{crestH:18,crestW:.7,hc:'#D9A441',crestC:'#2F6FD6'},front:(J)=>rshield(J.lh[0],J.lh[1],36)}};s+=zip(x+60,HIPY-40,90,3)}
 else if(t>4.15&&t<5.8){const x=lerp(-200,1000,seg(t,4.15,5.8,'l'));let pose={x,y:HIPY,face:1,expr:'angry',...run((t-4.1)*16,1)};pose.y+=pose.bob;pose.rua=150;pose.rfa=170;
  gl={pose,o:{helmet:{crestH:18,crestW:.7,hc:'#D9A441',crestC:'#2F6FD6'},front:(J)=>g(slipper(0,0,-30+Math.sin(t*20)*30),`translate(${f2(J.rh[0]+6)} ${f2(J.rh[1]-14)}) scale(1.6)`)}};s+=zip(x-170,HIPY-40,90,3)}
 if(t>2.0&&t<4){const u=seg(t,2.0,2.7,'l');const x=lerp(360,420,u),y=lerp(HIPY-20,G-12,EASE.bounce(u));s+=sword(x,y,lerp(160,280,u)+ (u>=1?0:0),58)}
 // lion
 let lx=null,lf=-1,scared=false,roar=false;
 if(t>1.3&&t<2.4){lx=lerp(1000,600,seg(t,1.3,2.0,'o'));roar=t>2.0}
 else if(t>=2.4&&t<3.8){lx=lerp(600,-260,seg(t,2.5,3.8,'i'))}
 else if(t>4.0&&t<5.6){lx=lerp(-160,1060,seg(t,4.0,5.6,'l'));lf=1;scared=true}
 const lion=(x,f,ph)=>{let o='';const y=G-110;const legs=[-50,-25,30,55];
  legs.forEach((dx,i)=>{const a=Math.sin(ph+(i%2?Math.PI:0))*24;o+=line(x+dx*f,y+20,x+dx*f+Math.sin(a*D2R)*60,y+20+Math.cos(a*D2R)*80,{w:12,c:'#B9772B'})});
  o+=`<path d="M${x-80*f} ${y}Q${x-140*f} ${y-30+Math.sin(ph)*12} ${x-150*f} ${y-80}" stroke="${INK}" stroke-width="7" fill="none" stroke-linecap="round"/>`+circ(x-150*f,y-84,13,{f:'#9a5a18',w:4});
  o+=ell(x,y,100,50,{f:'#F2B04B',w:6});
  const hx=x+95*f,hy=y-40;const mp=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2,rr=i%2?58:74;mp.push([hx+Math.cos(a)*rr,hy+Math.sin(a)*rr])}
  o+=blob(mp,{sharp:true,f:'#C46A1B',w:5,j:2})+circ(hx,hy,46,{f:'#F2B04B',w:6});
  if(scared){o+=circ(hx+8*f-10,hy-10,9,{f:'#fff',w:3})+circ(hx+8*f+12,hy-10,9,{f:'#fff',w:3})+circ(hx+8*f-8,hy-10,3.5,{f:INK,w:0})+circ(hx+8*f+14,hy-10,3.5,{f:INK,w:0});
   o+=ell(hx+16*f,hy+18,10,12,{f:INK,w:3})+sweat(hx-30*f,hy-48,1.2)}
  else{o+=line(hx+4*f-14,hy-16,hx+4*f-4,hy-12,{w:5})+line(hx+4*f+8,hy-12,hx+4*f+18,hy-16,{w:5})+circ(hx+4*f-8,hy-6,4.5,{f:INK,w:0})+circ(hx+4*f+13,hy-6,4.5,{f:INK,w:0});
   o+=roar?ell(hx+18*f,hy+20,18,22,{f:'#7A1020',w:5})+blob([[hx+10*f,hy+2],[hx+14*f,hy+12],[hx+18*f,hy+2]],{sharp:true,f:'#fff',w:2}):line(hx+6*f,hy+18,hx+26*f,hy+18,{w:5})}
  o+=circ(hx+30*f,hy+2,8,{f:INK,w:0});return o};
 if(lx!=null)s+=lion(lx,lf,t*14);
 if(roar&&t<2.6){for(let i=0;i<3;i++)s+=line(lx-180-i*24,G-200+i*30,lx-220-i*24,G-210+i*36,{w:6})}
 if(gl)s+=stick(gl.pose,gl.o);
 s+=burst(610,330,90,'Р-Р-Р!',t,2.0,2.6,{fs:44});
 return s}};
/* 6 — Құлау: 476 */
SCENES[6]={D:6.6,top:'476 ЖЫЛ.',bot:'ГРАВИТАЦИЯ ЖЕҢДІ',botAt:4.05,draw(t){let s=sky('#FFA766','#FFE6B8');
 s+=circ(680,400,92,{f:'#FFD45C',w:6});
 s+=g(column(120,G,260,50)+column(210,G,200,50)+rect(85,G-268,170,26,{f:'#F4EFE6',w:4}),'',.5);
 s+=ground('#D9B57A');
 const cx=420,ch=250,top=G-ch;
 // column
 const blocks=[[G-22,22],[G-90,70],[G-160,70],[G-225,60],[G-250,30]];
 if(t<2.4){s+=column(cx,G,ch,96);
  if(t>1.4){const u=seg(t,1.4,2.4,'l');const pts=[[cx-20,top+40],[cx+10,top+80],[cx-14,top+120],[cx+16,top+160],[cx-8,top+195],[cx+12,top+225]];const n=Math.max(2,Math.ceil(u*pts.length));
   s+=`<polyline points="${pts.slice(0,n).map(p=>p.join(',')).join(' ')}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`;
   for(let i=0;i<3;i++){const v=((t-1.4)*1.8+i/3)%1;s+=rect(cx-30+i*28,top+60+v*(ch-40),9,9,{f:'#ddd5c6',w:3})}}}
 else{const u=seg(t,2.4,3.1,'l');const rest=[[cx-90,G-26,-12],[cx+70,G-30,18],[cx-10,G-52,-4],[cx+110,G-18,60],[cx-140,G-14,-70]];
  blocks.forEach(([y,h],i)=>{const[rx,ry,rr]=rest[i];const x=lerp(cx,rx,EASE.o(u)),yy=lerp(y,ry,EASE.bounce(u));s+=g(rect(-46,-h/2+4,92,Math.min(h,60),{f:'#FBF8F2',w:5})+line(-20,-h/3,-20,h/4,{w:2.5,c:'#b9b1a2'})+line(14,-h/3,14,h/4,{w:2.5,c:'#b9b1a2'}),`translate(${f2(x)} ${f2(yy)}) rotate(${f2(rr*EASE.o(u))})`)});
  s+=dust(cx,G,t,2.75,{n:8,sp:150,r:34,d:1.1})}
 const fall=seg(t,4.0,4.32,'i');
 if(t<4.32){let pose={x:cx,y:top-132+fall*(G-top+120),face:1,expr:'happy'};const wv=Math.sin(t*10);
  if(t<1.4)Object.assign(pose,{rua:150+wv*15,rfa:170+wv*25,lua:-25,lfa:-10,lean:-4});
  else if(t<2.4)Object.assign(pose,{expr:'worry',head:16,rua:20,rfa:10,lua:-20,lfa:-10});
  else if(t<3.0)Object.assign(pose,{expr:'shock',head:20,rua:60,rfa:70,lua:-60,lfa:-70,lth:-14,rth:14});
  else if(t<4.0)Object.assign(pose,{expr:'worry',head:0,face:0,rua:105,rfa:150,lua:-60,lfa:-70,lth:-14,rth:14});
  else Object.assign(pose,{expr:'scream',rua:170,rfa:180,lua:-170,lfa:-180,lth:-8,rth:8});
  s+=stick(pose,{toga:true,front:(J)=>{let o=laurel(J.hc[0],J.hc[1]-J.HR+6,40,9);if(t>3.2&&t<4.32){const v=EASE.back(seg(t,3.2,3.45,'l'));o+=g(line(0,10,0,-50,{w:6,c:'#6b4a2b'})+rect(-46,-100,92,52,{f:'#fff',w:5})+txt(0,-60,'476',{font:'Mont',fw:900,fs:34,f:RED}),`translate(${f2(J.rh[0])} ${f2(J.rh[1])}) scale(${v})`)}return o}});
  if(t>4.0)s+=g(zip(cx-50,pose.y-240,0,1)+line(cx-60,pose.y-260,cx-60,pose.y-180,{w:5,op:.7})+line(cx+60,pose.y-260,cx+60,pose.y-180,{w:5,op:.7}))}
 if(t>=2.4&&t<4.0&&t>2.8&&t<3.0)s+=txt(cx+70,top-240,'?',{font:'Mont',fw:900,fs:70,f:RED});
 if(t>=4.3){const wig=Math.sin(t*16)*10*(t<5.6?1:0);s+=line(cx-8,G-50,cx-26+wig,G-170,{w:9})+line(cx-26+wig,G-170,cx-10+wig,G-178,{w:9})+line(cx+14,G-50,cx+30-wig,G-168,{w:9})+line(cx+30-wig,G-168,cx+46-wig,G-172,{w:9});
  s+=blob([[cx-120,G+4],[cx-90,G-46],[cx-30,G-70],[cx+40,G-72],[cx+100,G-44],[cx+130,G+4]],{f:'#E9E2D2',w:6});
  for(let i=0;i<5;i++)s+=rect(cx-100+i*44,G-40-(i%2)*16,36,24,{f:'#FBF8F2',w:4});
  if(t>5.0){const v=EASE.back(seg(t,5.0,5.3,'l'));s+=g(line(0,0,0,-90,{w:5})+`<path d="M0 -90L${46+Math.sin(t*10)*6} -78L0 -62Z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,`translate(${cx+90} ${G-40}) scale(${v})`)}}
 s+=dust(cx,G,t,4.32,{n:8,sp:140,r:34});
 s+=burst(640,300,92,'ГҮРС!',t,4.33,5.4,{fs:46,rot:-8});
 return s}};

