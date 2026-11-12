/* White-matte removal for the supplied dash frames. Does not redraw the character. */
(function(root){
 'use strict';
 function cutout(source,w,h){
  const count=w*h,p=source,out=new Uint8ClampedArray(p),background=new Uint8Array(count),seen=new Uint8Array(count),queue=new Int32Array(count);
  let read=0,write=0;
  function visit(i){
   if(i<0||i>=count||seen[i])return;seen[i]=1;const k=i*4,lo=Math.min(p[k],p[k+1],p[k+2]),hi=Math.max(p[k],p[k+1],p[k+2]);
   // Ground shadows are neutral and much darker than the white backdrop.
   const limit=i/w>=h*.86?145:236;
   if(lo<limit||hi-lo>24)return;background[i]=1;queue[write++]=i;
  }
  for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
  // Background holes between the legs, not the white print inside the hoodie.
  for(let y=Math.floor(h*.66);y<h*.97;y+=6)for(let x=Math.floor(w*.25);x<w*.76;x+=6)visit(y*w+x);
  while(read<write){const i=queue[read++],x=i%w;if(x)visit(i-1);if(x<w-1)visit(i+1);visit(i-w);visit(i+w);}
  // Closed holes between hair strands do not touch the image border. Find those
  // white components separately, protecting the face and the hoodie's white print.
  let face={left:w,right:0,top:h,bottom:0},largestSkin=0;
  const skinSeen=new Uint8Array(count),skinQueue=new Int32Array(count);
  const skin=i=>{const k=i*4,r=p[k],g=p[k+1],b=p[k+2];return i/w<h*.47&&r>200&&g>170&&b>120&&r-g>4&&g-b>3&&r-b<85;};
  for(let first=0;first<w*Math.floor(h*.47);first++){
   if(skinSeen[first]||!skin(first))continue;let start=0,end=1,left=w,right=0,top=h,bottom=0;skinSeen[first]=1;skinQueue[0]=first;
   const append=j=>{if(j<0||j>=count||skinSeen[j]||!skin(j))return;skinSeen[j]=1;skinQueue[end++]=j;};
   while(start<end){const i=skinQueue[start++],x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(x)append(i-1);if(x<w-1)append(i+1);append(i-w);append(i+w);}
   if(end>largestSkin){largestSkin=end;face={left,right,top,bottom};}
  }
  if(face.right<=face.left)face={left:w*.35,right:w*.65,top:h*.08,bottom:h*.4};
  const holes=[];
  const faceCenter=(face.left+face.right)/2,whiteSeen=new Uint8Array(count),whiteQueue=new Int32Array(count);
  const white=i=>{const k=i*4;return Math.min(p[k],p[k+1],p[k+2])>=236&&Math.max(p[k],p[k+1],p[k+2])-Math.min(p[k],p[k+1],p[k+2])<=16;};
  for(let first=0;first<count;first++){
   if(background[first]||whiteSeen[first]||!white(first))continue;
   let start=0,end=1,protectedPart=false;whiteQueue[0]=first;whiteSeen[first]=1;
   const append=j=>{if(j<0||j>=count||whiteSeen[j]||background[j]||!white(j))return;whiteSeen[j]=1;whiteQueue[end++]=j;};
   while(start<end){const i=whiteQueue[start++],x=i%w,y=Math.floor(i/w);
    if((x>=face.left-7&&x<=face.right+7&&y>=face.top-7&&y<=face.bottom+7)||(x>=faceCenter-w*.18&&x<=faceCenter+w*.18&&y>=face.bottom&&y<=h*.61))protectedPart=true;
    if(x)append(i-1);if(x<w-1)append(i+1);append(i-w);append(i+w);
   }
   if(end>=18){let left=w,right=0,top=h,bottom=0;for(let j=0;j<end;j++){const n=whiteQueue[j],x=n%w,y=Math.floor(n/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}holes.push({left,right,top,bottom,size:end,protectedPart});}
   if(!protectedPart&&end>=18)for(let i=0;i<end;i++)background[whiteQueue[i]]=1;
  }
  function distances(inverse){
   const d=new Uint8Array(count);for(let i=0;i<count;i++)d[i]=(!!background[i]===inverse)?9:0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;let v=d[i];if(x)v=Math.min(v,d[i-1]+1);if(y){v=Math.min(v,d[i-w]+1);if(x)v=Math.min(v,d[i-w-1]+1);if(x<w-1)v=Math.min(v,d[i-w+1]+1);}d[i]=v;}
   for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;let v=d[i];if(x<w-1)v=Math.min(v,d[i+1]+1);if(y<h-1){v=Math.min(v,d[i+w]+1);if(x)v=Math.min(v,d[i+w-1]+1);if(x<w-1)v=Math.min(v,d[i+w+1]+1);}d[i]=v;}
   return d;
  }
  const inside=distances(false),outside=distances(true),matte=[p[0],p[1],p[2]];
  let removed=0,softened=0;
  for(let i=0;i<count;i++){
   const k=i*4,x=i%w,y=Math.floor(i/w),bg=background[i];
   if(bg){out[k+3]=0;removed++;if(outside[i]>1||y>=h*.86)continue;}
   else if(inside[i]>2)continue;
   // Recover edge opacity against the known white matte, then remove its white spill.
   let nearest=-1,best=Infinity;
   for(let dy=-6;dy<=6;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-6;dx<=6;dx++){
    const xx=x+dx;if(xx<0||xx>=w)continue;const j=yy*w+xx,dist=dx*dx+dy*dy;
    if(inside[j]>=3&&!background[j]&&dist<best){best=dist;nearest=j;}
   }}
   if(nearest<0){if(bg)continue;for(let dy=-3;dy<=3;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-3;dx<=3;dx++){
    const xx=x+dx;if(xx<0||xx>=w)continue;const j=yy*w+xx;if(background[j])continue;
    const score=Math.min(p[j*4],p[j*4+1],p[j*4+2]);if(score<best){best=score;nearest=j;}
   }}}
   if(nearest<0)continue;
   let numerator=0,denominator=0;
   for(let c=0;c<3;c++){const diff=matte[c]-p[nearest*4+c];numerator+=(matte[c]-p[k+c])*diff;denominator+=diff*diff;}
   if(denominator<16)continue;
   const alpha=Math.max(0,Math.min(1,numerator/denominator));
   if(alpha<.02){out[k+3]=0;continue;}
   out[k+3]=Math.round(alpha*255);if(alpha<.999)softened++;
   for(let c=0;c<3;c++)out[k+c]=Math.max(0,Math.min(255,Math.round((p[k+c]-matte[c]*(1-alpha))/alpha)));
  }
  return{data:out,background,inside,removed,softened,face,holes};
 }
 if(typeof module==='object'&&module.exports)module.exports={cutout};else root.DashCutout={cutout};
})(typeof window==='object'?window:globalThis);
