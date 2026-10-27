'use strict';
// Questions get answers, ideas are clickable, and a busy AI shows one plain line with Try again.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../builder-smalltalk'),B=require('../react-builder'),E=require('../builder-errors');
const route=m=>S.smallTalk(m)?'smalltalk':(S.questionOnly(m)||S.conversation(m))?'answer':'build';

test('asking for ideas or explanations is answered; short change requests still build',()=>{
 for(const m of ['can you suggest what else','can you suggest what elsw?','anything else','anythign else','anything more','any ideas?','what should we add next','ok but why','really?','is the form saving?','hi, why did the build fail?'])assert.equal(route(m),'answer',m);
 for(const m of ['bigger','dark mode','more photos','booking form','navy and gold','add a gallery','suggest a gallery and add it'])assert.equal(route(m),'build',m);
 assert.equal(S.smallTalk('hello what can you do'),'help');
 assert.equal(S.smallTalk('hi how are you doing today'),'greeting');
});

test('IDEA lines become clickable ideas and leave the answer text',()=>{
 const r=B.splitIdeas('Two ideas:\n1. Opening hours.\n2. Gift cards.\nIDEA: Add opening hours and the address to the footer\nIDEA: Add gift cards','what else?');
 assert.deepEqual(r.ideas,['Add opening hours and the address to the footer','Add gift cards']);
 assert.doesNotMatch(r.text,/IDEA:/);
 assert.deepEqual(B.splitIdeas('The form saves bookings.','is it saving?').ideas,[]);
});

test('a builder reply in plain text is shown as an answer, not a failure',()=>{
 assert.equal(B.parseEdit('Here are three things to add next: opening hours, a booking calendar and reviews.').answer,true);
 assert.equal(B.parseEdit(JSON.stringify({message:'The booking form already saves to your database.'})).answer,true);
 assert.throws(()=>B.parseEdit('{"files":{"src/App.jsx":"cut off'),/not JSON/);
});

test('provider failures read as one plain line; real problems keep their words',()=>{
 for(const raw of ['No coding model returned usable project files. nvidia/nemotron: Provider returned error','openrouter/free: The operation was aborted due to timeout','HTTP 429 Too Many Requests'])assert.equal(E.plain(Error(raw)).text,E.BUSY_TEXT,raw);
 assert.equal(E.plain(Error('That change does not build: missing import')).busy,false);
});

test('the server keeps failed messages, answers questions with chat models, and never charges for answers',()=>{
 const api=fs.readFileSync(path.join(__dirname,'../create-api.js'),'utf8'),server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8');
 assert.match(api,/require\('\.\/builder-errors'\)\.remember\(builder,id/);
 assert.match(api,/job\.result\.answered&&!job\.refunded/);
 assert.match(server,/if\(opts\.tier==="chat"\)return callChatAnswer\(opts,parse\);/);
 assert.match(server,/KAIROQ_BUILDER_FREE_FALLBACKS/);
 assert.match(ui,/'Try again'/);
 assert.match(ui,/idea-list/);
 assert.match(ui,/Thinking about ideas for your app/);
 assert.doesNotMatch(ui,/if\(current\.stream\?\.text\)\{const next=messageItem\(\{role:'assistant',text:current\.stream\.text\}\)/,'no flickering half-written answers');
});

test('saving a failure keeps the message and a retry',()=>{
 let meta={messages:[{role:'user',text:'old'},{role:'assistant',text:'ok'}]};
 const fake={loadMeta:()=>meta,saveMeta:m=>{meta=m}};
 E.remember(fake,'p',{message:'can you suggest what else',mode:'build',text:E.BUSY_TEXT});
 assert.equal(meta.messages.at(-2).text,'can you suggest what else');
 assert.equal(meta.messages.at(-1).retry,'can you suggest what else');
 assert.equal(meta.messages.at(-1).failed,true);
});

test('a failed model chain is tried once more before the owner sees anything, and never says "busy"',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8'),api=fs.readFileSync(path.join(__dirname,'../create-api.js'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8');
 assert.match(server,/opts\.onRetry\?\.\(\);[\s\S]{0,400}return callBuilderModelOnce\(opts,parse\)/);
 assert.match(server,/Last: the same free route the main chat uses/);
 assert.match(api,/progress:RETRY/);
 assert.doesNotMatch(E.BUSY_TEXT+ui,/AI is busy/);
});

test('a change the builder could not fit is told plainly, without file names or code',()=>{
 const said=require('../builder-errors').plain(Error('The change could not be built after 3 attempts. Last problem: src/components/search/FlightSearchForm.jsx: edit 1 (find "Compare example fares") was not found'));
 assert.equal(said.text,"I couldn't finish this change, even after several tries, so your app is as it was. Press Try again: it often works the second time.");
 assert.match(said.raw,/FlightSearchForm/,'the details stay in the logs');
});
