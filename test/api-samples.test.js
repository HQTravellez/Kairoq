"use strict";
// Outside APIs with sample answers (api-samples.js): the owner adds a spec and its key's name;
// app functions get sample answers shaped like the real ones in the preview while the key is
// missing and always in saved checks; the live site always calls the real API; calls are logged.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-apis-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.APP_ENCRYPTION_KEY='test-encryption-key-1234567890';
const builder=require('../react-builder'),backend=require('../react-backend'),samples=require('../api-samples'),secrets=require('../project-secrets'),design=require('../react-design');

// A small hotel supplier API, the kind an owner would paste.
const SPEC={openapi:'3.0.3',info:{title:'Sample Hotels',version:'1.2'},servers:[{url:'https://api.samplehotels.test/v1'}],
 components:{securitySchemes:{key:{type:'apiKey',in:'header',name:'X-Api-Key'}},schemas:{
  Hotel:{type:'object',required:['id','name'],properties:{id:{type:'string'},name:{type:'string'},city:{type:'string'},price:{type:'number'},currency:{type:'string'},rating:{type:'number'},image_url:{type:'string'}}},
  Booking:{type:'object',properties:{reference:{type:'string'},status:{type:'string',enum:['confirmed','on_hold']},check_in:{type:'string',format:'date'},check_out:{type:'string',format:'date'},total:{type:'number'},guest_email:{type:'string',format:'email'}}}}},
 security:[{key:[]}],
 paths:{'/hotels':{get:{operationId:'searchHotels',summary:'Hotels with rooms free',parameters:[{name:'city',in:'query',required:true,schema:{type:'string'}}],responses:{200:{description:'ok',content:{'application/json':{schema:{type:'object',properties:{results:{type:'array',items:{$ref:'#/components/schemas/Hotel'}},count:{type:'integer'}}}}}}}}},
  '/hotels/{hotelId}':{get:{operationId:'getHotel',responses:{200:{description:'ok',content:{'application/json':{schema:{$ref:'#/components/schemas/Hotel'}}}}}}},
  '/bookings':{post:{operationId:'book',requestBody:{content:{'application/json':{schema:{type:'object',properties:{hotel_id:{type:'string'}}}}}},responses:{201:{description:'made',content:{'application/json':{schema:{$ref:'#/components/schemas/Booking'}}}}}}}}};

test.after(()=>{if(meta)backend.close(meta.id);fs.rmSync(tmp,{recursive:true,force:true})});

let meta;
test('an added API: listed with its key status, described to the builder, and sample answers shaped like the spec',async()=>{
 meta=builder.create({name:'Stays',owner:'owner'});
 assert.throws(()=>samples.add(meta.id,{spec:'{"nope":1}',secret:'HOTEL_KEY'}),/Could not read that spec/);
 assert.throws(()=>samples.add(meta.id,{spec:SPEC,secret:'hotel key!'}),/Name the key like/);
 assert.throws(()=>samples.add(meta.id,{spec:{...SPEC,servers:[]},secret:'HOTEL_KEY'}),/base address/);
 const api=samples.add(meta.id,{spec:JSON.stringify(SPEC),secret:'hotel_key'});
 assert.deepEqual({title:api.title,base:api.base_url,secret:api.secret,key:api.key_added,ops:api.operations},{title:'Sample Hotels',base:'https://api.samplehotels.test/v1',secret:'HOTEL_KEY',key:false,ops:3});
 assert.throws(()=>samples.add(meta.id,{spec:SPEC,secret:'HOTEL_KEY'}),/already has an API/);
 // The builder learns the real paths and how to read the key.
 const note=samples.promptNote(meta.id);
 assert.match(note,/Sample Hotels at https:\/\/api\.samplehotels\.test\/v1 \(key: secrets\.get\('HOTEL_KEY'\)\)/);
 assert.match(note,/"path":"\/hotels\/\{hotelId\}"/);assert.match(note,/X-Api-Key/);
 assert.match(builder.knowledgeNote(builder.loadMeta(meta.id)),/Outside APIs this app uses/);
 // Matching: documented paths and methods only.
 const {api:a,rest}=samples.findApi(meta.id,'https://api.samplehotels.test/v1/hotels/abc?x=1');
 assert.equal(rest,'/hotels/abc');assert.equal(samples.findOperation(a,rest,'GET').id,'getHotel');
 assert.equal(samples.findOperation(a,'/hotels/abc/rooms','GET'),null);
 assert.equal(samples.findOperation(a,'/bookings','GET'),null);
 assert.equal(samples.findApi(meta.id,'https://api.samplehotels.test/v2/hotels'),null);
 assert.equal(samples.findApi(meta.id,'https://api.samplehotels.test.evil.com/v1/hotels'),null);
 // Sample answers: shaped like the spec, sensible values, the same each time.
 const list=JSON.parse(samples.sampleAnswer(a,samples.findOperation(a,'/hotels','GET'),{method:'GET',url:'https://api.samplehotels.test/v1/hotels?city=Toronto'}).body);
 assert.equal(list.results.length,3);
 for(const h of list.results){assert.equal(typeof h.name,'string');assert.ok(h.price>=80&&h.price<=500,'price '+h.price);assert.equal(h.currency,'CAD');assert.ok(h.rating>=3&&h.rating<=5);assert.match(h.image_url,/^https:\/\/example\.com\/.+\.jpg$/)}
 assert.deepEqual(JSON.parse(samples.sampleAnswer(a,samples.findOperation(a,'/hotels','GET'),{method:'GET',url:'https://api.samplehotels.test/v1/hotels?city=Toronto'}).body),list);
 const booking=samples.sampleAnswer(a,samples.findOperation(a,'/bookings','POST'),{method:'POST',url:'https://api.samplehotels.test/v1/bookings'});
 assert.equal(booking.status,201);assert.equal(booking.headers['x-kairoq-sample'],'1');
 const b=JSON.parse(booking.body);
 assert.ok(['confirmed','on_hold'].includes(b.status));assert.match(b.check_in,/^\d{4}-\d{2}-\d{2}$/);assert.ok(b.check_out>b.check_in,'check-out after check-in');assert.match(b.guest_email,/@example\.com$/);
 const missing=samples.sampleAnswer(a,null,{method:'GET',url:'https://api.samplehotels.test/v1/nothing'});
 assert.equal(missing.status,404);
});

test('preview without the key gets samples; with the key, the live site and other hosts get real calls; checks always samples',async()=>{
 const real=[];const fakeReal=async a=>{real.push(a.url);return{status:200,headers:{},body:'{"real":true}'}};
 const url='https://api.samplehotels.test/v1/hotels?city=Toronto&apikey=SECRET123';
 let r=await samples.fetchFor(meta.id,{url,method:'GET'},{mode:'preview',real:fakeReal});
 assert.equal(r.headers['x-kairoq-sample'],'1');assert.equal(real.length,0);
 r=await samples.fetchFor(meta.id,{url,method:'GET'},{mode:'live',real:fakeReal});
 assert.equal(r.body,'{"real":true}');
 r=await samples.fetchFor(meta.id,{url:'https://other.example.com/x',method:'GET'},{mode:'preview',real:fakeReal});
 assert.equal(r.body,'{"real":true}','only added APIs get sample answers');
 secrets.set(meta.id,'app_hotel_key','k-123');
 assert.equal(samples.list(meta.id)[0].key_added,true);
 r=await samples.fetchFor(meta.id,{url,method:'GET'},{mode:'preview',real:fakeReal});
 assert.equal(r.body,'{"real":true}','with the key the preview is real too');
 r=await samples.fetchFor(meta.id,{url,method:'POST'},{mode:'check',real:fakeReal});
 assert.equal(r.headers['x-kairoq-sample'],'1','a saved check never calls the real API');
 // A failing real call is logged and passed on.
 await assert.rejects(samples.fetchFor(meta.id,{url:'https://down.example.com/',method:'GET'},{mode:'live',real:async()=>{throw Error('timed out')}}),/timed out/);
 const log=samples.log(meta.id);
 assert.equal(log[0].status,0);assert.match(log[0].error,/timed out/);
 assert.deepEqual(log.slice(1).map(c=>[c.mode,c.sample]),[['check',true],['preview',false],['preview',false],['live',false],['preview',true]]);
 assert.ok(log.every(c=>!/SECRET123/.test(c.url)),'keys in addresses are hidden in the log');
 assert.match(log[1].url,/apikey=•••$/);
 secrets.set(meta.id,'app_hotel_key',null);
 assert.deepEqual(samples.missingKeys(meta.id),[{title:'Sample Hotels',secret:'HOTEL_KEY'}]);
 // Which mode a request is in.
 assert.equal(samples.modeOf({published:null},{headers:{}},null),'preview');
 assert.equal(samples.modeOf({published:{version:2},preview_key:'abc'},{headers:{}},null),'live');
 assert.equal(samples.modeOf({published:{version:2},preview_key:'abc'},{headers:{'x-kairoq-preview':'abc'}},null),'preview');
 assert.equal(samples.modeOf({published:{version:2},preview_key:'abc'},{headers:{'x-kairoq-preview':'abd'}},null),'live');
 assert.equal(samples.modeOf({published:{version:2}},{headers:{}},{dir:'x'}),'check');
});

test('a real server function gets the sample answer in the preview',{timeout:120000},async(t)=>{
 const js=`export default async function (request, { fetch, secrets }) {
  const key = await secrets.get('HOTEL_KEY');
  const r = await fetch('https://api.samplehotels.test/v1/hotels?city=' + encodeURIComponent(request.query.city || 'Toronto'), { headers: { 'X-Api-Key': key || '' } });
  const data = await r.json();
  return { json: { status: r.status, sample: r.headers.get('x-kairoq-sample'), names: data.results.map(h => h.name), keyMissing: !key } };
}
`;
 await builder.initializeFrom(meta,{...design.starterFiles('Stays'),'functions/hotels.js':js,'functions/peek.js':"export default async function (request, { secrets }) {\n  const k = await secrets.get('HOTEL_KEY');\n  console.log('using key', k);\n  return { json: { ok: true } };\n}\n"},'Stays');
 const server=http.createServer(async(req,res)=>{try{if(await backend.handle(req,res))return}catch(e){res.writeHead(e.status||500);return res.end(String(e.message))}res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const out=await new Promise((resolve,reject)=>{const q=http.request({host:'127.0.0.1',port:server.address().port,method:'POST',path:'/api/apps/'+meta.id+'/functions/hotels?city=Toronto',headers:{'Content-Type':'application/json'}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(c).toString()}))});q.on('error',reject);q.end('{}')});
  assert.equal(out.status,200,out.body);
  const j=JSON.parse(out.body);
  assert.equal(j.status,200);assert.equal(j.sample,'1');assert.equal(j.names.length,3);assert.equal(j.keyMissing,true);
  assert.equal(samples.log(meta.id)[0].url,'https://api.samplehotels.test/v1/hotels?city=Toronto');
  // With a key saved, a function that prints it never shows it in the app's logs.
  secrets.set(meta.id,'app_hotel_key','kq-very-secret-9876');
  await new Promise((resolve,reject)=>{const q=http.request({host:'127.0.0.1',port:server.address().port,method:'POST',path:'/api/apps/'+meta.id+'/functions/peek',headers:{'Content-Type':'application/json'}},res=>{res.resume();res.on('end',resolve)});q.on('error',reject);q.end('{}')});
  const lines=require('../react-logs').list(meta.id).map(l=>l.message);
  assert.ok(lines.some(l=>l==='using key •••'),lines.join(' | '));
  assert.ok(lines.every(l=>!l.includes('kq-very-secret-9876')));
  secrets.set(meta.id,'app_hotel_key',null);
 }finally{server.close()}
});

test('one box: a name finds the spec online (YAML on GitHub), or Kairoq reads the docs page; services the code calls are offered',async()=>{
 const m2=builder.create({name:'Trips',owner:'owner'});
 const yaml=require('yaml').stringify(SPEC);
 const fetched=[];
 const fetchUrl=async({url})=>{fetched.push(url);
  if(url==='https://raw.githubusercontent.com/acme/specs/main/hotels.yaml')return{status:200,body:yaml};
  if(url==='https://docs.rooms.test/api')return{status:200,body:'<html><head><script>evil()</script></head><body><h1>Rooms API</h1><p>Base URL https://api.rooms.test/v2. Send your key in the X-Rooms-Key header.</p><p>GET /rooms returns {"rooms":[{"id","name","price"}]}</p>'+'<p>More text.</p>'.repeat(60)+'</body></html>'};
  return{status:404,body:''}};
 const webSearch=async q=>/Sample Hotels/.test(q)&&/OpenAPI/.test(q)?['https://example.com/blog','https://github.com/acme/specs/blob/main/hotels.yaml']:/Rooms/.test(q)&&/documentation/.test(q)?['https://docs.rooms.test/api']:[];
 const a=await samples.addByName(m2.id,{name:'Sample Hotels',webSearch,fetchUrl});
 assert.equal(a.title,'Sample Hotels');assert.equal(a.secret,'SAMPLE_KEY');assert.equal(a.drafted,false);
 assert.equal(a.source,'https://raw.githubusercontent.com/acme/specs/main/hotels.yaml');
 assert.ok(!fetched.includes('https://example.com/blog'),'only spec-looking links are opened');
 // Drafted from the docs page; the page goes to the AI as text, scripts removed.
 const asked=[];
 const callModel=async(o,parse)=>{asked.push(o.messages[1].content);return parse(JSON.stringify({openapi:'3.0.3',info:{title:'Rooms'},servers:[{url:'https://api.rooms.test/v2'}],components:{securitySchemes:{k:{type:'apiKey',in:'header',name:'X-Rooms-Key'}}},security:[{k:[]}],paths:{'/rooms':{get:{responses:{200:{description:'ok',content:{'application/json':{schema:{type:'object',properties:{rooms:{type:'array',items:{type:'object',properties:{id:{type:'string'},name:{type:'string'},price:{type:'number'}}}}}}}}}}}}}}))};
 const b=await samples.addByName(m2.id,{name:'Rooms',webSearch,fetchUrl,callModel});
 assert.equal(b.drafted,true);assert.equal(b.secret,'ROOMS_KEY');assert.equal(b.base_url,'https://api.rooms.test/v2');assert.equal(b.source,'https://docs.rooms.test/api');
 assert.match(asked[0],/Base URL https:\/\/api\.rooms\.test\/v2/);assert.doesNotMatch(asked[0],/evil\(\)/);
 const r=await samples.fetchFor(m2.id,{url:'https://api.rooms.test/v2/rooms',method:'GET'},{mode:'preview'});
 assert.equal(JSON.parse(r.body).rooms.length,3);
 // A website typed in: the usual spec addresses on it are tried.
 fetched.length=0;
 await assert.rejects(samples.addByName(m2.id,{name:'api.nothing.test',webSearch:async()=>[],fetchUrl}),/could not find/);
 assert.ok(fetched.includes('https://api.nothing.test/openapi.json'));
 await assert.rejects(samples.addByName(m2.id,{name:'x'}),/Type the service/);
 // The code calls a service with no key and no sample answers yet: offered.
 await builder.initializeFrom(m2,{...design.starterFiles('Trips'),'functions/cars.js':"export default async function (request, { fetch, secrets }) {\n  const k = await secrets.get('CARS_KEY');\n  const r = await fetch('https://api.cars.test/v1/cars', { headers: { Authorization: 'Bearer ' + k } });\n  return { json: await r.json() };\n}\n",'functions/rooms.js':"export default async function (request, { fetch, secrets }) { const r = await fetch('https://api.rooms.test/v2/rooms', { headers: { 'X-Rooms-Key': await secrets.get('ROOMS_KEY') } }); return { json: await r.json() } }\n"},'Trips');
 assert.deepEqual(samples.suggestions(m2.id),[{host:'api.cars.test',secret:'CARS_KEY'}]);
 backend.close(m2.id);
});
