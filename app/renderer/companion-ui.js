'use strict';
const $=id=>document.getElementById(id);
let state={configured:false,connected:false,canSend:false,duplex:false},operation=0;
let stateRevision=0;
const busy=new Set();
function feedback(text){$('feedback').textContent=text;}
function syncButtons(){for(const button of document.querySelectorAll('#sender button'))button.disabled=!state.connected||busy.has(button);}
function showState(value){
 state={...state,...value};
 const labels={unconfigured:'尚未连接',connecting:'正在连接…',connected:'已连接',reconnecting:'连接已断开，正在重试…',failed:'连接失败'};
 $('connection-status').textContent=labels[state.status]||'尚未连接';$('connection-status').dataset.state=state.status||'unconfigured';
 $('connection-detail').textContent=state.error||(state.connected?(state.duplex?'可以互相留句话，也可以分享此刻。':'已连接到旧版服务。'):'');
 $('welcome').hidden=state.configured;$('daily').hidden=!state.configured;
 $('test').hidden=!state.configured;$('test').disabled=state.status==='connecting';
 $('disconnect').hidden=!state.configured;$('import').textContent=state.configured?'更换连接文件':'导入连接文件';
 $('sender').hidden=!state.canSend;$('receiver').hidden=state.canSend;
 const peer=state.peerStatus;
 $('peer-status').textContent=!state.connected?'连接恢复后再看看':!state.canReceive?'双方更新后可看到对方状态':peer&&peer.expiresAt>Date.now()?peer.text:'还没有分享状态';
 syncButtons();
}
function duration(kind){const amount=Number($(kind+'-duration').value),unit=Number($(kind+'-unit').value),seconds=amount*unit;if(!Number.isSafeInteger(amount)||amount<1||![1,60,3600,86400].includes(unit)||seconds>2592000)throw new Error('保留时间请设置在 1 秒到 30 天之间。');return{seconds,amount,unit};}
function saveDuration(kind,value){try{localStorage.setItem('here-'+kind+'-duration',JSON.stringify(value));}catch{}}
for(const kind of ['message','status'])try{const v=JSON.parse(localStorage.getItem('here-'+kind+'-duration'));if(v&&Number.isSafeInteger(v.amount)&&v.amount>=1&&[1,60,3600,86400].includes(v.unit)&&v.amount*v.unit<=2592000){$(kind+'-duration').value=v.amount;$(kind+'-unit').value=v.unit;}}catch{}
async function run(button,fn,success){
 if(busy.has(button))return false;busy.add(button);button.disabled=true;
 try{const result=await fn();if(!result.ok)throw new Error(result.error||'暂时没有送出，请稍后再试');if(success)feedback(success);return result;}
 catch(error){feedback(error.message);return false;}finally{busy.delete(button);button.disabled=false;syncButtons();}
}
async function reload(){const current=++operation,revision=stateRevision;try{const config=await window.pet.companionConfig();if(current!==operation)return;if(revision===stateRevision)showState(config);$('role').value=config.role;$('url').value=config.url;if(config.configured)$('key').placeholder='已保存；更换时填写新密钥';}catch{feedback('设置暂时不可用，请重新打开。');}}
window.pet.onConnection(value=>{stateRevision++;showState(value);});
async function importConnection(event){
 const button=event.currentTarget;
 const result=await run(button,async()=>{const value=await window.pet.companionImport();return value.canceled?{ok:true,canceled:true}:value;});
 if(result&&!result.canceled){$('key').value='';$('advanced').open=false;feedback('连接已导入，正在连接…');await reload();}
}
$('connect').onclick=importConnection;$('import').onclick=importConnection;
$('test').onclick=event=>run(event.currentTarget,()=>window.pet.companionTest(),'连接成功。');
$('config-form').onsubmit=async event=>{event.preventDefault();const result=await run(event.submitter,()=>window.pet.companionSave({role:$('role').value,url:$('url').value.trim(),key:$('key').value.trim()}),'连接已保存。');if(result){$('key').value='';$('advanced').open=false;await reload();}};
$('disconnect').onclick=async event=>{if(!confirm('断开并移除这台电脑的连接？之后可以重新导入。'))return;const result=await run(event.currentTarget,()=>window.pet.companionDisconnect(),'已断开连接。');if(result){$('key').value='';$('url').value='';await reload();}};
$('message').oninput=()=>{$('message-count').textContent=Array.from($('message').value).length+' / 120';};
$('message-form').onsubmit=async event=>{event.preventDefault();const text=$('message').value.trim();if(!text)return feedback('先写一句话吧。');let time;try{time=duration('message');}catch(error){return feedback(error.message);}const result=await run(event.submitter,()=>window.pet.companionSend({kind:'message',text,durationSeconds:time.seconds}),'已送出，让这句话陪对方一会儿。');if(result){$('message').value='';$('message').oninput();saveDuration('message',time);}};
$('status-form').onsubmit=async event=>{event.preventDefault();let time;try{time=duration('status');}catch(error){return feedback(error.message);}const result=await run(event.submitter,()=>window.pet.companionSend({kind:'status',text:$('status').value.trim(),durationSeconds:time.seconds}),'状态已分享。');if(result)saveDuration('status',time);};
$('clear-status').onclick=async event=>{const result=await run(event.currentTarget,()=>window.pet.companionSend({kind:'status',text:'',durationSeconds:3600}),'状态已清除。');if(result)$('status').value='';};
document.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>run(button,()=>window.pet.companionSend({kind:'action',action:button.dataset.action}),'小动作已送出。'));
setInterval(()=>{if(state.peerStatus?.expiresAt<=Date.now())showState({peerStatus:null});},1000);
void reload();
