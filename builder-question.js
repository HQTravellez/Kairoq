'use strict';
// A question the builder asks before it builds, and the owner's answer to it.
// A question carries 2 to 4 short options and the index of the one the builder recommends.
// The chat shows the options as buttons; a typed "ok"/"yes" picks the recommended one, and a
// typed option (its text or its number) picks that one. Asking a question never costs a credit.

const clip=(s,n)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
function choices(value,recommended){
 const raw=(Array.isArray(value)?value:typeof value==='string'?[value]:[]).flatMap(o=>{
  const text=String(typeof o==='string'?o:o&&(o.label||o.text)||'').replace(/^\s*Options:\s*/i,'');
  return /^\s*1[.)]\s+/.test(text)?text.split(/(?:^|\s+)[1-4][.)]\s+/).filter(Boolean):[text];
 });
 const marked=raw.findIndex(o=>/\(recommended\)/i.test(o));
 const options=[...new Set(raw.map(o=>clip(o.replace(/\s*\(recommended\)/ig,''),160)).filter(Boolean))].slice(0,4);
 const r=Number(recommended);
 return{options,recommended:options.length?(marked>=0?marked:Number.isInteger(r)&&r>=0&&r<options.length?r:0):null};
}

// A question from a model reply: {"question":{"text","options","recommended"}}, a plain
// "question" string, or a key the model invented for it ("before_building", "ask").
function fromReply(value){
 if(!value||typeof value!=='object')return null;
 const raw=value.question??value.before_building??value.ask??value.clarify;
 if(!raw)return null;
 const q=typeof raw==='string'?{text:raw}:raw;
 const text=clip(q.text||q.question,400);
 if(!text)return null;
 return{text,...choices(q.options,q.recommended)};
}

// Discuss replies are plain text. A choice is asked on its last line:
// "QUESTION: Should guests book instantly? | Request the hotel confirms | Instant booking"
// with the recommended option first. A JSON reply (the model copying the build format) is read too.
function fromText(answer){
 const t=String(answer||'').trim();
 if(t.startsWith('{')){
  try{const v=JSON.parse(t);const q=fromReply(v);if(q){const plan=(Array.isArray(v.plan)?v.plan:[]).map(x=>'- '+clip(x,160)).filter(x=>x.length>2);return{text:[clip(v.message,800),plan.join('\n')].filter(Boolean).join('\n\n'),question:q}}}catch{}
 }
 const m=/(?:^|\n)\s*QUESTION:\s*([^\n]+)\s*$/i.exec(t);
 if(!m)return{text:t,question:null};
 const [head,...opts]=m[1].split('|').map(s=>s.trim()).filter(Boolean);
 if(!head)return{text:t,question:null};
 return{text:t.slice(0,m.index).trim(),question:{text:clip(head,400),...choices(opts,0)}};
}

// The message a stored question shows in the chat and in the model's history.
function display(message,q){
 if(!q)return message;
 return[String(message||'').trim(),'**'+q.text+'**'].filter(Boolean).join('\n\n');
}
function historyText(m){
 if(!m.question||!m.question.options||!m.question.options.length)return m.text;
 return m.text+'\nOptions: '+m.question.options.map((o,i)=>(i+1)+') '+o+(i===m.question.recommended?' (recommended)':'')).join('  ');
}

// The question still waiting for an answer: the builder's last message, when it asked one.
// A last message that ends with "?" (an older reply, or a question asked in prose) counts too.
function pending(meta){
 const last=substantive(meta&&meta.messages||[]).at(-1);
 if(!last||last.role!=='assistant')return null;
 if(last.question)return fromReply({question:last.question});
 return /\?\s*\**\s*$/.test(String(last.text||''))?{text:clip(last.text,400),options:[],recommended:null}:null;
}

// Free greetings and status acknowledgements must not erase an unanswered decision.
function substantive(messages){
 return messages.filter((m,i)=>{
  if(m.conversation_kind==='social'||m.conversation_kind==='status')return false;
  const social=entry=>entry?.role==='user'&&require('./builder-smalltalk').smallTalk(entry.text);
  if(social(m)&&messages[i+1]?.support)return false;
  if(m.role==='assistant'&&m.support&&social(messages[i-1]))return false;
  return true;
 });
}

const APPROVAL=/^(ok(ay)?|k|yes|yeah|yep|yup|sure|go|go ahead|go for it|do it|proceed|continue|sounds good|looks good|fine|perfect|great|approved?|confirm(ed)?|agreed?|build it|let'?s go|👍|✅)[\s.!👍]*$/i;
function isApproval(message){return APPROVAL.test(String(message||'').trim())}

// The owner's reply to a pending question, as an instruction the builder cannot misread.
// Returns null when the reply is not an answer (a new request is left as it is).
function answer(message,q){
 const t=String(message||'').trim();
 if(!q||!t||t.length>300)return null;
 const opts=q.options||[];
 const num=/^(?:option\s*)?#?([1-4])[.)]?$/i.exec(t);
 let choice=num&&opts[Number(num[1])-1]!==undefined?Number(num[1])-1:opts.findIndex(o=>o.toLowerCase()===t.toLowerCase());
 if(choice<0&&isApproval(t))choice=opts.length?q.recommended??0:-2;
 if(choice===-1)return null;
 const picked=choice>=0?opts[choice]:null;
 return{choice:picked,message:'You asked: "'+q.text+'" My answer: '+(picked?picked+'.':'yes, go with the option you recommended (or, if you did not recommend one, the safest choice that needs no invented data; say which in one sentence).')+' Do not ask this again: build it now, following your plan.'};
}

module.exports={fromReply,fromText,display,historyText,pending,isApproval,answer,substantive};
