"use strict";
// Impeccable and Hallmark ship to Kairoq Agent as read-only skills (hermes/skills/design) and
// show on the Plugins page with their real state.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');

test('both skills are in the Hermes skills folder with their licences and the Kairoq note',()=>{
 for(const [name,lic] of [['impeccable','Apache'],['hallmark','MIT']]){
  const dir=path.join(root,'hermes/skills/design',name);
  const skill=fs.readFileSync(path.join(dir,'SKILL.md'),'utf8');
  assert.match(skill,/^---\nname: /,name+' has front matter');
  assert.match(skill,/Kairoq note \(the only change to this file\)/);
  assert.match(fs.readFileSync(path.join(dir,'LICENSE'),'utf8'),new RegExp(lic));
  assert.ok(!fs.existsSync(path.join(dir,'scripts')),name+' ships no scripts');
 }
 assert.ok(fs.existsSync(path.join(root,'hermes/skills/design/impeccable/reference/critique.md')));
 assert.ok(fs.existsSync(path.join(root,'hermes/skills/design/hallmark/references/themes/almanac.md')));
 assert.ok(!fs.readdirSync(path.join(root,'hermes/skills/design/hallmark/references/themes')).some(f=>f.endsWith('.jpg')),'no theme pictures');
});

test('the Plugins page lists Impeccable and Hallmark with the real state',()=>{
 const src=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const fn=/function pluginStatus\(env = process\.env\) \{[\s\S]*?\n\}\n/.exec(src)[0];
 const req=m=>require(m.startsWith('./')?path.join(root,m):m);
 const pluginStatus=new Function('require','__dirname',fn+'return pluginStatus;')(req,root);
 const r=pluginStatus({});
 const imp=r.installed.find(p=>p.id==='impeccable'),hal=r.installed.find(p=>p.id==='hallmark');
 assert.ok(imp&&hal);
 assert.equal(imp.source,'pbakaus/impeccable');assert.equal(hal.source,'Nutlope/hallmark');
 assert.equal(hal.kairoq.on,true);
 assert.equal(typeof imp.kairoq.on,'boolean');
 assert.equal(imp.hermes.on,false);assert.match(imp.hermes.why,/agent isn't connected/);
 assert.match(fs.readFileSync(path.join(root,'public/licenses.html'),'utf8'),/pbakaus\/impeccable[\s\S]*Nutlope\/hallmark/);
 assert.match(fs.readFileSync(path.join(root,'hermes/UPSTREAM.md'),'utf8'),/## Impeccable and Hallmark/);
});
