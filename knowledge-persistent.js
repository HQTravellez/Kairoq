// Persistent, tenant-isolated knowledge store; atomic JSON snapshots.
// Requires a persistent volume in production. Does not parse binary documents.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const SUPPORTED=new Set(['text/plain','text/markdown','application/json','text/html','application/yaml','text/yaml']);
const MAX=2*1024*1024;
function words(s){return new Set((s.toLowerCase().match(/[a-z0-9_-]{3,}/g)||[]));}
function assertId(s){if(typeof s!=='string'||!s.trim()||s.length>128)throw Error('Invalid tenant identity');}
function createStore(file){
 if(!path.isAbsolute(file))throw Error('Absolute storage path required');
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 let records=[];
 if(fs.existsSync(file)){const parsed=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(parsed))throw Error('Invalid knowledge store');records=parsed;}
 function persist(){const tmp=file+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(records),{mode:0o600,flag:'wx'});fs.renameSync(tmp,file);}
 return {
  ingest({ownerId,name,mimeType,content,sourceVersion='1'}){
   assertId(ownerId);
   if(!SUPPORTED.has(mimeType))throw Error('Unsupported document format');
   if(typeof name!=='string'||!name.trim()||name.length>255)throw Error('Invalid name');
   if(typeof content!=='string'||!content.trim()||Buffer.byteLength(content)>MAX)throw Error('Invalid content');
   const id=crypto.randomUUID(),hash=crypto.createHash('sha256').update(content).digest('hex');
   const chunks=[];for(let i=0;i<content.length;i+=1500)chunks.push({offset:i,text:content.slice(i,i+1500)});
   records.push({id,ownerId,name,mimeType,sourceVersion,hash,chunks,createdAt:new Date().toISOString()});persist();
   return {id,name,sourceVersion,hash,chunkCount:chunks.length};
  },
  list(ownerId){assertId(ownerId);return records.filter(d=>d.ownerId===ownerId).map(({chunks,ownerId,...rest})=>({...rest,chunkCount:chunks.length}));},
  search({ownerId,query,limit=5}){
   assertId(ownerId);if(typeof query!=='string'||!query.trim())return [];
   const q=words(query);
   return records.filter(d=>d.ownerId===ownerId).flatMap(d=>d.chunks.map((c,index)=>{
    const w=words(c.text);let score=0;for(const t of q)if(w.has(t))score++;
    return {documentId:d.id,name:d.name,sourceVersion:d.sourceVersion,hash:d.hash,chunk:index,offset:c.offset,excerpt:c.text,score};
   })).filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(0,Math.min(20,limit)));
  },
  remove(ownerId,id){assertId(ownerId);const before=records.length;records=records.filter(d=>!(d.ownerId===ownerId&&d.id===id));if(records.length!==before){persist();return true;}return false;}
 };
}
module.exports={createStore};
