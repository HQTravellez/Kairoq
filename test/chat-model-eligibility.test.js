"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {isConversationalModel,conversationalFallbacks}=require('../chat-model-eligibility');
test('exclude content safety and classifier models from assistant model menu',()=>{
 for(const m of [{id:'nvidia/nemotron-3.5-content-safety',name:'Nemotron 3.5 Content Safety'},{id:'vendor/safe',name:'Safety Classifier'},{id:'vendor/xyz-moderation',name:'Moderation'}])
  assert.equal(isConversationalModel(m),false,m.name);
 assert.equal(isConversationalModel({id:'nvidia/nemotron-3-super-120b-a12b:free',name:'Nemotron Super'}),true);
});
test('free fallback only selects conversational models',()=>{
 const models=[{id:'nvidia/content-safety:free',name:'Content Safety',isFree:true,context_length:300000},{id:'nvidia/nemotron-3-super:free',name:'Nemotron Super',isFree:true,context_length:120000},{id:'vendor/paid',name:'Paid',isFree:false,context_length:1000000}];
 assert.deepEqual(conversationalFallbacks(models,'',3),['nvidia/nemotron-3-super:free']);
});
