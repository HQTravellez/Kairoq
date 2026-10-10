'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'workspace','website-jobs'),active=new Map();
function filename(id){if(!/^site-[a-f0-9-]{36}$/.test(id))throw Error('Invalid website job');return path.join(ROOT,id+'.json');}
function save(job){fs.mkdirSync(ROOT,{recursive:true});const file=filename(job.id);fs.writeFileSync(file+'.tmp',JSON.stringify(job,null,2));fs.renameSync(file+'.tmp',file);}
function submit(input,callModel){
 if(input.id&&[...active.values()].some(job=>job.projectId===input.id))throw Error('This website already has a running job');
 const job={id:'site-'+crypto.randomUUID(),operation:input.id?'website-revision':'website-build',projectId:input.id||null,status:'queued',created_at:new Date().toISOString()};save(job);active.set(job.id,job);
 setImmediate(async()=>{try{
  const web=require('./developer-agent'),progress=status=>{job.status=status;save(job);};progress('designing');
  const generated=input.id?await web.revise(String(input.id),String(input.instruction||''),callModel,input):await web.build({...input,onProgress:progress},callModel);
  const {preview,files,...result}=generated;job.status='complete';job.projectId=result.id;job.result={...result,preview_url:'/api/developer/preview/'+result.id+'/index.html',files:Object.keys(files)};
 }catch(error){job.status='failed';job.error=String(error.message||error);if(error.projectId)job.projectId=error.projectId;}finally{job.completed_at=new Date().toISOString();save(job);active.delete(job.id);}});
 return{...job};
}
function getJob(id){const job=JSON.parse(fs.readFileSync(filename(id),'utf8'));if(!['complete','failed'].includes(job.status)&&!active.has(id)){job.status='failed';job.error='Website build interrupted by a restart. Any saved draft is available in your projects; retry the build or revision.';save(job);}return job;}
module.exports={submit,getJob};
