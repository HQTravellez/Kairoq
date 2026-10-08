'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
test('visual screenshot evidence requires owner sign-in', {timeout:10000},async()=>{
 const child=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',PORT:'39127',APP_PASSWORD:'synthetic-evidence-test-password',FULLSTACK_APP_SMOKE_TEST:'false',HOUSING_APP_BUILD:'false',DEVELOPER_SMOKE_TEST:'false'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),5000);child.stdout.on('data',d=>{if(String(d).includes('Kairoq running')){clearTimeout(timer);resolve();}});child.on('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});});const response=await fetch('http://127.0.0.1:39127/api/developer/evidence/test-project/1/1');assert.equal(response.status,401);}finally{child.kill('SIGTERM');}
});
