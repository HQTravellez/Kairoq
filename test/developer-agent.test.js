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
