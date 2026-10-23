"use strict";
// Server-side only. Recognize the spelling already saved in Railway.
const key=()=>String(process.env.EXPLABS_API_KEY||process.env.EXPlabs_API_Key||'').trim();
const configured=()=>Boolean(key());
let queue=Promise.resolve();
const BASE_URL=()=>String(process.env.KAIROQ_EXPERIENTIAL_URL||'https://api.experientiallabs.ai/v1').replace(/\/+$/,'');
const RETRY=new Set([429,502,503,504]),MAX_TRIES=Number(process.env.KAIROQ_EXPERIENTIAL_TRIES||4);
const MAX_WAIT_MS=Number(process.env.KAIROQ_EXPERIENTIAL_MAX_WAIT_MS||30000),BASE_WAIT_MS=Number(process.env.KAIROQ_EXPERIENTIAL_BASE_WAIT_MS||2000);
// While the gateway asked to slow down, every call (also the small ones) waits, so they do
// not all hit it at once.
let pauseUntil=0;
function retryWait(header,attempt){
 const secs=Number(header),at=Date.parse(header||'');
 const asked=Number.isFinite(secs)&&secs>=0?secs*1000:Number.isFinite(at)?at-Date.now():NaN;
 const backoff=BASE_WAIT_MS*2**(attempt-1)*(0.75+Math.random()*0.5);
 return Math.max(0,Math.min(MAX_WAIT_MS,Number.isFinite(asked)&&asked>0?asked:backoff));
}
async function cooldown(signal){const ms=pauseUntil-Date.now();if(ms>0)await new Promise((resolve,reject)=>{const t=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(t);reject(signal.reason||Error('Aborted'))},{once:true})})}
function callProject(opts,services){
 // Small requests (the quick questions, suggestions) do not wait behind whole-app builds.
 if(Number.isInteger(opts.maxOutputTokens)&&opts.maxOutputTokens<=2500)return run(opts,services);
 const task=queue.then(()=>run(opts,services));
 queue=task.catch(()=>{});
 return task;
}
async function run(opts,{enforceBudget,recordUsage,parse}){
 opts.signal?.throwIfAborted();
 const model='gpt-6-luna'; // Published $0.10/M input, $0.50/M output; no sampling overrides.
 const maxOutput=Number.isInteger(opts.maxOutputTokens)?Math.max(512,Math.min(20000,opts.maxOutputTokens)):20000;
 let images=0;const inputText=JSON.stringify(opts.messages||[],(k,v)=>{if(k==='image_url'&&v&&typeof v==='object'){images++;return '[rendered screenshot]';}return v;});const input=Math.ceil(inputText.length/2)+images*16384;
 const reserve=(input*0.10+maxOutput*0.50)/1e6;
 const totals=await enforceBudget();
 const daily=Number(process.env.DAILY_COST_LIMIT_USD||2),monthly=Number(process.env.MONTHLY_COST_LIMIT_USD||30);
 if((daily>0&&totals.daily+reserve>daily)||(monthly>0&&totals.monthly+reserve>monthly))throw Error('Experiential builder budget insufficient');
 const body=JSON.stringify({model,messages:opts.messages,response_format:{type:'json_object'},max_completion_tokens:maxOutput,safety_identifier:'kairoq-builder'});
 // A busy gateway (429, or 502/503/504 before any answer) is asked again a few times, waiting
 // what it asks for (Retry-After) or longer each time, capped, instead of failing the build.
 let response,data;
 for(let attempt=1;;attempt++){
  await cooldown(opts.signal);
  response=await fetch(BASE_URL()+'/chat/completions',{
   method:'POST',headers:{Authorization:'Bearer '+key(),'Content-Type':'application/json'},
   signal:opts.signal?AbortSignal.any([opts.signal,AbortSignal.timeout(480000)]):AbortSignal.timeout(480000),body
  });
  data=await response.json().catch(()=>({}));
  if(!RETRY.has(response.status)||attempt>=MAX_TRIES)break;
  const wait=retryWait(response.headers.get('retry-after'),attempt);
  pauseUntil=Math.max(pauseUntil,Date.now()+wait);
  console.warn('[experiential-builder] '+response.status+', retrying in '+Math.round(wait/1000)+'s ('+attempt+'/'+(MAX_TRIES-1)+')');
 }
 if(!response.ok)throw Error('Experiential '+response.status+': '+String(data.error?.message||data.error||'Request rejected').slice(0,220));
 // Record usage before parsing: invalid model output can still incur cost.
 const reported=Number(data.usage?.cost);
 const cost=Number.isFinite(reported)?reported:reserve;
 await recordUsage({...data.usage,cost},{purpose:opts.purpose||'developer-build',provider:'experiential',model,cost_estimated:!Number.isFinite(reported)});
 const raw=data.choices?.[0]?.message?.content;
 const text=typeof raw==='string'?raw:Array.isArray(raw)?raw.map(x=>x.text||'').join(''):'';
 if(!text.trim())throw Error('Experiential returned no code; finish='+data.choices?.[0]?.finish_reason);
 console.log('[experiential-builder] response '+JSON.stringify({model,cost,characters:text.length,finish:data.choices?.[0]?.finish_reason}));
 return parse(text,model);
}
module.exports={configured,callProject,retryWait};
