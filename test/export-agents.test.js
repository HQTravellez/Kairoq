"use strict";
// Agent-ready downloads (export-agents.js): AGENTS.md and CLAUDE.md written from the app's own
// files, and checks (npm test) that run in the downloaded project with no install.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-agents-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_HOSTING_REGISTRY:path.join(tmp,'hosting.json')});
const builder=require('../react-builder'),exporter=require('../react-export'),T=require('../create-templates');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

function writeOut(files,dir){for(const [p,c] of Object.entries(files)){const f=path.join(dir,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)}}
// The project's own test run, as a developer would start it (not as part of this test run).
function npmTest(dir){
 try{return{ok:true,out:execFileSync(process.execPath,['--test'],{cwd:dir,encoding:'utf8',stdio:'pipe',env:Object.fromEntries(Object.entries(process.env).filter(([k])=>k!=='NODE_TEST_CONTEXT'))})}}
 catch(e){return{ok:false,out:String(e.stdout)+String(e.stderr)}}
}

test('a SaaS starter download explains itself to AI tools and its checks pass',async()=>{
 const meta=builder.create({name:'Draftwise',owner:'owner'});
 await builder.initializeFrom(meta,T.get('ai-saas').files,'Started from the SaaS starter');
 const files=exporter.exportFiles(meta.id);
 const agents=files['AGENTS.md'];
 assert.match(agents,/^# Draftwise/);
 assert.match(agents,/`src\/pages\/Workspace\.jsx`/,'it names the app\'s real files');
 assert.match(agents,/`drafts` \(team\): shared by the members of the current team/);
 assert.match(agents,/customer credits: 25 free, 1 per AI request/);
 assert.match(agents,/`pro` \(subscription, \+1000 credits\)/);
 assert.match(agents,/This is a SaaS/);
 assert.doesNotMatch(agents,/src\/components\/ui\/button\.jsx/,'the UI kit is summarised, not listed file by file');
 assert.match(files['CLAUDE.md'],/@AGENTS\.md/);
 assert.equal(JSON.parse(files['package.json']).scripts.test,'node --test');
 assert.ok(exporter.MANAGED.test('AGENTS.md')&&exporter.MANAGED.test('CLAUDE.md')&&exporter.MANAGED.test('tests/kairoq.test.js'));
 assert.ok(!exporter.MANAGED.test('NOTES.md'),'owners\' own notes are never overwritten');
 assert.ok(files['src/kairoq-saas.js'],'the account pages module comes along');
 const dir=path.join(tmp,'draftwise');writeOut(files,dir);
 const run=npmTest(dir);
 assert.ok(run.ok,run.out);
 assert.match(run.out,/# pass 4/);assert.match(run.out,/# skipped 1/,'placeholder Stripe ids are pointed out, not failed');
 assert.match(run.out,/replace the price_Replace/);
 // A broken change is caught: a collection nobody declared, a plan that does not match.
 fs.writeFileSync(path.join(dir,'src/pages/Extra.jsx'),"import { collection } from 'kairoq';\nexport const notes = collection('notes');\n");
 const cfg=fs.readFileSync(path.join(dir,'src/saas.config.js'),'utf8');
 fs.writeFileSync(path.join(dir,'src/saas.config.js'),cfg.replace('credits: 1000','credits: 2000'));
 const broken=npmTest(dir);
 assert.equal(broken.ok,false);
 assert.match(broken.out,/collection\("notes"\), which is not in src\/backend\.json/);
 assert.match(broken.out,/plan "pro" shows 2000 credits but adds 1000/);
});

test('any app gets the instructions; a plain app has no SaaS section and its checks pass',async()=>{
 const meta=builder.create({name:'Bakery',owner:'owner'});await builder.initialize(meta);
 const files=exporter.exportFiles(meta.id);
 assert.match(files['AGENTS.md'],/No collections yet/);
 assert.doesNotMatch(files['AGENTS.md'],/This is a SaaS/);
 const dir=path.join(tmp,'bakery');writeOut(files,dir);
 const run=npmTest(dir);assert.ok(run.ok,run.out);
});
