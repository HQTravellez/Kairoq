"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {starter}=require("../developer-starter");
const {assemble,getProject}=require("../developer-agent");

test("offline website starter creates all three meaningful files",()=>{
  const p=starter("Build a corporate travel platform","Travellez","editorial");
  assert.match(p.files["index.html"],/name="viewport"/);
  assert.match(p.files["index.html"],/Travellez/);
  assert.match(p.files["styles.css"],/@media\(max-width:600px\)/);
  assert.doesNotThrow(()=>new (require("node:vm").Script)(p.files["app.js"]));
  assert.ok(p.files["styles.css"].length>2000);
});
test("assembled preview includes CSS and runnable inline JavaScript",()=>{
  const p=starter("Corporate travel management experience","Demo","tech");
  const html=assemble(p.files);
  assert.match(html,/<style>/);
  assert.match(html,/<script>/);
  assert.match(html,/Corporate travel|Travel, beautifully simplified/i);
});
test("project loader rejects invalid or traversal project identifiers",()=>{
  for(const id of ["../secrets","../../.env","x/../../x","bad"])assert.throws(()=>getProject(id),/Invalid project ID/);
});

test("multi-page assembly renders requested route with shared CSS and JS",()=>{
 const files={"index.html":'<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="styles.css"></head><body><h1>Home</h1><a href="platform.html">Platform</a><script src="app.js"></script></body></html>',"platform.html":'<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="styles.css"></head><body><h1>Platform</h1><a href="index.html">Home</a><script src="app.js"></script></body></html>',"styles.css":"body{font:16px Arial} ".repeat(40),"app.js":"window.__kairoqMultiPage=true;"};
 const home=assemble(files,"index.html"),platform=assemble(files,"platform.html");
 assert.match(home,/<h1>Home<\/h1>/);assert.match(platform,/<h1>Platform<\/h1>/);assert.match(platform,/<style>/);assert.match(platform,/__kairoqMultiPage/);
});

const {normalizeFiles,requiredPages,generateFiles}=require('../developer-agent');
const websiteFixture=()=>starter('Build a corporate travel platform','Travellez','tech').files;
test('website contract retries missing home and required routes before browser QA',async()=>{
 const valid=websiteFixture();let calls=0;
 const result=await generateFiles(async opts=>{
  calls++;if(calls===1)return{files:{...valid,'index.html':''}};
  assert.match(opts.messages.at(-1).content,/failed website validation/);
  if(calls===2)return{files:valid};
  return{files:{...valid,'platform.html':valid['index.html']}};
 },{messages:[{role:'user',content:'Build a website'}]},{required:['index.html','platform.html']});
 assert.equal(calls,3);assert.ok(result.files['platform.html']);
});
test('website contract bounds repairs and rejects excess pages',async()=>{
 const files=websiteFixture();for(let i=0;i<40;i++)files[`page-${i}.html`]=files['index.html'];
 let calls=0;await assert.rejects(generateFiles(async()=>{calls++;return{files};},{messages:[]}),/after 3 attempts.*at most 40/);assert.equal(calls,3);
});
test('required route extraction enforces exact filenames and page limit',()=>{
 assert.deepEqual(requiredPages('Generate index.html, platform.html, smart-itinerary.html and pricing.html'),['index.html','platform.html','smart-itinerary.html','pricing.html']);
 assert.throws(()=>requiredPages(Array.from({length:40},(_,i)=>`page-${i}.html`).join(' ')),/exceeds/);
});
test('partial website repairs retain existing routes and shared assets',()=>{
 const base={...websiteFixture(),'about.html':websiteFixture()['index.html']};
 const result=normalizeFiles({files:{'styles.css':base['styles.css']+'\n/* repaired */'}},base);
 assert.equal(result['index.html'],base['index.html']);assert.equal(result['about.html'],base['about.html']);assert.equal(result['app.js'],base['app.js']);
 assert.throws(()=>normalizeFiles({files:{'index.html':''}},base),/index.html/);
});
test('website repair still rejects unsafe scripts and invalid JavaScript',()=>{
 const files=websiteFixture();
 assert.throws(()=>normalizeFiles({files:{...files,'index.html':files['index.html'].replace('</body>','<script src="https://bad.example/app.js"></script></body>')}}),/local app.js/);
 assert.throws(()=>normalizeFiles({files:{...files,'app.js':'const =;'}}),/syntax error/);
});
