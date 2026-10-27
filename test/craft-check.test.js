"use strict";
// The craft check: the "made by AI" giveaways measured on a real page (design-tells.js), sent back
// to the builder with exact fixes, and a design director review (craft-check.js).
const test=require('node:test'),assert=require('node:assert/strict');
const runtime=require('../runtime-check'),tells=require('../design-tells'),craft=require('../craft-check');

// A page with the usual AI giveaways.
const AI_PAGE=`<!doctype html><html><head><style>
body{font-family:Inter,sans-serif;margin:0;background:#fff;color:#111}section{padding:60px 40px}
.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.2em;color:#e2321b}
.pill{display:inline-block;border-radius:999px;background:#fde;padding:4px 10px;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(3,260px);gap:20px}.card{border-radius:24px;border:1px solid #eee;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:20px;height:160px}
.blob{position:absolute;top:0;left:0;width:400px;height:400px;filter:blur(80px);background:#a78bfa}
h1 span{color:#e2321b;font-style:italic;font-family:Georgia,serif}.serif{font-family:Georgia,serif}.mono{font-family:Courier}.third{font-family:Verdana}
.stat{font-size:48px}</style></head><body>
<div class="blob"></div>
<section><span class="pill">New</span><h1>Elevate your <span>journey</span> today</h1><p>Seamless travel, effortlessly managed. Unlock savings.</p>
<a href="#">Get started →</a> <a href="#">Learn more →</a> <a href="#">See pricing →</a><p>Toronto · Since 2019 · Trusted</p><p>Fast · Simple · Smart</p>
<div><div class="stat">10k+</div><div class="stat">99%</div></div></section>
<section><p class="eyebrow">Features</p><h2>Everything you need</h2><div class="grid"><div class="card"><svg width="20" height="20"></svg><h3>Fast</h3><p>Quick.</p></div><div class="card"><svg width="20" height="20"></svg><h3>Safe</h3><p>Secure.</p></div><div class="card"><svg width="20" height="20"></svg><h3>Smart</h3><p>AI.</p></div></div></section>
<section><p class="eyebrow">Why us</p><h2 class="serif">Built for teams</h2><div class="grid"><div class="card"><h3>One</h3><p>a</p></div><div class="card"><h3>Two</h3><p>b</p></div><div class="card"><h3>Three</h3><p class="third">Verdana text that is long enough to count as a family in use here.</p></div></div></section>
</body></html>`;

// A calm page made by a person: one font pair, a heading in one style, a list with dividers.
const HUMAN_PAGE=`<!doctype html><html><head><style>
body{font-family:Inter,sans-serif;margin:0;background:#fff;color:#111}section{padding:80px 40px;max-width:1100px}
h1,h2{font-family:Georgia,serif;font-weight:600}h1{font-size:72px;letter-spacing:-.02em}ul{list-style:none;padding:0}li{border-top:1px solid #e5e5e5;padding:16px 0}
a.btn{display:inline-block;background:#13213c;color:#fff;padding:12px 20px;border-radius:6px}</style></head><body>
<section><h1>Kitchens and basements, done in eight weeks.</h1><p>We renovate homes across Toronto: one crew from demolition to the last coat of paint, with a fixed price agreed before we start.</p><a class="btn" href="#">Request a quote</a></section>
<section><h2>What we take on</h2><ul><li>Kitchens: cabinets, counters, plumbing and lighting.</li><li>Bathrooms: tiling, fixtures and ventilation.</li><li>Basements: framing, insulation and finishing.</li></ul></section>
</body></html>`;

async function measure(html){
 const {chromium}=require('playwright-core');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage({viewport:{width:1280,height:900}});await page.setContent(html);return await tells.tells(page,'desktop')}
 finally{await browser.close()}
}

test('the AI giveaways are measured on the page, each with its fix; a hand-made page passes',{skip:!runtime.available()},async()=>{
 const ai=await measure(AI_PAGE),kinds=ai.issues.map(i=>i.kind);
 for(const k of ['eyebrow','dots','arrows','accent-word','blobs','card-grids','round','fonts','pill','filler'])assert.ok(kinds.includes(k),'finds '+k+' in '+kinds.join(','));
 assert.ok(ai.issues.every(i=>i.fix&&i.issue&&['major','minor'].includes(i.severity)));
 assert.match(ai.issues.find(i=>i.kind==='filler').issue,/"elevate"/);
 assert.deepEqual(ai.stats.sort(),['10k+','99%']);
 // The sentence-case variant seen on a real build: short labels in the accent colour, arrow icons.
 const law=await measure(`<!doctype html><html><head><style>body{font-family:Inter;color:#0f1b3e}.lab{font-size:14px;color:rgb(255,88,77)}</style></head><body>
 <p class="lab">Where we focus</p><h2>Disputes need clarity</h2><p class="lab">A first conversation</p><h2>Start with the facts</h2>
 <a href="#">Request a consultation <svg class="lucide lucide-arrow-right" width="10" height="10"></svg></a> <a href="#">Explore <svg class="lucide lucide-arrow-up-right" width="10" height="10"></svg></a> <a href="#">About us <svg class="lucide lucide-arrow-right" width="10" height="10"></svg></a>
 <button>What should I include? <svg class="lucide lucide-chevron-down" width="10" height="10"></svg></button></body></html>`);
 assert.deepEqual(law.issues.map(i=>i.kind).sort(),['arrows','eyebrow']);
 assert.match(law.issues.find(i=>i.kind==='arrows').issue,/^3 buttons/,'the accordion chevron does not count');
 const human=await measure(HUMAN_PAGE);
 assert.deepEqual(human.issues.filter(i=>i.severity==='major').map(i=>i.kind),[],JSON.stringify(human.issues));
});

test('numbers the owner never gave are flagged; the ones they gave are kept',()=>{
 assert.deepEqual(tells.madeUpStats(['10k+','99%','70'],'We did 70 bookings over two months'),['10k+','99%']);
 const pictures=[{issues:[{severity:'major',kind:'eyebrow',issue:'labels',fix:'remove'},{severity:'major',kind:'not-a-tell',issue:'x',fix:'y'}],stats:['500+']}];
 assert.deepEqual(craft.found(pictures,'').map(i=>i.kind),['eyebrow','made-up-number']);
});

test('the craft check fixes what it measured, measures again, then asks a design director once',async()=>{
 const shots=[[{issues:[{severity:'major',kind:'eyebrow',issue:'Small capital labels above 3 headings',fix:'Remove them.'},{severity:'major',kind:'card-grids',issue:'2 rows of identical boxes',fix:'Keep one.'}],stats:[]}],
  [{issues:[],stats:[]}]];
 let n=0;const edits=[],reviews=[];
 const out=await craft.run({url:()=>'http://x/',request:'A site for a renovation company',facts:'',designShots:async()=>shots[Math.min(n++,1)],
  reviewLook:async o=>{reviews.push(o.prompt);return{ok:false,problems:['The hero has no strong idea: show a finished kitchen large, beside the headline.']}},
  edit:async(msg,shown)=>{edits.push({msg,shown});return{version:2+edits.length}}});
 assert.equal(edits.length,2);
 assert.match(edits[0].msg,/1\. Small capital labels above 3 headings\. Fix: Remove them\.\n2\. 2 rows of identical boxes\. Fix: Keep one\./);
 assert.equal(edits[0].shown,'Refine the design so it looks hand-made','the owner sees plain words');
 assert.match(reviews[0],/design director of a top independent studio[\s\S]*renovation company[\s\S]*Would your studio ship it/);
 assert.match(edits[1].msg,/show a finished kitchen large/);
 assert.equal(out.passes,2);assert.deepEqual(out.remaining,[]);
 assert.equal(craft.summary(out),'Refined the design so it looks hand-made rather than generated (2 passes).');
 // A clean page that the director would ship: nothing changes.
 const clean=await craft.run({url:()=>'u',request:'r',designShots:async()=>[{issues:[],stats:[]}],reviewLook:async()=>({ok:true,problems:[]}),edit:async()=>{throw Error('no edit expected')}});
 assert.equal(clean.passes,0);assert.equal(craft.summary(clean),'Checked the design for anything that looks generic: nothing to change.');
});

test('the builder\'s rules and the UI kit no longer ask for the AI look',()=>{
 const fs=require('fs'),path=require('path'),kit=f=>fs.readFileSync(path.join(__dirname,'..','starter-kit/src/components/ui',f),'utf8');
 const {RULES}=require('../react-design');
 assert.doesNotMatch(RULES,/rounded-2xl\)|shadow-soft cards|hover:-translate-y-0\.5|bg-gradient-subtle, a dark band/);
 assert.match(RULES,/at most one grid of cards on a page/);assert.match(RULES,/Giveaways to never use: small capital labels above headings/);
 assert.doesNotMatch(kit('card.jsx'),/shadow-soft/);assert.doesNotMatch(kit('button.jsx'),/shadow-glow|bg-gradient-hero/);
 assert.doesNotMatch(kit('section.jsx'),/uppercase/);assert.doesNotMatch(kit('motion.jsx'),/rounded-2xl border bg-card text-card-foreground shadow-soft/);
});

test('a first build goes through the craft check before the owner sees it (any plan, free)',{timeout:180000},async()=>{
 const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-craft-'));
 Object.assign(process.env,{NODE_ENV:'test',KAIROQ_WEB_RESEARCH:'off',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_DESIGN_PANEL:'off',KAIROQ_LOOK_CHECK:'off'});
 const builder=require('../react-builder'),createApi=require('../create-api');
 const asked=[];
 const callModel=async(o,parse)=>{
  const first=String(o.messages[0].content||'');
  if(/art director/.test(first))return parse(JSON.stringify({name:'Site',summary:'s',palette:{background:'#ffffff',foreground:'#13213c',primary:'#f2b632',secondary:'#eef1f6',accent:'#13213c',muted:'#f5f6f9'},fonts:{display:'Archivo',body:'Inter'},radius:'0.5rem'}));
  const last=o.messages.filter(m=>m.role==='user').at(-1);asked.push(String(typeof last.content==='string'?last.content:JSON.stringify(last.content)));
  return parse(JSON.stringify({message:asked.length===1?'Built the Northline site.':'Removed the small labels above the headings.',files:{'src/App.jsx':"// Home page.\nimport { TextLoop } from './components/ui/text-loop.jsx';\nimport { Magnetic } from './components/ui/magnetic.jsx';\nexport default function App(){return <main className=\"bg-background text-foreground\"><h1>Northline v"+asked.length+"</h1></main>}\n"}}));
 };
 let shot=0;const designShots=async()=>[{name:'desktop',mime:'image/jpeg',data:'',issues:shot++===0?[{severity:'major',kind:'eyebrow',issue:'Small capital labels above 3 headings',fix:'Remove them.'}]:[],stats:[]}];
 const reviewLook=async()=>({ok:true,problems:[]});
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,callModel,secure:false,designShots,reviewLook}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=(method,url,body)=>new Promise((resolve,reject)=>{const p=body?Buffer.from(JSON.stringify(body)):null;const q=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:p?{'Content-Type':'application/json','Content-Length':p.length}:{}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>resolve({status:res.statusCode,json:JSON.parse(Buffer.concat(c).toString()||'{}')}))});q.on('error',reject);if(p)q.write(p);q.end()});
 try{
  const made=await call('POST','/api/create/projects',{name:'Northline',prompt:'A website for Northline, a Toronto renovation company: kitchens, bathrooms and basements.'});
  assert.equal(made.status,201,JSON.stringify(made.json));
  let j;for(let i=0;i<300;i++){j=(await call('GET','/api/create/jobs/'+made.json.job.id)).json.job;if(['complete','failed','stopped'].includes(j.status))break;await new Promise(r=>setTimeout(r,200))}
  assert.equal(j.status,'complete',JSON.stringify(j).slice(0,600));
  assert.equal(asked.length,2,'the first build and one craft pass');
  assert.match(asked[1],/Craft pass: the page still has the generic "made by AI" look[\s\S]*1\. Small capital labels above 3 headings\. Fix: Remove them\./);
  const meta=builder.loadMeta(made.json.project.id);
  const users=meta.messages.filter(m=>m.role==='user').map(m=>m.text);
  assert.equal(users.at(-1),'Refine the design so it looks hand-made');
  assert.equal(meta.messages.at(-1).craft,'Refined the design so it looks hand-made rather than generated (1 pass).');
  assert.match(builder.loadFiles(meta.id,meta.current_version)['src/App.jsx'],/Northline v2/);
 }finally{server.close()}
});
