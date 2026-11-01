"use strict";
// Design moves (design-moves.js): one-tap instructions from Impeccable's command vocabulary,
// the audit report, and the chat route that turns a move into the builder's instruction.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const moves=require('../design-moves');

test('seven moves, each with a label, a hint and a mode',()=>{
 const list=moves.list();
 assert.deepEqual(list.map(m=>m.id),['polish','bolder','quieter','distill','clarify','critique','audit']);
 for(const m of list)assert.ok(m.label&&m.hint&&['build','discuss','audit'].includes(m.mode),m.id);
 assert.equal(moves.get('critique').mode,'discuss');
 assert.equal(moves.get('nope'),null);
});

test('the chat shows the move and the note; the builder gets the full instruction with the scope',()=>{
 assert.equal(moves.shown('bolder','the hero'),'Bolder: the hero');
 assert.equal(moves.shown('polish',''),'Polish');
 const t=moves.instruction('bolder','the hero');
 assert.match(t,/Make it bolder: an amplification/);assert.match(t,/The owner adds: the hero/);assert.match(t,/touch only that/);
 assert.match(moves.instruction('quieter'),/generic quiet .* is not the goal/);
 assert.match(moves.instruction('clarify'),/persistent labels/);
 assert.match(moves.instruction('critique'),/Score each area 1 to 10/);
 assert.equal(moves.instruction('audit'),'');
});

test('the audit report lists measured and detected findings and the fix message repeats them',()=>{
 const r=moves.auditReport({detected:[{severity:'major',kind:'impeccable:nested-cards',issue:'Nested cards (src/App.jsx:40)',fix:'Flatten it.'}],measured:[{severity:'major',kind:'eyebrow',issue:'Small capital labels above 2 headings',fix:'Remove them.'}]});
 assert.equal(r.count,2);
 assert.match(r.text,/^Audit of the current version \(1 from Impeccable's rules, 1 measured on the page\):/);
 assert.match(r.text,/1\. Small capital labels above 2 headings\. \*\*Fix:\*\* Remove them\./);
 assert.match(r.text,/2\. \[nested-cards\] Nested cards/);
 const fix=moves.fixAudit(r.text);
 assert.match(fix,/^Fix exactly these findings/);assert.match(fix,/Nested cards/);assert.ok(!fix.includes('Say "Fix the audit findings"'));
 assert.equal(moves.auditReport({}).count,0);
});

test('the editor offers the moves and the chat route accepts one',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','public','create.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'..','public','create.js'),'utf8'),api=fs.readFileSync(path.join(__dirname,'..','create-api.js'),'utf8');
 assert.match(html,/id="design-moves"/);
 for(const id of ['polish','bolder','quieter','distill','clarify','critique','audit'])assert.ok(js.includes("['"+id+"',"),id+' chip');
 assert.match(js,/\{move:id,message:note\}/);
 assert.match(api,/move:typeof b\.move==='string'\?b\.move:null/);
 assert.match(api,/action==='\/audit'&&method==='POST'/);
 assert.match(api,/'POST:\/audit':'editor'/);
});
