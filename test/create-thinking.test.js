"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-thinking-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'acc.sqlite');
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_BUILD_WORKERS='0';
const builder=require('../react-builder'),{streamSnapshot}=require('../create-api');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

test('the plan streams item by item, before the code',()=>{
 assert.deepEqual(streamSnapshot('{"plan":["Add a bo','build').plan,['Add a bo']);
 assert.deepEqual(streamSnapshot('{"plan":["Add a booking form","Save it to \\"bookings\\""','build').plan,['Add a booking form','Save it to "bookings"']);
 const done=streamSnapshot('{"plan":["A","B"],"message":"Done","files":{"src/App.jsx":"export default 1"}}','build');
 assert.deepEqual(done.plan,['A','B']);assert.equal(done.message,'Done');assert.deepEqual(done.files,['src/App.jsx']);
 assert.deepEqual(streamSnapshot('{"message":"No plan","files":{}}','build').plan,[]);
});

test('a change keeps its plan, the model\'s reasoning and how long it thought',async()=>{
 const meta=builder.create({name:'Thinking'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1),live=[];let seen;
 const callModel=async(opts,parse)=>{
  seen=opts;
  opts.onReasoning('The user','The user');opts.onReasoning(' wants a title.','The user wants a title.');
  await new Promise(r=>setTimeout(r,30));
  const reply=JSON.stringify({plan:['Add a title to the page','  ',''],message:'Added a title.',files:{'src/App.jsx':files['src/App.jsx'].replace(/<\/main>|<\/div>\s*\);\s*}\s*$/,m=>'<h1>Hello</h1>'+m)}});
  opts.onToken(reply,reply);
  return parse(reply);
 };
 const r=await builder.edit(meta.id,'Add a title',{callModel,onStream:()=>{},onThinking:t=>live.push(t)});
 assert.equal(typeof seen.onReasoning,'function');
 assert.deepEqual(live,['The user','The user wants a title.']);
 assert.deepEqual(r.plan,['Add a title to the page'],'empty plan items are dropped');
 const m=builder.loadMeta(meta.id).messages.at(-1);
 assert.deepEqual(m.plan,['Add a title to the page']);
 assert.equal(m.thinking,'The user wants a title.');
 assert.ok(m.thought_ms>=25,'time until the first word of the answer: '+m.thought_ms);
 assert.equal(m.attempts,undefined,'first-try changes do not say "fixed"');
 assert.match(builder.SYSTEM_PROMPT,/"plan":\[/);
});

test('Build mode records a timeline: thought, plan, edits, build and fixes',async()=>{
 const meta=builder.create({name:'Timeline'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1),live=[];
 const good=files['src/App.jsx'].replace(/<\/main>|<\/div>\s*\);\s*}\s*$/,m=>'<h1>Hi</h1>'+m);
 const queue=[{plan:['Add a greeting'],message:'x',files:{'src/App.jsx':'export default function App( {'}},{plan:['ignored'],message:'Added a greeting.',files:{'src/App.jsx':good,'src/Hello.jsx':'export default function Hello(){return null}\n'}}];
 const callModel=async(opts,parse)=>{opts.onReasoning&&opts.onReasoning('Hmm','Hmm');return parse(JSON.stringify(queue.shift()))};
 const r=await builder.edit(meta.id,'Add a greeting',{callModel,onEvent:ev=>live.push(ev.length)});
 const types=r.timeline.map(e=>e.t);
 assert.deepEqual(types.slice(0,2),['think','plan']);
 assert.ok(types.includes('fix'),'the failed build is shown as a fix: '+types.join(','));
 assert.equal(r.timeline.find(e=>e.t==='build'&&!e.ok).detail.length>0,true);
 const edits=r.timeline.filter(e=>e.t==='edit');
 assert.deepEqual(edits.slice(-2).map(e=>e.file+':'+e.kind),['src/App.jsx:edited','src/Hello.jsx:created']);
 assert.ok(r.timeline.some(e=>e.t==='build'&&e.ok));
 assert.ok(live.length>=5&&live.at(-1)===r.timeline.length,'events stream live');
 const m=builder.loadMeta(meta.id).messages.at(-1);
 assert.equal(m.timeline.length,r.timeline.length);assert.ok(m.duration_ms>=0);
 // The editor gets the full reasoning only on recent messages.
 assert.equal(builder.detail(meta.id).messages.at(-1).timeline[0].text,'Hmm');
});

test('Agent mode records reads, edits, builds and its thoughts',async()=>{
 const agent=require('../react-agent');
 const meta=builder.create({name:'Agent timeline'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1);
 const steps=[{thought:'Look at the page first.',actions:[{tool:'read_files',paths:['src/App.jsx']}]},
  {thought:'Add a heading.',actions:[{tool:'write_files',files:{'src/App.jsx':files['src/App.jsx'].replace(/<\/main>|<\/div>\s*\);\s*}\s*$/,m=>'<h1>Hi</h1>'+m)}},{tool:'finish',message:'Added a heading.'}]}];
 const callModel=async(opts,parse)=>parse(JSON.stringify(steps.shift()));
 const r=await agent.run(meta.id,'Add a heading',{callModel});
 const tl=r.timeline;
 assert.deepEqual(tl.filter(e=>e.t==='think').map(e=>e.note),['Look at the page first.','Add a heading.']);
 assert.deepEqual(tl.find(e=>e.t==='read').files,['src/App.jsx']);
 assert.equal(tl.find(e=>e.t==='edit').file,'src/App.jsx');
 assert.ok(tl.some(e=>e.t==='build'&&e.ok));
 assert.equal(builder.loadMeta(meta.id).messages.at(-1).timeline.length,tl.length);
});

test('out of rounds with a working build: Kairoq runs the review itself and the verdict says so',async()=>{
 const agent=require('../react-agent');
 const meta=builder.create({name:'Out of rounds'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1);
 const app=files['src/App.jsx'].replace(/<\/main>|<\/div>\s*\);\s*}\s*$/,m=>'<h1>Members</h1>'+m);
 // Two files change (the review is required); the model keeps reading and never calls finish.
 const steps=[{thought:'Write the page.',actions:[{tool:'write_files',files:{'src/App.jsx':app,'src/Members.jsx':'export default function Members(){return <p>Two members</p>}\n'}},{tool:'build_and_test'}]},{thought:'One more look.',actions:[{tool:'read_files',paths:['src/App.jsx']}]}];
 const reviews=[];
 const callModel=async(opts,parse)=>{
  const sys=String(opts.messages[0].content||'');
  if(/independent senior code reviewer|independent product\/spec reviewer/.test(sys)){reviews.push(sys.slice(0,40));return parse(JSON.stringify({verdict:'pass',findings:[]}))}
  return parse(JSON.stringify(steps.shift()||{thought:'Still looking.',actions:[{tool:'read_files',paths:['src/App.jsx']}]}));
 };
 const r=await agent.run(meta.id,'Add a members page with a list',{callModel,maxSteps:2});
 assert.match(r.message,/ran out of rounds/);
 assert.equal(reviews.length,2,'both reviewers ran after the rounds were used up');
 assert.ok(r.timeline.some(e=>e.t==='test'&&e.text==='Standards + Spec review passed'),JSON.stringify(r.timeline.map(e=>e.text||e.t)));
 assert.equal(r.verification.evidence.engineering_review,'passed');
});

test('substantial work without a task graph: Kairoq writes the task list from the plan and the write goes through',async()=>{
 const agent=require('../react-agent'),tg=require('../task-graph');
 const meta=builder.create({name:'Auto task list'});await builder.initialize(meta);
 const request='Build a platform: an app with auth, a database and an api for a running club\n\nApproved plan (build exactly this first version):\nShow runs. Members join with a code.\nScreens: Join (enter the club code); This week (the runs)';
 const results=[];
 const steps=[{thought:'Write the function.',actions:[{tool:'write_files',files:{'functions/hello.js':'export default async function hello(){return {ok:true}}\n'}}]},
  {thought:'Done.',actions:[{tool:'finish',message:'Added the function.'}]}];
 const callModel=async(opts,parse)=>{
  const sys=String(opts.messages[0].content||'');
  if(/independent senior code reviewer|independent product\/spec reviewer/.test(sys))return parse(JSON.stringify({verdict:'pass',findings:[]}));
  const last=opts.messages.at(-1);if(typeof last.content==='string'&&/^Results of step/.test(last.content))results.push(last.content);
  return parse(JSON.stringify(steps.shift()||{thought:'Looking.',actions:[{tool:'read_files',paths:['src/App.jsx']}]}));
 };
 const r=await agent.run(meta.id,request,{callModel,maxSteps:4});
 assert.ok(!results.some(x=>/needs a tracer-bullet task graph first/.test(x)),'the write is not refused');
 assert.ok(results.some(x=>/write_files: functions\/hello\.js/.test(x)),results.join('\n').slice(0,500));
 assert.ok(r.timeline.some(e=>e.t==='note'&&e.text==='Set up the task list from the plan'));
 const st=tg.status(meta.id,request);
 assert.deepEqual(st.tasks.map(t=>t.id+':'+t.status),['S1:done','S2:done'],'the auto list is ticked off at finish');
 // (No browser in this test, so the completion gate holds finish back; the task list is not the reason.)
 assert.ok(!results.some(x=>/task graph is incomplete/.test(x)),results.join('\n').slice(0,800));
});

test('a review that keeps blocking a working build stops after two rounds and saves a draft',async()=>{
 const agent=require('../react-agent');
 const meta=builder.create({name:'Review cap'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1);
 let reviews=0,step=0;
 const callModel=async(opts,parse)=>{
  const sys=String(opts.messages[0].content||'');
  if(/independent senior code reviewer/.test(sys)){reviews++;return parse(JSON.stringify({verdict:'block',findings:[{id:'S1',severity:'critical',confidence:0.95,file:'src/App.jsx',message:'The menu crashes when empty',evidence:'x'}]}))}
  if(/independent product\/spec reviewer/.test(sys))return parse(JSON.stringify({verdict:'pass',findings:[]}));
  step++;
  // Write, build and test, then finish; after a refusal, change a file and finish again.
  // Two plain modules (no UI files, so the screenshot check is not needed in this test).
  return parse(JSON.stringify(step%2?{thought:'Write and test.',actions:[{tool:'write_files',files:{'src/menuData.js':'export const items=['+step+']\n','src/prices.js':'export const prices={}\n'}},{tool:'build_and_test'}]}:{thought:'Done.',actions:[{tool:'finish',message:'Built the menu.'}]}));
 };
 const inspect=async()=>({errors:[],steps:[{step:'open',ok:true}],text:'Menu',external:[]});
 const r=await agent.run(meta.id,'Add the menu data and prices modules',{callModel,inspect,maxSteps:10});
 assert.equal(reviews,2,'two review rounds, then no more');
 assert.ok(!/^Stopped after/.test(r.message.split('\n').pop()),'it finished, it did not run out of rounds');
 assert.match(r.message,/UNVERIFIED DRAFT/);
 assert.match(r.message,/open finding\(s\) after 2 rounds: src\/App\.jsx: The menu crashes when empty/);
 assert.equal(r.verification.evidence.engineering_review,'failed','the verdict stays honest');
});

test('a look check that keeps failing stops after one repair round and ships the draft with it listed as open',async()=>{
 const agent=require('../react-agent');
 const meta=builder.create({name:'Look cap'});await builder.initialize(meta);
 let step=0,shots=0;
 const callModel=async(opts,parse)=>{
  const sys=String(opts.messages[0].content||'');
  if(/independent senior code reviewer|independent product\/spec reviewer/.test(sys))return parse(JSON.stringify({verdict:'pass',findings:[]}));
  step++;
  return parse(JSON.stringify(step%2?{thought:'Write and test.',actions:[{tool:'write_files',files:{'src/App.jsx':'export default function App(){return <h1>Menu '+step+'</h1>}\n'}},{tool:'build_and_test'}]}:{thought:'Done.',actions:[{tool:'finish',message:'Built the menu page.'}]}));
 };
 const inspect=async()=>({errors:[],steps:[{step:'open',ok:true}],text:'Menu',external:[]});
 const designShots=async()=>{shots++;return[]};
 const r=await agent.run(meta.id,'Add a menu page',{callModel,inspect,designShots,maxSteps:10});
 assert.equal(shots,2,'one repair round for the look, then the draft ships');
 assert.ok(!/^Stopped after/.test(r.message.split('\n').pop()),'it finished, it did not run out of rounds');
 assert.match(r.message,/UNVERIFIED DRAFT/);
 assert.match(r.message,/The look check still found: No visual screenshots were produced\./);
 assert.equal(r.verification.evidence.visual_quality,'failed');
});

test('style-level Standards findings do not block; critical ones and confident Spec gaps do',()=>{
 const {blocking}=require('../engineering-review');
 assert.equal(blocking({standards:{findings:[{severity:'important',confidence:0.95,message:'duplicated logic'}]},spec:{findings:[]}}).length,0);
 assert.equal(blocking({standards:{findings:[{severity:'critical',confidence:0.6,message:'crash'}]},spec:{findings:[]}}).length,1);
 assert.equal(blocking({standards:{findings:[]},spec:{findings:[{severity:'important',confidence:0.9,message:'no cake form'}]}}).length,1);
 assert.equal(blocking({standards:{findings:[]},spec:{findings:[{severity:'important',confidence:0.5,message:'maybe'}]}}).length,0);
});

test('the Changes API returns each changed file before and after',async()=>{
 const http=require('http'),createApi=require('../create-api');
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>false,callModel:async()=>{throw Error('no model')},secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=(method,url,{body,headers={}}={})=>new Promise((resolve,reject)=>{const payload=body?Buffer.from(JSON.stringify(body)):null;const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{let json;try{json=JSON.parse(Buffer.concat(c))}catch{}resolve({status:res.statusCode,headers:res.headers,json})})});req.on('error',reject);if(payload)req.write(payload);req.end()});
 try{
  const signup=await call('POST','/api/create/signup',{body:{email:'changes@example.com',password:'password1'},headers:{'x-forwarded-for':'10.77.0.1'}});
  const cookie=signup.headers['set-cookie'][0].split(';')[0];
  const id=(await call('POST','/api/create/projects',{headers:{cookie},body:{name:'Changes'}})).json.project.id;
  const files=builder.loadFiles(id,1);
  await builder.saveSource(id,{...files,'src/App.jsx':files['src/App.jsx']+'\n// v2\n','src/New.jsx':'export default function New(){return null}\n'},{summary:'Two changes',changed:['src/App.jsx','src/New.jsx']});
  const r=await call('GET','/api/create/projects/'+id+'/changes?version=2',{headers:{cookie}});
  assert.equal(r.status,200);assert.equal(r.json.previous,1);
  const byPath=Object.fromEntries(r.json.files.map(f=>[f.path,f]));
  assert.equal(byPath['src/New.jsx'].status,'created');assert.equal(byPath['src/New.jsx'].before,null);
  assert.equal(byPath['src/App.jsx'].status,'edited');assert.match(byPath['src/App.jsx'].after,/\/\/ v2/);assert.doesNotMatch(byPath['src/App.jsx'].before,/\/\/ v2/);
  assert.equal((await call('GET','/api/create/projects/'+id+'/changes?version=9',{headers:{cookie}})).status,404);
  assert.equal((await call('GET','/api/create/projects/'+id+'/changes?version=2')).status,401,'sign-in needed');
 }finally{server.close()}
});

test('the agent sees the matching specialist skills and can open one',async()=>{
 const agent=require('../react-agent');
 const G=require('../gsap-skill-packs');G.clear();
 const meta=builder.create({name:'Motion skill'});await builder.initialize(meta);
 let step=0,system='',opened='';
 const realFetch=global.fetch;
 global.fetch=async(url,o)=>{if(String(url).includes('raw.githubusercontent.com/greensock'))return new Response('---\nname: gsap-core\n---\nUse gsap.to with an ease.',{status:200});return realFetch(url,o)};
 const callModel=async(opts,parse)=>{
  const sys=String(opts.messages[0].content||'');
  if(/independent senior code reviewer|independent product\/spec reviewer/.test(sys))return parse(JSON.stringify({verdict:'pass',findings:[]}));
  if(!system)system=sys;
  step++;
  const last=String(opts.messages.at(-1).content||'');
  if(step===2)opened=last;
  return parse(JSON.stringify(step===1?{thought:'Read the motion skill first.',actions:[{tool:'open_skill',name:'gsap:core'}]}:step===2?{thought:'Write and test.',actions:[{tool:'write_files',files:{'src/motion.js':'export const ease="power2.out"\n'}},{tool:'build_and_test'}]}:{thought:'Done.',actions:[{tool:'finish',message:'Added the motion helper.'}]}));
 };
 const inspect=async()=>({errors:[],steps:[{step:'open',ok:true}],text:'ok',external:[]});
 try{
  const r=await agent.run(meta.id,'Add a motion helper module for the animated hero',{callModel,inspect,maxSteps:6});
  assert.match(system,/SPECIALIST SKILLS for this request[\s\S]*gsap:core/);
  assert.match(system,/"tool":"open_skill"/);
  assert.match(opened,/OFFICIAL GSAP SKILL[\s\S]*Use gsap\.to with an ease\./);
  const tl=builder.loadMeta(meta.id).messages.at(-1).timeline||[];
  assert.ok(tl.some(e=>e.t==='note'&&e.icon==='book'&&/gsap:core/.test(e.text)),'the step log shows the skill');
  assert.ok(r.message);
 }finally{global.fetch=realFetch;G.clear()}
});

test('matching skills are opened before the first step, so the first write goes straight through',async()=>{
 const agent=require('../react-agent');
 const G=require('../gsap-skill-packs');G.clear();
 const meta=builder.create({name:'Preload skill'});await builder.initialize(meta);
 let step=0,intro='';const seen=[];
 const realFetch=global.fetch;
 global.fetch=async(url,o)=>{if(String(url).includes('raw.githubusercontent.com/greensock'))return new Response('---\nname: gsap-core\n---\nUse gsap.to with an ease.',{status:200});return realFetch(url,o)};
 const write={tool:'write_files',files:{'src/motion.js':'export const ease="power2.out"\n'}};
 const callModel=async(opts,parse)=>{
  const sys=String(opts.messages[0].content||'');
  if(/independent senior code reviewer|independent product\/spec reviewer/.test(sys))return parse(JSON.stringify({verdict:'pass',findings:[]}));
  step++;if(step===1)intro=JSON.stringify(opts.messages);seen.push(String(opts.messages.at(-1).content||''));
  return parse(JSON.stringify(step===1?{thought:'Write and test.',actions:[write,{tool:'build_and_test'}]}:{thought:'Done.',actions:[{tool:'finish',message:'Added the motion helper.'}]}));
 };
 const inspect=async()=>({errors:[],steps:[{step:'open',ok:true}],text:'ok',external:[]});
 try{
  await agent.run(meta.id,'Add a motion helper module for the animated hero',{callModel,inspect,maxSteps:6});
  assert.match(intro,/SPECIALIST SKILLS ALREADY OPENED[\s\S]*Use gsap\.to with an ease\./,'skill text is in the first request');
  assert.match(seen[1]||'',/write_files: src\/motion\.js/,'the first write goes through');
  assert.doesNotMatch(seen.join('\n'),/nothing written yet/);
  const tl=builder.loadMeta(meta.id).messages.at(-1).timeline||[];
  assert.ok(tl.some(e=>e.t==='note'&&e.icon==='book'&&/gsap:core/.test(e.text)),'the step log shows the skill');
 }finally{global.fetch=realFetch;G.clear()}
});

test('building the untouched starter page is refused, not tested and passed',async()=>{
 const agent=require('../react-agent');
 const design=require('../react-design');
 const meta=builder.create({name:'Starter only'});await builder.initializeFrom(meta,design.starterFiles('Starter only'),'Start');
 let step=0;const seen=[];
 const callModel=async(opts,parse)=>{
  const sys=String(opts.messages[0].content||'');
  if(/independent senior code reviewer|independent product\/spec reviewer/.test(sys))return parse(JSON.stringify({verdict:'pass',findings:[]}));
  step++;seen.push(String(opts.messages.at(-1).content||''));
  return parse(JSON.stringify(step===1?{thought:'Build.',actions:[{tool:'build_and_test'}]}:{thought:'Done.',actions:[{tool:'finish',message:'Done.'}]}));
 };
 await agent.run(meta.id,'A page for a bakery',{callModel,inspect:async()=>({errors:[],steps:[{step:'open',ok:true}],text:'ok',external:[]}),maxSteps:3});
 assert.match(seen[1]||'',/nothing to build yet[\s\S]*starter page/);
});

test('a plain request lists no specialist skills',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','react-agent.js'),'utf8');
 assert.match(src,/function skillsNote\(request\)/);
 const T=require('../teardown-skill-pack'),G=require('../gsap-skill-packs');
 assert.equal([...T.list('Add a contact page'),...G.list('Add a contact page')].length,0);
});
