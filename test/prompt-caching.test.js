'use strict';
// Prompt caching: each change re-reads the whole app, and providers charge far less for text that
// starts the same way as last time. So the builder rules and the project files (oldest-unchanged
// first) come first, and what changes per message comes last.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-cache-'));
process.env.KAIROQ_DESIGN_BRIEF='off';process.env.KAIROQ_STRUCTURE_GATE='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),muse=require('../muse');

const file=(name,text)=>`// ${name}: ${text}.\nexport default function ${name}() {\n  return <p>${text}</p>;\n}\n`;
const reply=obj=>(opts,parse)=>Promise.resolve(parse(JSON.stringify(obj)));
function shared(a,b){let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return i}

test('consecutive changes start with the same long text, so most of the app is read from cache',async()=>{
 const meta=builder.create({name:'Cafe',owner:'owner'});await builder.initialize(meta);
 const seen=[];
 const model=obj=>(opts,parse)=>{seen.push({...opts,messages:[...opts.messages]});return reply(obj)(opts,parse)};
 await builder.edit(meta.id,'Build a cafe site',{callModel:model({message:'Built it.',files:{
  'src/App.jsx':"// App: the page.\nimport Menu from './components/Menu.jsx';\nimport Hours from './components/Hours.jsx';\nexport default function App() {\n  return (<main><Menu /><Hours /></main>);\n}\n",
  'src/components/Menu.jsx':file('Menu','Espresso 3 dollars, flat white 4 dollars'),
  'src/components/Hours.jsx':file('Hours','Open 7 to 4 every day')}})});
 await builder.edit(meta.id,'Change the hours',{callModel:model({message:'Changed the hours.',files:{'src/components/Hours.jsx':file('Hours','Open 8 to 5 every day')}})});
 await builder.edit(meta.id,'Change the hours again',{callModel:model({message:'Changed again.',files:{'src/components/Hours.jsx':file('Hours','Open 9 to 6 every day')}})});
 await builder.edit(meta.id,'One more hours change',{callModel:model({message:'Changed once more.',files:{'src/components/Hours.jsx':file('Hours','Open 10 to 7 every day')}})});
 const [,,third,fourth]=seen.map(o=>o.messages[0].content);
 // The file changed most recently is listed last, so everything before it is the same text.
 assert.ok(third.indexOf('--- src/components/Hours.jsx')>third.indexOf('--- src/components/Menu.jsx'),'the recently changed file comes after the unchanged ones');
 const same=shared(third,fourth);
 assert.ok(same>=third.indexOf('--- src/components/Hours.jsx'),'the rules and every unchanged file are a shared prefix ('+same+' characters)');
 assert.ok(same>builder.SYSTEM_PROMPT.length+200);
 // What changes per message is in the last message, not in the cached start.
 for(const o of seen){assert.doesNotMatch(o.messages[0].content,/Request: /);assert.match(o.messages.at(-1).content,/Request: /)}
 assert.equal(seen[1].cacheKey,'kairoq-'+meta.id,'one cache key per project');
});

test('Muse is billed at the cached price for cached input, and gets the project cache key',async()=>{
 assert.equal(muse.cost({prompt_tokens:50000,completion_tokens:3000}).toFixed(4),'0.0752');
 assert.equal(muse.cost({prompt_tokens:50000,completion_tokens:3000,prompt_tokens_details:{cached_tokens:40000}}).toFixed(4),'0.0313');
 let body=null;
 await muse.chat({messages:[],promptCacheKey:'kairoq-abc',env:{META_MODEL_API_KEY:'k'},fetchImpl:async(u,i)=>{body=JSON.parse(i.body);return{ok:true,json:async()=>({choices:[{message:{content:'ok'}}],usage:{}})}}});
 assert.equal(body.prompt_cache_key,'kairoq-abc');
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.match(server,/opts\.cacheKey\?\{session_id:/,'OpenRouter keeps a project on the same provider so its cache stays warm');
 assert.match(fs.readFileSync(path.join(__dirname,'../builder-costs.js'),'utf8'),/\['developer-build','muse'\]/);
});
