"use strict";
// Sites that do not all look the same (design-moods.js, signature moments in design-recipes.js),
// older projects getting new kit pieces, plain replies, and "the design sucks" answered with an
// apology and a completely new look.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-variety-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const moods=require('../design-moods'),recipes=require('../design-recipes'),design=require('../react-design');
const builder=require('../react-builder'),createApi=require('../create-api'),scope=require('../scope-guard');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

const CREAM={background:'#f7f5f0',foreground:'#1f1f1c',primary:'#2d342f',secondary:'#ece8df',accent:'#8c5a3c',muted:'#f1eee7'};
const brief=(extra={})=>JSON.stringify({name:'Quiet Atelier',summary:'Calm.',palette:CREAM,fonts:{display:'Cormorant Garamond',body:'Inter'},radius:'0.75rem',...extra});

test('colour moods suit the business, differ from the owner\'s recent sites and never fall back to cream',()=>{
 assert.equal(moods.deal('Northline Renovations, kitchens and basements in Toronto').id,'mustard-navy');
 assert.equal(moods.deal('A cosy café in Ottawa').id,'tomato-paper');
 assert.notEqual(moods.deal('A cosy café in Ottawa',{recent:[{mood:'tomato-paper'}]}).id,'tomato-paper','not the mood a recent site used');
 assert.equal(moods.MOODS.some(m=>moods.isCream(m.palette.background)),false,'no mood is Kairoq\'s cream');
 assert.equal(moods.isCream('#f7f5f0'),true);assert.equal(moods.isCream('#ffffff'),false);
 // The art director's cream page and a recent heading font are replaced; a fitting palette stays.
 const mood=moods.MOODS.find(m=>m.id==='mustard-navy');
 const held=moods.enforce({palette:{...CREAM},fonts:{display:'Cormorant Garamond',body:'Inter'}},mood,{avoidFonts:['Cormorant Garamond']});
 assert.equal(held.palette.background,'#ffffff');assert.equal(held.palette.primary,'#f2b632');assert.equal(held.mood,'mustard-navy');
 assert.notEqual(held.fonts.display,'Cormorant Garamond');
 const near=moods.enforce({palette:{...mood.palette,primary:'#e8a91f'},fonts:{display:'Archivo',body:'Inter'}},mood);
 assert.equal(near.palette.primary,'#e8a91f','a close shade the art director chose is kept');
 for(const m of moods.MOODS)for(const f of m.display)assert.ok(design.FONTS[f],'font exists: '+f);
});

test('every landing page gets a signature moment, checked after the first build',async()=>{
 assert.equal(recipes.signature('Toronto renovation company'),'rotating-headline');
 assert.notEqual(recipes.signature('Toronto renovation company',{recent:[{signature:'rotating-headline'}]}),'rotating-headline');
 const files={'src/App.jsx':"import { TextLoop } from './components/ui/text-loop.jsx';\nexport default function App(){return <h1>Hi</h1>}"};
 assert.match(recipes.signatureMissing('rotating-headline',files),/signature moment is missing from the page: Rotating headline/);
 assert.equal(recipes.signatureMissing('rotating-headline',{...files,'src/components/home/Hero.jsx':"import { Magnetic } from '../ui/magnetic.jsx'"}),null);
 assert.equal(recipes.signatureMissing('object-3d',{'src/App.jsx':"import { Diorama } from 'kairoq/hero3d'\nexport default()=><h1>Northline</h1>"}),null);
 // The brief: offered a mood and a signature, held to them; a 3D hero is the signature.
 const seen=[];
 const callModel=async(o,parse)=>{seen.push(o.messages[1].content);return parse(brief())};
 const b=await design.createBrief('Northline Renovations: kitchens, bathrooms and basements in Toronto',{callModel,projectName:'Northline',recent:[{mood:'ink-coral',fonts:{display:'Cormorant Garamond'},signature:'glow-hero'}]});
 assert.match(seen[0],/Colour mood for this site .*"Mustard and navy"/);
 assert.match(seen[0],/Do not use these heading fonts .*Cormorant Garamond/);
 assert.match(seen[0],/Signature moment \(required on the landing page; Kairoq checks it\): Rotating headline/);
 assert.equal(b.mood,'mustard-navy');assert.equal(b.palette.background,'#ffffff');assert.equal(b.signature,'rotating-headline');
 assert.notEqual(b.fonts.display,'Cormorant Garamond');
 assert.match(design.designNote(b),/Signature moment \(required; the page must have it\): Rotating headline/);
 const b3=await design.createBrief('Northline Renovations in Toronto',{callModel:async(o,parse)=>parse(brief({hero3d:{recipe:'Diorama',object:'house'}})),projectName:'Northline'});
 assert.equal(b3.signature,'object-3d');
 assert.deepEqual(require('../design-hero3d').suggest('A renovation contractor'),{recipe:'Diorama',object:'house'});
});

test('older projects get new kit pieces at their next build; nothing the owner changed is touched',()=>{
 const files=design.starterFiles('Old');
 const old={...files};delete old['src/components/ui/tilt.jsx'];delete old['src/components/ui/text-loop.jsx'];old['src/components/ui/button.jsx']='// my own button\n';
 const next=design.withKit(old);
 assert.equal(next['src/components/ui/tilt.jsx'],files['src/components/ui/tilt.jsx']);
 assert.ok(next['src/components/ui/text-loop.jsx']);
 assert.equal(next['src/components/ui/button.jsx'],'// my own button\n');
 const noTokens={'src/App.jsx':'x'};assert.equal(design.withKit(noTokens),noTokens,'apps without the design system are left alone');
});

test('plain words: tidy-ups never reach the reply, and "also changed" says what it means',()=>{
 assert.match(require('../code-structure').fixMessage(['src/App.jsx: App() is 300 lines; split it']),/Your "message" is for the owner, who never sees code: .*never files, folders, components or this tidy-up/);
 assert.equal(scope.note([{area:'saved data and bookings',files:['src/backend.json']},{area:'sign-in',files:['src/hooks/useAuth.js']}]),'I also changed how the app saves information (like enquiries or bookings) and a sign-in, which you didn\'t ask for. If you don\'t want that, undo this change.');
 const yes=['the design sucks','this looks so basic','I hate the colours','it looks like a template','meh, boring','looks cheap','The website is ugly'];
 const no=['make the button blue','change the hero text to Welcome home','add a contact form','the design is great, add a menu page','why is the form not saving','sucks that the form button is grey, make it red with white text'];
 for(const t of yes)assert.equal(design.isDesignComplaint(t),true,t);
 for(const t of no)assert.equal(design.isDesignComplaint(t),false,t);
});

function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{let json=null;try{json=JSON.parse(Buffer.concat(c).toString())}catch{}resolve({status:res.statusCode,headers:res.headers,json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
test('"the design sucks": an apology and a completely new look, not a question back',{timeout:180000},async()=>{
 const asked=[];
 const callModel=async(o,parse)=>{
  const first=String(o.messages[0].content||'');
  if(/art director/.test(first)){asked.push('brief');return parse(brief({palette:{...CREAM,background:'#ffffff',primary:'#ff5a4e',foreground:'#0f1b3d'},fonts:{display:'Space Grotesk',body:'Inter'}}))}
  const last=o.messages.filter(m=>m.role==='user').at(-1);asked.push(String(typeof last.content==='string'?last.content:JSON.stringify(last.content)));
  return parse(JSON.stringify({message:'Sorry it was not right. I have given Northline a completely new look: navy and bright yellow, bold headings.',files:{'src/App.jsx':"// Northline home page.\nexport default function App(){return <main className=\"bg-background text-foreground\"><h1>Northline</h1></main>}\n"}}));
 };
 process.env.KAIROQ_DESIGN_BRIEF='off';
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,callModel,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const meta=builder.create({name:'Northline',owner:'owner'});await builder.initialize(meta);
  const m=builder.loadMeta(meta.id);m.design={name:'Northline Atelier',mood:'',palette:{...CREAM},fonts:{display:'Cormorant Garamond',body:'Inter'},radius:'0.75rem',created_at:'2026-10-26T00:00:00Z'};builder.saveMeta(m);
  await builder.saveSource(meta.id,{...builder.loadFiles(meta.id,1),'src/App.jsx':"// Home.\nexport default function App(){return <h1>Old</h1>}\n"},{summary:'v2'});
  const r=await request(server,'POST','/api/create/projects/'+meta.id+'/chat',{body:{message:'the design sucks'}});
  assert.equal(r.status,202,JSON.stringify(r.json));
  const job=r.json.job.id;
  let j;for(let i=0;i<300;i++){j=(await request(server,'GET','/api/create/jobs/'+job)).json;if(j&&['complete','failed','stopped'].includes(j.job?j.job.status:j.status))break;await new Promise(r=>setTimeout(r,200))}
  const fresh=builder.loadMeta(meta.id);
  assert.equal(asked[0],'brief','a new design brief first');
  assert.notEqual(fresh.design.name,'Northline Atelier');assert.ok(fresh.design.mood);assert.equal(moods.isCream(fresh.design.palette.background),false);
  assert.match(asked[1],/not happy with how the app looks[\s\S]*Start your message to the owner with one short, warm sentence saying sorry/);
  const reply=fresh.messages.filter(x=>x.role==='assistant').at(-1);
  assert.match(reply.text,/^Sorry it was not right/);
  assert.equal(fresh.messages.filter(x=>x.role==='user').at(-1).text,'the design sucks','the owner sees their own words');
  assert.match(builder.loadFiles(meta.id,fresh.current_version)['src/index.css'],new RegExp(fresh.design.fonts.display.replace(/ /g,'.')),'the new fonts are in the tokens');
 }finally{delete process.env.KAIROQ_DESIGN_BRIEF;server.close()}
});

test('the business type picks the mood, sites designed together differ, the 3D sits in the hero, photos get an overlay',async()=>{
 // "consultation" is a consultancy word, but this is a law firm.
 assert.equal(moods.deal('Hale Whitford Law: a Toronto law firm for employment disputes; how a first consultation works').id,'red-black-law');
 // Two sites designed at the same time: the second does not get the first one's mood or signature.
 const callModel=async(o,parse)=>parse(brief());
 const a=await design.createBrief('Ironside Gym, a strength gym in Mississauga',{callModel,projectName:'Ironside Gym',owner:'same-time'});
 const b=await design.createBrief('Ironside Gym, a strength gym in Mississauga',{callModel,projectName:'Ironside Gym',owner:'same-time'});
 assert.notEqual(a.mood,b.mood);assert.notEqual(a.signature,b.signature);
 const c=await design.createBrief('Ironside Gym, a strength gym in Mississauga',{callModel,projectName:'Ironside Gym',owner:'someone-else'});
 assert.equal(c.mood,a.mood,'other owners are not affected');
 // The 3D object must be in the hero, not lower down.
 const shapes="import { GlassShapes } from 'kairoq/hero3d'";
 assert.match(recipes.signatureMissing('object-3d',{'src/components/home/Preview.jsx':shapes,'src/components/home/Hero.jsx':'<h1>Make the numbers make sense</h1>'}),/not in the hero/);
 assert.equal(recipes.signatureMissing('object-3d',{'src/components/home/Hero.jsx':shapes}),null);
 assert.equal(recipes.signatureMissing('object-3d',{'src/pages/Home.jsx':shapes+'\n<h1>Ledgerly</h1>'}),null);
 assert.match(design.RULES,/Text on a photo always sits on a dark overlay/);
});
