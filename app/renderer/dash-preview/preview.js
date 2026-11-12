const $=id=>document.getElementById(id),base='../../assets/motions/grey-dash-v29/';
const config=await fetch(base+'timings.json').then(r=>r.json());
const images=Array.from({length:16},(_,i)=>{const im=new Image();im.src=base+`frame-${String(i+1).padStart(2,'0')}.png`;return im;});
await Promise.all(images.map(im=>im.decode()));
const quick=[150,150,150,150,150,80,60,150,150,150,150,150,150,80,60,150];
const normalize=value=>Math.max(20,Math.min(2000,Math.round(Number(value)/10)*10||150));
let durations=[...config.durations];try{const saved=JSON.parse(localStorage.getItem('here-dash-v29'));if(Array.isArray(saved)&&saved.length===16&&saved.every(Number.isFinite))durations=saved.map(normalize);}catch{}
let mode='both',started=performance.now(),paused=false,frozen=0,current=0;
const labels=['站立','起步','迈出','展开','落脚','收腿','并拢','站稳'];
for(let i=0;i<16;i++){
 const card=document.createElement('div');card.className='frame'+([5,6,13,14].includes(i)?' recovery':'');card.dataset.frame=i;
 const button=document.createElement('button'),image=document.createElement('img');image.src=images[i].src;image.alt=`第 ${i+1} 帧 · ${labels[i%8]}`;button.append(image);button.onclick=()=>seek(i);
 const text=document.createElement('span');text.textContent=`${String(i+1).padStart(2,'0')} · ${labels[i%8]}`;
 const label=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='20';input.max='2000';input.step='10';input.value=durations[i];input.dataset.duration=i;input.setAttribute('aria-label',`第${i+1}帧时长毫秒`);input.onchange=()=>{durations[i]=normalize(input.value);input.value=durations[i];persist();seek(i);};label.append(input,document.createTextNode('ms'));card.append(button,text,label);$(i<8?'right-frames':'left-frames').append(card);
}
const canvas=$('motion'),ctx=canvas.getContext('2d');ctx.scale(2,2);
function indices(){return mode==='right'?config.directions.right:mode==='left'?config.directions.left:Array.from({length:16},(_,i)=>i);}
function durationOf(list){return list.reduce((sum,i)=>sum+durations[i],0);}
function elapsed(now){return Math.max(0,paused?frozen:now-started);}
function frameAt(time){const list=indices();let rest=time%durationOf(list);for(const i of list){if(rest<durations[i])return i;rest-=durations[i];}return list.at(-1);}
function persist(){try{localStorage.setItem('here-dash-v29',JSON.stringify(durations));}catch{}}
function updateModes(){document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));}
function seek(index){if(!indices().includes(index)){mode=index<8?'right':'left';updateModes();}const list=indices();frozen=durationOf(list.slice(0,list.indexOf(index)));paused=true;$('pause').textContent='播放';render(performance.now());}
function restart(){started=performance.now();frozen=0;paused=false;$('pause').textContent='暂停';render(performance.now());}
function preset(values){durations=[...values];document.querySelectorAll('[data-duration]').forEach(input=>input.value=durations[Number(input.dataset.duration)]);persist();restart();}
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;updateModes();restart();});
$('quick').onclick=()=>preset(quick);$('original').onclick=()=>preset(Array(16).fill(150));$('replay').onclick=restart;
$('pause').onclick=()=>{if(paused){started=performance.now()-frozen;paused=false;}else{frozen=elapsed(performance.now());paused=true;}$('pause').textContent=paused?'播放':'暂停';render(performance.now());};
$('step').onclick=()=>{const list=indices(),index=frameAt(elapsed(performance.now()));seek(list[(list.indexOf(index)+1)%list.length]);};
$('save').onclick=()=>{const blob=new Blob([JSON.stringify({...config,durations},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='grey-dash-timings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function render(now){current=frameAt(elapsed(now));ctx.clearRect(0,0,460,460);ctx.fillStyle='#fbfbfb';ctx.fillRect(0,0,460,460);ctx.drawImage(images[current],21,20,418,420);$('frame-label').textContent=`${current<8?'向右':'向左'} · 第 ${current+1} / 16 帧 · ${labels[current%8]}`;document.querySelectorAll('.frame').forEach(card=>card.setAttribute('aria-current',String(Number(card.dataset.frame)===current)));$('status').textContent=`向右 ${(durationOf(config.directions.right)/1000).toFixed(2)} 秒 · 向左 ${(durationOf(config.directions.left)/1000).toFixed(2)} 秒 · 全循环 ${(durationOf(Array.from({length:16},(_,i)=>i))/1000).toFixed(2)} 秒`;}
function tick(now){render(now);requestAnimationFrame(tick);}requestAnimationFrame(tick);
window.dashPreview={snapshot:()=>({mode,paused,current:frameAt(elapsed(performance.now())),durations:[...durations],totalMs:durationOf(indices()),loaded:images.every(im=>im.complete&&im.naturalWidth>0)}),seek,frameAt};
