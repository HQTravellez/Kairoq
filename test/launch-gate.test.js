"use strict";
// The launch gate (launch-gate.js): before a version goes live its money flows get checks and
// must work in the browser; a flow that cannot be checked only holds it back when no money flow
// is protected; serious code mistakes hold it back too.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-gate-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),gate=require('../launch-gate');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

const MAIN="import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n";
async function app(name,body){const meta=builder.create({name,owner:'owner'});await builder.initializeFrom(meta,{'src/main.jsx':MAIN,'src/App.jsx':'export default function App(){return <div>'+body+'</div>}\n'},'Start');return builder.loadMeta(meta.id)}
// The model: lists the given flows and writes a click-then-expect check for each.
const model=flows=>async(o,parse)=>{
 if(o.purpose==='feature-checks')return parse(JSON.stringify({flows}));
 const flow=/Flow to check: ([^:]+):/.exec(o.messages[1].content)[1];
 return parse(JSON.stringify({name:flow,steps:[{action:'click',text:flow},{action:'expect',text:'Done: '+flow}]}));
};
// The browser: flows whose expected text is in `works` succeed.
const browser=works=>async(url,o)=>({steps:o.steps.map(s=>({step:JSON.stringify(s),ok:s.action!=='expect'||works.some(w=>s.text==='Done: '+w),error:'Text not found'})),errors:[]});

test('a working money flow is protected and the version may go live',async()=>{
 const meta=await app('Trattoria','<button>Book a table</button>');
 const g=await gate.check(meta.id,meta.current_version,{callModel:model([{name:'Book a table',description:'click Book a table',money:true}]),inspect:browser(['Book a table'])});
 assert.equal(g.ok,true,JSON.stringify(g.blockers));assert.deepEqual(g.protected,['Book a table']);
 assert.equal(builder.loadMeta(meta.id).launch_gate.ok,true);
});

test('when no money flow can be shown to work, the publish is held back with the reason',async()=>{
 const meta=await app('Shop','<button>Pay deposit</button>');
 const g=await gate.check(meta.id,meta.current_version,{callModel:model([{name:'Pay deposit',description:'click Pay deposit',money:true}]),inspect:browser([])});
 assert.equal(g.ok,false);assert.equal(g.blockers[0].kind,'unchecked');assert.equal(g.blockers[0].name,'Pay deposit');
 assert.match(gate.message(g),/Not checked: Pay deposit[\s\S]*publish anyway/);
});

test('one protected money flow is enough; the others become warnings',async()=>{
 const meta=await app('Spa','<button>Book a massage</button><button>Pay online</button>');
 const g=await gate.check(meta.id,meta.current_version,{callModel:model([{name:'Book a massage',description:'click',money:true},{name:'Pay online',description:'click',money:true}]),inspect:browser(['Book a massage'])});
 assert.equal(g.ok,true);assert.deepEqual(g.warnings.map(w=>w.name),['Pay online']);
});

test('a saved check that fails, or a secret in the page, holds the publish back',async()=>{
 const meta=await app('Keys',"<button>Sign up</button>");
 await builder.saveSource(meta.id,{...builder.loadFiles(meta.id,meta.current_version),'src/key.js':"export const KEY='sk_live_abcdefghijklmnop1234';\n"},{summary:'key'});
 const n=builder.loadMeta(meta.id).current_version;
 require('../react-checks').save(meta.id,{name:'Sign up',steps:[{action:'click',text:'Sign up'},{action:'expect',text:'Done: Sign up'}]});
 const g=await gate.check(meta.id,n,{inspect:browser([])});
 assert.equal(g.ok,false);
 assert.deepEqual(g.blockers.map(b=>b.kind).sort(),['check','security']);
 // Off: nothing is held back.
 process.env.KAIROQ_LAUNCH_GATE='off';try{assert.equal((await gate.check(meta.id,n,{inspect:browser([])})).ok,true)}finally{delete process.env.KAIROQ_LAUNCH_GATE}
});
