/* Supplied artwork is copied byte-for-byte. White-matte handling is display-only. */
(() => {
  'use strict';
  const effects = {}, dash = []; let timing;
  const sourceNames = {heart:'heart-original.jpg',sleep:'sleep-z-original.jpg',stretch:'stretch-rays-original.jpg'};
  async function loadImage(url) { const image=new Image();image.src=url;await image.decode();return image; }
  function canvasOf(image) { const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);return canvas; }
  function transparentMatte(image, exteriorOnly=false) {
    const canvas=canvasOf(image),ctx=canvas.getContext('2d',{willReadFrequently:true}),frame=ctx.getImageData(0,0,canvas.width,canvas.height),p=frame.data;
    const w=canvas.width,h=canvas.height,mask=exteriorOnly?new Uint8Array(w*h):null;
    if(mask){
      const queue=new Int32Array(w*h);let head=0,tail=0;
      const visit=i=>{if(i<0||i>=w*h||mask[i])return;const o=i*4;if(Math.min(p[o],p[o+1],p[o+2])<232||Math.max(p[o],p[o+1],p[o+2])-Math.min(p[o],p[o+1],p[o+2])>24)return;mask[i]=1;queue[tail++]=i;};
      for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
      // The confirmed dash has a white gap between the trouser legs. It is
      // background even when the original floor shadow closes it off from the border.
      for(let y=Math.floor(h*.68);y<h*.96;y+=8)for(let x=Math.floor(w*.35);x<w*.65;x+=8)visit(y*w+x);
      while(head<tail){const i=queue[head++],x=i%w;if(x)visit(i-1);if(x<w-1)visit(i+1);visit(i-w);visit(i+w);}
    }
    for(let i=0;i<w*h;i++){
      if(mask&&!mask[i]){const o=i*4;if(i/w<h*.94||Math.min(p[o],p[o+1],p[o+2])<200||Math.max(p[o],p[o+1],p[o+2])-Math.min(p[o],p[o+1],p[o+2])>24)continue;}const o=i*4,min=Math.min(p[o],p[o+1],p[o+2]),alpha=255-min;
      if(alpha<9){p[o+3]=0;continue;}
      // Keep the supplied RGB values; only the white matte's display opacity changes.
      p[o+3]=Math.min(255,Math.round(alpha*(exteriorOnly?1:2.5)));
    }
    ctx.putImageData(frame,0,0);return canvas;
  }
  function cleanDash(image){
    const canvas=canvasOf(image),ctx=canvas.getContext('2d',{willReadFrequently:true}),frame=ctx.getImageData(0,0,canvas.width,canvas.height);
    frame.data.set(DashCutout.cutout(frame.data,canvas.width,canvas.height).data);ctx.putImageData(frame,0,0);return canvas;
  }
  async function load(){
    await Promise.all(Object.entries(sourceNames).map(async([name,file])=>{effects[name]=transparentMatte(await loadImage('../assets/effects/'+file));}));
    timing=await fetch('../assets/motions/grey-dash-v29/timings.json').then(r=>r.json());
    await Promise.all(timing.durations.map(async(_,i)=>{dash[i]=cleanDash(await loadImage('../assets/motions/grey-dash-v29/frame-'+String(i+1).padStart(2,'0')+'.png'));}));
  }
  function effect(ctx,name,cx,cy,w,h,alpha=1,scale=1){if(!effects[name]||alpha<=0)return;ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.scale(scale,scale);ctx.drawImage(effects[name],-w/2,-h/2,w,h);ctx.restore();}
  const tween=(t,a,b,x,y)=>x+(y-x)*Math.max(0,Math.min(1,(t-a)/(b-a)));
  function draw(ctx,s,now,{headTop,bodyBottom,height=158,behind=false,reduced=false}={}){
    if(s.quiet||s.suspended)return;
    const cy=headTop+height*.47, effectName=s.effect?.action, effectElapsed=s.effect?.elapsed||0;
    if(effectName==='stretch'&&behind){
      const t=Math.min(1,effectElapsed/4000),alpha=reduced?1:t<.1?t/.1:t>.7?(1-t)/.3:1;
      effect(ctx,'stretch',150,cy,176,166,alpha,reduced?1:t<.1?tween(t,0,.1,.8,1):tween(t,.7,1,1,1.04));
    }
    if(behind)return;
    if(s.action==='sleep'){
      const t=reduced?.3:(s.elapsed%9000)/9000;
      const alpha=reduced?.85:t<.15?t/.15*.85:t<.58?.85:t<7/9?tween(t,.58,7/9,.8,0):0;
      const dx=reduced?0:tween(t,0,7/9,0,12),dy=reduced?0:tween(t,0,7/9,6,-25);
      effect(ctx,'sleep',137+dx,headTop-31+dy,58,53,alpha,reduced?1:tween(t,0,7/9,.85,1.05));
    }
    if(effectName==='kiss'){
      const t=Math.min(1,effectElapsed/5000),alpha=reduced?1:t<.15?t/.15:t>.58?(1-t)/.42:1;
      const pulse=reduced?1:t<.15?tween(t,0,.15,.65,1):t<.25?tween(t,.15,.25,1,1.13):t<.36?tween(t,.25,.36,1.13,1):t<.46?tween(t,.36,.46,1,1.13):t<.58?tween(t,.46,.58,1.13,1):tween(t,.58,1,1,.85);
      const dy=reduced?0:t<.15?tween(t,0,.15,10,0):t>.58?tween(t,.58,1,0,-30):0;
      effect(ctx,'heart',150,cy+dy,34,32,alpha,pulse);effect(ctx,'heart',125,headTop+height*.77+dy,18,17,alpha,pulse);
    }
  }
  function drawDash(ctx,elapsed,{height=158,floor=450,center=150}={}){
    if(!timing||!dash.length)return null;const total=timing.durations.reduce((a,b)=>a+b,0);let t=Math.max(0,Math.min(elapsed,total-.001)),index=0;
    while(index<timing.durations.length-1&&t>=timing.durations[index]){t-=timing.durations[index++];}
    const scale=height/(timing.height-10),w=timing.width*scale,h=timing.height*scale;
    ctx.drawImage(dash[index],center-w/2,floor-h,w,h);return{headTop:floor-h,bodyBottom:floor,index};
  }
  window.PetArtwork={load,draw,drawDash,dashDuration:()=>timing?.durations.reduce((a,b)=>a+b,0)||2080,sources:()=>({...sourceNames}),ready:()=>Object.keys(effects).length===3&&dash.length===16};
})();
