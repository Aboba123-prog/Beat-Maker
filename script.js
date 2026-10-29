(function(){
'use strict';
var AudioContextClass=window.AudioContext||window.webkitAudioContext;
var audioContext=null;
var isPlaying=false;
var currentStep=0;
var nextNoteTime=0;
var schedulerTimer=null;
var bpm=120;
var swing=0;
var masterVolume=.7;
var stepsPerBar=16;
var activeSteps=16;
var sounds=['kick','snare','hihat','tomhi','tommid','tomlow','perc1','perc2'];
var labels={kick:'KICK',snare:'SNARE',hihat:'HI-HAT',tomhi:'TOM HI',tommid:'TOM MID',tomlow:'TOM LOW',perc1:'PERC 1',perc2:'PERC 2'};
var sequence={};
var mutedTracks={};
var trackVolumes={};
var visualTimers=[];
var $=function(id){return document.getElementById(id);};
sounds.forEach(function(s){sequence[s]=new Array(64).fill(false);mutedTracks[s]=false;trackVolumes[s]=1;});
document.addEventListener('DOMContentLoaded',init);

function init(){
if(!AudioContextClass){$('statusText').textContent='Web Audio is not supported in this browser';$('playBtn').disabled=true;return;}
sounds.forEach(function(s){
var group=document.createElement('div');
group.className='pad-row';
group.innerHTML='<div class="pad-label">'+labels[s]+'</div><div class="pad-group" data-sound="'+s+'"></div><div class="track-tools"><button type="button" class="track-button mute-btn" data-sound="'+s+'" aria-label="Mute '+labels[s]+'">M</button></div>';
$('pads').appendChild(group);
var padGroup=group.querySelector('.pad-group');
for(var i=0;i<stepsPerBar;i++){
var pad=document.createElement('button');
pad.type='button';
pad.className='pad';
pad.dataset.sound=s;
pad.dataset.step=i;
pad.setAttribute('aria-label',labels[s]+' step '+(i+1));
padGroup.appendChild(pad);
}
});
for(var n=1;n<=16;n++){
var num=document.createElement('div');
num.className='step-num'+(n%4===1?' beat':'');
num.textContent=n;
$('stepNumbers').appendChild(num);
}
createMixer();
setupControls();
updatePads();
updateBpm();
updateSwing();
updateVolume();
}

function ensureAudio(){
if(!audioContext)audioContext=new AudioContextClass();
if(audioContext.state==='suspended'&&audioContext.resume)audioContext.resume();
}

function createMixer(){
var mixer=$('mixer');
sounds.forEach(function(s){
var channel=document.createElement('div');
channel.className='mix-channel';
channel.innerHTML='<div class="mix-top"><span class="mix-name">'+labels[s]+'</span><span class="mix-value" id="mixval-'+s+'">100%</span></div><input type="range" min="0" max="100" value="100" data-mix="'+s+'" aria-label="'+labels[s]+' volume">';
mixer.appendChild(channel);
});
}

function setupControls(){
$('playBtn').addEventListener('click',play);
$('stopBtn').addEventListener('click',stop);
$('clearBtn').addEventListener('click',clearSequence);
$('downloadBtn').addEventListener('click',downloadWav);
$('saveBtn').addEventListener('click',saveProject);
$('loadBtn').addEventListener('click',function(){$('fileInput').click();});
$('fileInput').addEventListener('change',loadProject);
$('bpm').addEventListener('input',function(){bpm=parseInt(this.value,10);updateBpm();});
$('swing').addEventListener('input',function(){swing=parseInt(this.value,10)/100;updateSwing();});
$('volume').addEventListener('input',function(){masterVolume=parseInt(this.value,10)/100;updateVolume();});
$('pads').addEventListener('click',function(e){
var pad=e.target.closest?e.target.closest('.pad'):e.target;
if(!pad||!pad.classList||!pad.classList.contains('pad'))return;
var sound=pad.dataset.sound;
var step=parseInt(pad.dataset.step,10);
sequence[sound][step]=!sequence[sound][step];
pad.classList.toggle('active',sequence[sound][step]);
ensureAudio();
playSound(sound,audioContext.currentTime);
setStatus('Pattern edited');
});
$('pads').addEventListener('click',function(e){
var btn=e.target;
if(!btn.classList||!btn.classList.contains('mute-btn'))return;
var sound=btn.dataset.sound;
mutedTracks[sound]=!mutedTracks[sound];
btn.classList.toggle('muted',mutedTracks[sound]);
btn.textContent=mutedTracks[sound]?'X':'M';
var row=btn.parentNode.parentNode;
var pads=row.querySelectorAll('.pad');
for(var i=0;i<pads.length;i++)pads[i].classList.toggle('muted-track',mutedTracks[sound]);
});
$('mixer').addEventListener('input',function(e){
var s=e.target.dataset.mix;
if(!s)return;
trackVolumes[s]=parseInt(e.target.value,10)/100;
$('mixval-'+s).textContent=e.target.value+'%';
});
$('duplicateBtn').addEventListener('click',duplicateBar);
}

function updateBpm(){$('bpmValue').textContent=bpm;}
function updateSwing(){$('swingValue').textContent=Math.round(swing*100)+'%';}
function updateVolume(){$('volumeValue').textContent=Math.round(masterVolume*100)+'%';}
function setStatus(text){$('statusText').textContent=text;}

function updatePads(){
sounds.forEach(function(s){
for(var i=0;i<stepsPerBar;i++){
var pad=document.querySelector('.pad[data-sound="'+s+'"][data-step="'+i+'"]');
if(pad)pad.classList.toggle('active',!!sequence[s][i]);
}
});
}

function play(){
if(isPlaying)return;
ensureAudio();
isPlaying=true;
currentStep=0;
nextNoteTime=audioContext.currentTime+.05;
$('playBtn').disabled=true;
$('patternState').textContent='PLAYING';
setStatus('Playing pattern');
scheduler();
}

function stop(){
isPlaying=false;
if(schedulerTimer)clearTimeout(schedulerTimer);
schedulerTimer=null;
while(visualTimers.length)clearTimeout(visualTimers.pop());
Array.prototype.forEach.call(document.querySelectorAll('.pad.playing'),function(p){p.classList.remove('playing');});
$('playBtn').disabled=false;
$('patternState').textContent='READY';
setStatus('Playback stopped');
}

function clearSequence(){
stop();
sounds.forEach(function(s){
sequence[s]=new Array(64).fill(false);
mutedTracks[s]=false;
var btn=document.querySelector('.mute-btn[data-sound="'+s+'"]');
if(btn){btn.classList.remove('muted');btn.textContent='M';}
var all=document.querySelectorAll('.pad[data-sound="'+s+'"]');
for(var j=0;j<all.length;j++)all[j].classList.remove('muted-track');
});
updatePads();
setStatus('Pattern cleared');
}

function secondsPerStep(){return 60/bpm/4;}

function scheduler(){
if(!isPlaying)return;
while(nextNoteTime<audioContext.currentTime+.12){
scheduleStep(currentStep,nextNoteTime);
advanceStep();
nextNoteTime+=secondsPerStep();
}
schedulerTimer=setTimeout(scheduler,25);
}

function advanceStep(){currentStep=(currentStep+1)%activeSteps;}

function scheduleStep(step,time){
var actual=time+(step%2===1?secondsPerStep()*swing*.5:0);
sounds.forEach(function(s){
if(sequence[s][step]&&!mutedTracks[s])playSound(s,actual);
});
var delay=Math.max(0,(actual-audioContext.currentTime)*1000);
var timer=setTimeout(function(){
Array.prototype.forEach.call(document.querySelectorAll('.pad.playing'),function(p){p.classList.remove('playing');});
sounds.forEach(function(s){
var p=document.querySelector('.pad[data-sound="'+s+'"][data-step="'+(step%16)+'"]');
if(p&&sequence[s][step]&&!mutedTracks[s])p.classList.add('playing');
});
updateMeter(step);
},delay);
visualTimers.push(timer);
}

function updateMeter(step){
var meter=document.querySelectorAll('#levelMeter i');
var hits=0;
sounds.forEach(function(s){if(sequence[s][step]&&!mutedTracks[s])hits++;});
var count=Math.min(meter.length,Math.max(1,hits*2));
for(var i=0;i<meter.length;i++)meter[i].classList.toggle('on',i<count);
setTimeout(function(){
for(var j=0;j<meter.length;j++)meter[j].classList.remove('on');
},100);
}

function playSound(sound,time,ctx){
ctx=ctx||audioContext;
if(!ctx)return;
var g=ctx.createGain();
g.connect(ctx.destination);
var level=masterVolume*trackVolumes[sound];
var duration=.15;
var osc,noise,buffer,data,filter;
function envelope(end,vol){
g.gain.setValueAtTime(Math.max(.0001,vol),time);
g.gain.exponentialRampToValueAtTime(.0001,time+end);
}
switch(sound){
case'kick':
osc=ctx.createOscillator();
osc.type='sine';
osc.frequency.setValueAtTime(145,time);
osc.frequency.exponentialRampToValueAtTime(42,time+.18);
osc.connect(g);
envelope(.24,.95*level);
osc.start(time);
osc.stop(time+.25);
break;
case'snare':
case'hihat':
noise=ctx.createBufferSource();
duration=sound==='snare'?.19:.085;
buffer=ctx.createBuffer(1,Math.max(1,Math.floor(ctx.sampleRate*duration)),ctx.sampleRate);
data=buffer.getChannelData(0);
for(var i=0;i<data.length;i++)data[i]=Math.random()*2-1;
noise.buffer=buffer;
filter=ctx.createBiquadFilter();
filter.type='highpass';
filter.frequency.value=sound==='hihat'?7200:900;
noise.connect(filter);
filter.connect(g);
envelope(duration,(sound==='hihat'?.22:.42)*level);
noise.start(time);
noise.stop(time+duration);
break;
case'tomhi':
case'tommid':
case'tomlow':
var start=sound==='tomhi'?260:sound==='tommid'?185:125;
var end=sound==='tomhi'?115:sound==='tommid'?78:52;
duration=sound==='tomhi'?.13:sound==='tommid'?.16:.2;
osc=ctx.createOscillator();
osc.type='sine';
osc.frequency.setValueAtTime(start,time);
osc.frequency.exponentialRampToValueAtTime(end,time+duration);
osc.connect(g);
envelope(duration,.5*level);
osc.start(time);
osc.stop(time+duration+.01);
break;
case'perc1':
case'perc2':
osc=ctx.createOscillator();
osc.type='triangle';
osc.frequency.setValueAtTime(sound==='perc1'?420:580,time);
osc.frequency.exponentialRampToValueAtTime(sound==='perc1'?120:160,time+.09);
duration=.11;
osc.connect(g);
envelope(duration,(sound==='perc1'?.34:.28)*level);
osc.start(time);
osc.stop(time+duration);
break;
}
}

function duplicateBar(){
sounds.forEach(function(s){
for(var i=0;i<8;i++)sequence[s][i+8]=sequence[s][i];
});
updatePads();
setStatus('First half copied to second half');
}

function projectData(){
return {format:'BeatMakerStudio',version:1,bpm:bpm,swing:swing,masterVolume:masterVolume,sequence:sequence,mutedTracks:mutedTracks,trackVolumes:trackVolumes};
}

function downloadBlob(blob,name){
var url=URL.createObjectURL(blob);
var a=document.createElement('a');
a.href=url;
a.download=name;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(function(){URL.revokeObjectURL(url);},1500);
}

function saveProject(){
var blob=new Blob([JSON.stringify(projectData())],{type:'application/json'});
downloadBlob(blob,'beat-maker-project.json');
setStatus('Project saved as JSON');
}

function loadProject(e){
var file=e.target.files&&e.target.files[0];
if(!file)return;
var reader=new FileReader();
reader.onload=function(ev){
try{
var data=JSON.parse(ev.target.result);
if(!data.sequence)throw new Error('Invalid project');
stop();
sounds.forEach(function(s){
var arr=data.sequence[s];
sequence[s]=new Array(64).fill(false);
if(arr&&typeof arr.length==='number'){
for(var i=0;i<Math.min(64,arr.length);i++)sequence[s][i]=!!arr[i];
}
mutedTracks[s]=!!(data.mutedTracks&&data.mutedTracks[s]);
trackVolumes[s]=data.trackVolumes&&typeof data.trackVolumes[s]==='number'?Math.max(0,Math.min(1,data.trackVolumes[s])):1;
});
bpm=clamp(parseInt(data.bpm,10)||120,40,200);
swing=clamp(Number(data.swing)||0,0,1);
masterVolume=clamp(typeof data.masterVolume==='number'?data.masterVolume:.7,0,1);
activeSteps=16;
$('bpm').value=bpm;
$('swing').value=Math.round(swing*100);
$('volume').value=Math.round(masterVolume*100);
sounds.forEach(function(s){
var btn=document.querySelector('.mute-btn[data-sound="'+s+'"]');
if(btn){btn.classList.toggle('muted',mutedTracks[s]);btn.textContent=mutedTracks[s]?'X':'M';}
var mix=document.querySelector('[data-mix="'+s+'"]');
if(mix){mix.value=Math.round(trackVolumes[s]*100);$('mixval-'+s).textContent=mix.value+'%';}
var row=document.querySelector('.pad-row .pad[data-sound="'+s+'"]');
if(row){
var all=document.querySelectorAll('.pad[data-sound="'+s+'"]');
for(var j=0;j<all.length;j++)all[j].classList.toggle('muted-track',mutedTracks[s]);
}
});
updateBpm();
updateSwing();
updateVolume();
updatePads();
setStatus('Project loaded');
}catch(err){
alert('Не удалось загрузить проект. Проверьте JSON-файл.');
}
e.target.value='';
};
reader.readAsText(file);
}

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

function downloadWav(){
ensureAudio();
if(isPlaying)stop();
var button=$('downloadBtn');
button.disabled=true;
button.textContent='RENDERING...';
var C=window.OfflineAudioContext||window.webkitOfflineAudioContext;
if(!C){
button.disabled=false;
button.textContent='↓ EXPORT WAV';
alert('Этот браузер не поддерживает экспорт WAV.');
return;
}
var sampleRate=44100;
var duration=secondsPerStep()*activeSteps*2+1;
var offline;
try{
offline=new C(2,Math.ceil(duration*sampleRate),sampleRate);
}catch(err){
button.disabled=false;
button.textContent='↓ EXPORT WAV';
alert('Не удалось создать аудиофайл.');
return;
}
for(var loop=0;loop<2;loop++){
for(var step=0;step<activeSteps;step++){
var time=(loop*activeSteps+step)*secondsPerStep()+(step%2===1?secondsPerStep()*swing*.5:0);
sounds.forEach(function(s){
if(sequence[s][step]&&!mutedTracks[s])playSound(s,time,offline);
});
}
}
if(typeof offline.startRendering==='function'){
var completed=false;
function finishOnce(buffer){
if(completed)return;
completed=true;
finishWav(buffer,button);
}
offline.oncomplete=function(e){finishOnce(e.renderedBuffer);};
try{
var rendered=offline.startRendering();
if(rendered&&typeof rendered.then==='function'){
rendered.then(function(buffer){finishOnce(buffer);},function(){exportFailed(button);});
}
}catch(err2){
exportFailed(button);
}
}else{
exportFailed(button);
}
}

function exportFailed(button){
button.disabled=false;
button.textContent='↓ EXPORT WAV';
alert('Не удалось отрендерить WAV в этом браузере.');
}

function finishWav(buffer,button){
try{
downloadBlob(bufferToWav(buffer),'beat-maker-'+bpm+'bpm.wav');
button.textContent='EXPORTED';
setStatus('WAV exported');
setTimeout(function(){
button.textContent='↓ EXPORT WAV';
button.disabled=false;
},1300);
}catch(e){
exportFailed(button);
}
}

function bufferToWav(audioBuffer){
var channels=audioBuffer.numberOfChannels;
var length=audioBuffer.length;
var bytes=length*channels*2;
var array=new ArrayBuffer(44+bytes);
var view=new DataView(array);
function str(offset,value){
for(var i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));
}
str(0,'RIFF');
view.setUint32(4,36+bytes,true);
str(8,'WAVE');
str(12,'fmt ');
view.setUint32(16,16,true);
view.setUint16(20,1,true);
view.setUint16(22,channels,true);
view.setUint32(24,audioBuffer.sampleRate,true);
view.setUint32(28,audioBuffer.sampleRate*channels*2,true);
view.setUint16(32,channels*2,true);
view.setUint16(34,16,true);
str(36,'data');
view.setUint32(40,bytes,true);
var channelData=[];
for(var c=0;c<channels;c++)channelData.push(audioBuffer.getChannelData(c));
var offset=44;
for(var i=0;i<length;i++){
for(var c2=0;c2<channels;c2++){
var sample=clamp(channelData[c2][i],-1,1);
view.setInt16(offset,sample<0?sample*32768:sample*32767,true);
offset+=2;
}
}
return new Blob([array],{type:'audio/wav'});
}

window.addEventListener('beforeunload',function(){
if(schedulerTimer)clearTimeout(schedulerTimer);
if(audioContext&&audioContext.close)audioContext.close();
});
})();
