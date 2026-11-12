/* Prepare sprite canvases once, including fixed-base blink poses. */
(()=>{
 const actions={},images={},cache={},breathCache={},boundsCache={};let loaded=false;
 function composite(name,index){
  const cfg=actions[name],image=images[name],locked=cfg.fixedBase===true||name==='chin',base=cfg.frames[locked?0:index];
  const c=document.createElement('canvas');c.width=base.width;c.height=base.height;const x=c.getContext('2d');
  x.drawImage(image,base.x,base.y,base.width,base.height,0,0,c.width,c.height);
  if(locked&&index!==0){
   const pose=cfg.frames[index];
   x.save();x.beginPath();if(cfg.blinkRegions){for(const [cx,cy,rx,ry] of cfg.blinkRegions){x.moveTo((cx+rx)*c.width,cy*c.height);x.ellipse(cx*c.width,cy*c.height,rx*c.width,ry*c.height,0,0,Math.PI*2);}}else {x.ellipse(c.width*.455,c.height*.325,c.width*.065,c.height*.065,0,0,Math.PI*2);x.ellipse(c.width*.60,c.height*.31,c.width*.08,c.height*.07,0,0,Math.PI*2);}x.clip();x.clearRect(0,0,c.width,c.height);
   x.drawImage(image,pose.x,pose.y,pose.width,pose.height,cfg.frameOffsets?.[index]??cfg.eyeOffsets?.[index]??0,0,c.width,c.height);x.restore();
  }
  const eyes = cfg.spiralEyes?.[index];
  if (eyes) {
   x.fillStyle = '#fffdf9';
   for (const [cx, cy] of eyes) {
    x.beginPath();
    x.ellipse(cx, cy, 14.7, 14.4, 0, 0, Math.PI * 2);
    x.fill();
   }
  }
  return c;
 }
 // Continuous local fabric deformation. Pixels outside the feathered chest area
 // are copied unchanged, so the face, pillow, hair and hem never bob or stretch.
 function breathingCanvas(name,time){
  const cfg=actions[name],b=cfg.breath;
  if(!breathCache[name]){
   const base=cache[name][0],source=base.getContext('2d').getImageData(0,0,base.width,base.height);
   const {width:w,height:h,data:pixels}=source,levels=[base];
   const [left,top,right,bottom]=b.region;
   const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
   for(let level=1;level<=32;level++){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d'),out=ctx.createImageData(w,h);out.data.set(pixels);
    const amount=b.amplitude*level/32;
    for(let y=top;y<Math.min(h,bottom);y++)for(let x=left;x<Math.min(w,right);x++){
     const wx=smooth((x-left)/90)*smooth((right-x)/140);
     const wy=smooth((y-top)/60)*smooth((bottom-y)/110);
     const sy=Math.min(h-1,y+amount*wx*wy),y0=Math.floor(sy),y1=Math.min(h-1,y0+1),f=sy-y0;
     const dest=(y*w+x)*4,a=(y0*w+x)*4,z=(y1*w+x)*4;
     for(let channel=0;channel<4;channel++)out.data[dest+channel]=pixels[a+channel]*(1-f)+pixels[z+channel]*f;
    }
    ctx.putImageData(out,0,0);levels.push(canvas);
   }
   breathCache[name]=levels;
  }
  const phase=time%b.periodMs;
  const progress=phase<b.inhaleMs?phase/b.inhaleMs:1-(phase-b.inhaleMs)/(b.periodMs-b.inhaleMs);
  const amount=(1-Math.cos(Math.PI*progress))/2;
  return breathCache[name][Math.round(amount*32)];
 }
 function visibleBounds(canvas){
  const {width:w,height:h}=canvas,p=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  let left=w,right=0,top=h,bottom=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
  return {left,right,top,bottom};
 }
 async function load(){
  if(loaded)return;const base=window.frameActionAssetBase||'../assets/sprites-v2/';const response=await fetch(base+'actions.json');if(!response.ok)throw Error('动作配置读取失败');const data=await response.json();
  await Promise.all(Object.entries(data.actions).map(async([name,cfg])=>{const im=new Image();im.src=base+cfg.file;await im.decode();actions[name]=cfg;images[name]=im;}));
  for(const [name,cfg] of Object.entries(actions))cache[name]=cfg.frames.map((_,i)=>composite(name,i));for(const name of Object.keys(actions))boundsCache[name]=cache[name].map(visibleBounds);loaded=true;
 }
 function draw(ctx,name,elapsed,{center=150,floor=450,height=155,speed=1,loop=false,frame=null,effectTime=elapsed}={}){
  const cfg=actions[name];if(!cfg||!cache[name])return null;
  const duration=cfg.sequence.reduce((s,e)=>s+e.ms,0),time=loop?Math.max(0,elapsed*speed)%duration:Math.min(Math.max(0,elapsed*speed),duration-.001);
  let start=0,step=0;for(;step<cfg.sequence.length-1;step++){if(time<start+cfg.sequence[step].ms)break;start+=cfg.sequence[step].ms;}
  let index=cfg.breath&&frame===null?0:cfg.sequence[step].frame;if(frame!==null)index=Math.max(0,Math.min(cfg.frames.length-1,frame));
  const locked=cfg.fixedBase===true||name==='chin',cell=cfg.frames[locked?0:index],s=height/(cell.bottom-cell.headTop),dx=center-cell.footCenter*s,dy=floor-cell.bottom*s;
  ctx.drawImage(cfg.breath&&frame===null?breathingCanvas(name,time):cache[name][index],dx,dy,cell.width*s,cell.height*s);
  const eyes = cfg.spiralEyes?.[index];
  if (eyes) {
   ctx.save();
   ctx.translate(dx, dy);
   ctx.scale(s, s);
   ctx.strokeStyle = '#4b3c34';
   ctx.lineWidth = 2.2;
   ctx.lineCap = 'round';
   const rotation = effectTime / 2200 * Math.PI * 2;
   for (const [cx, cy] of eyes) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.beginPath();
    for (let point = 0; point <= 160; point++) {
     const progress = point / 160;
     const angle = progress * Math.PI * 4.3;
     const radius = 1.2 + progress * 11.8;
     const x = Math.cos(angle) * radius;
     const y = Math.sin(angle) * radius;
     if (point === 0) ctx.moveTo(x, y);
     else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
   }
   ctx.restore();
  }
  const bounds=boundsCache[name][index];
  return {bounds:{left:dx+bounds.left*s,right:dx+bounds.right*s,top:dy+bounds.top*s,bottom:dy+bounds.bottom*s},headTop:floor-height,bodyBottom:floor,done:!loop&&elapsed*speed>=duration,index,duration};
 }
 function grabPose(elapsed, release = null) {
  const stepMs = 75;
  if (release) {
   const index = Math.max(0, release.from - Math.floor(release.elapsed / stepMs));
   return { index, done: release.elapsed >= (release.from + 1) * stepMs };
  }
  if (elapsed < 6 * stepMs) {
   return { index: Math.min(5, Math.floor(Math.max(0, elapsed) / stepMs)), done: false };
  }
  return { index: 5, done: false };
 }
 function slidePose(elapsed) {
  const ease = value => {
   const t = Math.max(0, Math.min(1, value));
   return t * t * (3 - 2 * t);
  };
  return {
   progress: ease((elapsed - 85) / 465),
   lean: 4 * ease(elapsed / 100) * (1 - ease((elapsed - 420) / 230)),
   done: elapsed >= 650,
  };
 }
 window.FrameActions={load,draw,slidePose,grabPose,has:n=>!!actions[n],get:n=>actions[n],names:()=>Object.keys(actions)};
})();
