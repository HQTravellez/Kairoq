"use strict";
// The builder's question before it builds: read from any reply, answered by a click, "ok" or a number.
const test=require('node:test'),assert=require('node:assert/strict');
const Q=require('../builder-question');
const {parseEdit}=require('../react-builder');

// The reply an owner actually got: a plan plus a question under a key the model made up.
const PASTED={plan:['Add a booking flow for stay dates, guest count, available room types, and rate selection in src/App.jsx.'],before_building:'Should a guest’s booking be a request for the hotel to confirm, or an instantly confirmed reservation? Instant confirmation requires real room inventory and rates; I won’t invent those.'};

test('a question-only build reply is accepted, not rejected as missing files',()=>{
 const r=parseEdit(JSON.stringify({plan:['Add a booking form'],message:'One choice first.',question:{text:'Request or instant booking?',options:['Request the hotel confirms','Instant booking'],recommended:0}}));
 assert.deepEqual(r.files,{});
 assert.deepEqual(r.question,{text:'Request or instant booking?',options:['Request the hotel confirms','Instant booking'],recommended:0});
 assert.ok(parseEdit(JSON.stringify(PASTED)).question.text.startsWith('Should a guest’s booking'));
 assert.throws(()=>parseEdit(JSON.stringify({message:'nothing'})),/needs a "files" object/);
});

test('discuss replies: a QUESTION line or a copied JSON reply becomes a question',()=>{
 const a=Q.fromText('1. Add a booking form\n2. Save requests\nQUESTION: Request or instant booking? | Request the hotel confirms | Instant booking');
 assert.equal(a.text,'1. Add a booking form\n2. Save requests');
 assert.deepEqual(a.question,{text:'Request or instant booking?',options:['Request the hotel confirms','Instant booking'],recommended:0});
 const b=Q.fromText(JSON.stringify(PASTED));
 assert.match(b.text,/^- Add a booking flow/);
 assert.match(b.question.text,/request for the hotel to confirm/);
 assert.deepEqual(Q.fromText('Plain answer.'),{text:'Plain answer.',question:null});
});

test('"ok", "yes", a number or an option answers the open question; a new request does not',()=>{
 const q={text:'Request or instant booking?',options:['Request the hotel confirms','Instant booking'],recommended:0};
 for(const ok of ['ok','OK.','yes','Yes!','go ahead','sounds good','👍'])assert.equal(Q.answer(ok,q).choice,'Request the hotel confirms',ok);
 assert.equal(Q.answer('2',q).choice,'Instant booking');
 assert.equal(Q.answer('instant booking',q).choice,'Instant booking');
 assert.match(Q.answer('ok',q).message,/Do not ask this again: build it now/);
 assert.equal(Q.answer('Add a gallery page',q),null);
 assert.equal(Q.answer('ok',null),null);
});

test('the open question is the builder\'s last message, structured or asked in prose',()=>{
 const q={text:'Request or instant?',options:['A','B'],recommended:0};
 assert.deepEqual(Q.pending({messages:[{role:'user',text:'x'},{role:'assistant',text:'…',question:q}]}),q);
 const prose=Q.pending({messages:[{role:'assistant',text:'Do you mean a request, or instant confirmation?'}]});
 assert.deepEqual(prose.options,[]);
 assert.match(Q.answer('ok',prose).message,/the option you recommended/);
 assert.equal(Q.pending({messages:[{role:'assistant',text:'Done.'}]}),null);
 assert.equal(Q.pending({messages:[{role:'assistant',text:'Which?',question:q},{role:'user',text:'B'}]}),null);
});

test('the model sees the options it offered in the chat history',()=>{
 assert.equal(Q.historyText({text:'Pick one.',question:{text:'?',options:['A','B'],recommended:1}}),'Pick one.\nOptions: 1) A  2) B (recommended)');
 assert.equal(Q.historyText({text:'Done.'}),'Done.');
});
