"use strict";
// Append-only bounded project memory. Use an existing persistent volume in production.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=process.env.KAIROQ_AUTONOMY_DIR||path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH||process.cwd(),'.kairoq-autonomy');
function location(projectId){
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(projectId||''))throw Error('Invalid project ID');
 return path.join(ROOT,projectId+'.jsonl');
}
const queue=new Map();
async function append(projectId,event){
 const filename=location(projectId);const previous=queue.get(filename)||Promise.resolve();
 const task=previous.catch(()=>{}).then(async()=>{
  await fs.mkdir(path.dirname(filename),{recursive:true,mode:0o700});
  const safe={...event,entryId:crypto.randomUUID()};
  const line=JSON.stringify(safe);
  if(Buffer.byteLength(line)>8192)throw Error('Evidence record too large');
  await fs.appendFile(filename,line+'\n',{encoding:'utf8',mode:0o600});
  return safe;
 });
 queue.set(filename,task);
 try{return await task;}finally{if(queue.get(filename)===task)queue.delete(filename);}
}
async function history(projectId,{limit=500}={}){
 const file=location(projectId);let contents;
 try{const st=await fs.stat(file);if(st.size>5_000_000)throw Error('Memory file exceeds review limit');contents=await fs.readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return [];throw e;}
 return contents.trim().split('\n').filter(Boolean).slice(-Math.max(1,Math.min(limit,1000))).map(x=>JSON.parse(x));
}
module.exports={append,history,location};
