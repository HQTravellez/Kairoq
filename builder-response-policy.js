'use strict';
// Short conversation deadlines; coding and image requests keep their own budgets.
function chatTimeout(env=process.env) {
 const value=Number(env.KAIROQ_CHAT_ATTEMPT_TIMEOUT_MS);
 return Number.isInteger(value)&&value>=250&&value<=30000?value:12000;
}
function discussionTier(images,tier) {return images.length?(tier==='standard'||tier==='chat'?'vision':tier):'chat';}
function requestSignal(opts,{premium=false,stream=false,env=process.env}={}) {
 const ms=opts.tier==='chat'?chatTimeout(env):stream?(premium?900000:300000):110000;
 return opts.signal?AbortSignal.any([opts.signal,AbortSignal.timeout(ms)]):AbortSignal.timeout(ms);
}
module.exports={chatTimeout,discussionTier,requestSignal};
