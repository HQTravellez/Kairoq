"use strict";
// Found on Google and in AI answers: crawlers that do not run JavaScript get each page's
// content, every page is in the sitemap, the business is described in structured data and
// /llms.txt summarizes the site for AI assistants.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-search-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),hosting=require('../react-hosting'),search=require('../site-search');

test('what a page showed is sent again without scripts or event handlers',()=>{
 const h=search.cleanHtml('<h1 onclick="steal()">Hi</h1><script>alert(1)</script><a href="javascript:x()">x</a><iframe src="https://evil"></iframe><p>Menu</p>');
 assert.ok(!/script|onclick|javascript:|iframe/i.test(h),h);assert.match(h,/<h1>Hi<\/h1>/);assert.match(h,/<p>Menu<\/p>/);
 assert.equal(search.normalPath('about/'),'/about');assert.equal(search.normalPath('/index.html'),'/');assert.equal(search.normalPath('menu?x=1'),'/menu');
});

test('a published site gives crawlers its pages, sitemap, structured data and llms.txt',async()=>{
 const meta=builder.create({name:'Lume',owner:'owner'});
 await builder.initializeFrom(meta,{'src/main.jsx':"import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",'src/App.jsx':'export default function App(){return <h1>Lume</h1>}\n'},'Start');
 hosting.publish(meta.id,{slug:'lume-test'});
 const pages=[{path:'/',title:'Lume',h1:'Trattoria Lume',text:'Fresh pasta every morning. Open Tue–Sun.',html:'<h1>Trattoria Lume</h1><p>Fresh pasta every morning.</p><script>x()</script>'},{path:'/menu',title:'Menu',h1:'Menu',text:'Cacio e pepe 19',html:'<h1>Menu</h1><p>Cacio e pepe 19</p>'}];
 await search.snapshot(meta.id,{renderSite:async(base,o)=>{assert.equal(base,'/sites/lume-test/');assert.equal(o.max,15);return pages},base:'/sites/lume-test/'});
 search.save(meta.id,{business:{name:'Trattoria Lume',type:'Restaurant',city:'Porto',phone:'+351 1',hours:['Tu-Su 17:00-22:00'],email:'not-an-email'},faq:[{q:'Do you take bookings?',a:'Yes </script><script>bad()</script>'},{q:'',a:'dropped'}]});
 const server=http.createServer((req,res)=>{if(!hosting.handlePath(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/sites/lume-test/';
 try{
  const home=await (await fetch(base)).text();
  assert.match(home,/<div id="root"><h1>Trattoria Lume<\/h1><p>Fresh pasta every morning\.<\/p><\/div>/,'the home page content is in the HTML');
  assert.match(home,/"@type":"Restaurant"/);assert.match(home,/"@type":"FAQPage"/);
  assert.ok(!/<\/script><script>bad/.test(home),'an answer cannot end the structured data script');
  assert.ok(!home.includes('not-an-email'));
  const menu=await (await fetch(base+'menu')).text();
  assert.match(menu,/<div id="root"><h1>Menu<\/h1>/);assert.match(menu,/<link rel="canonical" href="[^"]*\/sites\/lume-test\/menu">/);
  const sitemap=await (await fetch(base+'sitemap.xml')).text();
  assert.match(sitemap,/lume-test\/<\/loc>/);assert.match(sitemap,/lume-test\/menu<\/loc>/);
  const llms=await (await fetch(base+'llms.txt')).text();
  assert.match(llms,/^# Trattoria Lume/);assert.match(llms,/Phone: \+351 1/);assert.match(llms,/\[Menu\]\(.*\/menu\)/);assert.match(llms,/### Do you take bookings\?/);
  const st=search.status(builder.loadMeta(meta.id));
  assert.deepEqual(st.items.filter(i=>i.ok).map(i=>i.id),['pages','sitemap','business','llms']);
 }finally{server.close()}
});

test('suggestions come only from the live pages and are cleaned',async()=>{
 const meta=builder.create({name:'Nopub',owner:'owner'});
 await assert.rejects(search.suggest(builder.loadMeta(meta.id),{callModel:async()=>({})}),/Publish the app first/);
 const pub=builder.list('owner').find(m=>m.name==='Lume');
 let seen='';
 const s=await search.suggest(builder.loadMeta(pub.id),{callModel:async(o,parse)=>{seen=o.messages[1].content;return parse(JSON.stringify({seo:{title:'Trattoria Lume'},business:{type:'Pizzeria?',name:'Lume',hours:'Tu-Su 17:00-22:00'},faq:[{q:'Fresh?',a:'Yes'}]}))}});
 assert.match(seen,/Fresh pasta every morning/);
 assert.equal(s.business.type,'LocalBusiness','an unknown type falls back');assert.deepEqual(s.business.hours,['Tu-Su 17:00-22:00']);assert.equal(s.faq.length,1);
});
