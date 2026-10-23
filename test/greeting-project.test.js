'use strict';
// "hi" never becomes a project: creating one from a greeting is refused; a real request is created.
const test=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const freePort=()=>new Promise((resolve,reject)=>{const s=require('node:net').createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>resolve(String(port)))})});
async function startServer(dir){
 for(let attempt=1;;attempt++){
  const port=await freePort();
  const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',PORT:port,APP_PASSWORD:'',KAIROQ_REACT_PROJECTS_DIR:path.join(dir,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(dir,'accounts.sqlite'),FULLSTACK_APP_SMOKE_TEST:'false',HOUSING_APP_BUILD:'false',DEVELOPER_SMOKE_TEST:'false'},stdio:['ignore','pipe','pipe']});
  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),5000);child.stdout.on('data',d=>{if(String(d).includes('Kairoq running')){clearTimeout(timer);resolve();}});let err='';child.stderr.on('data',d=>{err+=d});child.on('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code+': '+err.slice(-800)));});});return{port,child}}
  catch(e){child.kill('SIGTERM');if(attempt<3&&/already in use/.test(e.message))continue;throw e}
 }
}

test('a greeting is refused as a project name; a real request is created',{timeout:30000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-greeting-'));
 const {port,child}=await startServer(dir);
 const create=body=>fetch('http://127.0.0.1:'+port+'/api/create/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  for(const name of ['hi','Hello!','thanks','ok']){
   const r=await create({name});
   assert.equal(r.status,422,name);
   assert.match((await r.json()).error,/greeting/);
  }
  const ok=await create({name:'Booking page for a yoga studio'});
  assert.equal(ok.status,201);
  assert.equal((await ok.json()).project.name,'Booking page for a yoga studio');
 }finally{child.kill('SIGTERM');fs.rmSync(dir,{recursive:true,force:true});}
});
