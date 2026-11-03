'use strict';
// The public home page on a phone follows the Figma "Phone Home" frame: hero, the editor demo,
// what it does, how it works, then three templates with "Explore all templates", then the rest.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pub=path.join(__dirname,'..','public');
test('phone order, three templates and Explore all',()=>{
 const css=fs.readFileSync(path.join(pub,'ui','forma.css'),'utf8'),js=fs.readFileSync(path.join(pub,'create.js'),'utf8');
 const block=css.slice(css.indexOf('Phone home, like the Figma'));
 const order=['#top','.product','#features','#how','#showcase','#pricing','.foot'].map(s=>Number(new RegExp('\\.landing>'+s.replace('.','\\.')+'\\{order:(\\d+)\\}').exec(block)[1]));
 assert.deepEqual(order,[...order].sort((a,b)=>a-b),'sections follow the Figma order');
 assert.match(block,/#showcase:not\(\.show-all\) #landing-templates>\[data-more\]\{display:none!important\}/);
 assert.match(block,/\.landing>\*\{min-width:0;max-width:100%\}/,'nothing scrolls sideways');
 assert.match(css,/html body #showcase \.show-more\{display:none\}/,'desktop keeps the full gallery');
 assert.match(js,/if\(\+\+n>3\)c\.dataset\.more=''/);
 assert.match(js,/'Explore all templates'/);
 assert.match(js,/\.then\(trimShowcase\)/);assert.match(js,/trimShowcase\(\)\};/,'tabs re-trim after filtering');
});
