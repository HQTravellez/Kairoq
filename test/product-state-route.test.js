'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
// A free port for this run: fixed ports collide when two CI jobs share a machine.
const freePort=()=>new Promise((resolve,reject)=>{const s=require('node:net').createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>resolve(String(port)))})});
// No APP_PASSWORD: requests from this machine count as the owner, so the route is reachable
// without a sign-in. The state file lives in a temp folder so real workspace data is untouched.
async function startServer(stateFile){
 for(let attempt=1;;attempt++){
  const port=await freePort();
  const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',PORT:port,APP_PASSWORD:'',PRODUCT_STATE_FILE:stateFile,FULLSTACK_APP_SMOKE_TEST:'false',HOUSING_APP_BUILD:'false',DEVELOPER_SMOKE_TEST:'false'},stdio:['ignore','pipe','pipe']});
  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),5000);child.stdout.on('data',d=>{if(String(d).includes('Kairoq running')){clearTimeout(timer);resolve();}});let err='';child.stderr.on('data',d=>{err+=d});child.on('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code+': '+err.slice(-800)));});});return{port,child}}
  catch(e){child.kill('SIGTERM');if(attempt<3&&/already in use/.test(e.message))continue;throw e}
 }
}

test('product state can be read, saved and merged', {timeout:20000}, async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-product-state-'));
 const stateFile=path.join(dir,'.product-state.json');
 const {port,child}=await startServer(stateFile);
 const base='http://127.0.0.1:'+port+'/api/product-state';
 const post=body=>fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  const empty=await fetch(base);
  assert.equal(empty.status,200);
  assert.deepEqual((await empty.json()).state,{});

  const first=await post({state:{demo_mode:true,vertical_mode:'commerce'}});
  assert.equal(first.status,200);
  assert.equal((await first.json()).state.demo_mode,true);

  // A later save of one field keeps the fields saved before it.
  assert.equal((await post({state:{onboarding_complete:true}})).status,200);
  const merged=(await (await fetch(base)).json()).state;
  assert.equal(merged.demo_mode,true);
  assert.equal(merged.vertical_mode,'commerce');
  assert.equal(merged.onboarding_complete,true);
  assert.ok(merged.updated_at);
  assert.equal(JSON.parse(fs.readFileSync(stateFile,'utf8')).onboarding_complete,true);

  // Workflow cards are capped so the file cannot grow without limit.
  const cards=Array.from({length:150},(_,i)=>({id:String(i),title:'card '+i}));
  assert.equal((await (await post({state:{workflow_cards:cards}})).json()).state.workflow_cards.length,100);

  assert.equal((await post({state:['not','an','object']})).status,400);
  assert.equal((await post({})).status,400);
 }finally{child.kill('SIGTERM');fs.rmSync(dir,{recursive:true,force:true});}
});
