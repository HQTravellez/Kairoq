'use strict';
const el=id=>document.getElementById(id);let objectUrl;
async function run(button,action){button.disabled=true;el('status').textContent='Processing…';try{await action();el('status').textContent='Ready.';}catch(e){el('status').textContent=e.message;}finally{button.disabled=false;}}
async function checked(url,options){const r=await fetch(url,{...options,signal:AbortSignal.timeout(185000)});if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(r.status===401?'Please sign in to Kairoq, then return to this page.':j.error||'Voice service is unavailable.');}return r;}
el('generate').onclick=()=>run(el('generate'),async()=>{
 const text=el('text').value.trim();if(!text)throw Error('Enter some narration text.');
 const r=await checked('/api/voice/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice:el('voice').value})});
 if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(await r.blob());el('player').src=objectUrl;el('player').hidden=false;el('download').href=objectUrl;el('download').hidden=false;
});
el('transcribe').onclick=()=>run(el('transcribe'),async()=>{
 const file=el('file').files[0];if(!file||file.size>10*1024*1024)throw Error('Choose an audio file up to 10 MB.');
 el('transcript').value='';const r=await checked('/api/voice/transcriptions',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});el('transcript').value=(await r.json()).text;
});
window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);});
