'use strict';
// Plain words for a failed builder message. Provider trouble (busy, timed out, a reply that was
// not usable) becomes one friendly line with a Try again button; real problems keep their text.
const BUSY=/provider|timed? ?out|timeout|rate.?limit|\b(429|502|503|504|529)\b|overloaded|unavailable|no coding model|usable project files|not json|needs a "files"|empty response|fetch failed|econn|socket|network|busy|upstream|no free llm|no configured free|free-tier provider|openrouter|model .*failed|capacity|too many requests/i;
const BUSY_TEXT='The free models could not finish this one, even after trying again. Nothing was changed and no credits were used.';
const BUILD_TEXT='I couldn\'t finish this change, even after several tries, so your app is as it was. Press Try again: it often works the second time.';
function plain(err){
 const raw=String((err&&err.message)||err||'').trim();
 if(!raw||BUSY.test(raw))return{text:BUSY_TEXT,busy:true,raw};
 // The builder's own edits did not fit after every attempt: the owner never sees code or files.
 if(/^The change could not be built after \d+ attempts/.test(raw))return{text:BUILD_TEXT,busy:false,raw};
 return{text:raw.slice(0,600),busy:false,raw};
}
// Keeps the owner's message and the failure in the project chat, so nothing disappears on reload.
function remember(builder,id,{message,mode,text}){
 try{
  const meta=builder.loadMeta(id),now=new Date().toISOString(),msg=String(message||'').trim().slice(0,12000);
  const users=meta.messages.filter(m=>m.role==='user');
  if(msg&&!(users.length&&users.at(-1).text===msg&&meta.messages.at(-1).role==='user'))meta.messages.push({role:'user',text:msg,mode,at:now});
  meta.messages.push({role:'assistant',text,failed:true,retry:msg||undefined,retry_mode:mode,at:now});
  builder.saveMeta(meta);
 }catch{}
}
module.exports={plain,remember,BUSY_TEXT,BUILD_TEXT};
