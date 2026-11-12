/* Uses the user's P2 image. Layout stays outside the current character bounds. */
(function(root){
 'use strict';
 function layout({width,height,actor,viewport={left:8,top:8,right:632,bottom:452},preferred='right'}){
  const gap=12,rightSpace=viewport.right-actor.right-gap,leftSpace=actor.left-gap-viewport.left;
  let side=preferred;
  if((side==='right'?rightSpace:leftSpace)<width && (side==='right'?leftSpace:rightSpace)>=width)side=side==='right'?'left':'right';
  // A narrow screen can reduce the bubble, but it must never move across the actor.
  const available=side==='right'?rightSpace:leftSpace;
  if(available<width){const other=side==='right'?leftSpace:rightSpace;if(other>available)side=side==='right'?'left':'right';}
  const room=side==='right'?rightSpace:leftSpace;
  const scale=Math.min(1,Math.max(0,room)/width),w=width*scale,h=height*scale;
  const x=side==='right'?actor.right+gap:actor.left-gap-w;
  // Align beside the face, lower than the previous above-head placement.
  const y=Math.max(viewport.top,Math.min(viewport.bottom-h,actor.top-12));
  return{x,y,width:w,height:h,side,mirror:side==='left',scale};
 }
 const api={layout};
 if(typeof module==='object'&&module.exports){module.exports=api;return;}
 let art=null;
 async function load(){
  const image=new Image();image.src='../assets/bubbles/speech-p2-original.png';await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),d=pixels.data,w=canvas.width,h=canvas.height;
  // Remove only the white exterior connected to the image edges. The white speech area stays.
  const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let begin=0,end=0;
  function visit(i){if(i<0||i>=w*h||seen[i])return;seen[i]=1;const p=i*4;if(Math.min(d[p],d[p+1],d[p+2])<235)return;queue[end++]=i;}
  for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
  while(begin<end){const i=queue[begin++],p=i*4;d[p+3]=0;const x=i%w;if(x)visit(i-1);if(x<w-1)visit(i+1);visit(i-w);visit(i+w);}
  ctx.putImageData(pixels,0,0);art=canvas;
 }
 function draw(ctx,box,lines,{alpha=1,font='13px -apple-system,"PingFang SC",sans-serif',lineHeight=20}={}){
  if(!art||box.width<=0)return;
  ctx.save();ctx.globalAlpha=alpha;
  if(box.mirror){ctx.translate(box.x+box.width,box.y);ctx.scale(-1,1);ctx.drawImage(art,0,0,box.width,box.height);}
  else ctx.drawImage(art,box.x,box.y,box.width,box.height);
  ctx.restore();
  ctx.save();ctx.globalAlpha=alpha;ctx.font=font;ctx.fillStyle='#4a3628';ctx.textAlign='center';ctx.textBaseline='middle';
  const centerX=box.x+box.width*(box.mirror?.48:.54),centerY=box.y+box.height*.45;
  if(box.scale<1){ctx.translate(centerX,centerY);ctx.scale(box.scale,box.scale);lines.forEach((text,i)=>ctx.fillText(text,0,(i-(lines.length-1)/2)*lineHeight));}
  else lines.forEach((text,i)=>ctx.fillText(text,centerX,centerY+(i-(lines.length-1)/2)*lineHeight));
  ctx.restore();
 }
 root.SpeechBubble={...api,load,draw,ready:()=>!!art};
})(typeof window==='object'?window:globalThis);
