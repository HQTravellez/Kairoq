'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test.after(()=>require('../runtime-check').close().catch(()=>{}));
const dd=require('../design-directions'),styles=require('../design-styles'),design=require('../react-design'),frame=require('../design-frame');

test('directions: three are dealt per project from the library, sites and app screens apart',()=>{
 const hotel=dd.deal('Casa Azul boutique hotel in Lisbon with booking',{seed:'Casa Azul'});
 assert.equal(hotel.kind,'page');assert.equal(hotel.sector,'hospitality');assert.equal(hotel.options.length,3);
 assert.equal(new Set(hotel.options.map(o=>o.id)).size,3);
 assert.deepEqual(dd.deal('Casa Azul boutique hotel in Lisbon with booking',{seed:'Casa Azul'}),hotel,'one project always gets the same choices');
 const dash=dd.deal('Orders dashboard for my shop with inventory');
 assert.equal(dash.kind,'app');assert.equal(dash.sector,'commerce');
 assert.equal(dd.deal('Bakery website with an admin page for orders').kind,'page','a site with an admin area is a site');
 assert.ok(!dd.deal('A SaaS tool for invoices',{seed:'x'}).options.some(o=>['pinned-poster','place-carries-it','contact-sheet','uneven-photographs'].includes(o.id)),'software is not dealt photo-led directions');
 const note=dd.note(hotel);assert.match(note,/DIRECTIONS dealt[\s\S]*set "direction"/);
 const page=dd.blueprint({direction:hotel.options[0].id,sector:'hospitality',created_at:'t'});
 assert.match(page,/ART DIRECTION[\s\S]*Hero "[\s\S]*Section [\s\S]*real content/);assert.ok(page.length<=7000);
 const app=dd.blueprint({direction:dash.options[0].id,sector:'commerce'});
 assert.match(app,/APP STYLE[\s\S]*Screen "[\s\S]*App screen rules/);
});

test('the brief picks a dealt direction and an optional style system; both reach every build',async()=>{
 let prompt='';
 const callModel=async(req,parse)=>{prompt=req.messages[1].content;return parse(JSON.stringify({name:'Market morning',palette:{background:'#f6f1ea',foreground:'#1d1a16',primary:'#9a3412'},fonts:{display:'Anton',body:'Literata'},direction:'not-dealt',idea:'The market stalls set the rhythm',style:'neon'}))};
 const brief=await design.createBrief('A cosy coffee shop in Leeds market, make it retro',{callModel,projectName:'Rosa'});
 assert.match(prompt,/DIRECTIONS dealt/);assert.match(prompt,/READY STYLE SYSTEMS[\s\S]*retro/);
 const dealt=dd.deal('Rosa A cosy coffee shop in Leeds market, make it retro',{seed:'Rosa'});
 assert.equal(brief.direction,dealt.options[0].id,'an id that was not dealt falls back to the first option');
 assert.equal(brief.style,'retro','the style the owner named is used');
 assert.equal(brief.fonts.display,'Anton','fonts from the taste-skill type systems load');
 assert.match(design.fontUrl(['Anton','Literata']),/family=Anton[\s\S]*family=Literata/);
 const note=design.designNote(brief);
 assert.match(note,/The idea: The market stalls/);assert.match(note,/ART DIRECTION/);assert.match(note,/STYLE SYSTEM "Retro"/);
 assert.equal(design.normalize({...brief,direction:'made-up',style:'apple'}).direction,undefined,'unknown ids are dropped');
});

test('style systems: generic ones only, AI-look ones only when named, matched by name and words',()=>{
 const ids=styles.list().map(s=>s.id);
 assert.ok(ids.length>=50);for(const brand of ['apple','stripe','airbnb','ferrari','starbucks'])assert.ok(!ids.includes(brand));
 assert.deepEqual(styles.named('make it retro').map(s=>s.id),['retro']);
 assert.ok(!styles.options('a glowing modern tech product').some(s=>styles.ONLY_WHEN_NAMED.has(s.id)));
 assert.equal(styles.options('glassmorphism please')[0].id,'glassmorphism');
 assert.match(styles.text('cafe'),/STYLE SYSTEM "Cafe"[\s\S]*#5D4432/);
});

test('builder habits, the taste-skill tells and the craft skills are in place',()=>{
 const builder=require('../react-builder'),m=require('../builder-method');
 assert.ok(builder.SYSTEM_PROMPT.includes(m.VERIFY));
 const src=require('fs').readFileSync(require.resolve('../react-builder.js'),'utf8');
 assert.equal((src.match(/METHOD\.DEBUG/g)||[]).length,3,'build, browser and check repairs find the cause first');
 assert.match(src,/METHOD\.REVIEW/);
 assert.match(require('fs').readFileSync(require.resolve('../live-guard.js'),'utf8'),/builder-method'\)\.DEBUG/);
 assert.ok(require('../design-slop').list().includes('pill badge above the hero'));
 const lib=require('../react-skills').builtin();
 for(const id of ['app-screens','three-product','redesign','faq-page','web-interface-guidelines','craft-form-validation','craft-rtl-and-bidi','craft-laws-of-ux'])assert.ok(lib.some(s=>s.id===id),id);
 assert.equal(lib.filter(s=>s.group==='Craft').length,11);
});

test('page-frame checks find a late title, an empty stretch and covered text in a real browser',async t=>{
 const runtime=require('../runtime-check');
 if(!runtime.available())return t.skip('no browser here');
 const b=await runtime.browser(),ctx=await b.newContext({viewport:{width:1280,height:800}}),page=await ctx.newPage();
 try{
  await page.setContent('<style>body{margin:0}</style><header style="position:fixed;top:0;left:0;right:0;height:120px;background:#fff">Menu</header><div style="height:900px;background:#eee"></div><div style="height:1200px"></div><h1>Rosa</h1><p>Coffee by the market.</p>');
  const issues=await frame.frame(page,'desktop');
  const all=issues.map(i=>i.issue).join(' | ');
  assert.match(all,/Late title/);assert.match(all,/Empty stretch/);
  await page.setContent('<style>body{margin:0}</style><header style="position:fixed;top:0;left:0;right:0;height:80px;background:#fff;z-index:9">Menu</header><h1 style="margin:20px 0 0">Rosa cafe</h1><p>Coffee by the market.</p>');
  assert.match((await frame.frame(page,'desktop')).map(i=>i.issue).join(' | '),/Covered text/);
  await page.setContent('<main><section><div style="max-width:800px;margin:0 auto"><h1>Rosa cafe</h1><p>Coffee by the market, open every morning.</p></div></section></main>');
  assert.deepEqual(await frame.frame(page,'desktop'),[],'a clean page passes');
  assert.match(frame.note([{screen:'phone',issue:'Late title',fix:'Bring it up'}]),/Measured in the browser[\s\S]*\[phone\] Late title/);
 }finally{await ctx.close()}
});
