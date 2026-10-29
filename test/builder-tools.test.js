"use strict";
// The builder works like a developer with a laptop: it searches the web, reads pages, downloads
// free files into the app and adds npm packages, each through Kairoq with licence and safety
// checks (builder-tools.js), and reads playbooks for hard topics (builder-playbooks.js).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-tools-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_DESIGN_BRIEF:'off',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const builder=require('../react-builder'),T=require('../builder-tools'),M=require('../react-models'),engine=require('../opencode-engine');

function animatedGlb(){return M.packGlb({asset:{version:'2.0'},scenes:[{nodes:[0]}],scene:0,nodes:[{name:'Root'}],animations:[{name:'Walk',channels:[],samplers:[]}]},()=>null)}
const JPG=Buffer.from([0xff,0xd8,0xff,0xe0,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0]);
const fakeRemote=async url=>{
 if(/\.glb$/.test(url))return{bytes:animatedGlb(),type:'model/gltf-binary'};
 if(/\.jpg$/.test(url))return{bytes:JPG,type:'image/jpeg'};
 if(/\.zip$/.test(url))return{bytes:Buffer.from('PK\x03\x04zip'),type:'application/zip'};
 return{bytes:Buffer.from('<html><head><style>x{}</style><script>evil()</script></head><body><h1>T-Rex</h1><p>Licence: CC0. <a href="https://static.example/trex.glb">Download</a></p></body></html>'),type:'text/html'};
};

test('only free licences: CC0, CC-BY, MIT, Apache, OFL, Unsplash, Pexels for files; permissive npm licences only',()=>{
 assert.equal(T.fileLicence('Public Domain (CC0)'),'CC0');assert.equal(T.fileLicence('CC-BY 4.0'),'CC-BY-4.0');assert.equal(T.fileLicence('MIT'),'MIT');
 assert.equal(T.fileLicence('CC-BY-NC 4.0'),null);assert.equal(T.fileLicence('CC BY-ND'),null);assert.equal(T.fileLicence('Royalty free'),null);assert.equal(T.fileLicence(''),null);
 for(const ok of ['MIT','Apache-2.0','(MIT OR Apache-2.0)','BSD-3-Clause','ISC'])assert.equal(T.packageLicenceOk(ok),true,ok);
 for(const no of ['GPL-3.0','AGPL-3.0-only','(MIT OR GPL-2.0)'.replace('MIT OR','MIT AND'),'UNLICENSED','',null,'SSPL-1.0'])assert.equal(T.packageLicenceOk(no),false,String(no));
});

test('search and read: links to follow, and pages as plain untrusted text',async()=>{
 const t=T.forProject('x',{webSearch:async q=>['https://poly.pizza/m/UYtneO5FpF','https://quaternius.com/'],remote:fakeRemote});
 assert.match(await t.run('search',{query:'free animated t-rex glb'}),/1\. https:\/\/poly\.pizza\/m\/UYtneO5FpF/);
 const page=await t.run('read',{url:'https://poly.pizza/m/UYtneO5FpF'});
 assert.match(page,/untrusted web text/);assert.match(page,/T-Rex/);assert.match(page,/Licence: CC0/);assert.match(page,/\[https:\/\/static\.example\/trex\.glb\]/);
 assert.doesNotMatch(page,/evil\(\)/);
 await assert.rejects(t.run('read',{url:'http://example.com/'}),/https/);
});

test('download: a free model comes in with its animations and source; pictures go to uploads; others are refused',async()=>{
 const meta=builder.create({name:'Dino',owner:'owner'});
 const t=T.forProject(meta.id,{remote:fakeRemote});
 const said=await t.run('download',{url:'https://static.example/trex.glb',licence:'CC0',name:'T-Rex',creator:'Quaternius',source_page:'https://poly.pizza/m/UYtneO5FpF'});
 assert.match(said,/Saved "T-Rex" \(CC0\) at \.\/models\/t-rex-[0-9a-f]{8}\.glb \(animations: Walk\)/);
 const model=M.list(meta.id)[0];assert.equal(model.source.provider,'web');assert.equal(model.source.creator,'Quaternius');
 assert.match(await t.run('download',{url:'https://static.example/kid.jpg',licence:'Unsplash',name:'Kid colouring'}),/at \.\/uploads\/kid-colouring-[0-9a-f]{6}\.jpg/);
 assert.match(await t.run('download',{url:'https://static.example/other.glb',licence:'CC-BY 4.0',name:'Dino 2',creator:'Ann'}),/CC-BY: show the credit "Dino 2" by Ann/);
 await assert.rejects(t.run('download',{url:'https://static.example/trex.glb',licence:'All rights reserved'}),/free licence/);
 await assert.rejects(t.run('download',{url:'https://static.example/pack.zip',licence:'CC0'}),/Only GLB models/);
 assert.equal(builder.loadMeta(meta.id).sources.length,3);
 assert.match(T.summary(t.log),/Added to your app: "T-Rex" by Quaternius \(CC0, https:\/\/poly\.pizza\/m\/UYtneO5FpF\)/);
 assert.match(M.note(meta.id,builder.loadMeta(meta.id)),/"Dino 2".*show the credit "Dino 2" by Ann \(CC-BY-4\.0\)/);
});

test('packages: permissive ones are added without install scripts, the app imports them, and the build resolves them',{timeout:120000},async()=>{
 const meta=builder.create({name:'Pkg',owner:'owner'});await builder.initialize(meta);
 const registry={'kq-hello':{'dist-tags':{latest:'1.2.3'},versions:{'1.2.3':{license:'MIT',description:'Says hello',dist:{unpackedSize:2000}}}},'gpl-thing':{'dist-tags':{latest:'1.0.0'},versions:{'1.0.0':{license:'GPL-3.0'}}}};
 const installs=[];
 const install=async(spec,dir)=>{installs.push(spec);const [n,v]=spec.split('@');const d=path.join(dir,'node_modules',n);fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'package.json'),JSON.stringify({name:n,version:v,main:'index.js',type:'module'}));fs.writeFileSync(path.join(d,'index.js'),'export function hello(n){return "Hello "+n}\n')};
 const folder=fs.mkdtempSync(path.join(tmp,'oc-'));
 const t=T.forProject(meta.id,{fetchJson:async u=>{const n=decodeURIComponent(u.split('/').pop());if(!registry[n])throw Error('404');return registry[n]},install});
 assert.match(await t.run('package',{name:'kq-hello'},{dir:folder}),/Added kq-hello@1\.2\.3 \(MIT\)/);
 assert.deepEqual(installs,['kq-hello@1.2.3']);
 assert.match(await t.run('package',{name:'gpl-thing'}).catch(e=>e.message),/GPL-3\.0.*cannot use/);
 assert.match(await t.run('package',{name:'react'}),/already available/);
 const listed=fs.readFileSync(path.join(folder,'src','kairoq.packages.json'),'utf8');
 assert.deepEqual(JSON.parse(listed).packages,{'kq-hello':'1.2.3'});
 const APP="import { hello } from 'kq-hello';\nexport default function App(){return <main><h1>{hello('Kairoq')}</h1></main>}\n";
 // Without the app's package list the import is refused; with it the real build resolves it.
 assert.ok(builder.checkProject({'src/App.jsx':APP}).some(e=>/package "kq-hello" is not available/.test(e)));
 const r=await builder.edit(meta.id,'say hello',{callModel:async(_o,parse)=>parse(JSON.stringify({message:'Said hello.',files:{'src/App.jsx':APP,'src/kairoq.packages.json':listed}}))});
 const js=fs.readdirSync(path.join(builder.versionDir(meta.id,r.version),'dist','assets')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(builder.versionDir(meta.id,r.version),'dist','assets',f),'utf8')).join('');
 assert.match(js,/Hello /);
 const out=require('../react-export').exportFiles(meta.id);
 assert.equal(JSON.parse(out['package.json']).dependencies['kq-hello'],'1.2.3');
});

test('playbooks: a 3D colouring app gets the know-how for characters, AR, colours and printing',()=>{
 const P=require('../builder-playbooks');
 const ids=P.pick('Build an iPhone AR coloring book app for kids. The child prints a T-Rex coloring page, colors it, then points the phone at the paper. Tapping the drawing makes a real animated 3D T-Rex pop out wearing the child\'s colors').map(b=>b.id);
 assert.deepEqual(ids,['3d-character','ar-coloring','camera-colours']);
 assert.deepEqual(P.pick('A booking site for my salon'),[]);
 assert.match(P.note('a printable colouring page'),/window\.print/);
 assert.match(engine.rules('Rules.'),/Think, research, then build/);
});

test('the real OpenCode program searches and downloads through Kairoq',{skip:!process.env.KAIROQ_TEST_OPENCODE_BIN&&'set KAIROQ_TEST_OPENCODE_BIN to run OpenCode itself',timeout:300000},async()=>{
 const meta=builder.create({name:'Real',owner:'owner'});
 const offered=[],results=[];
 const plan=[['kairoq_search',{query:'free animated t-rex'}],['kairoq_download',{url:'https://static.example/trex.glb',licence:'CC0',name:'T-Rex',creator:'Quaternius'}]];
 const model=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{
  const j=JSON.parse(b||'{}'),tools=(j.tools||[]).map(t=>t.function&&t.function.name),done=(j.messages||[]).filter(m=>m.role==='tool');if(tools.length)offered.push(tools);
  for(const m of done)results[done.indexOf(m)]=typeof m.content==='string'?m.content:JSON.stringify(m.content);
  r.writeHead(200,{'Content-Type':'text/event-stream'});const send=o=>r.write('data: '+JSON.stringify({id:'c',object:'chat.completion.chunk',created:1,model:j.model,...o})+'\n\n');
  const next=tools.length?plan[done.length]:null;
  if(next)send({choices:[{index:0,delta:{role:'assistant',tool_calls:[{index:0,id:'call_'+done.length,type:'function',function:{name:next[0],arguments:JSON.stringify(next[1])}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:100,completion_tokens:5}});
  else send({choices:[{index:0,delta:{role:'assistant',content:tools.length?'Fetched the T-Rex.':'Title'},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:5}});
  r.end('data: [DONE]\n\n');
 })});
 const route=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',async()=>{try{const j=JSON.parse(b||'{}');r.end(JSON.stringify({report:await engine.runCheck(String(q.headers.authorization||'').replace(/^Bearer\s+/i,''),j.tool||'check',j.args||{})}))}catch(e){r.statusCode=404;r.end('{}')}})});
 await new Promise(r=>model.listen(0,'127.0.0.1',r));await new Promise(r=>route.listen(0,'127.0.0.1',r));
 Object.assign(process.env,{KAIROQ_OPENCODE_BIN:process.env.KAIROQ_TEST_OPENCODE_BIN,EXPLABS_API_KEY:'test-key',KAIROQ_OPENCODE_BASE_URL:'http://127.0.0.1:'+model.address().port+'/v1',KAIROQ_OPENCODE_MODEL:'m1',NO_PROXY:'127.0.0.1,localhost'});
 engine.configure({checkUrl:'http://127.0.0.1:'+route.address().port+'/'});
 const tools=T.forProject(meta.id,{webSearch:async()=>['https://poly.pizza/m/UYtneO5FpF'],remote:fakeRemote});
 const s=engine.session({rules:engine.rules('Rules.'),tools});
 try{
  const r=await s.reply({files:{'src/App.jsx':'export default function App(){return null}\n'},prompt:'Add a real T-Rex'});
  const names=offered.find(t=>t.includes('kairoq_search'))||[];
  for(const n of ['kairoq_search','kairoq_read','kairoq_download','kairoq_package','kairoq_tutorials'])assert.ok(names.includes(n),n+' offered: '+names.join(','));
  assert.ok(!names.includes('bash')&&!names.includes('webfetch'),'still no shell and no open web');
  assert.match(results[0]||'',/poly\.pizza\/m\/UYtneO5FpF/);
  assert.match(results[1]||'',/Saved "T-Rex" \(CC0\)/);
  assert.equal(M.list(meta.id)[0].title,'T-Rex');
  assert.match(r.message,/Fetched the T-Rex/);
 }finally{s.close();model.close();route.close();engine.configure({checkUrl:null});for(const k of ['KAIROQ_OPENCODE_BIN','EXPLABS_API_KEY','KAIROQ_OPENCODE_BASE_URL','KAIROQ_OPENCODE_MODEL'])delete process.env[k]}
});
