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
