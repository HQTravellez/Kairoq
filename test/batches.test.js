"use strict";
// Batches 2-4: what test customers remember, checks that repair themselves, structured data from
// text and photos, asking an app's data in plain words, the side-effect guard, the two-reviewer
// design panel and the skill-improvement loop.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-batches-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_HOSTING_REGISTRY=path.join(tmp,'hosting.json');
process.env.KAIROQ_MEMORY_DIR=path.join(tmp,'memory');
process.env.KAIROQ_LEARNING_DIR=path.join(tmp,'learning');
process.env.KAIROQ_FREE_CREDITS='20';
process.env.KAIROQ_HOSTING_CREDITS='0';
const builder=require('../react-builder'),hosting=require('../react-hosting'),createApi=require('../create-api'),backend=require('../react-backend');

const calls=[];
backend.configure({appAi:async o=>{calls.push(o);return{text:'{}'}}});
const callModel=(opts,parse)=>Promise.resolve(parse(JSON.stringify({message:'ok',files:{'src/App.jsx':'export default function App(){return <p>ok</p>}\n'}})));
let server,ip=0;
function request(method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const r=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const text=Buffer.concat(c).toString();let json=null;try{json=JSON.parse(text)}catch{}resolve({status:res.statusCode,text,json})})});
  r.on('error',reject);if(payload)r.write(payload);r.end();
 });
}
test.before(async()=>{
 server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function account(email){
 const r=await new Promise((resolve,reject)=>{const payload=Buffer.from(JSON.stringify({email,password:'password1'}));const q=http.request({host:'127.0.0.1',port:server.address().port,method:'POST',path:'/api/create/signup',headers:{'Content-Type':'application/json','Content-Length':payload.length,'x-forwarded-for':'10.6.1.'+(++ip)}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>resolve({cookie:res.headers['set-cookie'][0].split(';')[0]}))});q.on('error',reject);q.write(payload);q.end()});
 return r.cookie;
}
async function app(cookie,files={}){
 const id=(await request('POST','/api/create/projects',{headers:{cookie},body:{name:'Shop'}})).json.project.id;
 await builder.saveSource(id,{...builder.loadFiles(id,1),'src/backend.json':JSON.stringify({collections:{bookings:{access:'public'}},ai:true}),...files},{summary:'setup'});
 return id;
}

test('test customers are asked afterwards what they remember, and the report counts it',async()=>{
 const synthetic=require('../synthetic-customers');
 const session={observe:async()=>({title:'Spa',path:'/',text:'Massage 85 euros. Book by phone.',elements:[],errors:[]}),act:async()=>{},close:async()=>{},screenshot:async()=>null,status:()=>200};
 const model=async(opts,parse)=>{
  const sys=opts.messages[0].content,user=opts.messages.at(-1).content;
  if(/right after leaving a website/.test(sys)){assert.match(user,/What does it cost\?/);assert.match(user,/Massage costs 85/);return parse(JSON.stringify({answers:[{q:1,answer:'85 euros',remembered:true},{q:2,answer:'no idea',remembered:false},{q:3,answer:'by phone',remembered:true}]}))}
  if(/You check whether/.test(sys))return parse('{"verdict":true,"reason":"ok","blocked":false}');
  return parse(JSON.stringify({thought:'Massage costs 85, I can book by phone.',feeling:'confident',memory:'Massage costs 85 euros',actions:[{action:'done',value:'found it'}]}));
 };
 const v=await synthetic.visit({url:'x',persona:synthetic.normalizePersona({name:'Ana'},0),goal:'Book a massage',callModel:model,browse:async()=>session});
 assert.deepEqual(v.recall.map(x=>x.remembered),[true,false,true]);
 const f=synthetic.funnel([v,{...v,recall:v.recall.map(x=>({...x,remembered:false}))}]);
 assert.deepEqual(f.recall.map(x=>[x.remembered,x.asked]),[[1,2],[0,2],[1,2]]);
 assert.deepEqual(synthetic.recallQuestions({recall:[]}),[]);
 // A model that cannot answer the quiz does not break the visit.
 const v2=await synthetic.visit({url:'x',persona:synthetic.normalizePersona({name:'Bo'},1),goal:'g',callModel:async(o,p)=>{if(/right after leaving/.test(o.messages[0].content))throw Error('down');return model(o,p)},browse:async()=>session});
 assert.equal(v2.recall,undefined);assert.equal(v2.outcome,'completed');
});

test('a check that fails on a renamed button suggests the new one, proven to pass, and the owner applies it',async()=>{
 const checks=require('../react-checks');
 const cookie=await account('checks@example.com'),id=await app(cookie);
 checks.save(id,{name:'Book a table',steps:[{action:'fill',label:'Your name',value:'Ana'},{action:'click',text:'Book now'},{action:'expect',text:'Thank you'}]});
 // A stand-in browser: the button is now called "Reserve a table".
 const inspect=async(url,{steps,scan})=>{
  const res=steps.map(s=>({step:JSON.stringify(s),ok:!(s.action==='click'&&s.text==='Book now')}));
  return{skipped:false,errors:[],steps:res,...(scan?{elements:[{id:1,kind:'input:text',label:'Your name'},{id:2,kind:'button',label:'Reserve a table'},{id:3,kind:'link',label:'Menu'}]}:{})};
 };
 const meta=builder.loadMeta(id),url=builder.previewUrl(meta);
 const r=await checks.run(id,url,{inspect,version:meta.current_version});
 assert.equal(r.failed.length,1);assert.equal(r.failed[0].index,1);
 const fixes=await checks.suggestRepairs(id,url,r,{inspect});
 assert.deepEqual(fixes[0],{id:checks.list(builder.loadMeta(id))[0].id,index:1,field:'text',from:'Book now',to:'Reserve a table'});
 // Through the API: the owner applies it.
 const c=checks.list(builder.loadMeta(id))[0];
 const ap=await request('POST','/api/create/projects/'+id+'/checks',{headers:{cookie},body:{repair:c.id}});
 assert.equal(ap.status,200);assert.equal(ap.json.checks[0].steps[1].text,'Reserve a table');
 assert.equal((await request('POST','/api/create/projects/'+id+'/checks',{headers:{cookie},body:{repair:c.id}})).status,404);
 // "expect" steps are never rewritten; unrelated labels are not suggested.
 assert.equal(await checks.repair(id,url,{...c,steps:[{action:'expect',text:'Thank you'}]},{index:0},{inspect}),null);
 assert.ok(checks.similarity('Book now','Book a table')>checks.similarity('Book now','Menu'));
});

test('ai.extract: shapes are checked, values tidied, one retry with the problems, photos go to a vision model',async()=>{
 const X=require('../app-extract');
 const shape={items:[{name:'string',price:'number',vegan:'boolean?'}],phone:'phone?',date:'date?'};
 assert.throws(()=>X.checkShape({a:'money'}),/Unknown type/);
 const v=X.validate(shape,{items:[{name:'Soup',price:'€6,50',vegan:'yes'},{name:'Bread'}],date:'May 3'});
 assert.deepEqual(v.value.items[0],{name:'Soup',price:6.5,vegan:true});
 assert.deepEqual(v.missing,['items[1].price']);assert.match(v.problems[0],/date should be a date/);
 let n=0;
 const out=await X.extract({shape,text:'Soup 6.50, Bread 3 (vegan). Call +351 912 345 678'},async o=>{n++;return{text:n===1?'{"items":[{"name":"Soup","price":"cheap"}]}':'{"items":[{"name":"Soup","price":6.5},{"name":"Bread","price":3,"vegan":true}],"phone":"+351 912 345 678","date":null}'}});
 assert.equal(n,2);assert.equal(out.data.items[1].vegan,true);assert.deepEqual(out.missing,[]);
 assert.throws(()=>X.images(['data:text/html;base64,AAAA']),/PNG, JPEG/);
 // Through the app API, with a photo.
 const cookie=await account('extract@example.com'),id=await app(cookie);
 calls.length=0;
 backend.configure({appAi:async o=>{calls.push(o);return{text:'{"items":[{"name":"Pizza","price":11}]}'}}});
 const jpeg='data:image/jpeg;base64,'+Buffer.from('fake').toString('base64');
 const r=await request('POST','/api/apps/'+id+'/ai/extract',{body:{shape:{items:[{name:'string',price:'number'}]},images:[jpeg]}});
 assert.equal(r.status,200,r.text);assert.equal(r.json.data.items[0].name,'Pizza');
 assert.equal(calls[0].vision,true);assert.equal(calls[0].messages.at(-1).content[1].image_url.url,jpeg);
 assert.equal((await request('POST','/api/apps/'+id+'/ai/extract',{body:{shape:{a:'string'}}})).status,400);
});

test('ask your data: a read-only query on the app\'s records, answered in words; writes and private tables are refused',async()=>{
 const cookie=await account('data@example.com'),id=await app(cookie);
 for(const [room,nights] of [['Garden',2],['Garden',3],['Ocean',1]])await request('POST','/api/apps/'+id+'/collections/bookings',{body:{data:{room,nights}}});
 let n=0;const seen=[];
 backend.configure({appAi:async o=>{seen.push(o);n++;
  if(/ONE read-only SQLite query/.test(o.system)){assert.match(o.messages[0].content,/collection "bookings" \(3 records\), fields: room e\.g\. "(Garden|Ocean)", nights/);return{text:JSON.stringify({db:'records',sql:"SELECT json_extract(data,'$.room') AS \"Room\", SUM(json_extract(data,'$.nights')) AS \"Nights\" FROM records WHERE collection='bookings' GROUP BY 1 ORDER BY 2 DESC",note:'nights booked per room'})}}
  return{text:'The Garden room has 5 nights booked, the Ocean room 1.'};
 }});
 const r=await request('POST','/api/create/projects/'+id+'/askdata',{headers:{cookie},body:{question:'Nights booked per room?'}});
 assert.equal(r.status,200,r.text);
 assert.deepEqual(r.json.rows,[{Room:'Garden',Nights:5},{Room:'Ocean',Nights:1}]);
 assert.match(r.json.answer,/Garden room has 5 nights/);
 const D=require('../data-ask');
 assert.throws(()=>D.safeSql("DELETE FROM records",'records'),/read-only/);
 assert.throws(()=>D.safeSql("SELECT 1; DROP TABLE records",'records'),/more than read/);
 assert.throws(()=>D.safeSql("SELECT email,password FROM users",'records'),/private/);
 // A model that keeps writing a bad query: a clear error, nothing changed.
 backend.configure({appAi:async()=>({text:'{"db":"records","sql":"UPDATE records SET data=1"}'})});
 const bad=await request('POST','/api/create/projects/'+id+'/askdata',{headers:{cookie},body:{question:'wipe it'}});
 assert.equal(bad.status,422);
 assert.equal((await request('GET','/api/apps/'+id+'/collections/bookings')).json.items.length,3);
});

test('side-effect guard: a change about looks that also touched data, payments or sign-in is reported',()=>{
 const g=require('../scope-guard');
 const before={'src/App.jsx':'<button className="bg-red-500">Book</button>','src/backend.json':'{"collections":{"bookings":{"access":"submit-only"}}}','src/Login.jsx':'await auth.signIn(email,password)'};
 const after={'src/App.jsx':'<button className="bg-blue-500">Book</button>','src/backend.json':'{"collections":{"bookings":{"access":"public"}}}','src/Login.jsx':'await auth.signIn(email.trim(),password)'};
 const found=g.check('make the main button blue',before,after);
 assert.deepEqual(found.map(f=>f.area),['saved data and bookings','sign-in']);
 assert.match(g.note(found),/did not ask about/);
 assert.deepEqual(g.check('let guests sign in and book online',before,after),[]);
 assert.deepEqual(g.check('make the button blue',before,{...before,'src/App.jsx':after['src/App.jsx']}),[]);
});

test('design panel: two reviewers, and only problems both agree on are fixed',async()=>{
 const P=require('../design-panel');
 const pictures=[{name:'desktop',mime:'image/jpeg',data:'AAAA'}];
 const model=async(opts,parse)=>{
  const text=opts.messages[0].content[0].text;
  if(/Another design reviewer/.test(text))return parse(JSON.stringify({verdicts:/A1/.test(text)?[{id:'A1',verdict:'UPHOLD'},{id:'A2',verdict:'REJECT'}]:[{id:'B1',verdict:'UPHOLD'}]}));
  return parse(JSON.stringify({findings:opts.tier==='vision'?[{severity:'major',screen:'phone',issue:'Hero text overflows on phones',fix:'Wrap it'},{severity:'minor',screen:'desktop',issue:'I prefer green',fix:'Make it green'}]:[{severity:'minor',screen:'both',issue:'Buttons have three different radii',fix:'Use one radius'}]}));
 };
 const r=await P.review({pictures,callModel:model});
 assert.deepEqual(r.agreed.map(f=>f.id),['A1','B1']);assert.deepEqual(r.rejected.map(f=>f.id),['A2']);
 assert.match(P.note(r.agreed),/overflows on phones[\s\S]*three different radii/);
 // A reviewer that does not answer properly: the panel steps aside (the normal review runs).
 await assert.rejects(P.review({pictures,callModel:async(o,parse)=>parse('{"message":"ok"}')}));
});

test('the event enquiry template is a valid project with an enquiries collection and AI',async()=>{
 const cookie=await account('venue@example.com');
 const r=await request('POST','/api/create/projects',{headers:{cookie},body:{template:'event-enquiry'}});
 assert.equal(r.status,201,r.text);
 const files=builder.loadFiles(r.json.project.id,1);
 assert.deepEqual(builder.validateFiles(files),[]);
 assert.match(files['src/components/PlannerChat.jsx'],/ai\.extract/);
 assert.deepEqual(JSON.parse(files['src/backend.json']).collections,{enquiries:{access:'submit-only'}});
});
