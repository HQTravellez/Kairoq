"use strict";
// Replies shaped like Lovable's: Done / Not done / What I'd do next after work, tap-able follow-ups
// after Discuss answers, dividers, and a Copy / thumbs row kept on the message.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const js=fs.readFileSync(path.join(root,"public/create.js"),"utf8"),g=re=>{const m=re.exec(js);assert.ok(m,String(re));return m[0]};

test("after work the reply has Done, Not done and numbered next steps; Discuss ends with follow-ups",()=>{
 const contract=require("../agent-response-contract").prompt();
 assert.match(contract,/\*\*Done:\*\*/);assert.match(contract,/\*\*Not done:\*\*/);assert.match(contract,/What I'd do next, in this order:/);
 const rb=fs.readFileSync(path.join(root,"react-builder.js"),"utf8");
 assert.match(/const DISCUSS_PROMPT=`[\s\S]*?`;/.exec(rb)[0],/End every answer with 2 or 3 follow-ups[\s\S]*IDEA:/);
});

test("rating an answer is kept on that message, found by its time; other messages are untouched",async()=>{
 const api=fs.readFileSync(path.join(root,"create-api.js"),"utf8");
 assert.match(api,/'POST:\/rating':'editor'/);
 const block=/if\(action==='\/rating'&&method==='POST'\)\{[\s\S]*?return send\(res,200,\{rating:m\.rating\|\|null\}\),true;\n  \}/.exec(api)[0];
 const meta={messages:[{role:"user",text:"hi",at:"t1"},{role:"assistant",text:"Hello",at:"t2"},{role:"assistant",text:"Second",at:"t3"}]};
 let saved=null;const sent=[];
 const run=new Function("action","method","readJson","req","res","builder","id","send",block.replace(/^if\(action/,"return (async()=>{if(action")+"})()");
 const call=body=>run("/rating","POST",async()=>body,{},{},{loadMeta:()=>meta,saveMeta:m=>{saved=m}},"p",(r,c,b)=>{sent.push([c,b]);return true});
 await call({at:"t3",rating:"up"});
 assert.equal(meta.messages[2].rating,"up");assert.equal(meta.messages[1].rating,undefined);assert.ok(saved);
 await call({at:"t3",rating:null});assert.equal(meta.messages[2].rating,undefined);
 await assert.rejects(call({at:"t1",rating:"up"}),/not found/,"a user message cannot be rated");
});

test("the page shows Copy / thumbs under answers and renders --- as a divider",{timeout:60000},async()=>{
 assert.match(js,/li\.append\(replyActions\(m,index\)\)/);
 assert.match(js,/api\('\/projects\/'\+state\.project\.id\+'\/rating',\{method:'POST',body:\{at:m\.at,rating:next\}\}\)/);
 const {chromium}=require("playwright");
 const code=[g(/function el\(tag,cls,txt\)\{[^\n]+\n/),g(/function inlineMd\(parent,textIn\)\{[^\n]+\n/),g(/function tableLines\(src\)\{[^\n]+\n/),g(/function tableCells\(line\)\{[^\n]+\n/),g(/function renderMarkdown\(src\)\{[\s\S]*?\n\}\n/)].join("");
 const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 try{const p=await b.newPage();const out=await p.evaluate(([c])=>{const r=new Function(c+";return renderMarkdown")()("Published.\n\n---\n\n**Done:** checked the site.");return{hr:r.querySelectorAll("hr").length,ps:r.querySelectorAll("p").length}},[code]);assert.deepEqual(out,{hr:1,ps:2})}
 finally{await b.close()}
 const css=fs.readFileSync(path.join(root,"public/calm.css"),"utf8");
 assert.match(css,/\.reply-act\[aria-pressed="true"\]/);
});
