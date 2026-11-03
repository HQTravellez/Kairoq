"use strict";
// The home prompt's text needs a little left padding: with none, the first letter ("H" in "Hi")
// is clipped at the text box edge.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
test("the home prompt keeps left padding so the first letter is not clipped",()=>{
 const css=fs.readFileSync(path.join(__dirname,"../public/ui/screens.css"),"utf8");
 const rule=/body\.app #home #new-prompt\{[^}]*padding:([^;!]+)/.exec(css);
 assert.ok(rule,"rule found");
 const left=rule[1].trim().split(/\s+/)[3]||rule[1].trim().split(/\s+/)[1]||rule[1].trim();
 assert.notEqual(parseFloat(left),0,"left padding is not 0");
});
