"use strict";
// Memory: lasting preferences, recipes from hard-won features that improve with use, and recall
// of an earlier project — all private to the account that owns the project.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-memory-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_MEMORY_DIR=path.join(tmp,'memory');
process.env.KAIROQ_LEARNING_DIR=path.join(tmp,'learning');
process.env.KAIROQ_RUNTIME_CHECK='off';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_WEB_RESEARCH='off';
const mem=require('../account-memory'),builder=require('../react-builder'),createApi=require('../create-api');

const ERR="Uncaught error: Cannot read properties of undefined (reading 'rooms')";
const hardResult={attempts:2,message:'Added room booking with an availability calendar.',changed:['src/App.jsx','src/pages/Book.jsx','src/backend.json'],runtime_errors:[],timeline:[{t:'test',ok:false,detail:[ERR]},{t:'test',ok:true}]};
let calls=[];
const model=async(opts,parse)=>{
 const sys=opts.messages[0].content,user=opts.messages.at(-1).content;calls.push(sys.slice(0,40));
 if(/LASTING preference/.test(sys))return parse(JSON.stringify({preferences:/euro/i.test(user)?['Prefers prices in euros']:/purple/i.test(user)?['Never use purple']:[]}));
 if(/write reusable recipes/.test(sys))return parse(JSON.stringify(/footer/i.test(user)?{skip:true}:{title:'Room booking with availability',when:'Requests to book rooms, tables or appointments on dates with limited availability.',steps:['Add a bookings collection with date, room and guest fields in src/backend.json','Load availability before rendering and default lists to []','Block dates that are already booked on the server, not only in the page'],pitfalls:['Reading fields of data that has not loaded yet']}));
 if(/maintain a reusable recipe/.test(sys))return parse(JSON.stringify({steps:['Add a bookings collection with date, room and guest fields','Load availability first and default lists to []','Check overlaps on the server'],pitfalls:['Reading fields of data that has not loaded yet','Time zones shifting dates by a day']}));
 throw Error('unexpected prompt');
};
const reset=()=>fs.rmSync(process.env.KAIROQ_MEMORY_DIR,{recursive:true,force:true});

test('lasting preferences are learned only from messages that sound like one, and apply to every project',async()=>{
 reset();calls=[];
 assert.deepEqual(await mem.learnPreferences('acct-a','Add a contact form',{callModel:model}),[]);
 assert.equal(calls.length,0,'no model call without a hint');
 assert.deepEqual(await mem.learnPreferences('acct-a','Always show prices in euros please',{callModel:model}),['Prefers prices in euros']);
 assert.deepEqual(await mem.learnPreferences('acct-a','I never want purple, too colourful',{callModel:model}),['Never use purple']);
 // Said again: one entry, not two.
 await mem.learnPreferences('acct-a','From now on prices in euros',{callModel:model});
 assert.equal(mem.view('acct-a').preferences.length,2);
 const meta=builder.create({name:'Shop',owner:'acct-a'});
 assert.match(builder.knowledgeNote(meta),/What the owner of this app prefers[\s\S]*prices in euros[\s\S]*Never use purple/);
 // Another account sees none of it.
 assert.equal(mem.view('acct-b').preferences.length,0);
 assert.doesNotMatch(builder.knowledgeNote(builder.create({name:'Other',owner:'acct-b'})),/What the owner of this app prefers/);
 // Turned off: nothing is used or learned.
 mem.edit('acct-a',{action:'enabled',enabled:false});
 assert.doesNotMatch(builder.knowledgeNote(meta),/What the owner of this app prefers/);
 assert.deepEqual(await mem.learnPreferences('acct-a','Always use British spelling',{callModel:model}),[]);
});

test('a hard-won feature becomes a recipe; a similar request gets it; it improves, and switches off when it keeps failing',async()=>{
 reset();
 assert.equal(await mem.writeRecipe('acct-a',{message:'Change the footer',result:{...hardResult,attempts:1},mode:'build'},{callModel:model}),null,'easy work is not a recipe');
 const r=await mem.writeRecipe('acct-a',{message:'Let guests book rooms on dates that are free',result:hardResult,mode:'build',projectId:'p1'},{callModel:model});
 assert.equal(r.title,'Room booking with availability');assert.equal(r.status,'active');
 assert.equal(await mem.writeRecipe('acct-a',{message:'Fix the footer layout',result:hardResult,mode:'build'},{callModel:model}),null,'too specific: skipped');
 assert.deepEqual(mem.matchRecipes('acct-a','Add table booking with availability for the restaurant').map(x=>x.id),[r.id]);
 assert.deepEqual(mem.matchRecipes('acct-a','Make the header sticky'),[]);
 assert.deepEqual(mem.matchRecipes('acct-b','Add table booking with availability'),[],'private to the account');
 assert.match(mem.recipeNote([r]),/Recipes from earlier work[\s\S]*Room booking with availability[\s\S]*Watch for/);
 // Used and right first time: counted. Used and needed retries: improved with what went wrong.
 await mem.useRecipes('acct-a',[r.id],{attempts:1,runtime_errors:[],timeline:[]},{callModel:model});
 await mem.useRecipes('acct-a',[r.id],hardResult,{callModel:model});
 let v=mem.view('acct-a').recipes[0];
 assert.equal(v.uses,2);assert.equal(v.successes,1);assert.equal(v.improved,1);assert.ok(v.pitfalls.includes('Time zones shifting dates by a day'));
 for(let i=0;i<3;i++)await mem.useRecipes('acct-a',[r.id],hardResult,{callModel:model});
 v=mem.view('acct-a').recipes[0];
 assert.equal(v.status,'off');assert.match(v.reason,/1 of 5/);
 assert.deepEqual(mem.matchRecipes('acct-a','Add table booking with availability'),[]);
 // Turned back on, the count starts again.
 mem.edit('acct-a',{action:'recipe_status',id:r.id,status:'active'});
 assert.equal(mem.view('acct-a').recipes[0].uses,0);
 // Only the Kairoq owner can share; shared owner recipes reach other accounts.
 assert.throws(()=>mem.edit('acct-a',{action:'share',id:r.id,shared:true}),/Only the Kairoq owner/);
 const o=await mem.writeRecipe('owner',{message:'Rooms booking',result:hardResult,mode:'build'},{callModel:model});
 assert.deepEqual(mem.matchRecipes('acct-b','Add table booking with availability'),[]);
 mem.edit('owner',{action:'share',id:o.id,shared:true},{isOwner:true});
 assert.deepEqual(mem.matchRecipes('acct-b','Add table booking with availability').map(x=>x.id),[o.id]);
 assert.equal(mem.view('acct-b').shared[0].title,'Room booking with availability');
});

test('recall finds an earlier project of the same owner that the message refers to',async()=>{
 reset();
 const OK="export default function App() { return <h1>Casa Azul Lisbon</h1>; }\n";
 const hotel=builder.create({name:'Casa Azul Lisbon hotel',owner:'acct-r'});await builder.initialize(hotel);
 await builder.saveSource(hotel.id,{...builder.loadFiles(hotel.id,1),'src/App.jsx':OK},{summary:'Hotel'});
 const theirs=builder.create({name:'Lisbon hotel',owner:'acct-other'});await builder.initialize(theirs);
 const cur=builder.create({name:'New hotel',owner:'acct-r'});
 const r=mem.recall('acct-r',cur.id,'Make the rooms page like my Casa Azul Lisbon site');
 assert.equal(r.id,hotel.id);assert.match(r.note,/earlier project "Casa Azul Lisbon hotel"[\s\S]*src\/App\.jsx[\s\S]*Casa Azul Lisbon/);
 assert.equal(mem.recall('acct-r',cur.id,'Add a rooms page'),null,'no reference, no recall');
 assert.equal(mem.recall('acct-x',cur.id,'like my Lisbon hotel site'),null,'never another account\'s project');
});

test('through the API: preferences are learned and shown, recipes and recall reach the builder, and memory is editable',async()=>{
 reset();
 const prompts=[];
 const callModel=async(opts,parse)=>{
  const sys=opts.messages[0].content;
  if(/coding engine/.test(sys)){prompts.push({sys,user:JSON.stringify(opts.messages.at(-1).content)});return parse(JSON.stringify({plan:[],message:'Done.',files:{'src/App.jsx':"export default function App() { return <h1>Hi</h1>; }\n"}}))}
  return model(opts,parse);
 };
 const server=http.createServer(async(req,res)=>{if(builder.handlePreview(req,res))return;if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const req=(method,url,body,cookie)=>new Promise((resolve,reject)=>{const payload=body?Buffer.from(JSON.stringify(body)):null;const r=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...(cookie?{cookie}:{}),'x-forwarded-for':'10.4.4.'+Math.floor(Math.random()*200)}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const t=Buffer.concat(c).toString();let j=null;try{j=JSON.parse(t)}catch{}resolve({status:res.statusCode,json:j,headers:res.headers})})});r.on('error',reject);if(payload)r.write(payload);r.end()});
 try{
  const s=await req('POST','/api/create/signup',{email:'mem@example.com',password:'password1'});
  const cookie=s.headers['set-cookie'][0].split(';')[0],acct=s.json.account.id;
  const wait=async job=>{for(let i=0;i<400;i++){const j=(await req('GET','/api/create/jobs/'+job.id,null,cookie)).json.job;if(['complete','failed'].includes(j.status))return j;await new Promise(r=>setTimeout(r,25))}};
  const p1=(await req('POST','/api/create/projects',{name:'Lotus Yoga Lisbon'},cookie)).json.project.id;
  const j1=await wait((await req('POST','/api/create/projects/'+p1+'/chat',{message:'Add a price list, and always show prices in euros'},cookie)).json.job);
  assert.equal(j1.status,'complete');assert.deepEqual(j1.result.memory,{learned:['Prefers prices in euros']});
  const msgs=(await req('GET','/api/create/projects/'+p1,null,cookie)).json.project.messages;
  assert.deepEqual(msgs.at(-1).memory,{learned:['Prefers prices in euros']});
  // A recipe this account earned, and a second project that refers to the first.
  await mem.writeRecipe(acct,{message:'class booking',result:{...hardResult,message:'Added class booking'},mode:'build'},{callModel:model});
  const p2=(await req('POST','/api/create/projects',{name:'Studio two'},cookie)).json.project.id;
  const j2=await wait((await req('POST','/api/create/projects/'+p2+'/chat',{message:'Add room booking with availability, like my Lotus Yoga Lisbon site'},cookie)).json.job);
  assert.equal(j2.status,'complete');
  assert.deepEqual(j2.result.memory.recipes,['Room booking with availability']);assert.equal(j2.result.memory.recalled,'Lotus Yoga Lisbon');
  const last=prompts.at(-1);
  assert.match(last.sys,/prefers in all their apps[\s\S]*prices in euros/);
  assert.match(last.user,/Recipes from earlier work/);assert.match(last.user,/earlier project \\"Lotus Yoga Lisbon\\"/);
  await mem.settled();
  assert.equal(mem.view(acct).recipes[0].uses,1);
  // The Memory page: see, add, forget, switch off; sharing is for the Kairoq owner only.
  let m=(await req('GET','/api/create/memory',null,cookie)).json.memory;
  assert.equal(m.preferences[0].text,'Prefers prices in euros');assert.equal(m.recipes.length,1);
  m=(await req('POST','/api/create/memory',{action:'add_preference',text:'British spelling'},cookie)).json.memory;
  assert.equal(m.preferences[0].source,'you');
  m=(await req('POST','/api/create/memory',{action:'delete_preference',id:m.preferences[1].id},cookie)).json.memory;
  assert.deepEqual(m.preferences.map(p=>p.text),['British spelling']);
  m=(await req('POST','/api/create/memory',{action:'recipe_status',id:m.recipes[0].id,status:'off'},cookie)).json.memory;
  assert.equal(m.recipes[0].status,'off');
  assert.equal((await req('POST','/api/create/memory',{action:'share',id:m.recipes[0].id,shared:true},cookie)).status,403);
  assert.equal((await req('GET','/api/create/memory')).status,401);
 }finally{server.close()}
});
