"use strict";
// First-build clarification should be rare: Kairoq normally chooses sensible defaults and starts.
const test=require('node:test'),assert=require('node:assert/strict');
const clarify=require('../clarify');

test('clarification is capped at one simple outcome question',()=>{
 const raw={questions:[
  {q:'What should people do first?',options:['Book something','Track something','Browse information','Another option']},
  {q:'Second question?',options:['A','B']}
 ]};
 const qs=clarify.clean(raw);
 assert.equal(qs.length,1);
 assert.deepEqual(qs[0],{q:'What should people do first?',options:['Book something','Track something','Browse information'],multi:false});
});

test('clear product requests do not interrupt the user',async()=>{
 const callModel=async()=>{throw Error('should not be called')};
 for(const prompt of [
  'Build a CRM for my sales team',
  'Make a booking website, blue and white',
  'Create a 3D restaurant menu',
  'Build an inventory dashboard',
  'Connect our booking app to an API',
  'Make a responsive mobile-friendly customer portal'
 ]){
  assert.equal(clarify.worthAsking(prompt),false,prompt);
  assert.deepEqual(await clarify.questions(prompt,{callModel}),[],prompt);
 }
});

test('only truly vague requests can trigger one question',async()=>{
 assert.equal(clarify.worthAsking('Build an app'),true);
 assert.equal(clarify.worthAsking('Make a website'),true);
 const raw={questions:[{q:'What should the app help people do',options:[
  {label:'Book or request something',detail:'A simple request or booking flow.'},
  {label:'Track information',detail:'Save and manage records.'},
  {label:'Show information',detail:'A clear website or directory.'}
 ],recommended:0}]};
 const callModel=async(o,parse)=>parse(JSON.stringify(raw));
 const qs=await clarify.questions('Build an app',{callModel});
 assert.equal(qs.length,1);
 assert.equal(qs[0].q,'What should the app help people do?');
 assert.equal(qs[0].recommended,0);
});

test('clarification never becomes a blocker when the model fails',async()=>{
 assert.deepEqual(await clarify.questions('Build an app',{callModel:async()=>{throw Error('down')}}),[]);
 assert.deepEqual(await clarify.questions('Build an app',{callModel:async(o,parse)=>parse('not json')}),[]);
});

test('one answer can still be folded into the request',()=>{
 const p=clarify.withAnswers('Build an app',[{q:'What should people do first?',a:['Track customers']}]);
 assert.equal(p,'Build an app\n\nDetails from the owner:\n- What should people do first? Track customers');
});
