/* Canvas rendering and input; intent/timing live in PetBehavior. */
'use strict';
const C = document.getElementById('c'), X = C.getContext('2d', {willReadFrequently:true});
const E = document.getElementById('effects'), FX = E.getContext('2d');
const W=640,H=460,FLOOR=450,HEIGHT=158,CENTER=W/2;
let DPR=1, headTop=292, bodyBottom=450, ready=false, muted=false;
let actorBounds={left:CENTER-80,right:CENTER+80,top:292,bottom:450},desktop=null,bubbleSide='right';
function refreshDesktop(){window.pet.bounds().then(value=>{desktop=value;}).catch(()=>{});}
refreshDesktop();setInterval(refreshDesktop,100);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function sizeCanvas(){DPR=devicePixelRatio||1;for(const [c,x]of [[C,X],[E,FX]]){c.width=Math.round(W*DPR);c.height=Math.round(H*DPR);c.style.width=W+'px';c.style.height=H+'px';x.setTransform(DPR,0,0,DPR,0,0);}}
sizeCanvas();window.addEventListener('resize',sizeCanvas);
const behavior=new PetBehavior.PetBehavior({now:performance.now(),duration:asset=>asset==='dash'?window.PetArtwork?.dashDuration()||2080:window.FrameActions?.get(asset)?.sequence.reduce((n,f)=>n+f.ms,0)||0});
let nextTalk=performance.now()+(25+Math.random()*20)*60000;
let drag=null,pending=null,held=false,ignoring=true,activePointer=null;
const LIFT_HOLD_MS=190,LIFT_MOVE_PX=4;
function tick(now){
 if(ready){
  behavior.update(now);const s=behavior.snapshot(now);X.clearRect(0,0,W,H);FX.clearRect(0,0,W,H);
  let asset=s.asset,elapsed=s.elapsed,frame=null,height=s.action==='sleep'?HEIGHT*.4:HEIGHT,floor=FLOOR;
  if(drag){
   height=drag.height;floor=drag.floor;
   if(drag.grey){
    const pose=FrameActions.grabPose(now-drag.started,drag.releasedAt===null?null:{from:drag.releaseFrom,elapsed:now-drag.releasedAt});
    if(pose.done){drag=null;behavior.resume(now);}
    else{asset='greygrab';frame=pose.index;elapsed=0;}
   }
  }
  const context={headTop:floor-height,bodyBottom:floor,height,behind:true,reduced:reducedMotion.matches};
  if(!muted&&!drag){X.save();X.translate(CENTER-150,0);PetArtwork.draw(X,s,now,context);X.restore();}
  const result=s.action==='dash'&&!drag?PetArtwork.drawDash(X,elapsed,{center:CENTER,floor,height}):FrameActions.draw(X,asset,elapsed,{center:CENTER,floor,height,loop:!s.temporary,frame,effectTime:now});
  if(result){headTop=result.headTop;bodyBottom=result.bodyBottom;actorBounds=result.bounds||{left:CENTER-85,right:CENTER+85,top:headTop,bottom:bodyBottom};}
  if(!muted&&!drag){FX.save();FX.translate(CENTER-150,0);PetArtwork.draw(FX,s,now,{headTop,bodyBottom,height,reduced:reducedMotion.matches});FX.restore();}
  window.remoteCompanion?.position(headTop,bodyBottom);
  if(!window.remoteCompanion?.hasMessage())drawBubble(now);
  window.remoteCompanion?.drawEffect(FX,now,headTop);
  if(now>nextTalk){if(s.main!=='sleep'&&!drag)say('idleTalk');nextTalk=now+(25+Math.random()*20)*60000;}
 }
 requestAnimationFrame(tick);
}
const LINES = {};
let bubble = null;                  // {lines, w, h, born, dur, below}
const recent = {};                  // 每一组最近用过哪几句，避免连着重复


const FONT = '12px -apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif';
const MAXW = 76, LH = 16, PAGE_LINES = 3;

function wrap(text) {
  X.font = FONT;
  const lines = [];
  let cur = "";
  for (const ch of text) {
    if (ch === "\n" || X.measureText(cur + ch).width > MAXW) {
      lines.push(cur); cur = ch === "\n" ? "" : ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

function say(key, fallback) {
  if (muted) return;
  const pool = (LINES[key] && LINES[key].length) ? LINES[key] : LINES[fallback];
  if (!pool || !pool.length) return;
  const seen = recent[key] || [];
  let pick = pool.filter((l) => !seen.includes(l));
  if (!pick.length) pick = pool;
  const line = pick[Math.floor(Math.random() * pick.length)];
  // 池子大就多记两句，小池子只避开上一句
  recent[key] = [line, ...seen].slice(0, pool.length >= 4 ? 2 : 1);

  const lines = wrap(line);
  X.font = FONT;
  bubble = {
    lines,
    pageMs: 2500,
    pages: Math.ceil(lines.length/PAGE_LINES),
    born: performance.now(),
    dur: Math.max(2200 + line.length * 130,Math.ceil(lines.length/PAGE_LINES)*2500+400),   // 长一点的句子多停一会儿
  };
}

function visibleBubbleLines(now=performance.now()) {
  if(!bubble)return [];
  const page=Math.max(0,Math.min(bubble.pages-1,Math.floor((now-bubble.born)/bubble.pageMs)));
  return bubble.lines.slice(page*PAGE_LINES,(page+1)*PAGE_LINES);
}
function bubbleBox(now=performance.now()) {
  if(!bubble)return null;
  const lines=visibleBubbleLines(now);X.font=FONT;
  const textWidth=Math.max(0,...lines.map(line=>X.measureText(line).width));
  // Size the supplied bubble to the visible text, without a large minimum or fixed aspect.
  const width=Math.max(30,Math.min(112,Math.ceil(textWidth/.78+14)));
  const height=Math.max(30,Math.ceil(lines.length*LH/.72+10));
  const viewport={left:8,top:8,right:W-8,bottom:H-8};
  if(desktop){viewport.left=Math.max(viewport.left,desktop.workArea.x-desktop.x+8);viewport.right=Math.min(viewport.right,desktop.workArea.x+desktop.workArea.width-desktop.x-8);viewport.top=Math.max(viewport.top,desktop.workArea.y-desktop.y+8);viewport.bottom=Math.min(viewport.bottom,desktop.workArea.y+desktop.workArea.height-desktop.y-8);}
  const box=SpeechBubble.layout({width,height,actor:actorBounds,viewport,preferred:bubbleSide});bubbleSide=box.side;
  return box;
}
function drawBubble(now) {
  if(!bubble)return;
  const age=now-bubble.born;if(age>bubble.dur){bubble=null;return;}
  SpeechBubble.draw(X,bubbleBox(now),visibleBubbleLines(now),{alpha:Math.max(0,Math.min(1,age/130,(bubble.dur-age)/320)),font:FONT,lineHeight:LH});
}

function inBubble(x, y) {
  const b = bubbleBox();
  return !!b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}


function hit(x,y){if(x<0||y<0||x>=W||y>=H)return false;return X.getImageData(Math.floor(x*DPR),Math.floor(y*DPR),1,1).data[3]>24;}
function hitPet(x,y){return hit(x,y)&&!inBubble(x,y);}
function beginLift(){
 if(!pending||!ready)return;
 const point={x:pending.x,y:pending.y};clearTimeout(pending.timer);pending=null;
 if(drag?.releasedAt!==null&&drag?.grey){
  const pose=FrameActions.grabPose(0,{from:drag.releaseFrom,elapsed:performance.now()-drag.releasedAt});drag.started=performance.now()-pose.index*75;drag.releasedAt=null;
 }else{
  const s=behavior.snapshot(performance.now()),height=bodyBottom-headTop;
  drag={grey:s.outfit==='grey'&&s.main!=='sleep',started:performance.now(),releasedAt:null,releaseFrom:0,height,floor:bodyBottom};
 }
 held=true;behavior.suspend(performance.now());behavior.interact(performance.now());
 window.pet.dragStart(point);document.body.style.cursor='grabbing';say('grab');
}
function finishDrag(){
 if(pending){clearTimeout(pending.timer);pending=null;}
 if(!held)return;held=false;
 if(drag?.grey){drag.releaseFrom=Math.min(5,FrameActions.grabPose(performance.now()-drag.started).index);drag.releasedAt=performance.now();}
 else{drag=null;behavior.resume(performance.now());}
 window.pet.dragEnd();document.body.style.cursor='grab';say('drop');
}
let pokeN=0,pokeAt=-Infinity;
function poke(){
 const now=performance.now();if(now-pokeAt>30000)pokeN=0;pokeAt=now;pokeN++;
 const s=behavior.snapshot(now),level=pokeN>=8?'poke.x8':pokeN>=5?'poke.x5':pokeN>=3?'poke.x3':null;
 say(level||'poke.'+(held?'lift':s.main),'poke.idle');behavior.click(now);
}
window.addEventListener('mousemove',e=>{
 if(pending&&(Math.abs(e.clientX-pending.x)>LIFT_MOVE_PX||Math.abs(e.clientY-pending.y)>LIFT_MOVE_PX))beginLift();
 if(held)return;
 const on=hit(e.clientX,e.clientY)||!!window.remoteCompanion?.hit(e.clientX,e.clientY);
 if(on===ignoring){ignoring=!on;window.pet.ignoreMouse(ignoring);}
 document.body.style.cursor=on?'grab':'default';
});
window.addEventListener('mousedown',e=>{
 if(e.button===2){window.pet.menu();return;}if(e.button!==0)return;
 if(window.remoteCompanion?.hit(e.clientX,e.clientY)){window.remoteCompanion.dismiss();return;}
 if(bubble&&inBubble(e.clientX,e.clientY)){bubble=null;return;}
 if(!hitPet(e.clientX,e.clientY))return;
 pending={x:e.clientX,y:e.clientY,timer:setTimeout(beginLift,LIFT_HOLD_MS)};
});
window.addEventListener('mouseup',()=>{if(pending){clearTimeout(pending.timer);pending=null;poke();}else finishDrag();});
window.addEventListener('blur',finishDrag);
window.addEventListener('pointerdown',e=>{if(e.button===0&&hitPet(e.clientX,e.clientY)){activePointer=e.pointerId;try{C.setPointerCapture(e.pointerId);}catch{}}});
window.addEventListener('pointerup',()=>{if(held)finishDrag();activePointer=null;});
window.addEventListener('pointercancel',()=>{finishDrag();activePointer=null;});
C.addEventListener('lostpointercapture',()=>{if(held)finishDrag();activePointer=null;});
window.addEventListener('mouseleave',()=>{if(activePointer!==null&&C.hasPointerCapture(activePointer))return;finishDrag();});
window.addEventListener('contextmenu',e=>e.preventDefault());
window.pet.onState(value=>{
 finishDrag();if(drag){drag=null;behavior.resume(performance.now());}
 const previous=behavior.main;
 const state={auto:'idle',greyidle:'idle',greytyping:'work',greychin:'work',chin:'work'}[value]||value;
 if(['idle','work','sleep'].includes(state)){
  behavior.setMain(state,performance.now());
  if(state==='sleep')bubble=null;
  if(previous==='sleep'&&state!=='sleep')say('wake');else if(previous!=='work'&&state==='work')say('enterWork');
 }else{behavior.trigger(value.replace(/^grey/,''),performance.now());}
});
window.pet.onPreferences?.(value=>{
 finishDrag();if(drag){drag=null;behavior.resume(performance.now());}
 behavior.setSeason(value.season,performance.now(),new Date().getMonth()+1);
});
window.pet.onEasterEgg?.(action=>{finishDrag();if(drag){drag=null;behavior.resume(performance.now());}bubble=null;behavior.easterEgg(action,performance.now());});
window.pet.onSay(key=>say(key));
window.pet.onMute(value=>{muted=value;behavior.setQuiet(value,performance.now());if(value)bubble=null;});
window.pet.onCompanion(update=>{
 if(update.reset)return;
 if(typeof update.quiet==='boolean'){muted=update.quiet;behavior.setQuiet(muted,performance.now());}
 if(!muted)for(const event of update.events||[])if(event.expiresAt>Date.now())behavior.message(event,performance.now());
});
window.petRuntime={snapshot:()=>({...behavior.snapshot(performance.now()),ready,headTop,bodyBottom,actorBounds:{...actorBounds},bubbleBox:bubbleBox(),dragging:!!drag}),behavior};
(async()=>{
 try{
  const [_,lines,preferences]=await Promise.all([Promise.all([FrameActions.load(),PetArtwork.load(),SpeechBubble.load()]),fetch('../assets/台词.json').then(r=>r.json()),window.pet.preferences()]);
  Object.assign(LINES,lines);behavior.setSeason(preferences.season,performance.now());behavior.setMain(preferences.main==='auto'?'idle':preferences.main,performance.now());
  muted=!!preferences.quiet;behavior.setQuiet(muted,performance.now());ready=true;
 }catch(error){console.error('桌宠素材载入失败',error.message);}
 window.pet.ignoreMouse(true);requestAnimationFrame(tick);
})();
