"use strict";
const t=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../public/home.css'),'utf8');
t('gallery has meaningful card content and accessible navigation',()=>{
 assert.match(js,/kh-app-topline/);assert.match(js,/kh-app-kind/);
 assert.match(js,/setAttribute\("aria-label","Open "\+name\)/);
 assert.match(css,/\.kh-app-meta strong\{font-size:15px/);
});
t('gallery remains usable on mobile and respects reduced motion',()=>{
 assert.match(css,/max-width:520px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
