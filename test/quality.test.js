'use strict';
// KAIROQ_QUALITY=top (quality.js): one variable puts a top model on every build step, the build
// shows which model wrote it (and warns the owner about a cheaper one), the agent's check tool
// also reports the "made by AI" giveaways measured on the page, and OpenCode's spending is counted
// at Claude's real prices.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const q=require('../quality');

test('KAIROQ_QUALITY=top fills in the top models; variables Ka set himself win',()=>{
 const env={KAIROQ_QUALITY:'top',KAIROQ_PRO_MODELS:'openai/gpt-6'};
 const set=q.apply(env);
 assert.equal(env.KAIROQ_BUILDER_MODEL,'anthropic/claude-sonnet-5.5');
 assert.equal(env.KAIROQ_DESIGN_MODELS,'anthropic/claude-opus-5.5');
 assert.match(env.KAIROQ_LOOK_MODELS,/^anthropic\/claude-opus-5\.5/,'the design director looks with Opus');
 assert.equal(env.KAIROQ_BUILD_ENGINE,'opencode');
 assert.equal(env.KAIROQ_BUILDER_FAST,'off');
 assert.equal(env.KAIROQ_BUILDER_PROVIDER,'openrouter');
 assert.equal(env.KAIROQ_PRO_MODELS,'openai/gpt-6','kept');
 assert.ok(!set.includes('KAIROQ_PRO_MODELS'));
 for(const k of ['KAIROQ_BUILDER_PAID_APPROVED','DAILY_COST_LIMIT_USD','MONTHLY_COST_LIMIT_USD','KAIROQ_BUILDER_MONTHLY_LIMIT_USD'])assert.equal(env[k],undefined,k+' stays Ka\'s decision');
 const off={};assert.deepEqual(q.apply(off),[]);assert.deepEqual(off,{});
});

test('names people know, and a warning for cheaper models',()=>{
 assert.equal(q.label('anthropic/claude-sonnet-5.5'),'Claude Sonnet 5.5');
 assert.equal(q.label('nvidia/nemotron-3-super-120b-a12b:free'),'Nemotron 3 Super 120b A12b (free)');
 assert.equal(q.label('openrouter/free'),'a free model');
 assert.equal(q.cheap('openrouter/free',{}),true);
 assert.equal(q.cheap('deepseek/deepseek-v3.2',{}),false,'not top: no warning');
 const top={KAIROQ_QUALITY:'top'};q.apply(top);
 assert.equal(q.cheap('deepseek/deepseek-v3.2',top),true);
 assert.equal(q.cheap('anthropic/claude-opus-5.5',top),false);
 assert.deepEqual(q.builtBy({engine:'opencode',model:'anthropic/claude-sonnet-5.5'},top),{engine:'opencode',model:'anthropic/claude-sonnet-5.5',label:'Claude Sonnet 5.5',agent:true});
 assert.equal(q.builtBy({model:null}),null);
});

test('OpenCode counts a Claude build at its real price',()=>{
 const oc=require('../opencode-engine');
 assert.deepEqual(oc.rates('anthropic/claude-sonnet-5.5'),[2,10]);
 assert.deepEqual(oc.rates('anthropic/claude-opus-5.5'),[4,20]);
 assert.deepEqual(oc.rates('deepseek/deepseek-v3.2'),[0.5,1.5]);
});

test('each build records the model that wrote it; the agent check reports design giveaways',{timeout:120000},async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-quality-'));
 Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
 const builder=require('../react-builder');
 const meta=builder.create({name:'Northline',owner:'owner'});
 await builder.initialize(meta);
 const callModel=async(o,parse)=>{
  if(/art director/.test(String(o.messages[0].content||'')))return parse(JSON.stringify({name:'Site',summary:'s',palette:{background:'#ffffff',foreground:'#13213c',primary:'#f2b632',secondary:'#eef1f6',accent:'#13213c',muted:'#f5f6f9'},fonts:{display:'Archivo',body:'Inter'},radius:'0.5rem'}),'anthropic/claude-opus-5.5');
  return parse(JSON.stringify({message:'Built it.',files:{'src/App.jsx':'export default function App(){return <main><h1>Northline</h1></main>}\n'}}),'anthropic/claude-sonnet-5.5');
 };
 const r=await builder.edit(meta.id,'Make the headline say Northline',{callModel,engine:null});
 assert.equal(r.built_by.label,'Claude Sonnet 5.5');
 const m=builder.loadMeta(meta.id);
 assert.equal(m.messages.at(-1).built_by.model,'anthropic/claude-sonnet-5.5');
 assert.equal(m.versions.at(-1).built_by.model,'anthropic/claude-sonnet-5.5');
 // The giveaways list the agent's check tool returns on a designed site.
 m.design={...(m.design||{}),signature:'show-it-working'};builder.saveMeta(m);
 const shots=async()=>[{name:'desktop',mime:'image/jpeg',data:'',issues:[{severity:'major',kind:'eyebrow',issue:'Small capital labels above 3 headings',fix:'Remove them.'},{severity:'minor',kind:'round',issue:'Round corners',fix:'Less round.'}],stats:[]}];
 const list=await builder.designProblems(builder.loadMeta(meta.id),'/x',shots);
 assert.match(list,/^1\. Small capital labels above 3 headings\. Fix: Remove them\./);
 assert.doesNotMatch(list,/Round corners/,'only the major ones');
 const clean=await builder.designProblems(builder.loadMeta(meta.id),'/x',async()=>[{name:'desktop',issues:[],stats:[]}]);
 assert.equal(clean,'');
});
