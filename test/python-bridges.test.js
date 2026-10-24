"use strict";
const t=require('node:test'),assert=require('node:assert/strict'),bridge=require('../integration-lab/python-bridges');
const mock=(path,obj)=>async(url,init)=>{assert.ok(url.endsWith(path));assert.equal(init.method,'GET');assert.equal(init.redirect,'error');return{ok:true,text:async()=>JSON.stringify(obj)}};
t('Python integration refuses remote or credentialed endpoints',()=>{
 for(const url of ['https://example.com','http://192.168.0.5:8000/','http://me:secret@localhost:8000/','http://127.0.0.1:8000/admin','http://localhost:8000/?token=secret'])assert.throws(()=>bridge.localService(url),/loopback|root/);
 assert.equal(bridge.localService('http://127.0.0.1:8000/'),'http://127.0.0.1:8000');
});
t('FastAPI OpenAPI operations are validated without calling endpoints',async()=>{
 const spec={openapi:'3.0.3',info:{title:'Meals',version:'1'},paths:{'/foods':{get:{responses:{'200':{description:'OK'}}}}}};
 const result=await bridge.fastApiOpenApi('http://localhost:8000/',{fetchImpl:mock('/openapi.json',spec)});
 assert.equal(result.status,'openapi-validated');assert.equal(result.operations,1);
});
t('Browser Use probe performs no browser actions and grants no rights',async()=>{
 const result=await bridge.browserUseHealth('http://127.0.0.1:8765/',{fetchImpl:mock('/health',{status:'healthy'})});
 assert.equal(result.canControlBrowser,false);
});
t('reject external OpenAPI references',async()=>{
 const spec={openapi:'3.0.3',info:{title:'x',version:'1'},paths:{'/x':{get:{responses:{'200':{description:'OK',content:{'application/json':{schema:{$ref:'https://evil.test/secret'}}}}}}}}};
 await assert.rejects(bridge.fastApiOpenApi('http://localhost:8000/',{fetchImpl:mock('/openapi.json',spec)}),/External OpenAPI/);
});
