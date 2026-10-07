const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');
test('lead import API persists deduplicated prospects and rejects invalid batches atomically',{timeout:12000},async()=>{
 const root=path.join(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-import-api-'));
 fs.cpSync(root,temp,{recursive:true,filter:src=>!['node_modules','workspace','.git','.env'].includes(path.basename(src))});
 fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
 const child=spawn(process.execPath,['server.js'],{cwd:temp,env:{...process.env,NODE_ENV:'production',PORT:'39124',APP_PASSWORD:'',APP_ENCRYPTION_KEY:'isolated-test-key'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('startup timeout')),5000);child.stdout.on('data',d=>{if(String(d).includes('Kairoq running')){clearTimeout(timer);resolve()}});child.on('exit',code=>{clearTimeout(timer);reject(new Error(`startup exited ${code}`))})});
  const send=text=>fetch('http://127.0.0.1:39124/api/agents/sales/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
  const text='company,website,full_name,title\nAcme,acme.com,Jane Smith,Finance Director';
  const first=await send(text);assert.equal(first.status,200);assert.equal((await first.json()).imported,1);
  const second=await send(text);assert.equal((await second.json()).duplicates,1);
  assert.equal((await send('company,website\nGood,good.com\nBad,https://127.0.0.1')).status,400);
  const state=await (await fetch('http://127.0.0.1:39124/api/agents/status')).json();
  assert.equal(state.sales.leads.length,1);assert.equal(state.sales.leads[0].status,'new');assert.equal(state.sales.openenrich_configured,true);assert.equal(state.sales.lead_discovery.live_contact_database,false);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));fs.rmSync(temp,{recursive:true,force:true})}
});
