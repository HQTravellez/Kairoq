"use strict";
// Claude models straight from Anthropic (ANTHROPIC_API_KEY), with no OpenRouter in between: the
// owner's Anthropic credit pays for them. Uses Anthropic's own Messages API (its OpenAI-compatible
// endpoint is meant for testing only). The builder keeps OpenRouter-style model ids
// ("anthropic/claude-opus-5.5"); here they become Anthropic's ("claude-opus-5-5").
const URL_MESSAGES='https://api.anthropic.com/v1/messages';

function configured(env=process.env){return Boolean(String(env.ANTHROPIC_API_KEY||'').trim())}
function isClaude(model){return /^anthropic\//.test(String(model||''))}
function modelId(model){return String(model).replace(/^anthropic\//,'').replace(/\./g,'-')}

// Dollars per million tokens (input, output), used for Kairoq's budget: Anthropic's reply has
// token counts but no price. Same figures as the OpenCode engine; others use the builder's estimate.
function rates(model,fallback){
 const m=String(model||'');
 if(/claude-opus/.test(m))return[4,20];
 if(/claude-sonnet/.test(m))return[2,10];
 if(/claude-haiku/.test(m))return[0.1,0.5];
 return fallback||[5,25];
}

// OpenAI-style content (a string, or text and image_url parts) → Anthropic content blocks.
function blocks(content){
 if(typeof content==='string')return content;
 const out=[];
 for(const p of Array.isArray(content)?content:[]){
  if(p&&p.type==='text'&&p.text)out.push({type:'text',text:String(p.text)});
  else if(p&&p.type==='image_url'){
   const url=String(p.image_url&&p.image_url.url||p.image_url||'');
   const m=/^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/.exec(url);
   if(m)out.push({type:'image',source:{type:'base64',media_type:m[1],data:m[2]}});
   else if(/^https:\/\//.test(url))out.push({type:'image',source:{type:'url',url}});
  }
 }
 return out.length?out:'';
}
// System messages become the system prompt (cached: builds resend the same long rules every call);
// the rest stay in order as user and assistant turns.
function request(model,messages,{maxTokens=10000,stream=false}={}){
 const system=[],turns=[];
 for(const m of messages||[]){
  if(m.role==='system'){const t=typeof m.content==='string'?m.content:(Array.isArray(m.content)?m.content.map(p=>p.text||'').join('\n'):'');if(t.trim())system.push(t)}
  else if(m.role==='user'||m.role==='assistant'){const c=blocks(m.content);if(c&&(typeof c!=='string'||c.trim()))turns.push({role:m.role,content:c})}
 }
 const body={model:modelId(model),max_tokens:maxTokens,messages:turns};
 if(system.length)body.system=[{type:'text',text:system.join('\n\n'),cache_control:{type:'ephemeral'}}];
 if(stream)body.stream=true;
 return body;
}
function headers(env=process.env){return{'content-type':'application/json','x-api-key':String(env.ANTHROPIC_API_KEY||'').trim(),'anthropic-version':'2023-06-01'}}
// Anthropic's stop reasons → the builder's ("length" makes model-continue.js ask for the rest).
function finish(reason){return reason==='max_tokens'?'length':reason==='end_turn'||reason==='stop_sequence'?'stop':String(reason||'')}
// Token counts in the shape the builder records (cached input counts as input).
function usage(u){const input=(Number(u.input_tokens)||0)+(Number(u.cache_read_input_tokens)||0)+(Number(u.cache_creation_input_tokens)||0);return{prompt_tokens:input,completion_tokens:Number(u.output_tokens)||0,total_tokens:input+(Number(u.output_tokens)||0)}}

async function readStream(body,onToken){
 const dec=new TextDecoder();let buf='',text='',stop='',u={};
 for await(const chunk of body){
  buf+=dec.decode(chunk,{stream:true});
  let i;
  while((i=buf.indexOf('\n'))>=0){
   const line=buf.slice(0,i).trim();buf=buf.slice(i+1);
   if(!line.startsWith('data:'))continue;
   let e;try{e=JSON.parse(line.slice(5))}catch{continue}
   if(e.type==='message_start')Object.assign(u,e.message&&e.message.usage||{});
   else if(e.type==='content_block_delta'&&e.delta&&e.delta.type==='text_delta'){text+=e.delta.text;onToken&&onToken(e.delta.text,text)}
   else if(e.type==='message_delta'){if(e.delta&&e.delta.stop_reason)stop=e.delta.stop_reason;Object.assign(u,e.usage||{})}
   else if(e.type==='error')throw Error('Anthropic: '+String(e.error&&e.error.message||'stream error').slice(0,200));
  }
 }
 return{content:text,finish:finish(stop),usage:usage(u)};
}
// One request → {content, finish, usage}. Errors carry the HTTP status.
async function ask(model,messages,{maxTokens,onToken,signal,env=process.env,fetchImpl=fetch}={}){
 if(!configured(env))throw Error('ANTHROPIC_API_KEY is not set');
 const stream=typeof onToken==='function';
 const res=await fetchImpl(URL_MESSAGES,{method:'POST',headers:headers(env),signal,body:JSON.stringify(request(model,messages,{maxTokens,stream}))});
 if(!res.ok){const d=await res.json().catch(()=>({}));throw Object.assign(Error('Anthropic '+res.status+': '+String(d.error&&d.error.message||'request failed').slice(0,200)),{status:res.status})}
 if(stream&&res.body)return readStream(res.body,onToken);
 const d=await res.json();
 const content=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
 return{content,finish:finish(d.stop_reason),usage:usage(d.usage||{})};
}
module.exports={configured,isClaude,modelId,rates,request,ask,finish};
