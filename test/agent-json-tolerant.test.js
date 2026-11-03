'use strict';
// Free models often send a whole file inside a JSON string with real line breaks, stray
// backslashes or a trailing comma. These replies used to stop builds ("Reply was not valid JSON").
const test=require('node:test'),assert=require('node:assert');
const {parseStep,parseStepSafe,repairJson}=require('../react-agent');

const file='import React from "react";\nexport default function App(){\n\treturn <div className="p-4">Hi</div>\n}\n';

test('real line breaks and tabs inside a file string are accepted',()=>{
 const raw='{"thought":"write app","actions":[{"tool":"write_files","files":{"src/App.jsx":"'+file.replace(/"/g,'\\"')+'"}}]}';
 assert.throws(()=>JSON.parse(raw));
 const s=parseStep(raw);
 assert.equal(s.actions[0].files['src/App.jsx'],file);
});

test('backslashes JSON does not allow are kept as text',()=>{
 const raw='{"thought":"price","actions":[{"tool":"write_files","files":{"a.js":"const s = \'it\\\'s \\$5\';"}}]}';
 assert.throws(()=>JSON.parse(raw));
 const s=parseStep(raw);
 assert.equal(s.actions[0].files['a.js'],"const s = 'it\\'s \\$5';");
});

test('trailing commas and a code fence around the reply are accepted',()=>{
 const raw='```json\n{"thought":"x","actions":[{"tool":"write_files","files":{"a.css":"body{margin:0}",},},],}\n```';
 const s=parseStep(raw);
 assert.equal(s.actions[0].files['a.css'],'body{margin:0}');
});

test('commas, braces and escapes inside strings are not touched',()=>{
 const ok='{"a":"x, }\\n\\"q\\" \\u00e9","b":[1,2]}';
 assert.equal(repairJson(ok),ok);
 assert.deepEqual(JSON.parse(repairJson(ok)),JSON.parse(ok));
});

test('valid replies parse exactly as before',()=>{
 const raw=JSON.stringify({thought:'t',actions:[{tool:'write_files',files:{'src/App.jsx':file}}]});
 assert.equal(parseStep(raw).actions[0].files['src/App.jsx'],file);
});

test('a reply that is cut off still says so and names the model',()=>{
 const warn=console.warn;let logged='';console.warn=m=>{logged+=m};
 try{
  const r=parseStepSafe('{"thought":"x","actions":[{"tool":"write_files","files":{"a.js":"const a=1;\nconst b',"vendor/some-model");
  assert.match(r.invalid,/cut off/);
  assert.equal(r.model,'vendor/some-model');
  assert.match(logged,/vendor\/some-model/);
 }finally{console.warn=warn}
});

test('plain prose is still refused',()=>{
 const warn=console.warn;console.warn=()=>{};
 try{assert.ok(parseStepSafe('Sure! I will build it now.').invalid)}finally{console.warn=warn}
});
