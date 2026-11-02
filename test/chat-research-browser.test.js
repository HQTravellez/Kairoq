"use strict";
// Research happens even when no model can plan it: pasted links are opened, "research / compare"
// requests are searched and their top results read, and each step reaches the browser pane.
process.env.NODE_ENV="test";process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL="1";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const web=require("../web");
const root=path.join(__dirname,"..");

// A fake browser: pages are plain objects, no Chromium needed.
function fakeBrowse(pages){
 return async url=>{let here=url;return{observe:async()=>({title:pages[here]?.title||"Untitled",text:pages[here]?.text||"",elements:[]}),url:()=>here,screenshot:async()=>"data:image/jpeg;base64,AAAA",close:async()=>{}}};
}
const PAGES={"http://127.0.0.1:9/wave":{title:"Wave pricing",text:"Wave: free accounting, paid payroll."},"http://127.0.0.1:9/xero":{title:"Xero plans",text:"Xero: Starter, Standard, Premium plans."},"http://127.0.0.1:9/site":{title:"Acme",text:"Acme sells bikes."}};

test("plain plan: links are opened, research requests are searched (typos and filler removed)",()=>{
 assert.deepEqual(web.plainPlan("check https://xero.com/pricing and wave.com"),[{open:"https://xero.com/pricing"},{open:"https://wave.com"}]);
 assert.deepEqual(web.plainPlan("I WANT YOU RESEARCHA ND CHECK ND THEN TELL ME\n\ncompare wave and xero"),[{search:"compare wave and xero",openTop:2}]);
 assert.deepEqual(web.plainPlan("hi"),[]);
});

test("with every model down, a research request still searches, reads the top pages and reports each step",async()=>{
 const frames=[],searched=[];
 const out=await web.gather("compare wave and xero for an accounting firm",{
  callModel:async()=>{throw Error("OpenRouter: no credits")},
  webSearch:async q=>{searched.push(q);return["http://127.0.0.1:9/wave","http://127.0.0.1:9/xero","http://127.0.0.1:9/site"]},
  browseSite:fakeBrowse(PAGES),onBrowser:f=>frames.push(f)
 });
 assert.deepEqual(searched,["compare wave and xero for an accounting firm"]);
 assert.deepEqual(out.sources.map(s=>s.title),["Wave pricing","Xero plans"],"top two results read");
 assert.match(out.context,/^Web research done for this request/);
 assert.match(out.context,/Xero: Starter, Standard, Premium/);
 const last=frames.at(-1);
 assert.ok(last.steps.length>=5);
 assert.match(last.steps[0],/^Step 1 · Deciding what to look up$/);
 assert.ok(last.steps.some(s=>/^Step \d+ · Searching the web for "compare wave and xero/.test(s)));
 assert.ok(last.steps.some(s=>/^Step \d+ · Reading 127\.0\.0\.1/.test(s)));
 assert.match(last.steps.at(-1),/Done: read 2 pages/);
 assert.ok(frames.some(f=>f.screenshot==="data:image/jpeg;base64,AAAA"),"screenshots reach the pane");
 assert.deepEqual(out.steps,last.steps.map(s=>s.replace(/^Step \d+ · /,"")));
});

test("a pasted link is always opened, even when the model plans only a search",async()=>{
 const opened=[];
 const browse=fakeBrowse(PAGES);
 const out=await web.gather("what does http://127.0.0.1:9/site sell?",{
  callModel:async(_o,parse)=>parse(JSON.stringify({web:[{search:"acme bikes"}]})),
  webSearch:async()=>[],
  browseSite:async(u,o)=>{opened.push(u);return browse(u,o)}
 });
 assert.equal(opened[0],"http://127.0.0.1:9/site");
 assert.deepEqual(out.sources.map(s=>s.title),["Acme"]);
});

test("the builder plans research on the free route, keeps the steps on the answer, and shows Show browsing",()=>{
 const api=fs.readFileSync(path.join(root,"create-api.js"),"utf8");
 assert.match(api,/gather\([^\n]*\{callModel:\(o,p\)=>callModel\(\{\.\.\.o,tier:'chat',freeOnly:true\},p\),tier:'chat'/);
 assert.match(api,/lastMsg\.browsing=\{steps:research\.steps\.slice\(0,30\)/);
 const ui=fs.readFileSync(path.join(root,"public/create.js"),"utf8");
 assert.match(ui,/'Show browsing \('\+m\.browsing\.steps\.length\+' steps\)'/);
 assert.match(ui,/window\.kairoqBrowserPane\.show\(\{url:m\.browsing\.url,title:m\.browsing\.title,steps:m\.browsing\.steps\}\)/);
 const html=fs.readFileSync(path.join(root,"public/create.html"),"utf8");
 assert.match(html,/calm\.css\?v=2"/);assert.match(html,/create\.js\?v=20261102"/);
});

test("Discuss answers like a consultant: direct answer first, tables for comparisons, honest sources",()=>{
 const src=fs.readFileSync(path.join(root,"react-builder.js"),"utf8");
 const prompt=/const DISCUSS_PROMPT=`[\s\S]*?`;/.exec(src)[0];
 assert.match(prompt,/Open with the direct answer/);
 assert.match(prompt,/give a Markdown table/);
 assert.match(prompt,/cite the pages as \[1\], \[2\]/);
 assert.match(prompt,/never say you researched/);
});
