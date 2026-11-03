"use strict";
// Steps like Lovable: a light-grey heading as big as the reply, an arrow that points right when
// closed and down when open, the reasoning at full size beside a bulb, and room between steps.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const css=fs.readFileSync(path.join(__dirname,"../public/ui/forma.css"),"utf8");
test("step headings, arrow and reasoning look like Lovable's",()=>{
 assert.match(css,/#messages \.ks-head\{font:400 15\.5px\/1\.5 Inter[^}]*color:#8E8B94!important/);
 assert.match(css,/#messages \.ks-head \.ks-chev\{transform:none!important/,"closed: points right");
 assert.match(css,/#messages \.ks-head\[aria-expanded=true\] \.ks-chev\{transform:rotate\(90deg\)!important\}/,"open: points down");
 assert.match(css,/#messages \.ks-note p\{font:400 15\.5px\/1\.7 Inter/);
 assert.match(css,/#messages \.ks-story\{gap:22px!important/);
});
