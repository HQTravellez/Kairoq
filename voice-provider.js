'use strict';
// Original adapter for the independent Kokoro/Whisper HTTP service.
const MAX_AUDIO = 10 * 1024 * 1024;
function error(status,message){return Object.assign(new Error(message),{status});}
function config(env=process.env){
 const base=env.KAIROQ_VOICE_URL,key=env.KAIROQ_VOICE_KEY;
 if(!base||!key||key.length<32)throw error(503,'Voice service is not configured.');
 const u=new URL(base);
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw error(503,'Invalid voice service configuration.');
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&(/\.railway\.internal$/.test(u.hostname)||['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw error(503,'Voice service requires HTTPS or a private network.');
 return{base:u.origin,key};
}
async function request(route,{body,contentType='application/json',fetchImpl=fetch,env=process.env}={}){
 const {base,key}=config(env);
 let r;
 try{r=await fetchImpl(base+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':contentType},body,redirect:'error',signal:AbortSignal.timeout(180000)});}catch{throw error(503,'Voice service could not be reached.');}
 if(!r.ok){await r.body?.cancel();throw error([400,413,422,429].includes(r.status)?r.status:503,r.status===429?'Voice service is busy; retry shortly.':'Voice request failed.');}
 const reader=r.body.getReader();let size=0;const chunks=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_AUDIO)throw error(502,'Voice response was too large.');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
 return{bytes:Buffer.concat(chunks),type:r.headers.get('content-type')||''};
}
async function speech(input,opts={}){
 if(!input||typeof input.text!=='string'||!input.text.trim()||input.text.length>2000)throw error(422,'Enter 1–2000 characters.');
 const voice=input.voice||'af_heart',speed=input.speed??1;
 if(!['af_heart','bf_emma','ef_dora','ff_siwis','hf_alpha','if_sara','pf_dora'].includes(voice)||typeof speed!=='number'||!Number.isFinite(speed)||speed<0.5||speed>2)throw error(422,'Invalid voice or speed.');
 const r=await request('/v1/speech',{...opts,body:JSON.stringify({text:input.text,voice,speed})});
 if(!r.type.startsWith('audio/wav')||r.bytes.subarray(0,4).toString()!=='RIFF'||r.bytes.subarray(8,12).toString()!=='WAVE')throw error(502,'Voice service returned invalid audio.');
 return r.bytes;
}
async function transcribe(bytes,opts={}){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_AUDIO)throw error(413,'Upload audio up to 10 MB and 60 seconds.');
 const r=await request('/v1/transcriptions',{...opts,body:bytes,contentType:'application/octet-stream'});
 try{const j=JSON.parse(r.bytes);if(typeof j.text!=='string'||typeof j.language!=='string')throw Error();return{text:j.text,language:j.language,model:'whisper-tiny'};}catch{throw error(502,'Invalid transcription response.');}
}
async function voices(opts={}){const r=await request('/v1/voices',opts);return JSON.parse(r.bytes);}
module.exports={config,speech,transcribe,voices,MAX_AUDIO};
