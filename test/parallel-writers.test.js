'use strict';
process.env.KAIROQ_AGENT_REPLY='off'; // counts agent calls; the closing-message writer has its own test
// Parallel writers: a first build is planned as files and the sections are written at the same
// time; the agent then builds, tests and finishes. Proven with a real build in Chromium.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-pw-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=root;process.env.KAIROQ_AUTONOMY_DIR=path.join(root,'learning');process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_PARALLEL_WRITERS='on';
const agent=require('../react-agent'),builder=require('../react-builder'),design=require('../react-design'),runtime=require('../runtime-check'),PW=require('../parallel-writers');
test.after(()=>runtime.close());

const SECTIONS={Hero:'Pulse. Time, tuned to you.',Features:'Seven days of battery',Buy:'Buy Pulse'};
const PLAN={thought:'Three sections.',shared:{'src/App.jsx':"import Hero from './components/Hero.jsx';import Features from './components/Features.jsx';import Buy from './components/Buy.jsx';\nexport default function App(){return <main><Hero/><Features/><Buy/></main>}",'src/data/content.js':"export const brand='Pulse';"},
 sections:Object.keys(SECTIONS).map(n=>({file:'src/components/'+n+'.jsx',name:n,brief:'Show '+SECTIONS[n]}))};
const section=n=>n==='Buy'
 ?"import {useState} from 'react';import {brand} from '../data/content.js';export default function Buy(){const [n,set]=useState(0);return <section><button onClick={()=>set(n+1)}>Buy {brand}</button><p>In bag: {n}</p></section>}"
 :"export default function "+n+"(){return <section><h2>"+SECTIONS[n]+"</h2></section>}";

function fakeModel(log){
 let inFlight=0,maxInFlight=0,agentCalls=0;
 const call=async(opts,parse)=>{
  const sys=String(opts.messages[0].content||'');
  if(/independent senior code reviewer|independent product\/spec reviewer/.test(sys))return parse(JSON.stringify({verdict:'pass',findings:[]}));
  if(opts.purpose==='plan-files'){log.push('plan');return parse(JSON.stringify(PLAN))}
  if(opts.purpose==='section-writer'){
   const file=sys.match(/You write ONE file of this app: (\S+)\./)[1],n=file.split('/').pop().replace('.jsx','');
   inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);log.push('start '+n);
   await new Promise(r=>setTimeout(r,150));
   inFlight--;log.push('end '+n);
   return parse(JSON.stringify({file,content:section(n)}));
  }
  agentCalls++;log.push('agent '+agentCalls);
  if(agentCalls===1){log.first=String(opts.messages.at(-1).content);return parse(JSON.stringify({thought:'Build and test.',actions:[{tool:'build_and_test',steps:[{action:'click',text:'Buy Pulse'},{action:'expect',text:'In bag: 1'}]}]}))}
  return parse(JSON.stringify({thought:'Verified.',actions:[{tool:'finish',message:'Built the Pulse page.'}]}));
 };
 call.stats=()=>({maxInFlight,agentCalls});
 return call;
}

test('enabled by default, off under the test runner unless turned on, and off with the switch',()=>{
 assert.equal(PW.enabled(),true);
 const keep=process.env.KAIROQ_PARALLEL_WRITERS;
 process.env.KAIROQ_PARALLEL_WRITERS='off';assert.equal(PW.enabled(),false);
 delete process.env.KAIROQ_PARALLEL_WRITERS;assert.equal(PW.enabled(),false,'off unless turned on: the agent builds in small steps');
 process.env.KAIROQ_PARALLEL_WRITERS=keep;
});

test('a bad plan falls back to the normal agent; a failed section is named to the agent',async()=>{
 assert.equal(await PW.write({system:'s',intro:'i',callModel:async(o,p)=>p('{"shared":{}}')}),null);
 const out=await PW.write({system:'s',intro:'i',callModel:async(o,p)=>{if(o.purpose==='plan-files')return p(JSON.stringify(PLAN));if(/Features/.test(o.messages[0].content))throw Error('timeout');return p(JSON.stringify({content:'export default function X(){return null}'}))}});
 assert.deepEqual(out.failed,['src/components/Features.jsx']);
 assert.ok(out.files['src/App.jsx']&&out.files['src/components/Hero.jsx']&&!out.files['src/components/Features.jsx']);
 assert.equal(await PW.write({system:'s',intro:'i',callModel:async(o,p)=>p(JSON.stringify({...PLAN,shared:{...PLAN.shared,'../etc/x.js':'bad'},sections:[...PLAN.sections,{file:'server.js',brief:'x'}]}))}).then(r=>Object.keys(r.files).some(n=>/etc|server/.test(n))),false,'only app files');
});

test('a first build: sections written at the same time, then built, clicked and finished',{skip:!runtime.available(),timeout:240000},async()=>{
 const meta=builder.create({name:'Pulse',owner:'owner'});await builder.initialize(meta);assert.ok(design.isUntouchedStarter(builder.loadFiles(meta.id,builder.loadMeta(meta.id).current_version)),'starts from the starter');
 const server=http.createServer((req,res)=>{if(builder.handlePreview(req,res))return;res.writeHead(404);res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const log=[],callModel=fakeModel(log);
 try{
  const result=await agent.run(meta.id,'An Apple-style product page for Pulse, a smartwatch',{callModel,inspect:(url,opts)=>runtime.inspect('http://127.0.0.1:'+server.address().port+url,opts),designShots:async()=>[{name:'desktop',issues:[],stats:[]}],reviewLook:async()=>({ok:true,problems:[]}),maxSteps:4});
  assert.equal(callModel.stats().maxInFlight,3,'all three sections were being written at once');
  assert.ok(log.indexOf('plan')<log.indexOf('start Hero')&&log.indexOf('end Buy')<log.findIndex(x=>x.startsWith('agent 1')),'plan, then writers, then the agent');
  assert.match(log.first,/write_files: [\s\S]*src\/components\/Hero\.jsx/,'the agent is told what was written');
  assert.equal(callModel.stats().agentCalls,2,'the agent only built, tested and finished');
  assert.equal(result.verification.verified,true);
  const files=builder.loadFiles(meta.id,builder.loadMeta(meta.id).current_version);
  for(const n of Object.keys(SECTIONS))assert.ok(files['src/components/'+n+'.jsx'],n);
  const tl=builder.loadMeta(meta.id).messages.at(-1).timeline||[];
  assert.ok(tl.some(e=>e.t==='note'&&/Planned 3 sections/.test(e.text)));
  assert.ok(tl.some(e=>e.t==='note'&&/Wrote 3 sections in parallel/.test(e.text)));
 }finally{server.close()}
});
