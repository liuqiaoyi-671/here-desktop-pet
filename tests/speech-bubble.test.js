'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {layout}=require('../app/renderer/speech-bubble');
const overlaps=(a,b)=>a.x<b.right&&a.x+a.width>b.left&&a.y<b.bottom&&a.y+a.height>b.top;
test('气泡侧放、下移，并按屏幕空间左右切换，绝不盖住人物',()=>{
 const actor={left:255,right:385,top:292,bottom:450};
 for(const [viewport,preferred,side]of [[{left:8,top:8,right:632,bottom:452},'right','right'],[{left:8,top:8,right:422,bottom:452},'right','left'],[{left:218,top:8,right:632,bottom:452},'left','right']]){
  const b=layout({width:194,height:148,actor,viewport,preferred});assert.equal(b.side,side);assert(!overlaps(b,actor));assert(b.x>=viewport.left&&b.x+b.width<=viewport.right);assert(b.y>=viewport.top&&b.y+b.height<=viewport.bottom);assert(b.y+b.height>actor.top,'不能仍全部悬在头顶');assert.equal(b.mirror,side==='left');
 }
});
test('睡姿、举手、窄可见区域的气泡不遮人物，不越上下边缘',()=>{
 for(const actor of [{left:250,right:390,top:390,bottom:450},{left:225,right:415,top:12,bottom:170},{left:260,right:380,top:292,bottom:450}]){
  const v={left:80,top:8,right:560,bottom:452},b=layout({width:202,height:154,actor,viewport:v});
  assert(!overlaps(b,actor));assert(b.x>=v.left);assert(b.x+b.width<=v.right);assert(b.y>=v.top);assert(b.y+b.height<=v.bottom);assert(b.scale>0);
 }
});
