"use strict";
// Like file writes, edits arrive in several shapes from free models. All mean the same edit.
const test=require("node:test"),assert=require("node:assert/strict");
const {normalize,apply}=require("../react-edits");
test("edits as a list naming their file, and other common key names, are read",()=>{
 const want={"src/App.jsx":[{find:"a",replace:"b"},{find:"c",replace:"d"}]};
 assert.deepEqual(normalize([{path:"src/App.jsx",find:"a",replace:"b"},{file:"src/App.jsx",old:"c",new:"d"}]),want);
 assert.deepEqual(normalize({"src/App.jsx":[{search:"a",replace:"b"},{old_str:"c",new_str:"d"}]}),want);
 assert.deepEqual(normalize({"src/App.jsx":[{find:"a",replace:"b"},{before:"c",after:"d"}]}),want);
 assert.throws(()=>normalize(42),/for example \{"src\/App\.jsx":\[\{"find":"old text","replace":"new text"\}\]\}/,"a bad shape says the right one");
 const r=apply({"src/App.jsx":"<h1>a</h1><p>c</p>"},normalize([{path:"src/App.jsx",old:"<h1>a</h1>",new:"<h1>b</h1>"}]));
 assert.equal(r.errors.length,0);
});
