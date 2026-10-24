'use strict';
// Import upstream stage_skill create intents as inert Kairoq review candidates.
// No promoter, hook registration, executable subfiles, or active-skill mutations.
const crypto=require('node:crypto');
const defaultStore=require('../../autonomy-store');
async function stage({ownerId,projectId,intent},store=defaultStore) {
  const scope=require('./mem0').namespace(ownerId,projectId);
  if (!intent || intent.action!=='create' || intent.level!=='project' || !/^[a-z][a-z0-9-]{0,63}$/.test(intent.name||'')) throw Error('Only project create proposals supported');
  if (Object.keys(intent).some(k=>!['action','level','name','body','reason','evidence'].includes(k))) throw Error('Unsupported intent field or executable subfiles');
  for (const k of ['body','reason','evidence']) {
    if (typeof intent[k]!=='string' || !intent[k].trim() || intent[k].length>16000) throw Error('Invalid proposal '+k);
    if (/Bearer\s+\S+|sk-[\w-]{12,}|-----BEGIN|(?:password|api[_-]?key)\s*[:=]/i.test(intent[k])) throw Error('Potential secret in proposal');
  }
  if (Buffer.byteLength(JSON.stringify(intent))>6500) throw Error('Proposal exceeds durable record limit');
  const digest=crypto.createHash('sha256').update(JSON.stringify([intent.name,intent.body])).digest('hex');
  const rows=await store.history(scope,{limit:1000});
  if(rows.some(r=>r.type==='autoharness-candidate'&&r.digest===digest)) return {status:'duplicate',digest};
  await store.append(scope,{type:'autoharness-candidate',status:'pending-review',digest,intent,
    verified:false,recordedAt:new Date().toISOString()});
  return {status:'pending-review',digest,verified:false};
}
module.exports={stage};
