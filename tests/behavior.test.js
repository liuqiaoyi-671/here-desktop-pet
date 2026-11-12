'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {PetBehavior,calendarSeason}=require('../app/renderer/pet-behavior');
const duration=asset=>asset.includes('typing')?16340:asset.includes('chin')?5970:2600;
test('季节控制每项动作服装，睡觉独立；自动月份与手动覆盖',()=>{
 assert.deepEqual(Array.from({length:12},(_,i)=>calendarSeason(i+1)),['autumn-winter','autumn-winter','spring-summer','spring-summer','spring-summer','spring-summer','spring-summer','spring-summer','autumn-winter','autumn-winter','autumn-winter','autumn-winter']);
 const b=new PetBehavior({month:11,duration});assert.equal(b.snapshot(0).asset,'greyidle');
 b.setMain('work',0);assert.equal(b.snapshot(0).asset,'greytyping');b.setSeason('summer',1);assert.equal(b.snapshot(1).asset,'typing');
 b.update(b.phaseUntil);assert.equal(b.snapshot(b.phaseUntil).asset,'chin');
 b.setMain('sleep',100000);b.setSeason('winter',100001);assert.equal(b.snapshot(100002).asset,'sleep');
 b.setMain('idle',100003);b.setSeason('auto',100004,7);assert.equal(b.snapshot(100004).asset,'idle');
});
test('工作按序列整轮随机停留，不被待机定时器、点击、消息打断',()=>{
 let value=0;const b=new PetBehavior({duration,random:()=>value});b.setMain('work',0);
 assert.equal(b.phaseUntil%16340,0);assert(b.phaseUntil>=25000);
 value=.9;b.update(b.phaseUntil);assert.equal(b.phase,'chin');assert.equal(b.click(b.phaseStarted+1),null);
 assert(!b.message({kind:'action',action:'heart'},b.phaseStarted+20000));
 b.update(36000000);assert.equal(b.main,'work');assert.equal(b.temporary,null);assert(b.phaseUntil>36000000);
});
test('点击临时动作结束回待机；休眠、拖动、静音禁止冲突',()=>{
 const b=new PetBehavior({random:()=>.1,duration});assert.equal(b.click(100),'wave');assert.equal(b.snapshot(100).asset,'greywave');
 b.update(2701);assert.equal(b.snapshot(2701).asset,'greyidle');
 b.suspend(3000);assert(!b.trigger('kiss',3001));b.update(900000);assert.equal(b.temporary,null);b.resume(900001);
 b.setMain('sleep',900002);assert.equal(b.click(900003),null);b.update(1900000);assert.equal(b.snapshot(1900000).asset,'sleep');
 b.setMain('idle',1900001);b.setQuiet(true,1900002);b.update(2900000);assert.equal(b.temporary,null);
});
test('低频伸懒腰只在无互动待机触发，工作计时随拖动暂停',()=>{
 const b=new PetBehavior({random:()=>0,duration});b.update(239999);assert.equal(b.temporary,null);
 b.update(240000);assert.equal(b.temporary.action,'stretch');b.update(243000);assert.equal(b.temporary,null);
 b.click(250000);b.update(480000);assert.equal(b.temporary,null);
 b.setMain('work',500000);const end=b.phaseUntil;b.suspend(501000);b.resume(601000);assert.equal(b.phaseUntil,end+100000);
});

test('两档季节兼容旧设置、彩蛋播完恢复工作/睡觉、特效按原预览消散',()=>{
 const b=new PetBehavior({duration,season:'spring'});assert.equal(b.season,'spring-summer');b.setSeason('winter',0);assert.equal(b.season,'autumn-winter');
 b.setMain('work',1000);const end=b.phaseUntil;assert(b.easterEgg('dash',2000));assert.equal(b.snapshot(2000).asset,'dash');b.update(2000+2601);assert.equal(b.snapshot(4601).main,'work');assert.equal(b.snapshot(4601).asset,'greytyping');assert.equal(b.phaseUntil,end+2600);
 b.setMain('sleep',5000);assert(b.easterEgg('dash',5100));b.update(7800);assert.equal(b.snapshot(7800).asset,'sleep');
 b.setMain('idle',9000);assert(b.trigger('kiss',9100));b.update(11800);assert.equal(b.temporary,null);assert.equal(b.effect.action,'kiss');b.update(14101);assert.equal(b.effect,null);
});
