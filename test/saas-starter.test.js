"use strict";
// The AI SaaS starter (templates/ai-saas): a complete SaaS that builds as it is, and that SaaS
// requests start from, so the builder only writes the product part.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-starter-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_HOSTING_REGISTRY:path.join(tmp,'hosting.json')});
const builder=require('../react-builder'),backend=require('../react-backend'),T=require('../create-templates');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

test('the starter is listed, valid, and uses credits, teams, plans and the ready account pages',()=>{
 const t=T.get('ai-saas');
 assert.ok(T.list().some(x=>x.id==='ai-saas'&&x.category==='AI'));
 assert.deepEqual(builder.validateFiles(t.files),[]);
 const cfg=backend.parseConfig(t.files);
 assert.deepEqual(cfg.credits,{free:25,ai_cost:1});
 assert.equal(cfg.collections.drafts.access,'team');
 assert.deepEqual(Object.keys(cfg.payments.products),['pro','team','credits_500']);
 assert.match(t.files['src/App.jsx'],/from 'kairoq\/saas'/);
 assert.ok(t.files['src/components/ui/button.jsx'],'it brings Kairoq\'s UI kit and design tokens');
 assert.match(t.files['src/index.css'],/kairoq:tokens:start/);
 // The plans customers read match the products they pay for.
 const config=t.files['src/saas.config.js'];
 for(const [name,p] of Object.entries(cfg.payments.products).filter(([,p])=>p.mode==='subscription')){
  assert.match(config,new RegExp("product: '"+name+"'"));
  assert.match(config,new RegExp('credits: '+p.credits));
 }
});

test('SaaS requests start from the starter; marketing pages and other apps do not',()=>{
 for(const p of ['Build me an AI SaaS that writes cover letters, $19 a month','An AI image generator people pay for with credits','B2B platform for clinics to manage staff rotas','A subscription app for meal plans'])
  assert.equal(T.match(p),'ai-saas',p);
 for(const p of ['A landing page for my SaaS with a waitlist','A todo list app','Website for my bakery','Portfolio for a photographer',''])
  assert.equal(T.match(p),null,p);
});

test('a project started from it builds',async()=>{
 const meta=builder.create({name:'Starter',owner:'owner'});
 await builder.initializeFrom(meta,T.get('ai-saas').files,'Started from the SaaS starter');
 const m=builder.loadMeta(meta.id);
 assert.ok(m.current_version>=1);
 assert.ok(fs.existsSync(path.join(builder.projectDir(meta.id),'versions',String(m.current_version),'dist','index.html')));
});
