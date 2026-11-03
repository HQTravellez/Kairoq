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
const LONG=" Plans, features and prices for small firms, with invoicing, bank feeds, reports and payroll options explained.";
const PAGES={"http://127.0.0.1:9/wave":{title:"Wave pricing",text:"Wave: free accounting, paid payroll."+LONG},"http://127.0.0.1:9/xero":{title:"Xero plans",text:"Xero: Starter, Standard, Premium plans."+LONG},"http://127.0.0.1:9/site":{title:"Acme",text:"Acme sells bikes."+LONG},
 "http://127.0.0.1:9/xero-block":{title:"Just a moment...",text:"Checking your browser before accessing the site. Enable JavaScript and cookies to continue."+LONG}};

test("plain plan: the topic only; a comparison becomes focused searches",()=>{
 assert.deepEqual(web.plainPlan("check https://xero.com/pricing and wave.com"),[{open:"https://xero.com/pricing"},{open:"https://wave.com"}]);
 assert.deepEqual(web.plainPlan("hi compare xero and wave"),[{search:"xero vs wave",openTop:1},{search:"xero pricing features",openTop:1},{search:"wave pricing features",openTop:1}]);
 assert.equal(web.topicOf("Compare Wave and Xero for a small accounting firm. Research it and show it as a table."),"Compare Wave and Xero for a small accounting firm");
 assert.equal(web.topicOf("i want you search actual xero and wave"),"xero and wave");
 assert.equal(web.topicOf("I WANT YOU RESEARCHA ND CHECK ND THEN TELL ME\n\nwhat is the latest notion pricing"),"what is the latest notion pricing");
 assert.deepEqual(web.plainPlan("hi"),[]);
});

test("only pages about the question are read: no dictionaries, no text-diff tools, no bot-check pages",()=>{
 const urls=["https://dictionary.cambridge.org/dictionary/english/hi","https://www.merriam-webster.com/dictionary/hi","https://www.diffchecker.com/","https://text-compare.com/","https://www.xero.com/ca/pricing/","https://www.waveapps.com/pricing"];
 assert.deepEqual(web.relevant(urls,"xero vs wave"),["https://www.xero.com/ca/pricing/","https://www.waveapps.com/pricing"]);
 assert.equal(web.blockedPage("Just a moment...",""),true);
 assert.equal(web.blockedPage("Acme docs","GET /v1/rooms returns the rooms as JSON."),false,"a short real page is read");
 assert.equal(web.blockedPage("Access denied","x".repeat(400)),true);
 assert.equal(web.blockedPage("Xero pricing","Plans for every business. "+"x".repeat(200)),false);
});

test("a follow-up that names its own topic is not glued to the previous message",()=>{
 assert.deepEqual(web.keyWords(web.topicOf("research it and tell me")),[]);
 assert.deepEqual(web.keyWords(web.topicOf("i want you search actual xero and wave")),["xero","wave"]);
 const api=fs.readFileSync(path.join(root,"create-api.js"),"utf8");
 assert.match(api,/!web\.keyWords\(web\.topicOf\(askText\)\)\.length/);
});

test("with every model down, a comparison still searches each side, skips blocked pages and reads real ones",async()=>{
 const frames=[],searched=[];
 const results={"wave vs xero":["https://dictionary.cambridge.org/dictionary/english/hi","http://127.0.0.1:9/xero-block","http://127.0.0.1:9/wave"],
  "wave pricing features":["http://127.0.0.1:9/wave"],"xero pricing features":["http://127.0.0.1:9/xero"]};
 const out=await web.gather("hi compare wave and xero for an accounting firm, research it and show it as a table",{
  callModel:async()=>{throw Error("OpenRouter: no credits")},
  webSearch:async q=>{searched.push(q);return results[q.toLowerCase()]||[]},
  browseSite:fakeBrowse(PAGES),onBrowser:f=>frames.push(f)
 });
 assert.deepEqual(searched,["wave vs xero","wave pricing features","xero pricing features"]);
 assert.deepEqual(out.sources.map(s=>s.title),["Wave pricing","Xero plans"],"the bot-check page and the dictionary are not sources");
 const last=frames.at(-1);
 assert.ok(last.steps.some(s=>/Skipped 127\.0\.0\.1 \(the site would not let us read it\)/.test(s)));
 assert.ok(!last.steps.some(s=>/cambridge/.test(s)),"the dictionary is never opened");
 assert.match(last.steps.at(-1),/Done: read 2 pages/);
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

test("the builder researches on the free route, streams each page live, and shows a quiet sources line",()=>{
 const api=fs.readFileSync(path.join(root,"create-api.js"),"utf8");
 assert.match(api,/gather\([^\n]*\{callModel:\(o,p\)=>callModel\(\{\.\.\.o,tier:'chat',freeOnly:true\},p\),tier:'chat'/);
 assert.match(api,/live\.watch\(v\.owner,p,'kairoq'\)/);
 assert.match(api,/route==='\/live-browser\/stream'/);
 const ui=fs.readFileSync(path.join(root,"public/create.js"),"utf8");
 assert.doesNotMatch(ui,/Show browsing/);
 assert.match(ui,/'Read '\+list\.length\+' page'/);
 const html=fs.readFileSync(path.join(root,"public/create.html"),"utf8");
 assert.match(html,/id="web-browser-url" type="text"/);
 assert.doesNotMatch(html,/web-browser-log/);
 assert.doesNotMatch(html,/calm\.css\?v=1"/);assert.doesNotMatch(html,/create\.js\?v=20261141"/);
});

test("Discuss answers like a consultant: direct answer first, tables for comparisons, honest sources",()=>{
 const src=fs.readFileSync(path.join(root,"react-builder.js"),"utf8");
 const prompt=/const DISCUSS_PROMPT=`[\s\S]*?`;/.exec(src)[0];
 assert.match(prompt,/no plan to change this app/);
 assert.match(prompt,/Open with the direct answer/);
 assert.match(prompt,/give a Markdown table/);
 assert.match(prompt,/cite the pages as \[1\], \[2\]/);
 assert.match(prompt,/never say you researched/);
});

test("search phrases drop how-to-answer words, and only results about the question are read",async()=>{
 assert.equal(web.searchQuery("Compare Wave and Xero for a small accounting firm. Research it and show it as a table."),"Compare Wave and Xero for a small accounting firm");
 assert.deepEqual(web.keyWords("Compare Wave and Xero for a small accounting firm"),["wave","xero","accounting"]);
 const opened=[];
 const out=await web.gather("Compare Wave and Xero for a small accounting firm. Research it and show it as a table.",{
  callModel:async()=>{throw Error("no model")},
  webSearch:async()=>["https://www.diffchecker.com/text-compare/","http://127.0.0.1:9/xero","https://text-compare.com/","http://127.0.0.1:9/wave"],
  browseSite:async(u,o)=>{opened.push(u);return fakeBrowse({...PAGES,"http://127.0.0.1:9/xero":{title:"Xero plans",text:"Xero plans: Ignite, Grow and Comprehensive, priced per month."},"http://127.0.0.1:9/wave":{title:"Wave pricing",text:"Wave pricing: the Starter plan is free; Pro is paid monthly."}})(u,o)}
 });
 assert.deepEqual(opened,["http://127.0.0.1:9/xero","http://127.0.0.1:9/wave"],"text-compare tools are skipped");
 assert.deepEqual(out.sources.map(s=>s.title),["Xero plans","Wave pricing"]);
});

test("a new chat from the home page is greeted like a person, not asked what 'New chat' should do",()=>{
 const S=require("../builder-smalltalk");
 const r=S.reply("greeting",{name:"New chat",messages:[],versions:[]});
 assert.match(r,/^Hi! What would you like to build, or talk through first\?/);
 assert.doesNotMatch(r,/New chat should do/);
});
