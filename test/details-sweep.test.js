'use strict';
// Details sweep: the home title's line reads (it was white on light grey under a band made for a
// removed photo), empty lists say so in a quiet box, the Settings cards line up without a line
// over nothing, and the editor's version picker shows its whole name on a laptop.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('the sweep fixes are in place and win over older styles',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','public','ui','forma.css'),'utf8');
 const b=css.slice(css.indexOf('Details sweep'));
 assert.match(b,/html body\.app\.day #home \.home,html body\.app #home \.home\{background-image:none!important\}/,'beats calm.css body.app.day #home .home');
 assert.match(b,/html body\.app\.day #home \.home-sub,html body\.app #home \.home-sub\{color:var\(--c-ink-3/);
 assert.match(b,/#agents-screen,#api-screen,#leads-screen\) \.tp-empty\{display:block;grid-column:1\/-1/);
 assert.match(b,/\.st-plan-foot:has\(>span:empty\)\{display:none\}/);
 assert.match(b,/\.bar-tools #versions\{max-width:240px!important/);
 const html=fs.readFileSync(path.join(__dirname,'..','public','create.html'),'utf8');
 assert.ok(html.indexOf('ui/forma.css')>html.indexOf('calm.css'),'forma.css loads after calm.css');
});
