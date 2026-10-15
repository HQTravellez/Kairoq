"use strict";
// AI cost control for Kairoq Create: prompt-cache breakpoints for models that need them, and
// a cost report (per tier and model) from the usage ledger so the owner can see real margins.

// Claude models on OpenRouter cache a prompt prefix only when a block is marked with
// cache_control (cache writes cost 1.25x, reads 0.1x of the input price). DeepSeek, OpenAI and
// Gemini cache automatically, so their messages are left as they are.
// Breakpoints: the system prompt (rules, design brief, skills, knowledge: the same for every
// message of a project) and the last two large user messages (the project files, and in agent
// mode the latest step), so retries and agent steps re-read everything before them from cache.
const MIN_CHARS=3500;// about 1,000 tokens, the smallest prefix Claude caches
function needsBreakpoints(model){return process.env.KAIROQ_PROMPT_CACHE!=='off'&&/^anthropic\//.test(String(model||''))}
function textLength(content){return typeof content==='string'?content.length:Array.isArray(content)?content.reduce((n,p)=>n+(p&&p.type==='text'?String(p.text||'').length:1000),0):0}
function mark(message){
 const parts=typeof message.content==='string'?[{type:'text',text:message.content}]:Array.isArray(message.content)?message.content.map(p=>({...p})):null;
 if(!parts||!parts.length)return message;
 parts[parts.length-1]={...parts[parts.length-1],cache_control:{type:'ephemeral'}};
 return{...message,content:parts};
}
function withCacheBreakpoints(messages,model){
 if(!needsBreakpoints(model)||!Array.isArray(messages))return messages;
 const marks=new Set();
 if(messages[0]&&messages[0].role==='system'&&textLength(messages[0].content)>=MIN_CHARS)marks.add(0);
 const users=messages.map((m,i)=>[m,i]).filter(([m])=>m.role==='user'&&textLength(m.content)>=MIN_CHARS).map(([,i])=>i);
 for(const i of users.slice(-2))marks.add(i);
 return messages.map((m,i)=>marks.has(i)?mark(m):m);
}

// usage rows: {at, cost, prompt_tokens, completion_tokens, cached_tokens, context:{purpose, model, tier, design}}
function summarize(rows,{since,creditPrice=Number(process.env.KAIROQ_CREDIT_PRICE_USD||0.25),credits={}}={}){
 const from=since||new Date(Date.now()-30*86400000).toISOString();
 const groups=new Map();
 for(const r of rows||[]){
  if(!r||r.context?.purpose!=='developer-build'||String(r.at||'')<from)continue;
  const tier=r.context.design?'design':r.context.image?'image':r.context.tier||'standard';
  const key=tier+'|'+(r.context.model||'?');
  const g=groups.get(key)||{tier,model:r.context.model||'?',calls:0,cost:0,prompt_tokens:0,cached_tokens:0,completion_tokens:0};
  g.calls++;g.cost+=Number(r.cost)||0;g.prompt_tokens+=Number(r.prompt_tokens)||0;g.cached_tokens+=Number(r.cached_tokens)||0;g.completion_tokens+=Number(r.completion_tokens)||0;
  groups.set(key,g);
 }
 const list=[...groups.values()].map(g=>({...g,cost:round(g.cost),avg_cost:round(g.cost/g.calls),cached_share:g.prompt_tokens?Math.round(g.cached_tokens/g.prompt_tokens*100):0,
  // What one message of this tier sells for, to compare with the average AI call.
  credit_value:credits[g.tier]?round(credits[g.tier]*creditPrice):null})).sort((a,b)=>b.cost-a.cost);
 return{since:from,credit_price_usd:creditPrice,total_cost:round(list.reduce((n,g)=>n+g.cost,0)),total_calls:list.reduce((n,g)=>n+g.calls,0),groups:list};
}
function round(n){return Math.round(n*10000)/10000}
module.exports={withCacheBreakpoints,needsBreakpoints,summarize,MIN_CHARS};
