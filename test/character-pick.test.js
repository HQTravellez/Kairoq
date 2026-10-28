"use strict";
// Ready-made characters, like superapp: the plan finds real 3D models on Poly Pizza (CC0 or
// CC-BY only), the owner picks one before anything is built, it comes in with its own
// animations, and Model3D plays them (one loops, another on tap).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-chars-'));
Object.assign(process.env,{KAIROQ_DESIGN_BRIEF:'off',KAIROQ_WEB_RESEARCH:'off',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const builder=require('../react-builder'),M=require('../react-models'),plan=require('../build-plan');

// A tiny GLB with two animations, as Quaternius models have (Idle, Jump).
function animatedGlb(){
 const json={asset:{version:'2.0'},scenes:[{nodes:[0]}],scene:0,nodes:[{name:'Root'}],animations:[{name:'Idle',channels:[],samplers:[]},{name:'Jump',channels:[],samplers:[]}]};
 return M.packGlb(json,()=>null);
}
const JPG=Buffer.from([0xff,0xd8,0xff,0xe0,0,16,74,70,73,70,0,1]);
const ROWS=[
 {ID:'trex1',Title:'T-Rex',Creator:{Username:'Quaternius'},Licence:'CC0 1.0',Animated:true,TriangleCount:2400,Thumbnail:'https://static.poly.pizza/trex1.jpg',Download:'https://static.poly.pizza/trex1.glb'},
 {ID:'trex2',Title:'Dino',Creator:{Username:'Someone'},Licence:'CC-BY 3.0',Animated:true,TriangleCount:9000,Thumbnail:'https://static.poly.pizza/trex2.jpg',Download:'https://static.poly.pizza/trex2.glb'},
 {ID:'nope',Title:'Not free',Creator:{Username:'X'},Licence:'All rights reserved',Animated:true,Download:'https://static.poly.pizza/nope.glb'},
 {ID:'still',Title:'Dino statue',Creator:{Username:'Kenney'},Licence:'CC0',Animated:false,TriangleCount:800,Thumbnail:'https://static.poly.pizza/still.jpg',Download:'https://static.poly.pizza/still.glb'},
];
const calls=[];
const fakeFetch=async(url,opts={})=>{
 calls.push({url:String(url),token:opts.headers&&opts.headers['X-Auth-Token']});
 const u=new URL(url),json=b=>({ok:true,status:200,json:async()=>b});
 if(u.hostname==='api.poly.pizza'){
  if(u.pathname.startsWith('/v1/search/'))return json({results:u.searchParams.get('animated')==='true'?ROWS.filter(r=>r.Animated):ROWS});
  if(u.pathname.startsWith('/v1/model/'))return json(ROWS.find(r=>r.ID===decodeURIComponent(u.pathname.split('/').pop())));
 }
 if(u.hostname==='static.poly.pizza'){const b=u.pathname.endsWith('.glb')?animatedGlb():JPG;return{ok:true,status:200,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}}
 return{ok:false,status:404};
};

test('only CC0 and CC-BY models are offered, each with an honest note',()=>{
 assert.equal(M.ppLicence('CC0 1.0'),'CC0');assert.equal(M.ppLicence('CC-BY 4.0'),'CC-BY');
 assert.equal(M.ppLicence('CC-BY-NC 4.0'),null);assert.equal(M.ppLicence('All rights reserved'),null);
 assert.equal(M.ppView(ROWS[2]),null);
 const v=M.ppView(ROWS[1]);
 assert.equal(v.licence,'CC-BY');assert.match(v.note,/Animated/);assert.match(v.note,/app must credit Someone/);
 assert.match(M.ppView(ROWS[3]).note,/Stands still/);
 assert.match(M.ppView(ROWS[0]).note,/Animated · faceted low-poly/);
});

test('search: needs the key; animated first, still models only to fill up',async()=>{
 delete process.env.POLY_PIZZA_KEY;
 await assert.rejects(M.searchPolyPizza('trex',{fetchImpl:fakeFetch}),/POLY_PIZZA_KEY/);
 process.env.POLY_PIZZA_KEY='test-key';
 const rows=await M.searchPolyPizza('t-rex!',{animated:true,fetchImpl:fakeFetch,limit:3});
 assert.deepEqual(rows.map(r=>r.id),['trex1','trex2','still']);
 assert.equal(calls[0].token,'test-key');
 assert.match(calls[0].url,/\/search\/t%20rex\?limit=24&animated=true$/);
});

test('adding the picked model keeps its animations and credit, and the builder is told',async()=>{
 process.env.POLY_PIZZA_KEY='test-key';
 const meta=builder.create({name:'Dino Doodle',owner:'owner'});
 const id=meta.id;
 const added=await M.addPolyPizza(id,'trex2',{fetchImpl:fakeFetch});
 assert.deepEqual(added.animations,['Idle','Jump']);
 assert.equal(added.source.license,'CC-BY');assert.match(added.poster,/\.jpg$/);
 assert.equal((await M.addPolyPizza(id,'trex2',{fetchImpl:fakeFetch})).file,added.file,'picking twice adds it once');
 await assert.rejects(M.addPolyPizza(id,'nope',{fetchImpl:fakeFetch}),/licence/);
 const note=M.note(id,builder.loadMeta(id));
 assert.match(note,/Poly Pizza, CC-BY: show the credit "Dino" by Someone/);
 assert.match(note,/animations: "Idle", "Jump"/);
 assert.match(note,/tapAnimation="Jump"/);
});

test('the plan offers characters to pick; without a key it says so plainly',async()=>{
 const PLAN={title:'Bring a colored T-Rex to life',summary:'A printable T-Rex page that comes to life as a 3D dinosaur wearing the child\'s colors.',screens:[],features:['Tap to jump'],left_out:[],character:{search:'trex',animated:true}};
 const callModel=async(o,parse)=>parse(JSON.stringify(PLAN));
 process.env.POLY_PIZZA_KEY='test-key';
 const p=await plan.make('Build an iPhone AR coloring book app for kids',{callModel,fetchImpl:fakeFetch});
 assert.deepEqual(p.characters.options.map(o=>o.id),['trex1','trex2','still']);
 assert.match(p.characters.phone_note,/phone-first web app/);
 delete process.env.POLY_PIZZA_KEY;
 const q=await plan.make('A dinosaur coloring website',{callModel,fetchImpl:fakeFetch});
 assert.equal(q.characters.options.length,0);assert.match(q.characters.unavailable,/POLY_PIZZA_KEY/);assert.equal(q.characters.phone_note,undefined);
 const none=await plan.make('A booking site',{callModel:async(o,parse)=>parse(JSON.stringify({...PLAN,character:null}))});
 assert.equal(none.characters,undefined);
 assert.match(plan.withPlan('x',{...PLAN,picked:'T-Rex'}),/picked the ready-made 3D model "T-Rex".*never draw the character from shapes or SVG/);
 assert.match(plan.SYSTEM,/never plan to draw the character from shapes/);
});

test('Model3D plays the model\'s animations: one loops, another on tap',()=>{
 const src=require('../react-model3d').source();
 assert.match(src,/animation,tapAnimation,onAnimations/);
 assert.match(src,/el\.play\(\{repetitions:1\}\)/);
 assert.match(src,/addEventListener\('finished',done\)/);
 assert.match(src,/if\(!n\|\|still\)return/,'no looping for people who prefer reduced motion');
});

test('better questions, iPhone apps noticed, recipes only when they fit, honest message',()=>{
 const clarify=require('../clarify');
 assert.equal(clarify.worthAsking('x'.repeat(1000)),true);
 const n=require('../react-native-app');
 assert.equal(n.wanted('Build an iPhone AR coloring book app for kids'),true);
 assert.equal(n.wanted('A booking app for iPhone'),true);
 assert.equal(n.wanted('A website for my cafe'),false);
 const fs2=require('fs').readFileSync(require('path').join(__dirname,'..','clarify.js'),'utf8');
 assert.match(fs2,/heart of the app/);
 assert.match(require('../builder-method').VERIFY,/Not done yet:/);
});

test('in the editor: the plan shows real characters, Approve waits for a pick, the pick is added and built with',{timeout:180000},async(t)=>{
 const runtime=require('../runtime-check');
 if(!runtime.available()){t.diagnostic('no browser here');return}
 const http=require('http');
 Object.assign(process.env,{NODE_ENV:'test',POLY_PIZZA_KEY:'test-key',KAIROQ_CRAFT_CHECK:'off',KAIROQ_LOOK_CHECK:'off'});
 const realFetch=global.fetch;
 global.fetch=async(url,opts)=>/poly\.pizza/.test(String(url))?fakeFetch(url,opts):realFetch(url,opts);
 const PLAN={title:'Bring a colored T-Rex to life',summary:'A printable T-Rex page that comes to life as a 3D dinosaur wearing the child\'s colors.',screens:[{name:'Play',what:'Tap the page and the T-Rex jumps out'}],features:['Tap to jump'],left_out:['More dinosaurs'],character:{search:'trex',animated:true}};
 const createApi=require('../create-api'),built=[];
 const callModel=async(o,parse)=>{
  if(o.purpose==='clarify')return parse('{"questions":[]}');
  if(o.purpose==='plan')return parse(JSON.stringify(PLAN));
  if(/art director/.test(String(o.messages[0].content||'')))return parse(JSON.stringify({name:'Site',summary:'s',palette:{background:'#ffffff',foreground:'#13213c',primary:'#f2b632',secondary:'#eef1f6',accent:'#13213c',muted:'#f5f6f9'},fonts:{display:'Archivo',body:'Inter'},radius:'0.5rem'}));
  built.push(String(o.messages.at(-1).content));
  return parse(JSON.stringify({message:'Built it.',files:{'src/App.jsx':'export default function App(){return <main><h1>Dino</h1></main>}\n'}}));
 };
 const pub=path.join(__dirname,'..','public');
 const server=http.createServer(async(req,res)=>{
  if(await createApi.handle(req,res,{isOwner:()=>true,callModel,secure:false}))return;
  let f=req.url.split('?')[0];if(f==='/create')f='/create.html';
  const p=path.join(pub,f);
  if(p.startsWith(pub)&&fs.existsSync(p)&&fs.statSync(p).isFile()){res.writeHead(200,{'content-type':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':'text/html'});return res.end(fs.readFileSync(p))}
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const ctx=await (await runtime.browser()).newContext({viewport:{width:1400,height:900}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // The model pictures, as the browser would load them from Poly Pizza.
 const shot=fs.readFileSync(path.join(__dirname,'fixtures','character-thumb.png'));
 await page.route(/static\.poly\.pizza/,r=>r.fulfill({status:200,contentType:'image/png',body:shot}));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/create',{waitUntil:'domcontentloaded'});
  await page.fill('#new-prompt','Build an iPhone AR coloring book app for kids with a real animated T-Rex');
  await page.click('#new-submit');
  await page.waitForSelector('.ask-card',{timeout:20000});
  const skip=page.locator('.ask-card button:has-text("Skip")').first();
  await skip.waitFor({timeout:20000});await skip.click();
  await page.waitForSelector('.char-opt',{timeout:20000});
  assert.equal(await page.locator('.char-opt').count(),3);
  assert.match(await page.locator('.char-opt').first().innerText(),/T-Rex\s+Quaternius · CC0\s+Animated · faceted low-poly/);
  assert.match(await page.locator('.char-pick').innerText(),/phone-first web app/);
  assert.equal(await page.locator('.plan-approve').innerText(),'Pick a character');
  assert.equal(await page.locator('.plan-approve').isDisabled(),true);
  await page.locator('.char-opt').first().click();
  assert.equal(await page.locator('.plan-approve').innerText(),'Approve');
  if(process.env.KAIROQ_SHOT){await page.waitForTimeout(800);await page.evaluate(()=>{const l=document.getElementById('messages');l.scrollTop=l.scrollHeight});await page.screenshot({path:process.env.KAIROQ_SHOT})}
  assert.equal(built.length,0);
  await page.click('.plan-approve');
  for(let i=0;i<100&&!built.length;i++)await new Promise(r=>setTimeout(r,200));
  assert.match(built[0],/picked the ready-made 3D model "T-Rex"/);
  assert.match(built[0],/animations: "Idle", "Jump"/,'the builder knows the model and its animations');
  for(let i=0;i<100&&built.length<2;i++)await new Promise(r=>setTimeout(r,200));
  assert.match(built[1]||'',/no file shows it. Show it with import \{ Model3D \}/,'an app that draws the character instead is sent back');
  assert.doesNotMatch(built[0],/FIRST_BUILD_NATIVE|react-native/i,'a 3D character app stays a web app');
  assert.deepEqual(errors,[]);
 }finally{global.fetch=realFetch;await ctx.close();server.close();runtime.close()}
});
