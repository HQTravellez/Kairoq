"use strict";
// Autopilot: Kairoq finishes the job by itself (test against the request → fix → test again),
// picks its own skills from a menu, and sends helpers (researcher, reviewer) that cannot edit.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-autopilot-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_DESIGN_BRIEF:'off',KAIROQ_WEB_RESEARCH:'off',KAIROQ_CRAFT_CHECK:'off',KAIROQ_LOOK_CHECK:'off',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const AP=require('../autopilot'),builder=require('../react-builder'),engine=require('../opencode-engine'),S=require('../builder-skills');

const verdict=(items,problems=[])=>({...AP.clean({items:items.map(([what,status])=>({what,status,evidence:'seen'})),problems}),version:1});

test('the verdict comes from the findings, not the tester\'s word',()=>{
 const t=AP.clean({items:[{what:'Walk button',status:'done'},{what:'Real 3D T-Rex',status:'missing',evidence:'an SVG drawing'}],problems:[],verdict:'pass'});
 assert.equal(t.pass,false);
 assert.equal(AP.clean({items:[{what:'A',status:'done'}],problems:[{what:'Crash on phone',severity:'major'}]}).pass,false);
 assert.equal(AP.clean({items:[{what:'A',status:'done'}],problems:[{what:'Spacing',severity:'minor'}]}).pass,true);
 assert.throws(()=>AP.clean({items:[]}),/no requirements/);
});

test('the loop: test, fix what is missing, test again, stop when it passes',async()=>{
 const tests=[verdict([['Walk button','done'],['Real 3D T-Rex','missing']]),verdict([['Walk button','done'],['Real 3D T-Rex','done']])];
 const edits=[];
 const out=await AP.run({test:async()=>tests.shift(),edit:async m=>{edits.push(m);return{version:2}},rounds:3});
 assert.equal(edits.length,1);assert.match(edits[0],/Not done yet:\n- Real 3D T-Rex \(missing\)/);assert.doesNotMatch(edits[0],/Walk button/);
 assert.equal(out.rounds.length,2);assert.equal(out.final.pass,true);
 assert.match(out.summary,/everything you asked for is in and working/);
});

test('the loop stops when two rounds make no progress, and after the round limit',async()=>{
 let n=0;const stuck=await AP.run({test:async()=>{n++;return verdict([['Paper tracking','missing']])},edit:async()=>({}),rounds:3});
 assert.equal(n,2,'tested twice');assert.equal(stuck.rounds.at(-1).stopped,'no progress');
 assert.match(stuck.summary,/0 of 1 things you asked for are done\.\nNot done yet: Paper tracking/);
 let k=0,e=0;const limited=await AP.run({test:async()=>verdict([['Item '+(k++),'missing']]),edit:async()=>{e++;return{}},rounds:2});
 assert.equal(limited.rounds.length,3);assert.equal(e,2);
});

test('judge: the tester gets the request, the code, the screenshots, Kairoq\'s tests and the AI customers',async()=>{
 const meta=builder.create({name:'Dino',owner:'owner'});await builder.initialize(meta);
 await builder.edit(meta.id,'x',{callModel:async(_o,p)=>p(JSON.stringify({message:'ok',files:{'src/App.jsx':'export default function App(){return <main><h1>Dino</h1><svg/></main>}\n'}}))});
 let seen=null;
 const t=await AP.judge(meta.id,{request:'A real animated 3D T-Rex with a Jump button',
  designShots:async()=>[{name:'desktop',mime:'image/png',data:'AAAA'},{name:'phone',mime:'image/png',data:'AAAA'}],
  customers:async()=>'0% of 2 visitors reached the goal.',checks:{runtime_errors:['TypeError: x']},
  callModel:async(o,parse)=>{seen=o;return parse(JSON.stringify({items:[{what:'Real 3D T-Rex',status:'missing',evidence:'App.jsx draws an svg'}],problems:[]}))}});
 assert.equal(t.pass,false);assert.equal(t.version,2);
 const text=seen.messages[1].content[0].text;
 assert.match(seen.messages[0].content,/an SVG or boxes standing in for a real 3D model/);
 assert.match(text,/A real animated 3D T-Rex/);assert.match(text,/\/\/ src\/App\.jsx/);assert.match(text,/browser errors: TypeError: x/);assert.match(text,/0% of 2 visitors/);
 assert.equal(seen.messages[1].content.filter(c=>c.type==='image_url').length,2);
});

test('autopilot runs only with top quality (or when switched on)',()=>{
 const keep={...process.env};
 delete process.env.KAIROQ_QUALITY;delete process.env.KAIROQ_AUTOPILOT;assert.equal(AP.enabled(),false);
 process.env.KAIROQ_QUALITY='top';assert.equal(AP.enabled(),true);
 process.env.KAIROQ_AUTOPILOT='off';assert.equal(AP.enabled(),false);
 delete process.env.KAIROQ_QUALITY;process.env.KAIROQ_AUTOPILOT='on';assert.equal(AP.enabled(),true);
 process.env.KAIROQ_QUALITY=keep.KAIROQ_QUALITY||'';process.env.KAIROQ_AUTOPILOT=keep.KAIROQ_AUTOPILOT||'';
});

test('"Keep going until it\'s right": the editor API tests, fixes and tests again, and tells the owner',{timeout:180000},async()=>{
 const createApi=require('../create-api');
 const meta=builder.create({name:'Shop',owner:'owner'});await builder.initialize(meta);
 const m=builder.loadMeta(meta.id);m.messages.push({role:'user',text:'A shop with a cart and a checkout page'});builder.saveMeta(m);
 let judged=0;
 const callModel=async(o,parse)=>{
  if(o.purpose==='autopilot-judge'){judged++;return parse(JSON.stringify(judged===1?{items:[{what:'Cart',status:'done',evidence:'App.jsx'},{what:'Checkout page',status:'missing',evidence:'no route'}],problems:[]}:{items:[{what:'Cart',status:'done',evidence:'ok'},{what:'Checkout page',status:'done',evidence:'Checkout.jsx'}],problems:[]}))}
  const last=String(o.messages.at(-1).content);
  assert.match(last,/Autopilot round 1[\s\S]*Checkout page \(missing\)/);
  return parse(JSON.stringify({message:'Added the checkout page.',files:{'src/App.jsx':'export default function App(){return <main><h1>Shop</h1><a href="#checkout">Checkout</a></main>}\n'}}));
 };
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,callModel,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/api/create/projects/'+meta.id;
 try{
  const r=await fetch(base+'/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:"Keep going until it's right",mode:'autopilot'})});
  const {job}=await r.json();assert.ok(job&&job.id,'job started');
  let j;for(let i=0;i<300;i++){j=(await (await fetch('http://127.0.0.1:'+server.address().port+'/api/create/jobs/'+job.id)).json()).job;if(['complete','failed','cancelled'].includes(j.status))break;await new Promise(r=>setTimeout(r,200))}
  assert.equal(j.status,'complete',JSON.stringify(j).slice(0,500));
  assert.equal(judged,2);
  assert.match(j.result.autopilot.summary,/everything you asked for is in and working/);
  assert.match(builder.loadMeta(meta.id).messages.at(-1).text,/Autopilot: everything you asked for/);
 }finally{server.close()}
});

test('with autopilot on, the first build is tested and finished before the owner is told it is done',{timeout:180000},async()=>{
 const createApi=require('../create-api');process.env.KAIROQ_AUTOPILOT='on';process.env.KAIROQ_AUTOPILOT_CUSTOMERS='off';
 const meta=builder.create({name:'Cafe',owner:'owner'});await builder.initialize(meta);
 let judged=0,builds=0;
 const callModel=async(o,parse)=>{
  if(o.purpose==='autopilot-judge'){judged++;return parse(JSON.stringify({items:[{what:'Menu page',status:judged===1?'missing':'done',evidence:'x'}],problems:[]}))}
  if(o.purpose)return parse('{}');
  builds++;return parse(JSON.stringify({message:'Built.',files:{'src/App.jsx':'export default function App(){return <main><h1>Cafe '+builds+'</h1></main>}\n'}}));
 };
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,callModel,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 try{
  const {job}=await (await fetch('http://127.0.0.1:'+port+'/api/create/projects/'+meta.id+'/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'A cafe site with a menu page',mode:'build'})})).json();
  let j;for(let i=0;i<300;i++){j=(await (await fetch('http://127.0.0.1:'+port+'/api/create/jobs/'+job.id)).json()).job;if(['complete','failed','cancelled'].includes(j.status))break;await new Promise(r=>setTimeout(r,200))}
  assert.equal(j.status,'complete',JSON.stringify(j).slice(0,400));
  assert.equal(judged,2);assert.equal(builds,2,'the build plus one autopilot fix');
  assert.equal(j.result.autopilot.rounds.length,2);assert.ok(j.result.first_version<j.result.version);
 }finally{server.close();delete process.env.KAIROQ_AUTOPILOT;delete process.env.KAIROQ_AUTOPILOT_CUSTOMERS}
});

test('skills menu: the builder sees every skill and opens the ones it needs',async()=>{
 const menu=S.menu();
 assert.match(menu,/- 3d-character: /);assert.match(menu,/- Physics Engine: /);assert.match(menu,/- Operating System: \(not inside a browser app\)/);
 assert.equal(S.list().length,38);
 const T=require('../builder-tools').forProject('x');
 assert.match(await T.run('skill',{name:'3d-character'}),/Model3D from 'kairoq\/3d'/);
 assert.match(await T.run('skill',{name:'game'}),/Topic: Game/);
 assert.match(await T.run('skill',{name:'nope'}),/No skill called/);
});

test('helpers: a researcher and a reviewer that cannot change the app',()=>{
 const cfg=JSON.parse(JSON.stringify(require('../opencode-engine').__config?require('../opencode-engine').__config({id:'m',baseURL:'x'}):{}));
 const src=fs.readFileSync(path.join(__dirname,'..','opencode-engine.js'),'utf8');
 assert.match(src,/researcher:\{mode:'subagent'/);assert.match(src,/reviewer:\{mode:'subagent'/);
 assert.match(src,/task:\{'\*':'deny',researcher:'allow',reviewer:'allow'\}/);
 assert.equal((src.match(/edit:'deny',bash:'deny'/g)||[]).length,2,'neither helper can edit or run commands');
 assert.match(engine.rules('Rules.'),/send the researcher/);
});

test('the real OpenCode program offers the helpers and the skill tool, and a helper cannot edit',{skip:!process.env.KAIROQ_TEST_OPENCODE_BIN&&'set KAIROQ_TEST_OPENCODE_BIN to run OpenCode itself',timeout:300000},async()=>{
 const meta=builder.create({name:'Real',owner:'owner'});
 const calls=[];
 const model=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{
  const j=JSON.parse(b||'{}'),tools=(j.tools||[]).map(t=>t.function&&t.function.name),sys=JSON.stringify(j.messages&&j.messages[0]||'').slice(0,4000),done=(j.messages||[]).filter(m=>m.role==='tool').length;
  const helper=/research helper of an app builder/.test(sys);calls.push({tools,helper,done});
  r.writeHead(200,{'Content-Type':'text/event-stream'});const send=o=>r.write('data: '+JSON.stringify({id:'c',object:'chat.completion.chunk',created:1,model:j.model,...o})+'\n\n');
  const call=(name,args)=>send({choices:[{index:0,delta:{role:'assistant',tool_calls:[{index:0,id:'call_'+calls.length,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:10,completion_tokens:5}});
  if(!tools.length)send({choices:[{index:0,delta:{role:'assistant',content:'Title'},finish_reason:'stop'}]});
  else if(helper&&!done)call('kairoq_tutorials',{topic:'Game'});
  else if(helper)send({choices:[{index:0,delta:{role:'assistant',content:'Use a game loop with dt.'},finish_reason:'stop'}]});
  else if(done===0)call('kairoq_skill',{name:'3d-character'});
  else if(done===1)call('task',{description:'Research games',prompt:'How do I build a snake game?',subagent_type:'researcher'});
  else send({choices:[{index:0,delta:{role:'assistant',content:'Planned the game.'},finish_reason:'stop'}]});
  r.end('data: [DONE]\n\n');
 })});
 const route=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',async()=>{try{const j=JSON.parse(b||'{}');r.end(JSON.stringify({report:await engine.runCheck(String(q.headers.authorization||'').replace(/^Bearer\s+/i,''),j.tool||'check',j.args||{})}))}catch(e){r.statusCode=404;r.end('{}')}})});
 await new Promise(r=>model.listen(0,'127.0.0.1',r));await new Promise(r=>route.listen(0,'127.0.0.1',r));
 Object.assign(process.env,{KAIROQ_OPENCODE_BIN:process.env.KAIROQ_TEST_OPENCODE_BIN,EXPLABS_API_KEY:'test-key',KAIROQ_OPENCODE_BASE_URL:'http://127.0.0.1:'+model.address().port+'/v1',KAIROQ_OPENCODE_MODEL:'m1',NO_PROXY:'127.0.0.1,localhost'});
 engine.configure({checkUrl:'http://127.0.0.1:'+route.address().port+'/'});
 const s=engine.session({rules:engine.rules('Rules.'),tools:require('../builder-tools').forProject(meta.id)});
 try{
  const r=await s.reply({files:{'src/App.jsx':'export default function App(){return null}\n'},prompt:'Make a snake game'});
  const main=calls.find(c=>!c.helper&&c.tools.length).tools,helper=calls.find(c=>c.helper);
  assert.ok(main.includes('task')&&main.includes('kairoq_skill')&&main.includes('edit'),'builder tools: '+main.join(','));
  assert.ok(helper,'the researcher ran');
  assert.ok(helper.tools.includes('kairoq_tutorials')&&!helper.tools.includes('edit')&&!helper.tools.includes('write')&&!helper.tools.includes('kairoq_download'),'researcher tools: '+helper.tools.join(','));
  assert.match(r.message,/Planned the game/);
 }finally{s.close();model.close();route.close();engine.configure({checkUrl:null});for(const k of ['KAIROQ_OPENCODE_BIN','EXPLABS_API_KEY','KAIROQ_OPENCODE_BASE_URL','KAIROQ_OPENCODE_MODEL'])delete process.env[k]}
});
