'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const builder=require('../react-builder');

test('files a model places without src/ (or with ./ or /) land in src/; unsafe paths stay rejected',()=>{
 const r=builder.parseEdit(JSON.stringify({message:'x',files:{'backend.json':'{}','./src/App.jsx':'a','/src/pages/Menu.jsx':'b','App.css':'c','functions/send.js':'d','../evil.js':'e'},edits:{'pages/Home.jsx':[{find:'a',replace:'b'}]},delete:['old.jsx']}));
 assert.deepEqual(Object.keys(r.files).sort(),['../evil.js','functions/send.js','src/App.css','src/App.jsx','src/backend.json','src/pages/Menu.jsx']);
 assert.deepEqual(Object.keys(r.edits),['src/pages/Home.jsx']);
 assert.deepEqual(r.delete,['src/old.jsx']);
 assert.ok(builder.validateFiles({'../evil.js':'x'}).some(e=>/Invalid file path: \.\.\/evil\.js/.test(e)));
});
