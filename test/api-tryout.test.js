"use strict";
// Trying an outside API from Settings, like Beeceptor (api-tryout.js): endpoints with inputs filled
// from the spec, Send shows the real answer (or a sample while the key is missing), Check all calls
// every read-only endpoint once and says in plain words which work.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-tryout-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.APP_ENCRYPTION_KEY='test-encryption-key-1234567890';
const builder=require('../react-builder'),samples=require('../api-samples'),tryout=require('../api-tryout'),secrets=require('../project-secrets');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

// A weather API that needs no key, and a hotel API with a key in a header.
const WEATHER={openapi:'3.0.3',info:{title:'Weather',version:'1'},servers:[{url:'https://api.weather.test/v1'}],paths:{
 '/forecast':{get:{operationId:'forecast',summary:'Daily forecast',parameters:[{name:'latitude',in:'query',required:true,schema:{type:'number'},example:52.52},{name:'longitude',in:'query',required:true,schema:{type:'number'},example:13.41},{name:'start_date',in:'query',schema:{type:'string',format:'date'},example:'2023-05-01'},{name:'units',in:'query',schema:{type:'string',enum:['celsius','fahrenheit']}}],responses:{200:{description:'ok',content:{'application/json':{schema:{type:'object',properties:{temperature:{type:'number'}}}}}}}}},
 '/stations/{stationId}':{get:{operationId:'station',summary:'One station',parameters:[{name:'stationId',in:'path',required:true,schema:{type:'string'}}],responses:{200:{description:'ok'}}}},
 '/alerts':{get:{operationId:'alerts',summary:'Weather alerts',responses:{200:{description:'ok'}}}},
 '/reports':{post:{operationId:'report',summary:'Send a report',requestBody:{content:{'application/json':{schema:{type:'object',properties:{city:{type:'string'},rain:{type:'boolean'}}}}}},responses:{201:{description:'ok'}}}}}};
const HOTELS={openapi:'3.0.3',info:{title:'Hotels',version:'1'},servers:[{url:'https://api.hotels.test'}],components:{securitySchemes:{key:{type:'apiKey',in:'header',name:'X-Api-Key'}}},security:[{key:[]}],
 paths:{'/hotels':{get:{operationId:'hotels',parameters:[{name:'city',in:'query',required:true,schema:{type:'string'},example:'Toronto'}],responses:{200:{description:'ok',content:{'application/json':{schema:{type:'object',properties:{hotels:{type:'array',items:{type:'object',properties:{name:{type:'string'},price:{type:'number'}}}}}}}}}}}}}};

function setup(){
 const meta=builder.create({name:'Try',owner:'owner'});
 samples.add(meta.id,{spec:WEATHER});samples.add(meta.id,{spec:HOTELS,secret:'HOTELS_KEY'});
 const [weather,hotels]=samples.apis(meta.id);
 return{id:meta.id,weather,hotels};
}

test('every endpoint is listed with its inputs filled from the spec (old example dates moved ahead)',()=>{
 const {weather}=setup(),list=tryout.endpoints(weather);
 assert.deepEqual(list.map(e=>e.method+' '+e.path),['GET /forecast','GET /stations/{stationId}','GET /alerts','POST /reports']);
 const f=list[0],v=Object.fromEntries(f.params.map(p=>[p.name,p.value]));
 assert.equal(v.latitude,'52.52');assert.equal(v.longitude,'13.41');
 assert.ok(v.start_date>new Date().toISOString().slice(0,10),'a date in the coming weeks, not 2023');
 assert.deepEqual(f.params.find(p=>p.name==='units').options,['celsius','fahrenheit']);
 assert.equal(list[1].params[0].in,'path');assert.equal(list[1].params[0].required,true);
 assert.equal(list[3].read_only,false);assert.deepEqual(Object.keys(JSON.parse(list[3].body)),['city','rain']);
});

test('Send: a no-key API answers for real; a missing key gives a sample; the key is added on the server only',async()=>{
 const {id}=setup();const seen=[];
 const fetchUrl=async req=>{seen.push(req);return req.url.includes('weather')?{status:200,headers:{'content-type':'application/json'},body:'{"temperature":12.4}'}:{status:200,headers:{'content-type':'application/json'},body:'{"hotels":[{"name":"Real Inn","price":189}]}'}};
 const w=await tryout.send(id,{slug:'weather',op:'forecast',values:{latitude:'43.65',longitude:'-79.38',units:'celsius'}},{fetchUrl});
 assert.equal(w.sample,false);assert.equal(w.status,200);assert.equal(w.ok,true);assert.equal(w.body,'{\n  "temperature": 12.4\n}');
 assert.equal(seen[0].url,'https://api.weather.test/v1/forecast?latitude=43.65&longitude=-79.38&units=celsius');
 // Hotels without its key: a sample shaped like the real answer, nothing sent.
 const s=await tryout.send(id,{slug:'hotels',op:'hotels',values:{city:'Toronto'}},{fetchUrl});
 assert.equal(s.sample,true);assert.equal(seen.length,1);assert.match(s.why,/add the HOTELS_KEY key/);assert.ok(Array.isArray(JSON.parse(s.body).hotels));
 // With the key: sent in the X-Api-Key header, never in the answer to the page.
 secrets.set(id,'app_hotels_key','secret-k-987');
 const real=await tryout.send(id,{slug:'hotels',op:'hotels',values:{city:'Toronto'}},{fetchUrl});
 assert.equal(real.sample,false);assert.equal(seen[1].headers['X-Api-Key'],'secret-k-987');assert.doesNotMatch(JSON.stringify(real),/secret-k-987/);
 // "Sample answer" ticked: a sample even with the key.
 assert.equal((await tryout.send(id,{slug:'hotels',op:'hotels',values:{city:'Toronto'},sample:true},{fetchUrl})).sample,true);
 // Path inputs go into the address; a missing required one is asked for.
 await tryout.send(id,{slug:'weather',op:'station',values:{stationId:'YYZ 1'}},{fetchUrl});
 assert.equal(seen.at(-1).url,'https://api.weather.test/v1/stations/YYZ%201');
 await assert.rejects(tryout.send(id,{slug:'weather',op:'station',values:{}},{fetchUrl}),/Fill in stationId first/);
 // The call log keeps each answer for the panel.
 const log=samples.log(id);assert.equal(log[0].mode,'try');assert.ok(log.some(e=>e.reply==='{"temperature":12.4}'));
});

test('a real call that can change data asks first; failures are explained in plain words',async()=>{
 const {id}=setup();const seen=[];
 const fetchUrl=async req=>{seen.push(req);return{status:req.url.includes('alerts')?401:201,headers:{},body:'{"ok":true}'}};
 await assert.rejects(tryout.send(id,{slug:'weather',op:'report',body:'{"city":"Toronto"}'},{fetchUrl}),e=>{assert.equal(e.status,409);assert.deepEqual(e.data,{confirm:true});assert.match(e.message,/real POST to Weather, which can create or change data/);return true});
 assert.equal(seen.length,0,'nothing sent before the owner agrees');
 const ok=await tryout.send(id,{slug:'weather',op:'report',body:'{"city":"Toronto"}',confirm:true},{fetchUrl});
 assert.equal(ok.status,201);assert.equal(seen[0].body,'{"city":"Toronto"}');assert.equal(seen[0].headers['Content-Type'],'application/json');
 await assert.rejects(tryout.send(id,{slug:'weather',op:'report',body:'{oops',confirm:true},{fetchUrl}),/not valid JSON/);
 const no=await tryout.send(id,{slug:'weather',op:'alerts'},{fetchUrl});
 assert.equal(no.ok,false);assert.match(no.reason,/needs a key, or the key is wrong/);
 assert.match(tryout.reason(400,'{"errors":[{"detail":"departureDate must be in the future"}]}'),/did not accept the inputs: departureDate must be in the future/);
 await assert.rejects(tryout.send(id,{slug:'weather',op:'alerts'},{fetchUrl:async()=>{throw Object.assign(Error('fetch: timed out after 15 seconds'),{status:504})}}),/did not answer within 15 seconds/);
});

test('Check all: every read-only endpoint once, a plain summary, data-changing ones left alone',async()=>{
 const {id}=setup();const seen=[];
 const fetchUrl=async req=>{seen.push(req.method+' '+req.url);return{status:req.url.includes('alerts')?503:200,headers:{},body:'{}'}};
 const r=await tryout.check(id,{slug:'weather'},{fetchUrl});
 assert.deepEqual(r.results.map(x=>x.result),['ok','input','fail']);
 assert.match(r.results[1].reason,/Needs a value for stationId/);assert.match(r.results[2].reason,/problem on its side \(503\)/);
 assert.match(r.summary,/^1 of 3 read-only endpoints work, 1 failed, 1 need an input\. 1 endpoint changes data, so it is not called here/);
 assert.ok(seen.every(x=>x.startsWith('GET ')),'no POST during a check');
 // Without the key: checked with sample data, nothing sent.
 const before=seen.length,h=await tryout.check(id,{slug:'hotels'},{fetchUrl});
 assert.equal(seen.length,before);assert.deepEqual(h.results.map(x=>x.result),['sample']);assert.match(h.summary,/Add the HOTELS_KEY key to check them for real/);
});

test('through the editor API: endpoints come with the list; viewers cannot send',async()=>{
 const createApi=require('../create-api');
 const {id}=setup();
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=(method,url,body)=>new Promise((resolve,reject)=>{const p=body?Buffer.from(JSON.stringify(body)):null;const q=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:p?{'Content-Type':'application/json','Content-Length':p.length}:{}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>resolve({status:res.statusCode,json:JSON.parse(Buffer.concat(c).toString()||'{}')}))});q.on('error',reject);if(p)q.write(p);q.end()});
 try{
  const list=await call('GET','/api/create/projects/'+id+'/apis');
  assert.equal(list.status,200);assert.equal(list.json.apis[0].endpoints.length,4);assert.equal(list.json.apis[1].endpoints[0].params[0].value,'Toronto');
  const s=await call('POST','/api/create/projects/'+id+'/apitry',{slug:'hotels',op:'hotels',values:{city:'Toronto'}});
  assert.equal(s.status,200);assert.equal(s.json.sample,true);
  const c=await call('POST','/api/create/projects/'+id+'/apicheck',{slug:'hotels'});
  assert.equal(c.status,200);assert.match(c.json.summary,/sample data/);
  const missing=await call('POST','/api/create/projects/'+id+'/apitry',{slug:'nope',op:'x'});
  assert.equal(missing.status,404);
 }finally{server.close()}
 assert.equal(require('fs').readFileSync(path.join(__dirname,'..','create-api.js'),'utf8').includes("'POST:/apitry':'editor'"),true,'sending needs edit access');
});
