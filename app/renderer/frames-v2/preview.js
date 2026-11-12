let dragPosition={x:150,y:410},dragPointer=null,dragAnimation=null;
const $=id=>document.getElementById(id);
let action='idle',time=0,speed=1,paused=false,currentFrame=0,manualFrame=null;
const contexts={};
for(const id of ['reference','motion']){
 const c=$(id);c.width=600;c.height=920;
 contexts[id]=c.getContext('2d');contexts[id].scale(2,2);
}
window.frameActionAssetBase='../../assets/sprites-v2/';
try{
 await window.FrameActions.load();
 $('status').textContent='素材已载入。左侧为新版白袜外观，右侧播放所选动作。';
}catch(error){$('status').textContent='加载失败：'+error.message;throw error;}
for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>{
 if(button.dataset.action!=='greydrag'&&!FrameActions.has(button.dataset.action))return;
 action=button.dataset.action;dragPointer=null;dragAnimation=null;
 $('motion').style.touchAction=action==='greydrag'?'none':'';
 $('motion').style.cursor=action==='greydrag'?'grab':'';
 time=0;manualFrame=null;
 document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 $('action-label').textContent='当前动作 · '+(action==='greydrag'?'拖动右侧角色':FrameActions.get(action).title);
};
$('speed').oninput=()=>{speed=Number($('speed').value);$('speed-value').textContent=speed.toFixed(1)+'×';};
$('pause').onclick=()=>{paused=!paused;manualFrame=null;$('pause').textContent=paused?'播放':'暂停';};
$('step').onclick=()=>{
 paused=true;$('pause').textContent='播放';
 if(action==='greydrag')return;
 manualFrame=(currentFrame+1)%FrameActions.get(action).frames.length;
};
const motion=$('motion');
motion.onpointerdown=event=>{
 if(action!=='greydrag'||event.button!==0)return;
 const now=performance.now();let resumed=0;
 if(dragAnimation&&dragAnimation.releasedAt!==null){
  resumed=FrameActions.grabPose(0,{from:dragAnimation.releaseFrom,elapsed:now-dragAnimation.releasedAt}).index;
 }
 dragAnimation={started:now-resumed*75,releasedAt:null,releaseFrom:0};
 dragPointer={id:event.pointerId,x:event.clientX,y:event.clientY,origin:{...dragPosition}};
 motion.setPointerCapture(event.pointerId);motion.style.cursor='grabbing';
};
motion.onpointermove=event=>{
 if(!dragPointer||dragPointer.id!==event.pointerId)return;
 const rect=motion.getBoundingClientRect(),scale=Math.min(rect.width/300,rect.height/460);
 dragPosition={x:Math.max(55,Math.min(245,dragPointer.origin.x+(event.clientX-dragPointer.x)/scale)),y:Math.max(275,Math.min(450,dragPointer.origin.y+(event.clientY-dragPointer.y)/scale))};
};
function releasePointer(){
 if(dragPointer&&dragAnimation){
  const now=performance.now();
  dragAnimation.releaseFrom=Math.min(5,FrameActions.grabPose(now-dragAnimation.started).index);
  dragAnimation.releasedAt=now;
 }
 dragPointer=null;motion.style.cursor=action==='greydrag'?'grab':'';
}
motion.onpointerup=releasePointer;motion.onpointercancel=releasePointer;motion.onlostpointercapture=releasePointer;
let previous=performance.now();
function tick(now){
 if(!paused)time+=Math.min(100,now-previous)*speed;previous=now;
 for(const ctx of Object.values(contexts)){
  ctx.clearRect(0,0,300,460);
  if($('guides').checked){
   ctx.strokeStyle='#e1d5bc';ctx.setLineDash([4,5]);
   for(const y of [80,410]){ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(280,y);ctx.stroke();}ctx.setLineDash([]);
  }
 }
 FrameActions.draw(contexts.reference,'idle',0,{center:150,floor:410,height:330,frame:0});
 if(action==='greydrag'){
  const pose=dragAnimation?FrameActions.grabPose(now-dragAnimation.started,dragAnimation.releasedAt===null?null:{from:dragAnimation.releaseFrom,elapsed:now-dragAnimation.releasedAt}):null;
  if(pose?.done)dragAnimation=null;
  FrameActions.draw(contexts.motion,dragAnimation?'greygrab':'greyidle',0,{center:dragPosition.x,floor:dragPosition.y,height:250,frame:dragAnimation?pose.index:0,effectTime:dragAnimation?now-dragAnimation.started:0});
 }else{
  const result=FrameActions.draw(contexts.motion,action,time,{center:150,floor:410,height:['typing','chin','greytyping','greychin'].includes(action)?280:action==='sleep'?125:330,loop:true,frame:manualFrame});
  if(result)currentFrame=result.index;
 }
 requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.framesPreview={snapshot:()=>({action,currentFrame,paused,grabFrame:dragAnimation?FrameActions.grabPose(performance.now()-dragAnimation.started,dragAnimation.releasedAt===null?null:{from:dragAnimation.releaseFrom,elapsed:performance.now()-dragAnimation.releasedAt}).index:null,dragPosition:{...dragPosition},loaded:FrameActions.names()})};

const requestedAction=new URLSearchParams(location.search).get("action");
if(requestedAction){Array.from(document.querySelectorAll("[data-action]")).find(b=>b.dataset.action===requestedAction)?.click();}
