'use strict';
// Kairoq talks like Lovable while it works: each step has a short past-tense heading ("Planned the
// schedule page") with its plain thinking folded under it and one line to the owner; the change is
// one card (title, Details, Preview); one live line sits above the message box with Stop.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-lc-'));
Object.assign(process.env,{KAIROQ_REACT_PROJECTS_DIR:root,KAIROQ_AUTONOMY_DIR:path.join(root,'learning'),KAIROQ_DESIGN_BRIEF:'off',KAIROQ_PARALLEL_WRITERS:'off',KAIROQ_AGENT_REPLY:'off'});
const agent=require('../react-agent'),builder=require('../react-builder');
const pub=path.join(__dirname,'..','public');

test('a step carries a heading, a line to the owner and a folded note; finish carries a title',()=>{
 const r=agent.parseStep(JSON.stringify({step:'  Planned the schedule page ',say:"I'll add a schedule page.",thought:'New page from the menu.',actions:[{tool:'read_files',paths:['src/App.jsx']}]}));
 assert.equal(r.step,'Planned the schedule page');assert.equal(r.say,"I'll add a schedule page.");
 const p=agent.protocol({maxSteps:10});
 assert.match(p,/"step":"3 to 6 words, past tense/);assert.match(p,/"tool":"finish","title":"3 to 6 words naming the change/);
});

test('the timeline keeps each heading with its line and note',async()=>{
 const meta=builder.create({name:'Yoga',owner:'owner'});await builder.initialize(meta);
 let n=0;
 const callModel=async(o,parse)=>{n++;return parse(JSON.stringify({step:'Looked at the app',say:'Let me look at the app first.',thought:'Read App.jsx.',actions:[{tool:'read_files',paths:['src/App.jsx']}]}))};
 await agent.run(meta.id,'Add a class schedule',{callModel,maxSteps:2});
 const tl=builder.loadMeta(meta.id).messages.at(-1).timeline||[];
 const say=tl.filter(e=>e.t==='say');
 assert.equal(say.length,1,'a repeated line is shown once');
 assert.deepEqual({title:say[0].title,text:say[0].text,note:say[0].note},{title:'Looked at the app',text:'Let me look at the app first.',note:'Read App.jsx.'});
});

test('the chat renders the story, one result card and the live line',()=>{
 const js=fs.readFileSync(path.join(pub,'create.js'),'utf8'),css=fs.readFileSync(path.join(pub,'ui','forma.css'),'utf8'),html=fs.readFileSync(path.join(pub,'create.html'),'utf8');
 assert.match(js,/const story=storyRows\(tl\);if\(story\)li\.append\(story\);/);
 assert.match(js,/if\(m\.version&&index>=0\)li\.append\(resultCard\(m,index\)\)/);
 assert.match(js,/det\.onclick=\(\)=>openDetail\(index,'timeline'\)/);
 assert.match(js,/setPreview\(previewFor\(m\.version\)\)/);
 assert.match(js,/liveStrip\(j\);/);assert.match(js,/renderBuildOverlay\(null\);liveStrip\(null\);/);
 assert.ok(html.indexOf('id="ks-strip"')<html.indexOf('id="chat-form"'),'the live line sits above the message box');
 assert.match(js,/\$\('ks-strip-stop'\)\.onclick=\(\)=>\$\('stop-job'\)\.click\(\)/);
 assert.match(css,/\.ks-card-btns\{display:grid;grid-template-columns:1fr 1fr/);
});
