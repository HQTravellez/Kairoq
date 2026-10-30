'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const P=require('../voice-provider'),routes=require('../voice-routes');
const env={KAIROQ_VOICE_URL:'https://voice.example',KAIROQ_VOICE_KEY:'x'.repeat(32)};
const wav=Buffer.from('RIFFtestWAVEaudio');
test('provider refuses missing credentials and unsafe service URLs',()=>{
 assert.throws(()=>P.config({}),/not configured/);
 for(const u of ['http://public.example','https://a:b@host','https://host/path'])assert.throws(()=>P.config({...env,KAIROQ_VOICE_URL:u}));
 assert.equal(P.config({...env,KAIROQ_VOICE_URL:'http://voice.railway.internal:8080'}).base,'http://voice.railway.internal:8080');
});
test('speech uses fixed endpoint and never follows redirects',async()=>{
 const data=await P.speech({text:'hello'},{env,fetchImpl:async(url,opts)=>{assert.equal(url,'https://voice.example/v1/speech');assert.equal(opts.redirect,'error');assert.equal(opts.headers.Authorization,'Bearer '+env.KAIROQ_VOICE_KEY);assert.deepEqual(JSON.parse(opts.body),{text:'hello',voice:'af_heart',speed:1});return new Response(wav,{headers:{'Content-Type':'audio/wav'}});}});
 assert.deepEqual(data,wav);
 for(const input of [{text:''},{text:'x'.repeat(2001)},{text:'hi',voice:'../../etc'},{text:'hi',speed:NaN}])await assert.rejects(P.speech(input),{status:422});
});
test('bad upstream audio, errors and oversize responses are rejected',async()=>{
 await assert.rejects(P.speech({text:'hi'},{env,fetchImpl:async()=>new Response('secret',{status:500})}),/Voice request failed/);
 await assert.rejects(P.speech({text:'hi'},{env,fetchImpl:async()=>new Response('not audio')}),{status:502});
 await assert.rejects(P.speech({text:'hi'},{env,fetchImpl:async()=>new Response(Buffer.alloc(P.MAX_AUDIO+1))}),{status:502});
});
test('transcription validates input and returns only expected fields',async()=>{
 assert.deepEqual(await P.transcribe(wav,{env,fetchImpl:async()=>new Response(JSON.stringify({text:'hello',language:'en',secret:'hidden'}))}),{text:'hello',language:'en',model:'whisper-tiny'});
 await assert.rejects(P.transcribe(Buffer.alloc(0)),{status:413});
});
test('HTTP routes enforce authentication, origin, parse errors and audio delivery',async t=>{
 let calls=0;const server=http.createServer((req,res)=>routes.handle(req,res,{authenticated:r=>r.headers.authorization==='Bearer owner',service:{speech:async()=>{calls++;return wav;},voices:async()=>({voices:[]}),transcribe:async()=>({text:'hi'})}}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/voice/speech',{method:'POST',body:'{}'})).status,401);
 assert.equal((await fetch(base+'/api/voice/speech',{method:'POST',headers:{authorization:'Bearer owner',origin:'https://evil.example'},body:'{}'})).status,403);
 assert.equal(calls,0);
 assert.equal((await fetch(base+'/api/voice/speech',{method:'POST',headers:{authorization:'Bearer owner'},body:'invalid'})).status,400);
 const r=await fetch(base+'/api/voice/speech',{method:'POST',headers:{authorization:'Bearer owner'},body:'{"text":"hi"}'});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),wav);
});
