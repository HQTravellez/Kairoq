"use strict";
// Apps have real page addresses (/services, not #/services), so search engines list every page:
// each page loads directly at any depth, is pre-built with its own content and title, and is in
// the sitemap. Old "#/about" links still work.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-addresses-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),hosting=require('../react-hosting'),search=require('../site-search'),runtime=require('../runtime-check');

const page=(name,title,heading,body)=>`// ${name}: ${heading}.
import { Link } from 'react-router-dom';
import { usePageMeta } from 'kairoq';

export default function ${name}() {
  usePageMeta({ title: ${JSON.stringify(title)}, description: ${JSON.stringify(body)} });
  return (
    <main>
      <h1>{${JSON.stringify(heading)}}</h1>
      <p>${body}</p>
      <nav><Link to="/">Home</Link> <Link to="/services">Services</Link> <Link to="/services/beard">Beard trim</Link> <Link to="/about">About</Link></nav>
    </main>
  );
}
`;
const FILES={
 'src/main.jsx':"import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",
 'src/App.jsx':`// App: the routes.
import { Routes, Route } from 'react-router-dom';
import { Router } from 'kairoq';
import HomePage from './pages/HomePage.jsx';
import ServicesPage from './pages/ServicesPage.jsx';
import BeardPage from './pages/BeardPage.jsx';
import AboutPage from './pages/AboutPage.jsx';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/beard" element={<BeardPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Router>
  );
}
`,
 'src/pages/HomePage.jsx':page('HomePage',"Joe's Barbers","Joe's Barbers",'Classic cuts on Queen Street since 1998.'),
 'src/pages/ServicesPage.jsx':page('ServicesPage',"Haircut prices – Joe's Barbers",'Services and prices','Haircut 35 dollars, skin fade 40 dollars.'),
 'src/pages/BeardPage.jsx':page('BeardPage',"Beard trim – Joe's Barbers",'Beard trim','Hot towel beard trim in 20 minutes.'),
 'src/pages/AboutPage.jsx':page('AboutPage',"About – Joe's Barbers",'About Joe','Joe has cut hair in Toronto for 25 years.'),
};

test('the builder is told to use real page addresses with a title per page',()=>{
 const p=builder.SYSTEM_PROMPT;
 assert.match(p,/wrap <Routes> in <Router>/);assert.match(p,/usePageMeta/);assert.match(p,/never HashRouter or BrowserRouter/);
 assert.match(require('../code-structure').check({'src/App.jsx':"import { HashRouter } from 'react-router-dom';"},['src/App.jsx']).join(),/real address/);
 assert.equal(builder.absoluteAssets('<script type="module" src="./assets/a.js"></script><link href="./assets/a.css">','/sites/joe/'),'<script type="module" src="/sites/joe/assets/a.js"></script><link href="/sites/joe/assets/a.css">');
});

test('a published app: every page loads at its own address, is pre-built with its own title, and is in the sitemap',{timeout:180000},async t=>{
 const meta=builder.create({name:"Joe's Barbers",owner:'owner'});
 await builder.initializeFrom(meta,FILES);
 hosting.publish(meta.id,{slug:'joe-test'});
 const server=http.createServer((req,res)=>{if(!hosting.handlePath(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,base=origin+'/sites/joe-test/';
 try{
  // A page two levels deep gets index.html with asset links that still load.
  const deep=await (await fetch(base+'services/beard')).text();
  const asset=/src="(\/sites\/joe-test\/assets\/[^"]+\.js)"/.exec(deep);
  assert.ok(asset,'asset links are absolute: '+deep.slice(0,400));
  assert.equal((await fetch(origin+asset[1])).status,200);
  if(!runtime.available()){t.diagnostic('no browser here: crawl skipped');return}
  // Publishing pre-builds every page (the real crawler, in a browser).
  const snap=await search.snapshot(meta.id,{renderSite:(u,o)=>runtime.renderSite(origin+u,o),base:'/sites/joe-test/'});
  assert.deepEqual(snap.pages.map(p=>p.path).sort(),['/','/about','/services','/services/beard']);
  const services=await (await fetch(base+'services')).text();
  assert.match(services,/<title>Haircut prices – Joe&#39;s Barbers<\/title>/);
  assert.match(services,/<meta name="description" content="Haircut 35 dollars, skin fade 40 dollars\.">/);
  assert.match(services,/<div id="root">[\s\S]*<h1>Services and prices<\/h1>/,'the page content is in the HTML');
  const sitemap=await (await fetch(base+'sitemap.xml')).text();
  for(const p of ['joe-test/services','joe-test/services/beard','joe-test/about'])assert.ok(sitemap.includes(p+'</loc>'),p);
  // Old "#/about" links land on /about.
  const where=await runtime.session(base+'#/about',{}).catch(()=>null);
  if(where&&where.page){await where.page.waitForTimeout(800);assert.match(where.page.url(),/\/sites\/joe-test\/about$/);await where.close?.()}
 }finally{server.close();await runtime.close()}
});
