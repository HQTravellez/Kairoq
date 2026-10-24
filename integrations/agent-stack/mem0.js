'use strict';
// Opt-in OSS REST boundary; never imported by the customer request path.
const {createHash} = require('node:crypto');
const {localService} = require('../../integration-lab/python-bridges');
function namespace(ownerId, projectId) {
  for (const value of [ownerId,projectId]) if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw Error('Authenticated owner and project IDs required');
  return 'kairoq_'+createHash('sha256').update(JSON.stringify([ownerId,projectId])).digest('hex');
}
function client({enabled=false,baseUrl,key,ownerId,projectId,timeoutMs=4000} = {}) {
  // Constructing a disabled client does not inspect configuration or make requests.
  if (!enabled) return {search:async()=>({status:'disabled',results:[]}),add:async()=>({status:'disabled'})};
  const origin = localService(baseUrl), scope=namespace(ownerId,projectId);
  if (typeof key !== 'string' || !key || /[\r\n]/.test(key)) throw Error('Dedicated Mem0 server API key required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw Error('Invalid timeout');
  function text(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 8000) throw Error('Invalid memory text');
    if (/Bearer\s+\S+|sk-[\w-]{12,}|-----BEGIN|(?:password|api[_-]?key)\s*[:=]/i.test(value)) throw Error('Potential secret in memory');
    return value;
  }
  async function request(route,body) {
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetch(origin+route,{method:'POST',redirect:'error',signal:controller.signal,
        headers:{'content-type':'application/json','X-API-Key':key},body:JSON.stringify(body)});
      if (!response.ok) throw Error('Mem0 request failed (HTTP '+response.status+')');
      let length=0; const chunks=[];
      for await (const chunk of response.body) {length+=chunk.length;if(length>256000) {controller.abort();throw Error('Mem0 response limit');}chunks.push(chunk);}
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally {clearTimeout(timer);}
  }
  return {
    async search(query) {
      const body=await request('/search',{query:text(query),filters:{user_id:scope,agent_id:'kairoq'},top_k:5});
      if (!Array.isArray(body.results)) throw Error('Invalid Mem0 result');
      // Refuse a misconfigured server that returns another namespace or omits provenance.
      if (body.results.some(r=>r.user_id!==scope || r.agent_id!=='kairoq')) throw Error('Mem0 scope mismatch');
      return {status:'experimental',results:body.results.slice(0,5).map(r=>({text:text(r.memory),verified:false,source:'mem0-oss'}))};
    },
    async add(message,{approved=false}={}) {
      if (approved!==true) throw Error('Explicit memory export approval required');
      await request('/memories',{messages:[{role:'user',content:text(message)}],user_id:scope,agent_id:'kairoq',infer:false,
        metadata:{source:'owner-message',verified:false}});
      return {status:'stored-unverified'};
    }
  };
}
module.exports={client,namespace};
