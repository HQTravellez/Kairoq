"use strict";
// Side-effect guard: after a change, Kairoq compares what the edit touched with what was asked.
// When a request about looks or text ("make the button blue") also changed saved data and
// bookings, payments or sign-in, the reply says so, so the owner can undo it before it costs
// them bookings. It only reports; nothing is blocked.
const AREAS=[
 {name:'saved data and bookings',files:/^(src\/backend\.json|sql\/|functions\/)/,code:/\b(collection\(|db\.sql|db\.collection|functions\.invoke|\.create\(|\.update\(|\.remove\()/,asked:/\b(book|reserv|order|form|save|stor|data|database|backend|collection|table|sql|function|automat|schedul|email|enquir|contact|submit|record|field|stock|inventor|ai\b|chat|assistant|menu item|import)/i},
 {name:'payments',files:/^src\/backend\.json$/,code:/\b(payments\.|checkout|stripe|price_[A-Za-z0-9]+)/i,asked:/\b(pay|checkout|stripe|price|pricing|subscri|purchase|buy|shop|cart|plan|deposit|refund)/i},
 {name:'sign-in',files:/(login|signin|sign-in|signup|auth)/i,code:/\b(auth\.|signIn|signUp|signOut|resetPassword|password)\b/,asked:/\b(log ?in|sign|account|password|auth|user|member|google)/i}
];
function changedLines(a='',b=''){
 const before=new Set(String(a).split('\n')),after=new Set(String(b).split('\n'));
 return[...String(b).split('\n').filter(l=>!before.has(l)),...String(a).split('\n').filter(l=>!after.has(l))].join('\n');
}
// message: what was asked. before/after: the app's files. Returns [{area, files}] for areas the
// change touched that the request did not mention.
function check(message,before={},after={}){
 const files=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(f=>before[f]!==after[f]);
 if(!files.length)return[];
 const out=[];
 for(const a of AREAS){
  if(a.asked.test(String(message||'')))continue;
  const hit=files.filter(f=>{
   const diff=changedLines(before[f],after[f]);
   if(a.name==='payments'&&f==='src/backend.json')return/"payments"|price_/.test(diff);
   if(a.name==='saved data and bookings'&&f==='src/backend.json')return!/"payments"|price_/.test(diff)||/"collections"|"access"|"automations"|"schedules"/.test(diff);
   return a.files.test(f)||a.code.test(diff);
  });
  if(hit.length)out.push({area:a.name,files:hit.slice(0,5)});
 }
 return out;
}
function note(found){return found.length?'This change also touched '+found.map(f=>f.area+' ('+f.files.join(', ')+')').join(' and ')+', which you did not ask about. If that was not intended, undo it from the version list.':''}
module.exports={check,note,changedLines};
