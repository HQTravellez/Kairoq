'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
// A free port for this run: fixed ports collide when two CI jobs share a machine.
const freePort=()=>new Promise((resolve,reject)=>{const s=require('node:net').createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>resolve(String(port)))})});
test('visual screenshot evidence requires owner sign-in', {timeout:10000},async()=>{
 const port=await freePort();
 const child=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',PORT:port,APP_PASSWORD:'synthetic-evidence-test-password',FULLSTACK_APP_SMOKE_TEST:'false',HOUSING_APP_BUILD:'false',DEVELOPER_SMOKE_TEST:'false'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),5000);child.stdout.on('data',d=>{if(String(d).includes('Kairoq running')){clearTimeout(timer);resolve();}});let err='';child.stderr.on('data',d=>{err+=d});child.on('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code+': '+err.slice(-800)));});});const response=await fetch('http://127.0.0.1:'+port+'/api/developer/evidence/test-project/1/1');assert.equal(response.status,401);assert.equal((await fetch('http://127.0.0.1:'+port+'/api/developer/travellez-benchmark-evidence/app/1')).status,401);}finally{child.kill('SIGTERM');}
});
