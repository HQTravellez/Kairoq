'use strict';
// Look before replying: a visual change is compared with what was asked, on screenshots, and
// fixed once when it does not match. And CSS stripes are not reported as payment changes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../look-check'),G=require('../scope-guard');

test('only layout and looks requests are looked at',()=>{
 for(const m of ['bring the pole beside this section on the right','make the pole bigger','overall website looks really bad','add a 3D barber pole animation in the header','dark mode'])assert.ok(L.isVisual(m),m);
 for(const m of ['save bookings to the database','send me an email when someone books','fix the login error'])assert.equal(L.isVisual(m),false,m);
});

test('the reviewer reply is read strictly; anything unclear is no verdict',()=>{
 assert.deepEqual(L.verdict('{"ok":true}'),{ok:true,problems:[]});
 assert.deepEqual(L.verdict('Sure! {"ok":false,"problems":["The pole is in the header, overlapping the Book button; it should be on the right of the first section."]}').problems.length,1);
 assert.equal(L.verdict('looks fine to me'),null);
 assert.equal(L.verdict('{"ok":false,"problems":[]}'),null);
 assert.match(L.prompt('put the pole on the right of the hero'),/put the pole on the right of the hero/);
 assert.match(L.fixMessage('x',['too small']),/- too small[\s\S]*Fix only these points/);
});

test('builds run the look check after visual changes and say what it saw',()=>{
 const api=fs.readFileSync(path.join(__dirname,'../create-api.js'),'utf8'),server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8');
 assert.match(api,/require\('\.\/look-check'\)\.isVisual\(message\)&&process\.env\.KAIROQ_LOOK_CHECK!=='off'/);
 assert.match(api,/displayText:'Fix how it looks: '/);
 assert.match(server,/m\.isFree&&m\.supportsVision/);
 assert.match(ui,/Checked the screenshots: it looks the way you asked\./);
});

test('CSS stripes are not payments; real payment code still is',()=>{
 assert.deepEqual(G.check('make the pole look better',{'src/index.css':''},{'src/index.css':'.pole{/* moving stripes */}'}),[]);
 assert.deepEqual(G.check('make the button blue',{'src/pages/P.jsx':''},{'src/pages/P.jsx':'await payments.checkout("price_1Abcdefg")'}).map(x=>x.area),['payments']);
});
