'use strict';
const provider=require('./voice-provider');
async function read(req,limit){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>limit)throw Object.assign(Error('Request too large.'),{status:413});chunks.push(c);}return Buffer.concat(chunks);}
async function handle(req,res,{authenticated,service=provider}={}){
 const route=(req.url||'').split('?')[0];
 if(!route.startsWith('/api/voice/'))return false;
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
  if(!authenticated||!authenticated(req)){json(401,{error:'Authentication required.'});return true;}
  const origin=req.headers.origin,site=req.headers['sec-fetch-site'];
  if(req.method==='POST'&&((site&&!['same-origin','none'].includes(site))||(origin&&new URL(origin).host!==req.headers.host))){json(403,{error:'Cross-site request refused.'});return true;}
  if(route==='/api/voice/voices'&&req.method==='GET')json(200,await service.voices());
  else if(route==='/api/voice/speech'&&req.method==='POST'){
   let data;try{data=JSON.parse(await read(req,16384));}catch(e){throw Object.assign(Error('Invalid JSON or oversized request.'),{status:e.status||400});}
   const wav=await service.speech(data);res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store','Content-Disposition':'attachment; filename="narration.wav"','X-Content-Type-Options':'nosniff'});res.end(wav);
  }else if(route==='/api/voice/transcriptions'&&req.method==='POST')json(200,await service.transcribe(await read(req,provider.MAX_AUDIO)));
  else json(404,{error:'Unknown voice endpoint.'});
 }catch(e){json(e.status||503,{error:e.status?e.message:'Voice service unavailable.'});}
 return true;
}
module.exports={handle};
