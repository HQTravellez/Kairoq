'use strict';
// 1M-context models read the whole app up front; other models keep the 60k-character view.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-ctx-'));
process.env.NODE_ENV='test';process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),agent=require('../react-agent');

test('the budget follows the chosen model',()=>{
 assert.equal(agent.contextBudget('anthropic/claude-sonnet-5.5'),800000);
 assert.equal(agent.contextBudget('anthropic/claude-opus-5.5'),800000);
 assert.equal(agent.contextBudget('anthropic/claude-fable-5.1'),800000);
 for(const m of ['openai/gpt-6','deepseek/deepseek-v3.2','qwen/qwen3-coder:free',null,'auto'])assert.equal(agent.contextBudget(m),60000,String(m));
 process.env.KAIROQ_AGENT_CONTEXT_CHARS='200000';assert.equal(agent.contextBudget('anthropic/claude-sonnet-5.5'),200000);delete process.env.KAIROQ_AGENT_CONTEXT_CHARS;
 assert.match(fs.readFileSync(path.join(__dirname,'..','create-api.js'),'utf8'),/contextChars:require\('\.\/react-agent'\)\.contextBudget\(chosen&&chosen\.id\)/);
});

test('a big app is read whole with a big budget, and cut with the default one',async()=>{
 const meta=builder.create({name:'Big app'});await builder.initialize(meta);
 const big='// big\n'+'export const rows = [\n'+Array.from({length:3000},(_,i)=>'  { id: '+i+', name: "Row number '+i+'" },').join('\n')+'\n];\n';
 await builder.initializeFrom(meta,{...builder.loadFiles(meta.id,builder.loadMeta(meta.id).current_version),'src/data.js':big},'Data');
 const seen=async contextChars=>{let first='';const callModel=async(opts,parse)=>{const sys=String(opts.messages[0].content||'');if(/independent senior code reviewer|independent product\/spec reviewer/.test(sys))return parse(JSON.stringify({verdict:'pass',findings:[]}));if(!first)first=JSON.stringify(opts.messages);return parse(JSON.stringify({thought:'Done.',actions:[{tool:'finish',message:'Nothing to change.'}]}))};
  await agent.run(meta.id,'Explain the data file',{callModel,inspect:async()=>({errors:[],steps:[],text:'ok',external:[]}),maxSteps:2,contextChars});return first};
 assert.match(await seen(800000),/Row number 2999/,'whole file read');
 assert.doesNotMatch(await seen(60000),/Row number 2999/,'default view is cut');
});
