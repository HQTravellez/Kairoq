'use strict';
// kairoq/story: 3D journey scenes (machine to guest) with detailed props, real materials and a
// storyboard player, instead of hand-placed grey boxes.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-story-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),runtime=require('../runtime-check');

const APP=`// Journey section.
import { CoffeeJourney } from 'kairoq/story';
export default function App() {
  return (
    <main>
      <section style={{ height: 480 }}><CoffeeJourney autoPlay={false} accent="#b08968" /></section>
    </main>
  );
}
`;

test('the builder is told to use kairoq/story for journeys, never boxes and cylinders',()=>{
 assert.match(builder.SYSTEM_PROMPT,/import \{ CoffeeJourney \} from 'kairoq\/story'/);
 assert.match(builder.SYSTEM_PROMPT,/Do not build your own machine or cup from boxes and cylinders/);
 const src=require('../react-story').source();
 for(const name of ['EspressoMachine','Cup','PourStream','Steam','Counter','Hand','Story','CoffeeJourney','useStoryProgress','useStoryMaterials'])assert.match(src,new RegExp('export (function|const) '+name+'\\b'),name);
});

test('an app with the coffee story builds, draws, and moves through its steps',{timeout:180000},async t=>{
 const meta=builder.create({name:'Stillroom',owner:'owner'});
 await builder.initializeFrom(meta,{'src/main.jsx':"import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",'src/App.jsx':APP});
 if(!runtime.available()){t.diagnostic('no browser here: drawing not checked');return}
 const server=http.createServer((req,res)=>{if(!builder.handlePreview(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const ctx=await (await runtime.browser()).newContext({viewport:{width:1100,height:700}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+builder.previewUrl(builder.loadMeta(meta.id)),{waitUntil:'load'});
  await page.waitForSelector('[data-kq-drawn="true"]',{timeout:30000});
  assert.equal(await page.locator('[aria-pressed="true"]').textContent(),'1. Set the cup');
  await page.click('text=2. Pull the shot');
  assert.match(await page.locator('[aria-live="polite"]').textContent(),/Pull the shot\. Espresso pours/);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();server.close();await runtime.close()}
});

test('a downloaded app that uses the story gets the module and the scene pieces it builds on',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../react-export.js'),'utf8');
 assert.match(src,/out\['src\/kairoq-story\.js'\]/);
 assert.match(src,/kairoq\\\\\/story\$\/, replacement/);
 assert.match(src,/if\(usesStory\|\|/);
});
