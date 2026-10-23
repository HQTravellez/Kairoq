"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-tier5-'));
process.env.NODE_ENV='test';
// These tests script the model's replies in order; the design brief has its own tests.
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.APP_ENCRYPTION_KEY='tier5-encryption-key-0123456789';
process.env.KAIROQ_FREE_CREDITS='20';
process.env.KAIROQ_FUNCTION_TIMEOUT_MS='4000';
process.env.KAIROQ_SQL_TIMEOUT_MS='1500';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),sql=require('../react-sql'),runtime=require('../runtime-check'),security=require('../react-security'),figma=require('../react-figma'),agent=require('../react-agent');

// The fake model answers build requests with a fixed app, or plays a script for agent tasks.
let script=null,lastModelOpts=null,agentCalls=[];
const callModel=async(opts,parse)=>{
 lastModelOpts={...opts,messages:opts.messages.map(m=>({...m}))};
 if(script){agentCalls.push(opts.messages.map(m=>({...m})));const next=script.shift();if(typeof next==='function')return parse(JSON.stringify(await next(opts)));return parse(JSON.stringify(next))}
 return parse(JSON.stringify({message:'ok',files:{'src/App.jsx':'export default function App(){return <p className="p-2">ok</p>}\n'}}));
};
let figmaFetch=null;
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,headers:res.headers,json,text:buf.toString()})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false,inspect:(u,o)=>runtime.inspect('http://127.0.0.1:'+server.address().port+u,o),webSearch:async q=>['https://example.com/docs?q='+encodeURIComponent(q)],figmaFetch:(u,o)=>figmaFetch(u,o)}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.5.0.'+(++ip)}});return{cookie:r.headers['set-cookie'][0].split(';')[0],account:r.json.account}}
async function project(cookie,name='T5'){return(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name}})).json.project.id}
async function waitJob(cookie,job){let j=job;for(let i=0;i<600&&!['complete','failed'].includes(j.status);i++){await new Promise(r=>setTimeout(r,50));j=(await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job}return j}
async function credits(cookie){return(await request(server,'GET','/api/create/me',{headers:{cookie}})).json.viewer.account.credits}

const SCHEMA="CREATE TABLE rooms(id INTEGER PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0));\nCREATE TABLE bookings(id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES rooms(id), guest TEXT NOT NULL, nights INTEGER NOT NULL);\nINSERT INTO rooms(name,price) VALUES('Garden',90),('Suite',180);\n";
const BOOK="export default async function(request,{db,user}){\n if(request.method==='GET')return {json:await db.sql`SELECT r.name, COUNT(b.id) AS bookings, COALESCE(SUM(b.nights),0) AS nights FROM rooms r LEFT JOIN bookings b ON b.room_id=r.id GROUP BY r.id ORDER BY r.id`};\n const {room,guest,nights}=request.body;\n const [row]=await db.sql`INSERT INTO bookings(room_id,guest,nights) VALUES(${room},${guest},${nights}) RETURNING id`;\n console.log('booked',guest);\n return {status:201,json:row};\n}\n";

test('SQL tables: migrations run once, server functions query with joins and parameters, nothing dangerous is allowed',async()=>{
 const {cookie}=await signup('sql@example.com');
 const id=await project(cookie,'Hotel');
 const base=builder.loadFiles(id,1);
 await builder.saveSource(id,{...base,'sql/001_init.sql':SCHEMA,'functions/book.js':BOOK},{summary:'rooms'});
 const api='/api/apps/'+id+'/functions/book';
 assert.equal((await request(server,'POST',api,{body:{room:1,guest:"Robert'); DROP TABLE rooms;--",nights:3}})).status,201,'values are parameters, so quotes are harmless');
 assert.equal((await request(server,'POST',api,{body:{room:2,guest:'Ana',nights:2}})).status,201);
 const bad=await request(server,'POST',api,{body:{room:99,guest:'X',nights:1}});
 assert.equal(bad.status,500);assert.match(bad.json.error,/FOREIGN KEY/);
 assert.deepEqual((await request(server,'GET',api)).json,[{name:'Garden',bookings:1,nights:3},{name:'Suite',bookings:1,nights:2}]);
 // Applied migrations are fixed; new ones are added.
 const v=builder.loadMeta(id).current_version,files=builder.loadFiles(id,v);
 await assert.rejects(builder.saveSource(id,{...files,'sql/001_init.sql':SCHEMA+'\nCREATE TABLE x(a);'},{summary:'edit'}),/already been applied/);
 await builder.saveSource(id,{...files,'sql/002_guests.sql':'ALTER TABLE bookings ADD COLUMN email TEXT;'},{summary:'add email'});
 await assert.rejects(builder.saveSource(id,{...files,'sql/003_bad.sql':"ATTACH DATABASE '/etc/passwd' AS p;"},{summary:'bad'}),/ATTACH is not allowed/);
 await assert.rejects(builder.saveSource(id,{...files,'sql/3_bad.sql':'SELECT 1;'},{summary:'bad'}),/sql\/001_description/);
 // Owner view and console.
 const overview=(await request(server,'GET','/api/create/projects/'+id+'/sql',{headers:{cookie}})).json;
 assert.deepEqual(overview.tables.map(t=>[t.name,t.count]),[['bookings',2],['rooms',2]]);
 assert.deepEqual(overview.tables[0].foreign_keys,[{ref:'rooms',col:'room_id',ref_col:'id'}]);
 assert.deepEqual(overview.migrations.map(m=>m.name),['sql/001_init.sql','sql/002_guests.sql']);
 assert.deepEqual((await request(server,'POST','/api/create/projects/'+id+'/sql',{headers:{cookie},body:{query:'SELECT COUNT(*) AS n FROM bookings WHERE nights > ?',params:[2]}})).json.result,[{n:1}]);
 for(const q of ['PRAGMA table_info(rooms)','SELECT * FROM pragma_database_list','SELECT 1; DELETE FROM rooms','DELETE FROM _kairoq_migrations'])
  assert.equal((await request(server,'POST','/api/create/projects/'+id+'/sql',{headers:{cookie},body:{query:q}})).status,400,q);
 // A runaway query is killed without blocking the server.
 const started=Date.now();
 const slow=request(server,'POST','/api/create/projects/'+id+'/sql',{headers:{cookie},body:{query:'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT COUNT(*) FROM c'}});
 await new Promise(r=>setTimeout(r,200));
 assert.equal((await request(server,'GET',api)).status,200,'other queries keep working');
 const r=await slow;assert.equal(r.status,504);assert.match(r.json.error,/stopped/);
 assert.ok(Date.now()-started<6000);
 assert.equal((await request(server,'GET',api)).status,200,'the SQL process is replaced');
 // Logs from the function are kept for the editor and the agent.
 const logs=(await request(server,'GET','/api/create/projects/'+id+'/logs',{headers:{cookie}})).json.logs;
 assert.ok(logs.some(l=>l.message==='booked Ana'));
 assert.ok(logs.some(l=>l.level==='error'&&/FOREIGN KEY/.test(l.message)));
 // The security scan catches SQL built from strings.
 assert.equal(security.scan({'functions/x.js':'export default async function(r,{db,user}){if(!user)return;return {json:await db.sql(`SELECT * FROM rooms WHERE name = \'${r.query.n}\'`)}}'},{})[0].title,'SQL built from strings');
 assert.deepEqual(security.scan({'functions/book.js':BOOK.replace('{db,user}','{db,user}').replace("const {room","if(!user)return {status:401};const {room")},{}).filter(f=>/SQL/.test(f.title)),[]);
});

test('agent mode works in steps: fixes a failed build, tests the UI in a browser, reads logs and data, then finishes',{skip:!runtime.available()&&'Chromium not installed'},async()=>{
 const {cookie}=await signup('agent@example.com');
 const id=await project(cookie,'Agent');
 const before=await credits(cookie);
 const APP="import {useState} from 'react';\nimport {functions} from 'kairoq';\nexport default function App(){const [msg,setMsg]=useState('');return <main className='p-6'><h1>Room booking</h1><label>Guest name<input aria-label='Guest name' id='g'/></label><button onClick={async()=>{const r=await functions.invoke('book',{room:1,guest:document.getElementById('g').value,nights:2});setMsg('Booked #'+r.id)}}>Book now</button><p>{msg}</p></main>}\n";
 script=[
  {thought:'I will add the rooms table, a booking function and the page.',actions:[{tool:'search',query:'export default'},{tool:'write_files',files:{'sql/001_init.sql':SCHEMA,'functions/book.js':BOOK,'src/App.jsx':APP.replace("from 'kairoq'","from './missing'")}},{tool:'build_and_test'}]},
  opts=>{const last=opts.messages.at(-1).content;assert.match(typeof last==='string'?last:last[0].text,/does not match a project file|nothing was built/);return{thought:'Fix the import, then test the booking flow.',actions:[{tool:'write_files',files:{'src/App.jsx':APP}},{tool:'build_and_test',steps:[{action:'fill',label:'Guest name',value:'Mia'},{action:'click',text:'Book now'},{action:'expect',text:'Booked #1'}]}]}},
  opts=>{const last=opts.messages.at(-1).content;assert.equal(typeof last,'string','standard tier gets no screenshots');assert.match(last,/built OK/);assert.match(last,/3\. ok /);assert.match(last,/No errors in the browser/);return{thought:'Check the logs and the saved row.',actions:[{tool:'view_logs'},{tool:'query_db',sql:'SELECT guest, nights FROM bookings'},{tool:'query_db',sql:'DELETE FROM bookings'},{tool:'web_search',query:'sqlite returning'}]}},
  opts=>{const last=opts.messages.at(-1).content;assert.match(last,/booked Mia/);assert.match(last,/"guest":"Mia"/);assert.match(last,/only SELECT/);assert.match(last,/example\.com\/docs/);return{thought:'Everything works.',actions:[{tool:'finish',message:'Added room booking backed by SQL tables, tested end to end.'}]}}
 ];
 agentCalls=[];
 const start=await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Add room booking with a database',mode:'agent'}});
 assert.equal(start.status,202);assert.equal(start.json.job.credits,3,'agent tasks cost 3x the tier');
 const job=await waitJob(cookie,start.json.job);
 script=null;
 assert.equal(job.status,'complete',job.error);
 assert.equal(job.result.version,2);assert.equal(job.result.steps,4);
 assert.deepEqual(job.result.changed.sort(),['functions/book.js','sql/001_init.sql','src/App.jsx']);
 assert.equal(job.agent.steps.length,4);assert.match(job.agent.steps[1].actions.join(' '),/Built and tested the app \(3 UI steps\)/);
 assert.match(agentCalls[0][0].content,/AGENT MODE/);assert.match(agentCalls[0][0].content,/web_search/);
 const p=(await request(server,'GET','/api/create/projects/'+id,{headers:{cookie}})).json.project;
 const last=p.messages.at(-1);
 assert.equal(last.mode,'agent');assert.equal(last.steps.length,4);assert.equal(p.versions.at(-1).agent.steps,4);
 assert.equal(await credits(cookie),before-3);
 assert.equal(fs.existsSync(path.join(builder.versionDir(id,3))),false,'failed builds leave no version behind');
});

test('agent mode: Stop cancels the task and refunds credits; a finish with errors is questioned once',async()=>{
 const {cookie}=await signup('stop@example.com');
 const id=await project(cookie,'Stop');
 const before=await credits(cookie);
 let release;
 script=[opts=>new Promise((_,reject)=>{release=reject;opts.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})))})];
 const start=await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Do a long task',mode:'agent'}});
 await new Promise(r=>setTimeout(r,100));
 assert.equal(before-3,await credits(cookie));
 assert.equal((await request(server,'POST','/api/create/jobs/'+start.json.job.id+'/cancel',{headers:{cookie}})).status,200);
 const job=await waitJob(cookie,start.json.job);
 assert.equal(job.status,'failed');assert.equal(job.error,'Stopped.');
 assert.equal(await credits(cookie),before,'credits refunded');
 // The protocol parser accepts plain build answers and rejects junk.
 assert.deepEqual(agent.parseStep('{"files":{"src/App.jsx":"x"}}').actions.map(a=>a.tool),['write_files','build_and_test']);
 assert.throws(()=>agent.parseStep('hello'),/not JSON/);
 assert.equal(agent.htmlToText('<style>x{}</style><h1>Docs</h1><p>Use &amp; enjoy</p>'),'Docs\nUse & enjoy');
 // Running out of steps keeps a version only if it builds.
 script=[{thought:'write',actions:[{tool:'write_files',files:{'src/App.jsx':'export default function App(){return <p>v2</p>}\n'}}]},{thought:'still going',actions:[{tool:'view_logs'}]}];
 const r=await agent.run(id,'Change the text',{callModel,maxSteps:2});
 script=null;
 assert.match(r.message,/^Stopped after 2 steps/);assert.equal(r.version,2);
});

test('Figma import reads the frame, saves its images, describes layout, colours and text, then builds it',async()=>{
 const {cookie}=await signup('figma@example.com');
 const id=await project(cookie,'Figma');
 const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4f00000000049454e44ae426082','hex');
 const frame={id:'12:34',name:'Home',type:'FRAME',absoluteBoundingBox:{width:1440,height:900},layoutMode:'VERTICAL',itemSpacing:24,paddingTop:48,paddingLeft:80,paddingRight:80,paddingBottom:48,fills:[{type:'SOLID',color:{r:1,g:0.98,b:0.94,a:1}}],children:[
  {id:'1:2',name:'Title',type:'TEXT',characters:'Book your stay in Lisbon',style:{fontFamily:'Playfair Display',fontSize:56,fontWeight:700,lineHeightPx:64},fills:[{type:'SOLID',color:{r:0.1,g:0.1,b:0.1,a:1}}]},
  {id:'1:3',name:'Hero photo',type:'RECTANGLE',absoluteBoundingBox:{width:1280,height:480},cornerRadius:24,fills:[{type:'IMAGE',imageRef:'ref1'}]},
  {id:'1:4',name:'CTA',type:'FRAME',layoutMode:'HORIZONTAL',fills:[{type:'SOLID',color:{r:0.05,g:0.45,b:0.4,a:1}}],cornerRadius:999,children:[{id:'1:5',name:'Label',type:'TEXT',characters:'Check availability',style:{fontFamily:'Inter',fontSize:16,fontWeight:600},fills:[{type:'SOLID',color:{r:1,g:1,b:1,a:1}}]}]},
  {id:'1:6',name:'Hidden',type:'TEXT',visible:false,characters:'secret'}
 ]};
 const seen=[];
 figmaFetch=async(url,opts)=>{
  seen.push(url);
  const json=b=>({ok:true,status:200,json:async()=>b,arrayBuffer:async()=>new ArrayBuffer(0)});
  const bin=b=>({ok:true,status:200,json:async()=>({}),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)});
  if(url.startsWith('https://api.figma.com/')){
   if(opts.headers['X-Figma-Token']!=='figd_valid_token_1234567890')return{ok:false,status:403,json:async()=>({err:'Invalid token'})};
   if(url.includes('/nodes?ids='))return json({nodes:{'12:34':{document:frame}}});
   if(url.includes('/images/KEY1234567890ab?ids='))return json({images:{'12:34':'https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/render.png'}});
   if(url.endsWith('/files/KEY1234567890ab/images'))return json({meta:{images:{ref1:'https://s3-alpha.figma.com/img/hero.png'}}});
  }
  if(url.startsWith('https://figma-alpha-api.s3.')||url.startsWith('https://s3-alpha.figma.com/'))return bin(png);
  return{ok:false,status:404,json:async()=>({})};
 };
 assert.deepEqual(figma.parseUrl('https://www.figma.com/design/KEY1234567890ab/Hotel?node-id=12-34&t=x'),{key:'KEY1234567890ab',nodeId:'12:34'});
 assert.deepEqual(figma.parseUrl('https://www.figma.com/design/KEY1234567890ab/branch/BRANCH12345678/Hotel'),{key:'BRANCH12345678',nodeId:null});
 assert.throws(()=>figma.parseUrl('https://evil.com/design/KEY1234567890ab/x'),/figma\.com/);
 const url='https://www.figma.com/design/KEY1234567890ab/Hotel?node-id=12-34';
 const denied=await request(server,'POST','/api/create/projects/'+id+'/figma',{headers:{cookie},body:{url,token:'figd_wrong_token_1234567890'}});
 assert.equal(denied.status,400);assert.match(denied.json.error,/refused the token/);
 const before=await credits(cookie);
 const r=await request(server,'POST','/api/create/projects/'+id+'/figma',{headers:{cookie},body:{url,token:'figd_valid_token_1234567890',save_token:true}});
 assert.equal(r.status,202,r.text);
 assert.deepEqual(r.json.frame,{name:'Home',images:['hero-photo.png'],rendered:true});
 const job=await waitJob(cookie,r.json.job);
 assert.equal(job.status,'complete',job.error);
 assert.equal(await credits(cookie),before-1,'no screenshot is sent without paid models, so no image credit');
 const prompt=lastModelOpts.messages.at(-1).content;
 assert.equal(typeof prompt,'string');
 for(const s of ['Figma design spec for the frame "Home"','auto-layout column gap 24','padding 48/80/48/80','fill #fffaf0','Playfair Display 56/64 700','text "Book your stay in Lisbon"','image ./uploads/hero-photo.png','radius 999','Colours (most used first):'])assert.ok(prompt.includes(s),s);
 assert.ok(!prompt.includes('secret'),'hidden layers are skipped');
 assert.ok(fs.existsSync(path.join(builder.projectDir(id),'uploads','hero-photo.png')));
 assert.ok(!fs.existsSync(path.join(builder.projectDir(id),'uploads','figma-home.png')),'the rendered frame is only a reference');
 assert.doesNotMatch(fs.readFileSync(path.join(builder.projectDir(id),'secrets.json'),'utf8'),/figd_valid/);
 assert.equal((await request(server,'GET','/api/create/projects/'+id+'/figma',{headers:{cookie}})).json.token_saved,true);
 // With paid models the rendered frame goes to a vision model as a reference image.
 process.env.KAIROQ_BUILDER_PAID_APPROVED='true';
 try{
  const again=await request(server,'POST','/api/create/projects/'+id+'/figma',{headers:{cookie},body:{url}});
  assert.equal(again.status,202,again.text);
  const j2=await waitJob(cookie,again.json.job);
  assert.equal(j2.status,'complete',j2.error);
  assert.equal(lastModelOpts.tier,'vision');
  assert.ok(Array.isArray(lastModelOpts.messages.at(-1).content)&&lastModelOpts.messages.at(-1).content.some(p=>p.type==='image_url'));
 }finally{delete process.env.KAIROQ_BUILDER_PAID_APPROVED}
 assert.ok(seen.every(u=>/^https:\/\/(api\.figma\.com|figma-alpha-api\.s3\.|s3-alpha\.figma\.com)/.test(u)));
});
