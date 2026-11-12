'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');const{cutout}=require('../app/renderer/dash-cutout');
test('去掉背景、脚底灰影和封闭发丝孔洞，保留白字与人物内部像素',()=>{
 const w=100,h=100,p=new Uint8ClampedArray(w*h*4);const fill=(x0,y0,x1,y1,color)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)p.set([...color,255],(y*w+x)*4);};
 fill(0,0,100,100,[251,251,251]);fill(20,94,80,98,[200,200,200]);fill(22,5,78,31,[50,45,42]);fill(40,10,60,25,[251,220,196]);fill(35,30,65,73,[145,140,137]);fill(45,70,56,96,[40,37,35]);fill(44,41,48,51,[250,250,250]);fill(26,10,31,17,[251,251,251]);fill(21,15,22,26,[220,220,220]);
 const before=new Uint8ClampedArray(p),r=cutout(p,w,h),alpha=(x,y)=>r.data[(y*w+x)*4+3];
 assert.deepEqual(p,before,'原数据不得写回');assert.equal(alpha(0,0),0);assert.equal(alpha(28,13),0,'发丝间封闭白底');assert.equal(alpha(25,96),0,'脚边灰影');assert.equal(alpha(46,45),255,'白色印字');
 assert.deepEqual(Array.from(r.data.slice((45*w+46)*4,(45*w+46)*4+4)),[250,250,250,255]);
 assert.equal(alpha(50,88),255,'鞋与腿的深色内部');assert(alpha(21,20)>0&&alpha(21,20)<100,'边缘需恢复半透明');assert(r.data[(20*w+21)*4]<100,'去掉边缘携带的白底颜色');
});
