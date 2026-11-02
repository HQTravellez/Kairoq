"use strict";
// Builder chat fixes after "helo" started a build: typo greetings, home talk opens Discuss, tables,
// honest research, a stopped build keeping its message, and quiet build-step lines.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const createJs=fs.readFileSync(path.join(root,"public/create.js"),"utf8");
const pick=re=>{const m=re.exec(createJs);assert.ok(m,"found "+re);return m[0]};

test("typo greetings are greetings, not apps; requests still build",()=>{
 const S=require("../builder-smalltalk");
 for(const t of ["helo","hii","hallo","heyy","helloo","hello there","hi"])assert.equal(S.smallTalk(t),"greeting",t);
 for(const t of ["help me build a booking site","add a pricing page","hi build a site for my bakery"])assert.equal(S.smallTalk(t),null,t);
});

test("home: a greeting or a question opens a Discuss chat; a build request builds",()=>{
 const homeTalk=new Function(pick(/const HOME_GREET=[^\n]+\n/)+pick(/const HOME_BUILD=[^\n]+\n/)+pick(/function homeTalk\(t\)\{[\s\S]*?\n\}\n/)+";return homeTalk")();
 for(const t of ["helo","hi","hey there","good morning"])assert.equal(homeTalk(t),"greeting",t);
 for(const t of ["well i want to discuss about the crm for my accounting firm","compare wave and xero","What does Xero cost?","tell me about tax deadlines"])assert.equal(homeTalk(t),"question",t);
 for(const t of ["A booking page for my yoga studio","build a CRM for my accounting firm","hi build me a landing page","Digital menu for my café"])assert.equal(homeTalk(t),null,t);
 // It opens a new chat, never the last project, and sends in Discuss.
 const block=pick(/const talk=homeTalk\(typed\);[\s\S]*?return;\n  \}/);
 assert.match(block,/api\('\/projects',\{method:'POST'/);
 assert.match(block,/setChatMode\('discuss'\);\n   await send\(typed,'discuss'\)/);
 assert.doesNotMatch(createJs,/const recent=Array\.isArray\(state\.projects\)&&state\.projects\.length\?state\.projects\[0\]/);
});

test("markdown tables render as tables, including one squashed onto one line",{timeout:60000},async()=>{
 const {chromium}=require("playwright");
 const fns=[pick(/function el\(tag,cls,txt\)\{[^\n]+\n/),pick(/function inlineMd\(parent,textIn\)\{[^\n]+\n/),pick(/function tableLines\(src\)\{[^\n]+\n/),pick(/function tableCells\(line\)\{[^\n]+\n/),pick(/function renderMarkdown\(src\)\{[\s\S]*?\n\}\n/)].join("");
 const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 try{
  const page=await browser.newPage();
  const out=await page.evaluate(([code])=>{
   const renderMarkdown=new Function(code+";return renderMarkdown")();
   const shape=n=>{const t=n.querySelector("table");return t?{head:[...t.querySelectorAll("th")].map(x=>x.textContent),rows:[...t.querySelectorAll("tbody tr")].map(r=>[...r.children].map(c=>c.textContent))}:null};
   const multi=renderMarkdown("Here is the comparison:\n\n| Feature | Wave | Xero |\n| :--- | :--- | :--- |\n| Cost | **Free** | Paid |\n| Reporting | Basic | Advanced |\n\nUse Wave for micro clients.");
   const squashed=renderMarkdown("| Feature | Wave | Xero | | :--- | :--- | :--- | | Cost | Free | Paid | | Inventory | No | Yes |");
   return{multi:shape(multi),multiText:multi.textContent,bold:!!multi.querySelector("td strong"),squashed:shape(squashed)};
  },[fns]);
  assert.deepEqual(out.multi,{head:["Feature","Wave","Xero"],rows:[["Cost","Free","Paid"],["Reporting","Basic","Advanced"]]});
  assert.ok(out.bold,"bold inside a cell");
  assert.match(out.multiText,/Here is the comparison:[\s\S]*Use Wave for micro clients\./);
  assert.deepEqual(out.squashed,{head:["Feature","Wave","Xero"],rows:[["Cost","Free","Paid"],["Inventory","No","Yes"]]});
 }finally{await browser.close()}
});

test("Discuss never claims research it did not do; typo'd research requests do research",()=>{
 const src=fs.readFileSync(path.join(root,"react-builder.js"),"utf8");
 const honest=new Function(/const CLAIMS_RESEARCH=[\s\S]*?\n\}\n/.exec(src)[0]+";return honestResearch")();
 const fake=honest("I have researched the current state of both platforms (2024-2026 data).\n\nWave is free.","");
 assert.doesNotMatch(fake,/I have researched/);
 assert.match(fake,/^This is from general knowledge, not a live web search/);
 assert.equal(honest("I have researched it.","Web research done for this request (read-only)"),"I have researched it.");
 assert.equal(honest("Wave is free.",""),"Wave is free.");
 assert.match(src,/answer=honestResearch\(answer,context\);/);
 const web=require("../web");
 assert.equal(web.needsWeb("I WANT YOU RESEARCHA ND CHECK ND THEN TELL ME"),true);
 assert.equal(web.needsWeb("hello"),false);
 const api=fs.readFileSync(path.join(root,"create-api.js"),"utf8");
 assert.match(api,/const prevAsk=String\(message\)\.trim\(\)\.split\(\/\\s\+\/\)\.length<10/,"short follow-ups research the earlier topic");
});

test("a stopped build keeps the owner's message in place, followed by a Stopped line",()=>{
 const api=fs.readFileSync(path.join(root,"create-api.js"),"utf8");
 assert.match(api,/remember\(builder,id,\{message,mode,text:controller\.signal\.aborted\?'Stopped before it finished\. Nothing was changed\.':said\.text\}\)/);
 assert.match(api,/retry:!controller\.signal\.aborted,saved:true\}\)/);
 const B=require("../builder-errors"),meta={messages:[]},fake={loadMeta:()=>meta,saveMeta:m=>Object.assign(meta,m)};
 B.remember(fake,"x",{message:"helo",mode:"build",text:"Stopped before it finished. Nothing was changed."});
 assert.deepEqual(meta.messages.map(m=>[m.role,m.text]),[["user","helo"],["assistant","Stopped before it finished. Nothing was changed."]]);
});

test("build steps are quiet light-grey lines; problems stay visible",()=>{
 const css=fs.readFileSync(path.join(root,"public/calm.css"),"utf8");
 assert.match(css,/body\.app \.ev:not\(\.bad\)[^{]*\{color:#A0A5AD!important;font-size:12\.5px!important/);
 assert.match(css,/\.md table\{border-collapse:collapse/);
});
