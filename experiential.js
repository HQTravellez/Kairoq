"use strict";
// Server-side only. Recognize the spelling already saved in Railway.
const key=()=>String(process.env.EXPLABS_API_KEY||process.env.EXPlabs_API_Key||'').trim();
const configured=()=>Boolean(key());
let queue=Promise.resolve();
function callProject(opts,services){
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
 const response=await fetch('https://api.experientiallabs.ai/v1/chat/completions',{
  method:'POST',headers:{Authorization:'Bearer '+key(),'Content-Type':'application/json'},
  signal:opts.signal?AbortSignal.any([opts.signal,AbortSignal.timeout(240000)]):AbortSignal.timeout(240000),body:JSON.stringify({model,messages:opts.messages,response_format:{type:'json_object'},max_completion_tokens:maxOutput,safety_identifier:'kairoq-builder'})
 });
 const data=await response.json().catch(()=>({}));
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
module.exports={configured,callProject};
