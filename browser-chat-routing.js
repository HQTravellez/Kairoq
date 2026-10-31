"use strict";
// Browser intent and capability truth are owned by Kairoq, not by whichever LLM is selected.
// This keeps "can you browse?" and "check this site" behavior identical across models.

const DOMAIN_RE=/(?<![@\w])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|io|app|co|ai|net|org|ca|dev|tech|travel|co\.uk))(?:\/[^\s)\]}>]*)?/i;
const URL_RE=/https?:\/\/[^\s)\]}>]+/i;
const DENIAL_RE=/\b(?:i\s+)?(?:can(?:not|'t)|am unable to|do not|don't)\b[^.\n]{0,110}\b(?:browse|access|open|check|visit|search|look up|fetch|read)\b[^.\n]{0,100}\b(?:live\s+)?(?:web|internet|website|websites|site|sites|url|urls|external)/i;

function clean(value){return String(value||"").trim()}
function normalizeUrl(value){
 let s=clean(value).replace(/[),.;!?]+$/,"");
 if(!s)return"";
 if(!/^https?:\/\//i.test(s))s="https://"+s;
 try{
  const u=new URL(s);
  if(!["http:","https:"].includes(u.protocol)||!u.hostname.includes("."))return"";
  return u.href;
 }catch{return""}
}
function reference(text){
 const t=clean(text),url=URL_RE.exec(t)?.[0];
 if(url)return normalizeUrl(url);
 const domain=DOMAIN_RE.exec(t)?.[0];
 return domain?normalizeUrl(domain):"";
}
function recentReference(messages,limit=14){
 const rows=Array.isArray(messages)?messages:[];
 for(let i=rows.length-1,n=0;i>=0&&n<limit;i--,n++){
  const r=reference(rows[i]?.text||rows[i]?.content||"");
  if(r)return r;
 }
 return"";
}
function capabilityQuestion(message){
 const t=clean(message);
 return /\b(can|could|do|does|will|are|is)\b[^?\n]{0,80}\b(?:you|kairoq|it)\b[^?\n]{0,100}\b(?:browse|search|open|check|visit|access|read|look up|use)\b[^?\n]{0,80}\b(?:web|internet|websites?|sites?|urls?|online)/i.test(t)
  || /\b(?:web|browser|internet)\s+(?:access|capability|tools?)\b/i.test(t);
}
function directIntent(message){
 const t=clean(message);
 const ref=reference(t);
 if(ref){
  // A bare domain in chat is itself enough to mean "look at this" when accompanied by a
  // browsing verb; explicit URLs also count because users commonly paste a link alone.
  if(URL_RE.test(t))return true;
  if(/\b(check|open|browse|visit|look(?: at)?|inspect|review|research|search|read|see|analyse|analyze|tell me about|what(?:'s| is) (?:on|happening with))\b/i.test(t))return true;
  if(t.replace(DOMAIN_RE,"").trim().length<4)return true;
 }
 return /\b(search (?:the )?(?:web|internet)|look ?up|find (?:this|that|it) online|browse (?:the )?web|check (?:the )?website|open (?:the )?site)\b/i.test(t);
}
function contextualIntent(message,messages){
 const t=clean(message);
 if(!/\b(check|try|open|look|browse|visit|research|search|inspect|review|continue)\b[^.\n]{0,40}\b(?:again|it|that|the site|the website|there)\b/i.test(t)
    && !/^(?:check|try|look|open|browse)\s+again[.!?]*$/i.test(t))return false;
 return Boolean(recentReference(messages));
}
function route(message,messages=[]){
 const ref=reference(message)||recentReference(messages);
 const execute=directIntent(message)||contextualIntent(message,messages);
 return{
  execute,
  reference:ref,
  message:execute&&ref&&!reference(message)
   ? clean(message)+"\n\nBrowser continuity: continue with the previously referenced public website "+ref
   : clean(message)
 };
}
function falseCapabilityDenial(answer){return DENIAL_RE.test(clean(answer))}
function capabilityAnswer({browser=true,search=true}={}){
 if(browser||search){
  const abilities=[
   search?"search the public web":null,
   browser?"open and interact with public websites in Kairoq's guarded browser":null
  ].filter(Boolean).join(" and ");
  return "Yes. Kairoq can "+abilities+". When you ask me to check a site, I should use those tools and report what the browser actually observed. I should not describe the underlying model's standalone limitations as Kairoq's capabilities.";
 }
 return "Kairoq supports public web search and browser research, but those runtime tools are not available on this server right now. I can work from material you provide until the browser runtime is restored.";
}
function guardDiscussAnswer(message,answer,{browser=true,search=true,context=""}={}){
 if(!falseCapabilityDenial(answer))return answer;
 if(!(browser||search))return capabilityAnswer({browser,search});
 const observed=/Web research done for this request/i.test(String(context||""));
 return observed
  ?"Kairoq has live web access, and web research was already executed for this request. The draft response incorrectly described the underlying model's limitations instead of Kairoq's tools. I should answer from the observed research rather than claim I cannot browse."
  :capabilityAnswer({browser,search});
}
module.exports={normalizeUrl,reference,recentReference,capabilityQuestion,directIntent,contextualIntent,route,falseCapabilityDenial,capabilityAnswer,guardDiscussAnswer};
