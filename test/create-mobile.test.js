"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),zlib=require('zlib');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-mobile-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='20';
process.env.KAIROQ_PUBLIC_URL='https://kairoq.example.com';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),hosting=require('../react-hosting'),mobile=require('../react-mobile'),exporter=require('../react-export'),runtime=require('../runtime-check');

let lastModelOpts=null;
const callModel=async(opts,parse)=>{lastModelOpts=opts;return parse(JSON.stringify({message:'ok',files:{'src/App.jsx':'export default function App(){return <p className="p-2">ok</p>}\n'}}))};
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,headers:res.headers,json,text:buf.toString(),buf})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.8.0.'+(++ip)}});return{cookie:r.headers['set-cookie'][0].split(';')[0]}}
async function project(cookie,name='Trail Guide'){return(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name}})).json.project.id}
function pngSize(buf){assert.deepEqual([...buf.subarray(0,8)],[137,80,78,71,13,10,26,10],'PNG signature');return[buf.readUInt32BE(16),buf.readUInt32BE(20)]}

test('every published app is installable: manifest, icons, service worker and head tags',async()=>{
 const {cookie}=await signup('pwa@example.com');
 const id=await project(cookie);
 assert.equal((await request(server,'GET','/api/create/projects/'+id+'/qr',{headers:{cookie}})).status,409,'QR needs a published app');
 hosting.publish(id,{slug:'trail-guide'});
 const page=await request(server,'GET','/sites/trail-guide/',{headers:{'user-agent':'Mozilla/5.0 Chrome/120'}});
 for(const tag of ['<link rel="manifest" href="manifest.webmanifest">','<link rel="apple-touch-icon" href="apple-touch-icon.png">','<meta name="theme-color" content="#111827">','<script src="kairoq-pwa.js" defer></script>','apple-mobile-web-app-title" content="Trail Guide"'])assert.ok(page.text.includes(tag),tag);
 assert.doesNotMatch(page.text,/viewport-fit/,'web apps keep the normal viewport');
 const m=(await request(server,'GET','/sites/trail-guide/manifest.webmanifest'));
 assert.equal(m.headers['content-type'],'application/manifest+json; charset=utf-8');
 assert.equal(m.json.name,'Trail Guide');assert.equal(m.json.display,'standalone');assert.equal(m.json.start_url,'./');
 assert.deepEqual(m.json.icons.map(i=>i.sizes),['192x192','512x512','512x512']);
 const sw=await request(server,'GET','/sites/trail-guide/sw.js');
 assert.equal(sw.headers['cache-control'],'no-cache');assert.match(sw.text,/const CACHE='kairoq-1'/);assert.match(sw.text,/includes\('\/api\/'\)\)return/,'backend calls are never cached');
 assert.match((await request(server,'GET','/sites/trail-guide/kairoq-pwa.js')).text,/serviceWorker\.register\('sw\.js'\)/);
 for(const [name,size] of Object.entries(mobile.SIZES)){const r=await request(server,'GET','/sites/trail-guide/'+name);assert.equal(r.headers['content-type'],'image/png');assert.deepEqual(pngSize(r.buf),[size,size],name)}
 const qr=await request(server,'GET','/api/create/projects/'+id+'/qr',{headers:{cookie}});
 assert.equal(qr.status,200);assert.match(qr.text,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[\s\S]*<path/);
 assert.equal((await request(server,'GET','/api/create/projects/'+id+'/mobile',{headers:{cookie}})).json.url,'https://kairoq.example.com/sites/trail-guide/');
});

test('mobile app setting: validation, phone-first prompt, viewport and native project export',async()=>{
 const {cookie}=await signup('native@example.com');
 const id=await project(cookie,'Surf Shop');
 const post=body=>request(server,'POST','/api/create/projects/'+id+'/mobile',{headers:{cookie},body});
 assert.equal((await post({theme_color:'red'})).status,400);
 assert.equal((await post({app_id:'Not An Id'})).status,400);
 assert.equal((await post({icon:'missing.png'})).status,400);
 const saved=(await post({enabled:true,name:'Surf Shop Lisbon',short_name:'Surf',theme_color:'#0e7490',app_id:'com.surfshop.app'})).json.mobile;
 assert.deepEqual([saved.enabled,saved.short_name,saved.theme_color,saved.app_id],[true,'Surf','#0e7490','com.surfshop.app']);
 assert.equal((await request(server,'GET','/api/create/projects/'+id,{headers:{cookie}})).json.project.mobile.enabled,true);
 // The AI is told to design phone-first.
 const job=(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Add a menu'}})).json.job;
 for(let i=0;i<200&&!['complete','failed'].includes((await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job.status);i++)await new Promise(r=>setTimeout(r,25));
 assert.match(lastModelOpts.messages[0].content,/MOBILE APP[\s\S]*bottom tab navigation[\s\S]*safe-area-inset/);
 hosting.publish(id,{slug:'surf-shop'});
 assert.match((await request(server,'GET','/sites/surf-shop/',{headers:{'user-agent':'Mozilla/5.0 Chrome/120'}})).text,/viewport-fit=cover/);
 assert.equal((await request(server,'GET','/sites/surf-shop/manifest.webmanifest')).json.orientation,'portrait');
 // Code export is a Capacitor project with an Android build workflow.
 const files=exporter.exportFiles(id);
 const cap=JSON.parse(files['capacitor.config.json']);
 assert.deepEqual([cap.appId,cap.appName,cap.webDir],['com.surfshop.app','Surf Shop Lisbon','dist']);
 const pkg=JSON.parse(files['package.json']);
 assert.ok(pkg.dependencies['@capacitor/core']&&pkg.devDependencies['@capacitor/android']&&pkg.devDependencies['@capacitor/ios']&&pkg.devDependencies['@capacitor/cli']);
 assert.match(pkg.scripts.android,/npx cap sync android/);
 assert.match(files['.github/workflows/kairoq-android.yml'],/gradlew assembleDebug[\s\S]*upload-artifact/);
 assert.match(files['README.md'],/Mobile app \(iOS and Android\)/);
 assert.match(files['index.html'],/viewport-fit=cover/);
 assert.match(files['src/kairoq.js'],/const APP_URL="https:\/\/kairoq\.example\.com\/sites\/surf-shop\/"/);
 assert.match(files['src/kairoq.js'],/In the mobile app, use email sign-in/);
 for(const f of ['capacitor.config.json','.github/workflows/kairoq-android.yml','functions/x.js','sql/001_init.sql'])assert.ok(exporter.MANAGED.test(f),f);
 // Turned off: a plain web project again.
 await post({enabled:false});
 const plain=exporter.exportFiles(id);
 assert.ok(!plain['capacitor.config.json']&&!plain['.github/workflows/kairoq-android.yml']);
 assert.equal(JSON.parse(plain['package.json']).dependencies['@capacitor/core'],undefined);
});

test('icons: a valid solid PNG without Chromium, and a rendered icon from the name or an uploaded image',async()=>{
 const png=mobile.solidPng(48,'#ff0000');
 assert.deepEqual(pngSize(png),[48,48]);
 const idat=png.indexOf('IDAT');const len=png.readUInt32BE(idat-4);
 const raw=zlib.inflateSync(png.subarray(idat+4,idat+4+len));
 assert.deepEqual([...raw.subarray(1,4)],[255,0,0]);
 if(!runtime.available())return;
 const {cookie}=await signup('icon@example.com');
 const id=await project(cookie,'Blue Lagoon');
 await mobile.renderIcons(id);
 const icon=fs.readFileSync(path.join(builder.projectDir(id),'mobile','icon-512.png'));
 assert.deepEqual(pngSize(icon),[512,512]);assert.ok(icon.length>png.length,'rendered with letters, not a plain square');
 assert.match(mobile.manifest(builder.loadMeta(id)).short_name,/^Blue Lagoon$/);
});
