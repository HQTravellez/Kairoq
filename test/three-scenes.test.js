"use strict";
// three.js in Create: React Three Fiber 8 + drei 9 and the tested pieces in 'kairoq/scene'
// (Scene3D, Configurator, Globe, Particles, MiniGame).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-scene-'));
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder');
const pkg=require('../package.json');

const APP=`import { Configurator, Globe, Particles, MiniGame, Scene3D } from 'kairoq/scene';
import { Float } from '@react-three/drei';
export default function App(){return <main>
<section className="relative h-72"><Particles /><h1 className="relative">Lumen</h1></section>
<Configurator src="./models/chair.glb" options={[{label:'Navy',color:'#1e3a8a',price:899},{label:'Rust',color:'#b45309',price:849}]} />
<Globe points={[{lat:43.65,lng:-79.38,label:'Toronto'}]} arcs={[{from:[43.65,-79.38],to:[40.71,-74]}]} />
<MiniGame title="Catch" seconds={10} />
<Scene3D controls className="h-64"><Float><mesh><boxGeometry /><meshStandardMaterial color="hotpink" /></mesh></Float></Scene3D>
<svg viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="black" /></svg>
</main>}
`;
const model=files=>async(_o,parse)=>parse(JSON.stringify({message:'ok',files}));

test('React Three Fiber and drei are pinned to the versions that work with React 18',()=>{
 assert.equal(pkg.dependencies.react,'18.3.1');
 assert.match(pkg.dependencies['@react-three/fiber'],/^8\./);
 assert.match(pkg.dependencies['@react-three/drei'],/^9\./);
 assert.equal(pkg.dependencies.three,'0.183.2');
 for(const p of ['@react-three/fiber','@react-three/drei','kairoq/scene'])assert.ok(builder.ALLOWED_PACKAGES.includes(p),p);
 assert.match(builder.SYSTEM_PROMPT,/Never create your own <Canvas> outside Scene3D/);
});

test('the visual-edit tags go on HTML and SVG only, never on three.js tags (which would crash)',()=>{
 const babel=require('@babel/core');
 const out=babel.transformSync(APP,{filename:path.join(tmp,'src','App.jsx'),babelrc:false,configFile:false,
  plugins:[require('../react-visual').locatorPlugin(tmp)],parserOpts:{plugins:['jsx']}}).code;
 for(const tag of ['main','section','h1','svg','line'])assert.match(out,new RegExp('<'+tag+'[^>]*data-kq='),tag+' is tagged');
 for(const tag of ['mesh','boxGeometry','meshStandardMaterial'])assert.doesNotMatch(out,new RegExp('<'+tag+'[^>]*data-kq='),tag+' is not tagged');
});

test('an app using every kairoq/scene piece builds, and the export runs outside Kairoq',async()=>{
 const meta=builder.create({name:'Scenes',owner:'owner'});await builder.initialize(meta);
 const r=await builder.edit(meta.id,'3D everywhere',{callModel:model({'src/App.jsx':APP})});
 const dist=path.join(builder.versionDir(meta.id,r.version),'dist');
 const js=fs.readdirSync(path.join(dist,'assets')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(dist,'assets',f),'utf8')).join('\n');
 assert.match(js,/data-kq-scene/);assert.match(js,/kq-game-best:/);
 const out=require('../react-export').exportFiles(meta.id);
 assert.match(out['src/kairoq-scene.js'],/export function Configurator/);
 assert.match(out['vite.config.js'],/kairoq\\\/scene/);
 const deps=JSON.parse(out['package.json']).dependencies;
 assert.equal(deps['@react-three/fiber'],pkg.dependencies['@react-three/fiber']);assert.equal(deps.three,pkg.dependencies.three);
 // Building one without three.js leaves the scene module out.
 const plain=builder.create({name:'Plain',owner:'owner'});await builder.initialize(plain);
 await builder.edit(plain.id,'plain',{callModel:model({'src/App.jsx':'export default function App(){return <h1>Hi</h1>}\n'})});
 assert.equal(require('../react-export').exportFiles(plain.id)['src/kairoq-scene.js'],undefined);
});

// In a real browser (CI installs Chromium): every piece draws a frame and the check sees it.
test('every piece draws in a browser and the runtime check counts them',{skip:!require('../runtime-check').available()&&'no Chromium here'},async()=>{
 const rc=require('../runtime-check');
 const meta=builder.create({name:'Draw',owner:'owner'});await builder.initialize(meta);
 const app=APP.replace(/<Configurator[^>]*\/>\n/,'');
 const r=await builder.edit(meta.id,'draw',{callModel:model({'src/App.jsx':app})});
 const dist=path.join(builder.versionDir(meta.id,r.version),'dist');
 const srv=http.createServer((q,s)=>builder.serveDist(q,s,dist,q.url,{sandbox:false}));await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 const prev=process.env.KAIROQ_DEAD_CLICKS;process.env.KAIROQ_DEAD_CLICKS='off';
 try{
  const out=await rc.check('http://127.0.0.1:'+srv.address().port+'/');
  assert.deepEqual(out.errors.filter(e=>!/fonts\.g|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION/.test(e)),[]);
  if(out.facts.models3d.webgl){assert.equal(out.facts.models3d.scenes,4);assert.equal(out.facts.models3d.drawn,4)}
 }finally{process.env.KAIROQ_DEAD_CLICKS=prev;srv.close();await rc.close().catch(()=>{})}
});
