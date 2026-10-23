'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const choices=require('../model-choices');

test('Auto comes first; named models are listed but off until OpenRouter and paid builds are on',()=>{
 const off=choices.list({});
 assert.equal(off[0].id,'auto');assert.equal(off[0].enabled,true);
 assert.ok(off.length>1&&off.slice(1).every(m=>m.enabled===false));
 assert.equal(choices.pick('anthropic/claude-opus-5.5',{}),null,'a named model without OpenRouter means Auto');
 const env={OPENROUTER_API_KEY:'x',KAIROQ_BUILDER_PAID_APPROVED:'true'};
 const on=choices.list(env);
 assert.ok(on.slice(1).every(m=>m.enabled));
 const fable=on.find(m=>m.id==='anthropic/claude-fable-5.1');
 assert.ok(fable.top&&fable.costlier,'the strongest model is marked top pick and costlier');
 assert.equal(choices.pick('anthropic/claude-opus-5.5',env).credits,10);
 assert.equal(choices.pick('made/up-model',env),null,'unknown ids mean Auto');
 assert.equal(choices.pick('auto',env),null);
});

test('KAIROQ_MODEL_CHOICES replaces the list, and "off" leaves only Auto',()=>{
 const env={OPENROUTER_API_KEY:'x',KAIROQ_BUILDER_PAID_APPROVED:'true',KAIROQ_MODEL_CHOICES:'deepseek/deepseek-v3.2=DeepSeek:2; bad entry; openai/gpt-6=GPT-6:7'};
 const list=choices.list(env);
 assert.deepEqual(list.map(m=>m.id),['auto','deepseek/deepseek-v3.2','openai/gpt-6']);
 assert.equal(list[2].credits,7);assert.equal(list[1].note,'Low cost, good for small edits','known models keep their description');
 assert.deepEqual(choices.list({...env,KAIROQ_MODEL_CHOICES:'off'}).map(m=>m.id),['auto']);
});
