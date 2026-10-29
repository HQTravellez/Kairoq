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
 const s=R.status();assert.equal(s.learned+s.unlearnable,before+3,'each one learned or, for a bare video, marked');assert.equal(s.job.done+s.job.skipped,3);assert.equal(s.total,359);
 R.learnAll({remote,callModel:async()=>{throw Error('Builder budget insufficient')},max:5});
 await new Promise(r=>{const t=setInterval(()=>{if(!R.status().job.running){clearInterval(t);r()}},20)});
 assert.match(R.status().job.last_error.error,/budget/);assert.equal(R.status().learned+R.status().unlearnable,before+3);
});

test('learning with free models: their limit pauses the run (nothing counts as failed) and pressing again continues',async()=>{
 const before=R.status().learned+R.status().unlearnable;
 R.learnAll({remote,callModel:async()=>{throw Error('All builder models failed: openrouter/free: 429 Rate limit exceeded: free-models-per-day')},max:4});
 await new Promise(r=>{const t=setInterval(()=>{if(!R.status().job.running){clearInterval(t);r()}},20)});
 const s=R.status();assert.match(s.job.paused,/free AI models have reached their limit/);assert.equal(s.job.failed,0);assert.equal(s.learned+s.unlearnable,before);
 R.learnAll({remote,callModel,max:2});
 await new Promise(r=>{const t=setInterval(()=>{if(!R.status().job.running){clearInterval(t);r()}},20)});
 assert.equal(R.status().learned+R.status().unlearnable,before+2,'continues where it stopped');assert.equal(R.status().job.paused,null);
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

const PARA='<p>'+'This part explains the technique step by step with the data structure and the tests that prove it works. '.repeat(12)+'</p>';
test('a series is learned whole: Kairoq follows "Next" and numbered parts on the same site',async()=>{
 const site={
  'https://blog.example/os/part-1':'<html><body><h1>Part 1: Booting</h1>'+PARA+'<a href="/os/part-2">Next</a><a href="https://other.example/ad">Sponsor</a></body></html>',
  'https://blog.example/os/part-2':'<html><body><h1>Part 2: Memory</h1>'+PARA+'<a href="/os/part-3">Part 3</a></body></html>',
  'https://blog.example/os/part-3':'<html><body><h1>Part 3: Scheduling</h1>'+PARA+'<a href="/about">About</a></body></html>'};
 const fetched=[];const remote=async u=>{fetched.push(u);if(!site[u])throw Error('404 '+u);return{bytes:Buffer.from(site[u]),type:'text/html'}};
 let seen='';const item={url:'http://blog.example/os/part-1',title:'Write an OS',topic:'Operating System',language:'Rust'};
 const saved=await R.learn(item,{remote,callModel:async(o,p)=>{seen=o.messages[1].content;return p(NOTES)}});
 assert.deepEqual(fetched,['https://blog.example/os/part-1','https://blog.example/os/part-2','https://blog.example/os/part-3'],'https first, the whole series, nothing off-site');
 assert.equal(saved.pages,3);assert.match(seen,/This covers 3 pages/);assert.match(seen,/=== PART 3: https:\/\/blog\.example\/os\/part-3/);
});

test('a GitHub project is learned from its README, docs and main code',async()=>{
 const raw=p=>'https://raw.githubusercontent.com/ann/tiny-git/HEAD/'+p;
 const files={[raw('README.md')]:'# tiny-git\n'+'Content addressed objects, trees and commits. '.repeat(20),[raw('docs/objects.md')]:'Objects are stored by their hash. '.repeat(20),[raw('src/index.js')]:'export function hashObject(data){ /* sha1 of the header and data */ }\n'.repeat(10)};
 const remote=async u=>{if(files[u])return{bytes:Buffer.from(files[u]),type:'text/plain'};throw Error('404 '+u)};
 const fetchJson=async u=>{assert.match(u,/api\.github\.com\/repos\/ann\/tiny-git\/git\/trees\/HEAD\?recursive=1/);return{tree:[{type:'blob',path:'src/index.js',size:500},{type:'blob',path:'README.md',size:900},{type:'blob',path:'docs/objects.md',size:600},{type:'blob',path:'package-lock.json',size:900},{type:'blob',path:'test/a.test.js',size:100}]}};
 let seen='';const saved=await R.learn({url:'https://github.com/ann/tiny-git',title:'Tiny Git',topic:'Git',language:'JavaScript'},{remote,fetchJson,callModel:async(o,p)=>{seen=o.messages[1].content;return p(NOTES)}});
 assert.equal(saved.pages,3);
 assert.ok(seen.indexOf('FILE README.md')<seen.indexOf('FILE docs/objects.md')&&seen.indexOf('FILE docs/objects.md')<seen.indexOf('FILE src/index.js'),'README, then docs, then code');
 assert.doesNotMatch(seen,/package-lock|a\.test\.js/);
});

test('a video is learned from its written version; one without is marked and not tried again',async()=>{
 const page=desc=>'<html><head><meta property="og:description" content="x"></head><body><script>var y={"shortDescription":"'+desc+'"}</script></body></html>';
 const site={'https://www.youtube.com/watch?v=a':page('Build a regex engine. Written version: https://blog.example/regex'),'https://blog.example/regex':'<html><body>'+PARA+'</body></html>','https://www.youtube.com/watch?v=b':page('Subscribe! https://twitter.com/me')};
 const remote=async u=>{if(site[u])return{bytes:Buffer.from(site[u]),type:'text/html'};throw Error('404 '+u)};
 const a=await R.learn({url:'https://www.youtube.com/watch?v=a',title:'Regex video',topic:'Regex Engine',language:'Python'},{remote,callModel:async(o,p)=>p(NOTES)});
 assert.equal(a.pages,2);
 const item={url:'https://www.youtube.com/watch?v=b',title:'Video only',topic:'Shell',language:'C'};
 await assert.rejects(R.learn(item,{remote,callModel:async(o,p)=>p(NOTES)}),/No readable text/);
 assert.equal(R.savedNotes(item.url),null);assert.equal(R.readFile(item.url).skipped,true);
});

test('notes made outside Kairoq (Hermes) are imported from a JSON Lines file: only listed tutorials, real notes, nothing overwritten',()=>{
 const list=R.catalog().tutorials.filter(x=>!R.readFile(x.url)).slice(0,3),notes=('Core idea: '+'a clear explanation of each step. '.repeat(20)).trim();
 const lines=[
  JSON.stringify({url:list[0].url,notes,sources:[list[0].url,'https://example.com/part-2','javascript:alert(1)']}),
  JSON.stringify({url:list[1].url,skipped:true,reason:'video only'}),
  JSON.stringify({url:list[2].url,notes:'too short'}),
  JSON.stringify({url:'https://not-in-the-list.example/x',notes}),
  'this is not json',
 ].join('\n');
 const r=R.importNotes(lines);
 assert.deepEqual({i:r.imported,s:r.skipped_marked,t:r.too_short,n:r.not_in_list,b:r.bad_lines},{i:1,s:1,t:1,n:1,b:1});
 const saved=R.savedNotes(list[0].url);assert.equal(saved.title,list[0].title);assert.equal(saved.by,'import');assert.deepEqual(saved.sources,[list[0].url,'https://example.com/part-2']);
 assert.equal(R.readFile(list[1].url).skipped,true);
 // Already learned: kept unless replace is asked for.
 assert.equal(R.importNotes(JSON.stringify({url:list[0].url,notes:notes+' changed'})).already,1);
 assert.equal(R.savedNotes(list[0].url).notes,notes);
 assert.equal(R.importNotes(JSON.stringify({url:list[0].url,notes:notes+' changed'}),{replace:true}).imported,1);
 // A JSON array works too.
 assert.equal(R.importNotes(JSON.stringify([{url:list[2].url,notes}])).imported,1);
 assert.throws(()=>R.importNotes('[not json'),/not valid JSON/);
});
