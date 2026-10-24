"use strict";
// OpenRouter advertises classifiers and content-safety models alongside assistants.
// A classifier must never be selected as a conversational fallback.
function isConversationalModel(model){
 const id=String(model?.id||'').toLowerCase(),name=String(model?.name||'').toLowerCase();
 if(!id)return false;
 return !/(?:content[ -]?safety|safety[ -]?classifier|moderation|prompt[ -]?guard|guardrail|nvidia\/nemotron.*safety)/i.test(id+' '+name);
}
function conversationalFallbacks(models,primary='',limit=3){
 return models.filter(m=>m.isFree&&m.id!==primary&&!m.id.startsWith('local/')&&m.id!=='openrouter/free'&&isConversationalModel(m))
 .sort((a,b)=>(b.context_length||0)-(a.context_length||0))
 .slice(0,Math.max(0,Math.min(3,limit))).map(m=>m.id);
}
module.exports={isConversationalModel,conversationalFallbacks};
