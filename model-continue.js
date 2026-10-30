"use strict";
// When a model reply hits its output limit (finish_reason "length"), ask the model to continue
// exactly where it stopped instead of failing: a cut-off JSON reply used to waste the whole call
// and fall back to another model. Up to KAIROQ_CONTINUATIONS (default 2) extra requests.
const CONTINUE='Your previous reply was cut off by the length limit. Continue exactly where you left off: output only the remaining characters, starting with the very next character. Do not repeat anything, do not restart the JSON, and do not add any preamble or code fences.';
const RETRY_EMPTY='Your previous attempt hit the output limit before emitting usable content. Retry now, be concise, skip explanation, and output only the required response format. Break work into tool/file batches when the protocol allows it.';
function maxContinuations(){const n=Number(process.env.KAIROQ_CONTINUATIONS);return Number.isInteger(n)&&n>=0?Math.min(n,4):2}
// Joins a continuation onto what came before. Only a stray opening code fence is dropped:
// removing "repeated" text could delete real content (code often repeats itself).
function merge(prev,next){return prev+String(next||'').replace(/^\s*```(?:json)?\s*\n/i,'')}
// ask(messages, onToken) → {content, finish}. Returns {content, finish, continuations}.
async function complete(ask,messages,{onToken,max=maxContinuations()}={}){
 let {content,finish}=await ask(messages,onToken);
 let n=0;
 if(finish==='length'&&!String(content||'').trim()&&max>0){
  n++;
  const retry=await ask([...messages,{role:'user',content:RETRY_EMPTY}],onToken);
  content=retry.content;finish=retry.finish;
 }
 while(finish==='length'&&n<max&&content){
  n++;
  const before=content;
  const r=await ask([...messages,{role:'assistant',content:before},{role:'user',content:CONTINUE}],onToken?(d,all)=>onToken(d,merge(before,all)):undefined);
  if(!r.content)break;
  content=merge(before,r.content);finish=r.finish;
 }
 return{content,finish,continuations:n};
}
module.exports={complete,merge,CONTINUE,RETRY_EMPTY};
