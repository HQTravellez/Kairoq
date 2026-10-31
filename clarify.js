"use strict";
// Before a first build: normally ask nothing. Kairoq chooses safe, reversible defaults and starts.
// One short question is allowed only when the owner's goal itself is too vague to know what to build.
// Visual choices are never an onboarding gate: if the owner cares about colour, style, 3D, layout,
// motion or device, they can say it naturally in the request or change it later.
const SYSTEM=`You help a person start building with Kairoq.
Default behavior: ask NO question and let Kairoq start.

Ask at most ONE short question only when the request is so vague that you cannot identify the
product's core job or first useful outcome. Prefer a safe, reversible default over asking.

Never ask about:
- colours, fonts, style, visual mood, corners or spacing
- 3D versus no 3D, animation or visual effects
- desktop versus mobile when a responsive web experience is a safe default
- page lists, wording, layout or other choices Kairoq can sensibly decide
- technical stacks, databases, frameworks or AI models

If the owner already named what the product should do (for example CRM, booking system, dashboard,
restaurant menu, customer portal, landing page, inventory tool, API integration), ask nothing.
If they explicitly mention a visual preference such as "blue and white" or "3D", preserve it and
ask nothing.

When a question is truly necessary, make it plain and outcome-focused, with 2 to 3 short options.
Put the safest useful recommendation first and set "recommended": 0.
Respond with ONLY JSON: {"questions":[{"q":"…?","options":[{"label":"…","detail":"…"},{"label":"…","detail":"…"}],"recommended":0,"multi":false}]}`;
const TIMEOUT_MS=20000;

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
// The AI's answer, cleaned: at most one question, with 2 to 3 distinct options.
function clean(raw){
 const out=[];
 for(const x of Array.isArray(raw&&raw.questions)?raw.questions:[]){
  // Options are a label and one sentence ({label, detail}) or, from older models, a plain label.
  const raw=(Array.isArray(x&&x.options)?x.options:[]).map(o=>typeof o==='string'?{label:clip(o,48),detail:''}:{label:clip(o&&(o.label||o.text),48),detail:clip(o&&(o.detail||o.description),140)}).filter(o=>o.label);
  const seen=new Set(),list=raw.filter(o=>!seen.has(o.label.toLowerCase())&&seen.add(o.label.toLowerCase())).slice(0,3);
  const q=clip(x&&x.q,140),opts=list.map(o=>o.label);
  if(q.length<6||opts.length<2)continue;
  const r=Number(x.recommended);
  out.push({q:/[?]$/.test(q)?q:q+'?',options:opts,...(list.some(o=>o.detail)?{details:list.map(o=>o.detail)}:{}),...(Number.isInteger(r)&&r>=0&&r<opts.length?{recommended:r}:{}),multi:x.multi===true});
  if(out.length>=1)break;
 }
 return out;
}
// Long, detailed requests are clear enough already.
// Long requirements already give the builder enough context; do not slow these down with generic questions.
// Keep this bounded below the model's 1500-character context cap to avoid re-asking documented details.
function worthAsking(prompt){
 const t=clip(prompt,4000);
 if(t.length<3||t.length>600)return false;
 // A named product/job is enough for Kairoq to choose a sensible first version.
 if(/\b(crm|booking|reservation|dashboard|website|landing page|portal|store|shop|menu|inventory|calendar|scheduler|marketplace|saas|api|integration|workflow|automation|tracker|calculator|assistant|chatbot|gallery|portfolio|blog|form|directory|learning app|game)\b/i.test(t))return false;
 // Explicit visual/device instructions are preferences, not reasons to ask more.
 if(/\b(blue|red|green|black|white|purple|orange|pink|yellow|dark|light|3d|animation|mobile|iphone|android|responsive)\b/i.test(t)&&t.split(/\s+/).length>4)return false;
 // Only near-empty outcome descriptions should interrupt the user.
 return /^(?:(?:please|can you|could you|i want|i need|make|build|create)\s+)*(?:me\s+)?(?:an?\s+)?(?:app|website|web app|mobile app|platform|system|something)(?:\s+for me)?[.!?]*$/i.test(t)
   || t.split(/\s+/).length<=3&&!/\b(for|to|that|with)\b/i.test(t);
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
module.exports={questions,withAnswers,clean,worthAsking};
