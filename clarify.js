"use strict";
// Before a first build: up to three quick questions whose answers change what gets built
// (who signs in, which parts, payments, emails), each with tap-to-answer options. A request that
// is already clear gets none and is built at once. Free; when the AI is slow or unsure, nothing
// is asked and the build starts as before.
const SYSTEM=`You help a small-business owner describe the app or website they want built.
Read their request. Ask at most 3 short questions, only where the answer changes what gets built
(who needs to sign in, which parts or pages, what data it keeps, payments, emails or reminders,
languages). Never ask about colours, style or wording: the builder chooses those. If the request
is already clear enough to build well, ask nothing.
Each question has 2 to 4 short options (a few words each) the owner can tap; set "multi": true
when several options can apply together.
Respond with ONLY JSON: {"questions":[{"q":"…?","options":["…","…"],"multi":false}]}`;
const TIMEOUT_MS=12000;

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
// The AI's answer, cleaned: at most 3 questions, 2 to 4 distinct options each.
function clean(raw){
 const out=[];
 for(const x of Array.isArray(raw&&raw.questions)?raw.questions:[]){
  const q=clip(x&&x.q,140),opts=[...new Set((Array.isArray(x&&x.options)?x.options:[]).map(o=>clip(o,48)).filter(Boolean))].slice(0,4);
  if(q.length<6||opts.length<2)continue;
  out.push({q:/[?]$/.test(q)?q:q+'?',options:opts,multi:x.multi===true});
  if(out.length>=3)break;
 }
 return out;
}
// Long, detailed requests are clear enough already.
function worthAsking(prompt){const t=clip(prompt,4000);return t.length>=3&&t.length<=280}
async function questions(prompt,{callModel,tier='standard'}={}){
 if(!callModel||!worthAsking(prompt))return[];
 const ask=callModel({messages:[{role:'system',content:SYSTEM},{role:'user',content:clip(prompt,600)}],tier,temperature:0.2,maxOutputTokens:500,purpose:'clarify'},c=>{const t=String(c).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1))});
 try{return clean(await Promise.race([ask,new Promise((_,rej)=>setTimeout(()=>rej(Error('timeout')),TIMEOUT_MS))]))}
 catch{return[]}
}
// The owner's answers, added to the request the builder reads.
function withAnswers(prompt,answers){
 const lines=(Array.isArray(answers)?answers:[]).slice(0,3).map(a=>({q:clip(a&&a.q,140),a:(Array.isArray(a&&a.a)?a.a:[a&&a.a]).map(x=>clip(x,60)).filter(Boolean)})).filter(x=>x.q&&x.a.length);
 if(!lines.length)return String(prompt||'');
 return String(prompt||'').trim()+'\n\nDetails from the owner:\n'+lines.map(x=>'- '+x.q+' '+x.a.join(', ')).join('\n');
}
module.exports={questions,withAnswers,clean,worthAsking};
