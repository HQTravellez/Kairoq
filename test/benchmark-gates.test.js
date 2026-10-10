'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),gates=require('../benchmark-gates');
const shots=[{label:'Desktop dashboard · 1440px',bytes:Buffer.from('dashboard')}];
function visual(){return{passed:true,coverage:{complete:true,mode:'ai-screenshot-review'},evidence:gates.evidenceManifest(shots)};}
function report(){return{source_sha:'a'.repeat(40),contract_version:gates.CONTRACT_VERSION,status:'passed',stage:'complete',app:{deployed_qa:{passed:true,visual_review:visual(),evidence:gates.evidenceManifest(shots)}},website:{deployed_qa:{passed:true,visual_review:visual(),evidence:gates.evidenceManifest(shots)}}};}
test('old marker, different commit, unknown provenance and incomplete public evidence never certify a current pass',()=>{
 const current={source_sha:'a'.repeat(40),contract_version:gates.CONTRACT_VERSION},r=report();assert.equal(gates.currentPass(r,current),true);
 for(const changed of [{...r,source_sha:'b'.repeat(40)},{...r,contract_version:3},{passed:true},{...r,website:{deployed_qa:{passed:true}}}])assert.equal(gates.currentPass(changed,current),false);
 assert.equal(gates.currentPass(r,{...current,source_sha:null}),false);
});
test('visual cache is reused only for identical nonempty public screenshot manifests',async()=>{
 assert.equal(gates.matchesEvidence(visual(),shots),true);assert.equal(gates.matchesEvidence(visual(),[{...shots[0],bytes:Buffer.from('changed')}]),false);assert.equal(gates.matchesEvidence(visual(),[]),false);
 const cached=visual();assert.equal(await gates.reviewEvidence(()=>{throw Error('Should not call model');},{},shots,cached),cached);
 let calls=0;const scores=Object.fromEntries(require('../design-pipeline').axes.map(axis=>[axis,4]));
 await gates.reviewEvidence(async()=>{calls++;return{visual_review:{scores,findings:[],screen_reviews:[{screen:shots[0].label,scores,findings:[]}]}};},{},shots,{...cached,evidence:[]});assert.equal(calls,1);
 await assert.rejects(gates.reviewEvidence(()=>{}, {},[],cached),/missing/);
});
function candidate(){
 const fields={trips:['traveler','destination','departure_date','status'],approvals:['requester','status'],expenses:['description','amount','category','status'],travelers:['name','email','department','status']};
 return{schema:{collections:Object.entries(fields).map(([name,fields])=>({name,fields:[...fields.map(name=>({name})),...(['approvals','expenses'].includes(name)?[{name:'trip',type:'reference',collection:'trips'}]:[])]})),actions:[['trips','requested','approved'],['trips','approved','booked'],['expenses','draft','submitted'],['expenses','submitted','paid']].map(([collection,from,to])=>({collection,field:'status',from:[from],to}))}};
}
test('Travellez requires all declared collections, fields, trip links and exact guarded transitions',()=>{
 assert.equal(gates.assertAppContract(candidate()),true);
 const missing=candidate();missing.schema.collections.pop();assert.throws(()=>gates.assertAppContract(missing),/travelers/);
 const bypass=candidate();bypass.schema.actions[1].from.push('requested');assert.throws(()=>gates.assertAppContract(bypass),/guarded/);
 const linked=candidate();linked.schema.collections[1].fields.pop();assert.throws(()=>gates.assertAppContract(linked),/reference trips/);
});
test('CI rejects failed, stale and evidence-mismatched benchmark reports',()=>{
 const {assertReport}=require('../scripts/verify-benchmark'),r=report();assert.equal(assertReport(r,r.source_sha),r);
 assert.throws(()=>assertReport({...r,status:'failed'},r.source_sha),/No complete/);
 assert.throws(()=>assertReport(r,'b'.repeat(40)),/No complete/);
 r.app.deployed_qa.visual_review.evidence[0].sha256='wrong';assert.throws(()=>assertReport(r,r.source_sha),/No complete|does not match/);
});
test('screenshot artifact reader rejects altered bytes, invalid indexes and traversal identities',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{read}=require('../benchmark-evidence'),root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-evidence-'));
 try{const r=report();r.app.id='travellez-test';r.app.deployed_qa.version=1;const folder=path.join(root,r.app.id,'release-evidence','1','design-evidence');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'1.jpg'),shots[0].bytes);assert.deepEqual(read(r,'app',1,{appRoot:root}),shots[0].bytes);assert.throws(()=>read(r,'app',0,{appRoot:root}),/Invalid/);fs.writeFileSync(path.join(folder,'1.jpg'),'changed');assert.throws(()=>read(r,'app',1,{appRoot:root}),/hash mismatch/);r.app.id='../outside';assert.throws(()=>read(r,'app',1,{appRoot:root}),/unavailable/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
const fs=require('node:fs'),browserPath=process.env.CHROMIUM_PATH||'/usr/bin/chromium';
test('required screens are exercised through collapsed mobile navigation, and missing screens fail',{skip:!fs.existsSync(browserPath)},async()=>{
 const browser=await require('playwright-core').chromium.launch({executablePath:browserPath,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage(),names=gates.REQUIRED_SCREENS;
 await page.setContent('<style>[hidden]{display:none}@media(max-width:600px){nav{position:fixed;top:0;left:0;width:250px;display:flex;flex-direction:column;transform:translateX(-110%);transition:transform .25s}nav.open{transform:translateX(0)}}</style><button aria-controls="nav" aria-expanded="false" onclick="document.querySelector(\'nav\').classList.toggle(\'open\');this.setAttribute(\'aria-expanded\',document.querySelector(\'nav\').classList.contains(\'open\'))">Menu</button><nav id="nav">'+names.map(n=>'<button data-kq-screen-target="'+n+'">'+n+'</button>').join('')+'</nav>'+names.map(n=>'<section data-kq-screen="'+n+'" hidden><h1>'+n+'</h1></section>').join(''));
 await page.evaluate(()=>document.querySelectorAll('[data-kq-screen-target]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-kq-screen]').forEach(s=>s.hidden=s.dataset.kqScreen!==button.dataset.kqScreenTarget);document.querySelectorAll('[data-kq-screen-target]').forEach(b=>b.setAttribute('aria-current',b===button?'page':'false'));document.querySelector('nav').classList.remove('open');document.querySelector('[aria-controls="nav"]').setAttribute('aria-expanded','false');}));
 const seen=[];await require('../app-builder').checkScreens(page,{requiredScreens:names,shot:async(_,label)=>seen.push(label)});assert.equal(seen.length,14);assert.ok(seen.includes('Mobile screen · controls'));
 await page.addStyleTag({content:'@media(max-width:600px){nav.open{transform:translateX(-110%)!important}}'});
 await assert.rejects(require('../app-builder').checkScreens(page,{requiredScreens:names}),/Required navigation unreachable: dashboard at 390px/);
 await page.locator('[data-kq-screen-target="controls"]').evaluate(n=>n.remove());await assert.rejects(require('../app-builder').checkScreens(page,{requiredScreens:names}),/Required screen missing: controls/);
 }finally{await browser.close();}
});
