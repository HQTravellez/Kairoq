"use strict";
// The chat talks in sentences: a Discuss reply never streams JSON or a raw QUESTION line.
const test=require('node:test'),assert=require('node:assert/strict');
const {streamSnapshot}=require('../create-api');

test('a Discuss reply in the builder\'s JSON format streams as its message and plan',()=>{
 const s=streamSnapshot('{"plan":["Add a booking flow","Add a form"],"message":"Here is the plan.","before_building":"Request or','discuss');
 assert.equal(s.text,'Here is the plan.\n\n- Add a booking flow\n- Add a form');
 assert.doesNotMatch(s.text,/[{}"]/);
 assert.doesNotMatch(streamSnapshot('```json\n{"plan":["A"]','discuss').text,/[{}`]/);
});

test('the QUESTION line streams as just the question; plain answers pass through',()=>{
 assert.equal(streamSnapshot('1. Add a form\nQUESTION: Request or instant? | Request | Instant','discuss').text,'1. Add a form\n\nRequest or instant?');
 assert.equal(streamSnapshot('Plain answer so far','discuss').text,'Plain answer so far');
});
