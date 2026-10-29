"use strict";
// Kairoq's reference library: every build-your-own-x tutorial (359 in 31 topics), a playbook per
// topic, and notes Kairoq writes once per tutorial and keeps, so builds use them without reading
// the article again (builder-references.js).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-refs-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const R=require('../builder-references'),T=require('../builder-tools');

const ARTICLE='<html><body><article><h1>Write a physics engine</h1>'+'<p>Integrate velocity with a fixed time step, detect collisions with a broad phase grid and resolve them with impulses. '.repeat(30)+'</p></article></body></html>';
const remote=async url=>({bytes:Buffer.from(/video/.test(url)?'<html><body>Watch</body></html>':ARTICLE),type:'text/html'});
const NOTES='What gets built: a small 2D physics engine.\n'+'Steps: fixed time step, broad phase, narrow phase, impulse resolution. '.repeat(12);
let calls=0;const callModel=async(o,parse)=>{calls++;assert.match(o.messages[0].content,/YOUR OWN WORDS/);assert.equal(o.purpose,'reference-notes');return parse(NOTES)};

test('the whole catalogue is there, and every topic has a playbook',()=>{
 const c=R.catalog();
 assert.equal(c.tutorials.length,359);assert.equal(c.topics.length,31);
 assert.match(c.license,/CC0/);
 for(const t of c.topics)assert.ok(R.TOPICS[t]&&R.TOPICS[t].text.length>150,'playbook for '+t);
 assert.equal(new Set(c.tutorials.map(x=>x.url)).size,359,'no duplicates');
 assert.equal(R.TOPICS['Operating System'].app,false,'says honestly what cannot run in an app');
});

test('requests find their topics; lookups list web tutorials first',()=>{
 assert.deepEqual(R.topicsFor('A snake game with physics and a leaderboard'),['Game','Physics Engine']);
 assert.ok(R.topicsFor('Build an iPhone AR coloring book app').includes('Augmented Reality'));
 assert.deepEqual(R.topicsFor('A booking site for my salon'),[]);
 const {topic,rows}=R.tutorials('Physics Engine');
 assert.equal(topic,'Physics Engine');assert.match(rows[0].language,/JavaScript|TypeScript/);
 const said=R.lookup('physics');
 assert.match(said,/Playbook: A physics engine steps the world/);assert.match(said,/not learned yet/);
 assert.match(R.note('a mini game'),/FROM THE REFERENCE LIBRARY.*Game/s);
});

test('learning: notes are written once, in Kairoq\'s own words, and used without reading again',async()=>{
 const item=R.tutorials('Physics Engine').rows[0];
 const saved=await R.learn(item,{remote,callModel});
 assert.equal(saved.url,item.url);assert.match(saved.notes,/fixed time step/);
 assert.equal(R.savedNotes(item.url).title,item.title);
 const said=R.lookup('Physics Engine');
 assert.match(said,/What Kairoq learned from these tutorials/);assert.match(said,new RegExp('### '+item.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 // A page without real content (a video) is skipped, not stored.
 await assert.rejects(R.learn({...item,url:'https://example.com/video'},{remote,callModel}),/No readable text/);
 await assert.rejects(R.learnFromText(item,'x'.repeat(800),{callModel:async(o,p)=>p('NO CONTENT')}),/no usable/);
});

test('"Learn the library" runs over what is not learned yet, shows progress, and stops on the budget',async()=>{
 const before=R.status().learned;
 R.learnAll({remote,callModel,max:3});
 await new Promise(r=>{const t=setInterval(()=>{const s=R.status();if(!s.job.running){clearInterval(t);r()}},20)});
 const s=R.status();assert.equal(s.learned,before+3);assert.equal(s.job.done,3);assert.equal(s.total,359);
 R.learnAll({remote,callModel:async()=>{throw Error('Builder budget insufficient')},max:5});
 await new Promise(r=>{const t=setInterval(()=>{if(!R.status().job.running){clearInterval(t);r()}},20)});
 assert.match(R.status().job.last_error.error,/budget/);assert.equal(R.status().learned,before+3);
});

test('the builder\'s tools: kairoq_tutorials answers from the library; reading a library tutorial learns it',async()=>{
 T.configure({callModel});
 const t=T.forProject('x',{remote});
 assert.match(await t.run('tutorials',{topic:'Game'}),/Topic: Game\nPlaybook: A game is a loop/);
 const item=R.tutorials('Text Editor').rows[0];assert.equal(R.savedNotes(item.url),null);
 await t.run('read',{url:item.url});
 for(let i=0;i<50&&!R.savedNotes(item.url);i++)await new Promise(r=>setTimeout(r,20));
 assert.ok(R.savedNotes(item.url),'learned while the builder read it');
 T.configure({callModel:null});
});
