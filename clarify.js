"use strict";
// Before a first build: up to three quick questions whose answers change what gets built
// (who signs in, which parts, payments, emails), each with tap-to-answer options. A request that
// is already clear gets none and is built at once. Free; when the AI is slow or unsure, nothing
// is asked and the build starts as before.
const SYSTEM=`You are Kairoq, a builder of apps and websites, talking with a small-business owner who just described what they want. You are warm, quick and specific: the way a good designer talks in a first meeting, never like a form.

First write "opening": one sentence that proves you understood the request in your own words, with one concrete detail from it, and that leads into the questions (for example "A field guide for Ontario birds with sighting tables — lovely. Two things so I get the data right:"). Plain words, no exclamation marks, no "Great idea!", no restating the whole request. If there are no questions, the sentence says what you will build and that you are starting ("A booking page for your yoga classes: starting on it now.").

Then ask at most 3 questions, only where the answer changes what gets built: how the main moment should work when the request leaves it open (how a booking is confirmed, how a drawing's colours reach the character), phone app or website when unclear, who uses it and signs in, which parts or pages, what it keeps, payments, emails or reminders. Never ask what the request already says, and never ask about colours, style, fonts or wording: the builder decides those with the owner later. A short, clear request gets no questions.

How a question reads: one idea, under 12 words, friendly and direct ("Who should be able to add sightings?"), never "Please specify…". Each has 2 to 4 options the owner can tap: a label of a few words and one plain sentence saying what it means for them, not for the code. Put the option you would choose first and set "recommended": 0; its sentence says in a few words why you would choose it. Set "multi": true when several can apply together.
Respond with ONLY JSON: {"opening":"…","questions":[{"q":"…?","options":[{"label":"…","detail":"…"},{"label":"…","detail":"…"}],"recommended":0,"multi":false}]}`;
const TIMEOUT_MS=20000;

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
// The AI's answer, cleaned: at most 3 questions, 2 to 4 distinct options each.
function clean(raw){
 const out=[];
 for(const x of Array.isArray(raw&&raw.questions)?raw.questions:[]){
  // Options are a label and one sentence ({label, detail}) or, from older models, a plain label.
  const raw=(Array.isArray(x&&x.options)?x.options:[]).map(o=>typeof o==='string'?{label:clip(o,48),detail:''}:{label:clip(o&&(o.label||o.text),48),detail:clip(o&&(o.detail||o.description),140)}).filter(o=>o.label);
  const seen=new Set(),list=raw.filter(o=>!seen.has(o.label.toLowerCase())&&seen.add(o.label.toLowerCase())).slice(0,4);
  const q=clip(x&&x.q,140),opts=list.map(o=>o.label);
  if(q.length<6||opts.length<2)continue;
  const r=Number(x.recommended);
  out.push({q:/[?]$/.test(q)?q:q+'?',options:opts,...(list.some(o=>o.detail)?{details:list.map(o=>o.detail)}:{}),...(Number.isInteger(r)&&r>=0&&r<opts.length?{recommended:r}:{}),multi:x.multi===true});
  if(out.length>=3)break;
 }
 return out;
}
// Long, detailed requests are clear enough already.
// Long requirements already give the builder enough context; do not slow these down with generic questions.
// Keep this bounded below the model's 1500-character context cap to avoid re-asking documented details.
function worthAsking(prompt){const t=clip(prompt,4000);return t.length>=3&&t.length<=600}
function opening(raw){const t=clip(raw&&raw.opening,220);return /^[A-Za-z0-9"'“(]/.test(t)&&t.length>=8?t:''}
// The opening line and the questions together ({opening, questions}); questions() keeps the old shape.
async function ask(prompt,{callModel,tier='standard'}={}){
 if(!callModel||!worthAsking(prompt))return{opening:'',questions:[]};
 const call=callModel({messages:[{role:'system',content:SYSTEM},{role:'user',content:clip(prompt,1500)}],tier,temperature:0.2,maxOutputTokens:1000,purpose:'clarify'},c=>{const t=String(c).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(a>=0&&b>a?t.slice(a,b+1):t)});
 try{const raw=await Promise.race([call,new Promise((_,rej)=>setTimeout(()=>rej(Error('timeout')),TIMEOUT_MS))]);return{opening:opening(raw),questions:clean(raw)}}
 catch{return{opening:'',questions:[]}}
}
async function questions(prompt,{callModel,tier='standard'}={}){
 if(!callModel||!worthAsking(prompt))return[];
 const ask=callModel({messages:[{role:'system',content:SYSTEM},{role:'user',content:clip(prompt,1500)}],tier,temperature:0.2,maxOutputTokens:900,purpose:'clarify'},c=>{const t=String(c).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1))});
 try{return clean(await Promise.race([ask,new Promise((_,rej)=>setTimeout(()=>rej(Error('timeout')),TIMEOUT_MS))]))}
 catch{return[]}
}
// The owner's answers, added to the request the builder reads.
function withAnswers(prompt,answers){
 const lines=(Array.isArray(answers)?answers:[]).slice(0,3).map(a=>({q:clip(a&&a.q,140),a:(Array.isArray(a&&a.a)?a.a:[a&&a.a]).map(x=>clip(x,60)).filter(Boolean)})).filter(x=>x.q&&x.a.length);
 if(!lines.length)return String(prompt||'');
 return String(prompt||'').trim()+'\n\nDetails from the owner:\n'+lines.map(x=>'- '+x.q+' '+x.a.join(', ')).join('\n');
}
module.exports={ask,questions,withAnswers,clean,worthAsking,opening};
