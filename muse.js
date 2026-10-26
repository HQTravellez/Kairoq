'use strict';
// Meta's Muse Spark through the Meta Model API (https://dev.meta.ai/docs/quickstart): a strong
// model for code and long tasks that also reads images, PDFs and video. Kairoq uses it for builds
// picked in the model menu (or Auto when paid builds are on), for the screenshot check after visual
// changes, and for answers to questions. Spending has its own monthly cap.
//
// Railway: META_MODEL_API_KEY (the key), KAIROQ_MUSE_MODEL (default muse-spark-1.3),
// KAIROQ_MUSE_MONTHLY_USD (default 20; 0 means no cap), KAIROQ_MUSE=off turns it off.

const BASE_URL='https://api.meta.ai/v1';
// Published pay-as-you-go prices, US dollars per million tokens (input, output).
const PRICE_IN=1.25,PRICE_OUT=4.25;

function configured(env=process.env){return Boolean(String(env.META_MODEL_API_KEY||'').trim())&&String(env.KAIROQ_MUSE||'').toLowerCase()!=='off'}
function model(env=process.env){return String(env.KAIROQ_MUSE_MODEL||'muse-spark-1.3').trim()}
function monthlyCap(env=process.env){const n=Number(env.KAIROQ_MUSE_MONTHLY_USD??20);return Number.isFinite(n)&&n>=0?n:20}

// Input served from Meta's prompt cache costs $0.15 per million instead of $1.25.
const PRICE_CACHED=0.15;
// What a reply cost, from its token counts (cached input is part of the input count).
function cost(usage={}){
 const input=Number(usage.prompt_tokens||usage.input_tokens||0),output=Number(usage.completion_tokens||usage.output_tokens||0);
 const cached=Math.min(input,Number(usage.prompt_tokens_details?.cached_tokens||usage.input_tokens_details?.cached_tokens||0));
 return((input-cached)*PRICE_IN+cached*PRICE_CACHED+output*PRICE_OUT)/1e6;
}

// One chat request (OpenAI chat completions format). Streams when onToken is given.
// spentThisMonth: async () => dollars spent on Muse this month; record: async (usage, cost) => void.
async function chat({messages,temperature=0.2,maxTokens=16000,promptCacheKey,signal,onToken,onReasoning,spentThisMonth,record,env=process.env,fetchImpl=fetch,readStream}){
 if(!configured(env))throw Error('Muse is not set up (META_MODEL_API_KEY)');
 const cap=monthlyCap(env);
 if(cap>0&&spentThisMonth&&(await spentThisMonth())>=cap)throw Error('Muse monthly budget reached ($'+cap.toFixed(2)+'); using the other models');
 const stream=Boolean(onToken&&readStream);
 const response=await fetchImpl(BASE_URL+'/chat/completions',{
  method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+String(env.META_MODEL_API_KEY).trim()},
  signal:signal?AbortSignal.any([signal,AbortSignal.timeout(600000)]):AbortSignal.timeout(600000),
  body:JSON.stringify({model:model(env),messages,temperature,max_tokens:maxTokens,stream,...(promptCacheKey?{prompt_cache_key:String(promptCacheKey).slice(0,64)}:{}),...(stream?{stream_options:{include_usage:true}}:{})})
 });
 if(!response.ok){const d=await response.json().catch(()=>({}));throw Error('Muse: '+String(d?.error?.message||d?.error||'HTTP '+response.status).slice(0,200))}
 const data=stream?await readStream(response.body,onToken,onReasoning):await response.json();
 const text=data?.choices?.[0]?.message?.content;
 if(typeof text!=='string'||!text.trim())throw Error('Muse returned an empty reply');
 const usage=data.usage||{};
 if(record)await record(usage,cost(usage));
 return{text,usage,cost:cost(usage),model:'meta/'+model(env)};
}

module.exports={configured,model,monthlyCap,cost,chat,BASE_URL,PRICE_IN,PRICE_OUT,PRICE_CACHED};
