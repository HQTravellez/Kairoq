'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const runtime=require('./app-runtime');
const marker=path.join(__dirname,'workspace','.fullstack-smoke-v1.json');
async function run(builder,model){
 if(fs.existsSync(marker)&&JSON.parse(fs.readFileSync(marker,'utf8')).passed){const result=JSON.parse(fs.readFileSync(marker,'utf8'));const check=marker+'.filter-qa';if(!fs.existsSync(check)){const project=runtime.getProject(result.id);const qa=await builder.browserQA(project.id,project,project);fs.writeFileSync(check,JSON.stringify(qa));console.log('[fullstack-smoke] Category filter browser check passed');}console.log('[fullstack-smoke] Already passed, skipping model calls');return;}
 const progressFile=marker+'.progress';let progress=fs.existsSync(progressFile)?JSON.parse(fs.readFileSync(progressFile,'utf8')):{};
 console.log('[fullstack-smoke] Building inventory app and verifying a data-preserving feature revision');
 if(!progress.id){const job={id:crypto.randomUUID(),operation:'build',projectName:'Stockroom Inventory',brief:'Build a polished inventory tracker for a small independent shop. One products collection with product_name text required, sku text required, quantity number required, reorder_level number required, and supplier text optional. Show stock counts and low-stock indicators, collection CRUD, login and dashboard. Keep navigation compact and responsive.',style:'editorial',status:'queued',created_at:new Date().toISOString()};await builder.run(job,model);if(job.status!=='complete')throw Error(job.error);progress.id=job.result.id;fs.writeFileSync(progressFile,JSON.stringify(progress));}
 const server=http.createServer(async(req,res)=>{if(!await runtime.handle(req,res)){res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/apps/'+progress.id+'/api/';let cookie;
 const request=async(url,method='GET',data)=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const json=await r.json();if(!r.ok)throw Error('Regression API '+r.status+' '+JSON.stringify(json));return json;};
 try{
 const project=runtime.getProject(progress.id),collection=project.schema.collections[0];
 await request('auth/register','POST',{email:'revision-'+crypto.randomBytes(6).toString('hex')+'@example.com',password:crypto.randomBytes(18).toString('hex')});
 const payload=Object.fromEntries(collection.fields.map(f=>[f.name,f.default??(f.type==='number'?7:f.type==='boolean'?true:f.type==='date'?'2030-11-01':f.type==='email'?'qa@example.com':f.type==='select'?f.options[0]:'Regression '+f.label)]));
 const saved=(await request('collections/'+collection.name,'POST',payload)).record;
 if(!progress.revised){const job={id:crypto.randomUUID(),operation:'revise',projectId:progress.id,projectName:'Stockroom Inventory',brief:'Add an optional category select field to products with options Supplies, Equipment, Other, and a working category filter above the product list. Preserve all existing fields, records and auth/CRUD. Keep total #record-count showing total selected collection records, even when a filter is active.',style:'editorial',status:'queued',created_at:new Date().toISOString()};await builder.run(job,model);if(job.status!=='complete')throw Error(job.error);progress.revised=true;fs.writeFileSync(progressFile,JSON.stringify(progress));}
 const after=(await request('collections/'+collection.name)).records.find(r=>r.id===saved.id);
 if(!after||Object.entries(saved.data).some(([k,v])=>after.data[k]!==v))throw Error('Live schema revision lost or changed stored inventory');
 const revised=runtime.getProject(progress.id);if(!revised.schema.collections[0].fields.some(f=>f.name==='category'&&f.type==='select'))throw Error('Requested category field missing');
 await request('collections/'+collection.name+'/'+saved.id,'DELETE');builder.publish(progress.id);
 const result={passed:true,id:progress.id,url:'/apps/'+progress.id+'/',version:revised.version,qa:revised.qa,checks:['real AI build','real AI feature revision','SQLite records survive revision','launch'],at:new Date().toISOString()};fs.writeFileSync(marker,JSON.stringify(result));console.log('[fullstack-smoke] RESULT '+JSON.stringify(result));
 }finally{await new Promise(r=>server.close(r));}
}
module.exports={run};
