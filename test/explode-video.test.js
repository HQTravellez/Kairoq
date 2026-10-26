"use strict";
// Product explode films (explode-video.js) against a stand-in for Google's Gemini API: the photo
// becomes two stills (whole, apart) for the owner to approve, Omni Flash films from the first to
// the last, ffmpeg cuts the frames, builds carry them, and <ScrollVideo> plays them on scroll.
// Credits are taken before each paid step and given back when one fails.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),{execFileSync}=require('child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-explode-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='200';
process.env.KAIROQ_VIDEO_POLL_MS='20';
delete process.env.GEMINI_API_KEY;
const builder=require('../react-builder'),createApi=require('../create-api'),ev=require('../explode-video'),design=require('../react-design'),runtime=require('../runtime-check');

// A real film when ffmpeg is here (numbered test pattern); otherwise a stand-in ffmpeg that writes frames.
let FFMPEG=true;try{execFileSync('ffmpeg',['-version'],{stdio:'ignore'})}catch{FFMPEG=false}
const FILM=path.join(tmp,'film.mp4');
if(FFMPEG)execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc=size=640x360:rate=24','-t','3','-pix_fmt','yuv420p','-c:v','libx264',FILM]);
else{
 fs.writeFileSync(FILM,Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(4000,7)]));
 const fake=path.join(tmp,'ffmpeg');fs.writeFileSync(fake,'#!/bin/sh\nfor last; do :; done\nd=$(dirname "$last")\nfor i in 001 002 003 004 005 006 007 008 009 010 011 012; do printf RIFF > "$d/$i.webp"; done\n');fs.chmodSync(fake,0o755);
 process.env.FFMPEG_PATH=fake;
}
const MP4=fs.readFileSync(FILM);
const PNG=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(200,1)]);

function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json=null;try{json=JSON.parse(buf.toString())}catch{}resolve({status:res.statusCode,headers:res.headers,buf,json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
// Google: POST /v1beta/interactions answers with a file; the file is PROCESSING once, then ACTIVE.
const asked=[];let google,gBase,failNext=0;
const images=[];
const generateImage=async(o)=>{images.push(o);await new Promise(r=>setTimeout(r,250));if(/FAILSTILL/.test(o.prompt))throw Error('image model down');return{mime:'image/png',data:Buffer.concat([PNG,Buffer.from([images.length])]).toString('base64')}};
let server,ip=0;
test.before(async()=>{
 const polls=new Map();
 google=http.createServer((req,res)=>{
  const c=[];req.on('data',d=>c.push(d));req.on('end',()=>{
   const j=(s,o)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
   if(req.headers['x-goog-api-key']!=='test-gemini')return j(403,{error:{message:'API key not valid'}});
   if(req.method==='POST'&&req.url==='/v1beta/interactions'){
    const body=JSON.parse(Buffer.concat(c).toString());asked.push(body);
    if(failNext>0){failNext--;return j(429,{error:{message:'Resource has been exhausted'}})}
    const name='film'+asked.length;polls.set(name,0);
    return j(200,{id:'int-'+asked.length,status:'completed',steps:[{type:'model_output',content:[{type:'video',mime_type:'video/mp4',uri:gBase+'/v1beta/files/'+name}]}]});
   }
   let m=/^\/v1beta\/files\/(film\d+):download\?alt=media$/.exec(req.url);
   if(m){res.writeHead(200,{'Content-Type':'video/mp4'});return res.end(MP4)}
   m=/^\/v1beta\/files\/(film\d+)$/.exec(req.url);
   if(m){const n=polls.get(m[1])||0;polls.set(m[1],n+1);return j(200,{name:'files/'+m[1],state:n?'ACTIVE':'PROCESSING'})}
   j(404,{error:{message:'not found'}});
  });
 });
 await new Promise(r=>google.listen(0,'127.0.0.1',r));
 gBase='http://127.0.0.1:'+google.address().port;
 process.env.KAIROQ_GEMINI_API_BASE=gBase;
 server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>false,callModel:()=>{throw Error('no model')},secure:false,generateImage}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>{server.close();google.close();runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.4.0.'+(++ip)}});return{cookie:r.headers['set-cookie'][0].split(';')[0]}}
const credits=async cookie=>(await request(server,'GET','/api/create/me',{headers:{cookie}})).json.viewer.account.credits;
async function until(fn,ms=8000){const t=Date.now();for(;;){const v=await fn();if(v)return v;if(Date.now()-t>ms)throw Error('timed out');await new Promise(r=>setTimeout(r,30))}}

let project,owner;
test('off until GEMINI_API_KEY is set; then a photo becomes two stills to approve, paid for first',async()=>{
 owner=await signup('burger@example.com');const {cookie}=owner;
 project=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Stack House'}})).json.project.id;
 await request(server,'POST','/api/create/projects/'+project+'/assets',{headers:{cookie},body:{images:[{name:'burger.png',dataUrl:'data:image/png;base64,'+PNG.toString('base64')}]}});
 let r=await request(server,'GET','/api/create/projects/'+project+'/explodes',{headers:{cookie}});
 assert.equal(r.json.enabled,false);
 assert.equal((await request(server,'POST','/api/create/projects/'+project+'/explodes',{headers:{cookie},body:{photo:'burger.png'}})).status,503);
 assert.equal((await request(server,'GET','/api/create/me',{headers:{cookie}})).json.explode_generation.enabled,false);

 process.env.GEMINI_API_KEY='test-gemini';
 r=await request(server,'GET','/api/create/projects/'+project+'/explodes',{headers:{cookie}});
 assert.equal(r.json.enabled,true);assert.deepEqual(r.json.credits,{stills:3,film:25,reel:25});
 assert.deepEqual(r.json.photos.map(p=>p.name),['burger.png']);
 assert.equal((await request(server,'POST','/api/create/projects/'+project+'/explodes',{headers:{cookie},body:{photo:'missing.png'}})).status,400);
 const before=await credits(cookie);
 r=await request(server,'POST','/api/create/projects/'+project+'/explodes',{headers:{cookie},body:{photo:'burger.png',note:'a cheeseburger: <b>bun</b>, patty, cheese, lettuce'}});
 assert.equal(r.status,202,JSON.stringify(r.json));
 assert.equal(r.json.explode.status,'stills');
 assert.equal(await credits(cookie),before-3,'the stills are paid for before they start');
 // One at a time per project.
 assert.equal((await request(server,'POST','/api/create/projects/'+project+'/explodes',{headers:{cookie},body:{photo:'burger.png'}})).status,409);
 const e=await until(async()=>{const l=(await request(server,'GET','/api/create/projects/'+project+'/explodes',{headers:{cookie}})).json.explodes;return l[0].status==='review'&&l[0]});
 assert.equal(e.note,'a cheeseburger:  b bun /b , patty, cheese, lettuce'.replace(/\s+/g,' '));
 assert.deepEqual(e.stills,{start:'start.png',end:'end.png'});
 // The photo is the reference for the whole product; the whole product is the reference for the exploded one.
 const [whole,apart]=images.slice(-2);
 assert.equal(whole.references[0],'data:image/png;base64,'+PNG.toString('base64'));
 assert.equal(apart.references[0],'data:image/png;base64,'+Buffer.concat([PNG,Buffer.from([images.length-1])]).toString('base64'));
 assert.match(whole.prompt,/whole and assembled/);assert.match(apart.prompt,/Exploded-view/);assert.match(apart.prompt,/cheeseburger/);
 assert.equal(whole.aspect,'16:9');
 const still=await request(server,'GET','/api/create/projects/'+project+'/explodefile?id='+e.id+'&name=end.png',{headers:{cookie}});
 assert.equal(still.status,200);assert.equal(still.headers['content-type'],'image/png');
 assert.equal((await request(server,'GET','/api/create/projects/'+project+'/explodefile?id='+e.id+'&name=../../meta.json',{headers:{cookie}})).status,404);
 // Another account cannot see them.
 const other=await signup('other@example.com');
 assert.notEqual((await request(server,'GET','/api/create/projects/'+project+'/explodefile?id='+e.id+'&name=end.png',{headers:{cookie:other.cookie}})).status,200);
});

test('the film goes from the first still to the last, then becomes frames for the site; a failed film is refunded',async()=>{
 const {cookie}=owner;
 const e=(await request(server,'GET','/api/create/projects/'+project+'/explodes',{headers:{cookie}})).json.explodes[0];
 // Google is busy: the credits come back and the stills stay for another try.
 failNext=1;let before=await credits(cookie);
 let r=await request(server,'POST','/api/create/projects/'+project+'/explodes',{headers:{cookie},body:{op:'film',id:e.id}});
 assert.equal(r.status,202,JSON.stringify(r.json));
 let back=await until(async()=>{const x=(await request(server,'GET','/api/create/projects/'+project+'/explodes',{headers:{cookie}})).json.explodes[0];return x.status==='review'&&x.error&&x});
 assert.match(back.error,/Resource has been exhausted.*refunded/);
 assert.equal(await credits(cookie),before,'refunded');
 // Now with the reel.
 before=await credits(cookie);
 r=await request(server,'POST','/api/create/projects/'+project+'/explodes',{headers:{cookie},body:{op:'film',id:e.id,reel:true}});
 assert.equal(r.status,202);assert.equal(r.json.explode.status,'rendering');
 assert.equal(await credits(cookie),before-50);
 const done=await until(async()=>{const x=(await request(server,'GET','/api/create/projects/'+project+'/explodes',{headers:{cookie}})).json.explodes[0];return x.status==='done'&&x},20000);
 const [wide,tall]=asked.slice(-2);
 assert.equal(wide.model,'gemini-omni-1.1-flash');
 assert.deepEqual(wide.input.slice(0,2).map(i=>[i.type,i.mime_type]),[['image','image/png'],['image','image/png']]);
 assert.match(wide.input[2].text,/^<FIRST_FRAME> <LAST_FRAME> /);assert.match(wide.input[2].text,/cheeseburger/);
 assert.deepEqual(wide.response_format,{type:'video',aspect_ratio:'16:9',resolution:'720p',delivery:'uri'});
 assert.equal(tall.response_format.aspect_ratio,'9:16');
 assert.ok(done.frames>=8,'frames: '+done.frames);
 assert.equal(done.film,'film.mp4');assert.equal(done.reel,'reel.mp4');
 assert.match(done.site_message,new RegExp('<ScrollVideo src="\\./uploads/explode-'+done.id+'/" frames=\\{'+done.frames+'\\}'));
 const part=await request(server,'GET','/api/create/projects/'+project+'/explodefile?id='+done.id+'&name=film.mp4',{headers:{cookie,range:'bytes=0-99'}});
 assert.equal(part.status,206);assert.equal(part.buf.length,100);
 const dl=await request(server,'GET','/api/create/projects/'+project+'/explodefile?id='+done.id+'&name=reel.mp4&download=1',{headers:{cookie}});
 assert.match(dl.headers['content-disposition'],/reel\.mp4/);
 // Builds carry the frames.
 const out=fs.mkdtempSync(path.join(tmp,'pub-'));ev.copyInto(project,out);
 assert.equal(fs.readdirSync(path.join(out,'uploads','explode-'+done.id)).length,done.frames);
 assert.ok(fs.existsSync(path.join(out,'uploads','explode-'+done.id,'001.webp')));
});

test('Google\'s answer: inline films are read, and file addresses off the API host are refused',async()=>{
 assert.deepEqual(ev.findVideo({steps:[{type:'thought'},{type:'model_output',content:[{type:'text',text:'ok'},{type:'video',mime_type:'video/mp4',data:'AAAA'}]}]}),{type:'video',mime_type:'video/mp4',data:'AAAA'});
 assert.equal(ev.findVideo({steps:[]}),null);
 const env={GEMINI_API_KEY:'test-gemini',KAIROQ_GEMINI_API_BASE:gBase};
 const real=global.fetch;
 global.fetch=async(url,init)=>url.endsWith('/interactions')?new Response(JSON.stringify({steps:[{content:[{type:'video',uri:'https://evil.example/v1beta/files/x'}]}]}),{status:200}):real(url,init);
 try{await assert.rejects(ev.render({first:{mime:'image/png',data:'AA'},last:{mime:'image/png',data:'AA'},prompt:'p',env}),/does not trust/)}
 finally{global.fetch=real}
 await assert.rejects(ev.render({first:{mime:'image/png',data:'AA'},last:{mime:'image/png',data:'AA'},prompt:'p',env:{}}),/GEMINI_API_KEY/);
});

test('ScrollVideo: pinned, plays forward to the parts and back as the page scrolls',{timeout:240000},async(t)=>{
 if(!FFMPEG){t.diagnostic('ffmpeg is not installed here: skipped');return}
 const meta=builder.create({name:'Stack',owner:'owner'});
 // A finished explode film for this project, with its frames.
 const eid='abcdefabcdef',d=path.join(builder.projectDir(meta.id),'explodes',eid);
 fs.mkdirSync(d,{recursive:true});fs.copyFileSync(FILM,path.join(d,'film.mp4'));
 const frames=await ev.cutFrames(path.join(d,'film.mp4'),path.join(d,'frames'));
 const m=builder.loadMeta(meta.id);m.explodes=[{id:eid,photo:'x.png',status:'done',frames,stills:{start:'png',end:'png'},at:new Date().toISOString()}];builder.saveMeta(m);
 const app=`import { ScrollVideo } from 'kairoq/scroll';
export default function App(){return(<main>
 <section className="h-[70vh] grid place-items-center"><h1 className="text-5xl font-semibold">Stack House</h1></section>
 <ScrollVideo src="./uploads/explode-${eid}/" frames={${frames}} alt="Our burger, layer by layer" captions={[{title:'Brioche bun',text:'Baked every morning.'},{title:'Smashed patty',text:'Two thin patties.'},{title:'Aged cheddar'}]} />
 <section className="h-[80vh] grid place-items-center"><p>Order now</p></section>
</main>)}
`;
 await builder.initializeFrom(meta,{...design.starterFiles('Stack'),'src/App.jsx':app},'Stack');
 assert.ok(fs.existsSync(path.join(builder.versionDir(meta.id,1),'dist','uploads','explode-'+eid,'001.webp')),'the build carries the frames');
 if(!runtime.available()){t.diagnostic('no browser here: only the build was checked');return}
 const srv=http.createServer((req,res)=>{if(!builder.handlePreview(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const ctx=await(await runtime.browser()).newContext({viewport:{width:1280,height:800}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+srv.address().port+builder.previewUrl(builder.loadMeta(meta.id)),{waitUntil:'networkidle'});
  const geo=await page.evaluate(()=>{const el=document.querySelector('[data-kq-scroll-video]');return{top:el.getBoundingClientRect().top+scrollY,span:el.offsetHeight-innerHeight}});
  assert.ok(geo.span>=1500,'a tall section');
  const frameAt=async(f)=>{await page.evaluate(y=>scrollTo(0,y),geo.top+geo.span*f);await page.waitForTimeout(400);return page.evaluate(()=>Number(document.querySelector('[data-kq-scroll-video] canvas').dataset.kqFrame))};
  await page.locator('[data-kq-scroll-video] canvas[data-kq-drawn="true"]').waitFor({timeout:20000});
  const start=await frameAt(0),quarter=await frameAt(0.22),middle=await frameAt(0.5),back=await frameAt(0.78),end=await frameAt(1);
  assert.equal(start,0);
  assert.ok(quarter>start&&quarter<middle,'plays forward: '+[start,quarter,middle]);
  assert.equal(middle,frames-1,'apart in the middle');
  assert.ok(back<middle&&back>0,'and back: '+back);
  assert.equal(end,0,'together at the end');
  await frameAt(0.5);
  assert.equal(Math.round(await page.evaluate(()=>document.querySelector('[data-kq-scroll-video] [data-kq-scene]').getBoundingClientRect().top)),0,'pinned');
  const visible=await page.evaluate(()=>[...document.querySelectorAll('[data-kq-caption]')].filter(c=>getComputedStyle(c).opacity!=='0'&&!c.getAttribute('aria-hidden')).map(c=>c.textContent));
  assert.deepEqual(visible.length,1);
  if(process.env.KAIROQ_SHOT)await page.screenshot({path:process.env.KAIROQ_SHOT});
  // Reduced motion: the parts as a still, with every caption.
  const still=await ctx.newPage();await still.emulateMedia({reducedMotion:'reduce'});
  await still.goto(page.url(),{waitUntil:'networkidle'});
  assert.equal(await still.locator('[data-kq-scroll-video] img').count(),1);
  assert.equal(await still.locator('[data-kq-scroll-video] h3').count(),3);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();srv.close()}
});
