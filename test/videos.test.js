"use strict";
// Launch clips and hero videos from the project's photos (video-gen.js), against a stand-in
// for fal.ai's queue: the photo is sent as the image, credits are taken first and given back
// when a clip fails, finished clips play in ranges and download, and hero videos go into builds.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-videos-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='35';
process.env.KAIROQ_VIDEO_POLL_MS='20';
delete process.env.FAL_KEY;delete process.env.FAL_API_KEY;
const builder=require('../react-builder'),createApi=require('../create-api'),vg=require('../video-gen');

const MP4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(3000,7)]);
const PNG=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(200,1)]);
const seen=[];
let fal,falBase;
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json=null;try{json=JSON.parse(buf.toString())}catch{}resolve({status:res.statusCode,headers:res.headers,buf,json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
test.before(async()=>{
 // fal.ai's queue: submit, status (once in the queue, then done), result, and the file.
 const polls=new Map();
 fal=http.createServer((req,res)=>{
  const c=[];req.on('data',d=>c.push(d));req.on('end',()=>{
   const j=(s,o)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
   if(req.url==='/files/clip.mp4'){res.writeHead(200,{'Content-Type':'video/mp4'});return res.end(MP4)}
   if(req.headers.authorization!=='Key test-fal')return j(401,{detail:'bad key'});
   if(req.method==='POST'&&req.url==='/fal-ai/wan/v2.2-a14b/image-to-video'){
    const body=JSON.parse(Buffer.concat(c).toString());seen.push(body);
    if(/FAIL/.test(body.prompt))return j(422,{detail:'content not allowed'});
    const rid='req-'+String(seen.length).padStart(8,'0');polls.set(rid,0);
    return j(200,{request_id:rid,status_url:falBase+'/fal-ai/wan/requests/'+rid+'/status',response_url:falBase+'/fal-ai/wan/requests/'+rid});
   }
   const m=/^\/fal-ai\/wan\/requests\/([\w-]+)(\/status)?$/.exec(req.url);
   if(m&&m[2]){const n=polls.get(m[1])||0;polls.set(m[1],n+1);return j(200,{status:n?'COMPLETED':'IN_QUEUE'})}
   if(m)return j(200,{video:{url:falBase+'/files/clip.mp4',content_type:'video/mp4'}});
   j(404,{});
  });
 });
 await new Promise(r=>fal.listen(0,'127.0.0.1',r));
 falBase='http://127.0.0.1:'+fal.address().port;
 server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>false,callModel:()=>{throw Error('no model')},secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>{server.close();fal.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.3.0.'+(++ip)}});return{cookie:r.headers['set-cookie'][0].split(';')[0]}}
const credits=async cookie=>(await request(server,'GET','/api/create/me',{headers:{cookie}})).json.viewer.account.credits;
async function until(fn,ms=5000){const t=Date.now();for(;;){const v=await fn();if(v)return v;if(Date.now()-t>ms)throw Error('timed out');await new Promise(r=>setTimeout(r,30))}}

test('videos stay off until FAL_KEY is set, then make launch clips from the owner\'s photos',async()=>{
 const {cookie}=await signup('clips@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Cafe Sol'}})).json.project.id;
 await request(server,'POST','/api/create/projects/'+id+'/assets',{headers:{cookie},body:{images:[{name:'terrace.png',dataUrl:'data:image/png;base64,'+PNG.toString('base64')},{name:'coffee.png',dataUrl:'data:image/png;base64,'+PNG.toString('base64')}]}});
 let r=await request(server,'GET','/api/create/projects/'+id+'/videos',{headers:{cookie}});
 assert.equal(r.json.enabled,false);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/videos',{headers:{cookie},body:{kind:'launch',photos:['terrace.png']}})).status,503);
 assert.equal((await request(server,'GET','/api/create/me',{headers:{cookie}})).json.video_generation.enabled,false);

 process.env.FAL_KEY='test-fal';process.env.KAIROQ_FAL_QUEUE_URL=falBase;
 r=await request(server,'GET','/api/create/projects/'+id+'/videos',{headers:{cookie}});
 assert.equal(r.json.enabled,true);assert.equal(r.json.credits,10);
 assert.deepEqual(r.json.photos.map(p=>p.name),['coffee.png','terrace.png']);
 const before=await credits(cookie);
 r=await request(server,'POST','/api/create/projects/'+id+'/videos',{headers:{cookie},body:{kind:'launch',photos:['terrace.png','coffee.png'],note:'steam rising'}});
 assert.equal(r.status,202,JSON.stringify(r.json));assert.equal(r.json.started.length,2);assert.equal(r.json.credits,20);
 assert.equal(await credits(cookie),before-20,'both clips are paid for before they start');
 const clips=await until(async()=>{const l=(await request(server,'GET','/api/create/projects/'+id+'/videos',{headers:{cookie}})).json.videos;return l.every(v=>v.status==='done')&&l});
 assert.equal(clips.length,2);
 const sent=seen.slice(-2);
 for(const b of sent){
  assert.match(b.image_url,/^data:image\/png;base64,/,'the owner\'s photo is the image');
  assert.equal(b.aspect_ratio,'9:16');assert.equal(b.resolution,'720p');
  assert.match(b.prompt,/Cafe Sol/);assert.match(b.prompt,/steam rising/);assert.match(b.prompt,/No new objects, people, text or logos/);
 }
 // The clip plays in ranges (Safari needs them) and downloads as a file.
 const name=clips[0].name;assert.match(name,/^clip-[a-f0-9]{12}\.mp4$/);
 const part=await request(server,'GET','/api/create/projects/'+id+'/video?name='+name,{headers:{cookie,range:'bytes=0-11'}});
 assert.equal(part.status,206);assert.equal(part.buf.slice(4,8).toString(),'ftyp');assert.equal(part.headers['content-range'],'bytes 0-11/'+MP4.length);
 const file=await request(server,'GET','/api/create/projects/'+id+'/video?name='+name+'&download=1',{headers:{cookie}});
 assert.equal(file.status,200);assert.match(file.headers['content-disposition'],/attachment/);assert.equal(file.buf.length,MP4.length);
 assert.equal((await request(server,'GET','/api/create/projects/'+id+'/video?name=../meta.json',{headers:{cookie}})).status,404);
 // Another account cannot see them.
 const other=await signup('other@example.com');
 assert.equal((await request(server,'GET','/api/create/projects/'+id+'/videos',{headers:{cookie:other.cookie}})).status,404);
 // A clip fal refuses is refunded; asking for more than the balance starts nothing.
 const mid=await credits(cookie);
 r=await request(server,'POST','/api/create/projects/'+id+'/videos',{headers:{cookie},body:{kind:'launch',photos:['terrace.png'],note:'FAIL please'}});
 assert.equal(r.status,202);
 const failed=await until(async()=>(await request(server,'GET','/api/create/projects/'+id+'/videos',{headers:{cookie}})).json.videos.find(v=>v.status==='failed'));
 assert.match(failed.error,/content not allowed/);
 assert.equal(await credits(cookie),mid,'the failed clip was refunded');
 r=await request(server,'POST','/api/create/projects/'+id+'/videos',{headers:{cookie},body:{kind:'launch',photos:['terrace.png','coffee.png']}});
 assert.equal(r.status,402);assert.equal(await credits(cookie),mid);
 // Removing a clip removes its file.
 r=await request(server,'DELETE','/api/create/projects/'+id+'/videos',{headers:{cookie},body:{id:clips[0].id}});
 assert.equal(r.json.videos.length,2);assert.equal(vg.read(id,name),null);
 delete process.env.FAL_KEY;
});

test('a hero video goes into every build and the chat message that puts it on the site',async()=>{
 process.env.FAL_KEY='test-fal';process.env.KAIROQ_FAL_QUEUE_URL=falBase;
 const meta=builder.create({name:'Villa Mar',owner:'owner'});
 require('../react-assets').save(meta.id,[{name:'pool.png',mime:'image/png',data:PNG.toString('base64')}]);
 const [v]=vg.start(meta.id,{kind:'hero',photos:['pool.png','ignored.png']});
 const done=await until(()=>vg.list(meta.id).find(x=>x.id===v.id&&x.status==='done'));
 assert.equal(seen.at(-1).aspect_ratio,'16:9');assert.match(seen.at(-1).prompt,/loop/);
 assert.equal(done.path,'./uploads/'+done.name);
 assert.match(done.site_message,new RegExp('\\./uploads/'+done.name));assert.match(done.site_message,/muted/);assert.match(done.site_message,/prefers-reduced-motion/);assert.match(done.site_message,/poster="\.\/uploads\/pool\.png"/);
 const pub=path.join(tmp,'public');vg.copyInto(meta.id,pub);
 assert.ok(fs.existsSync(path.join(pub,'uploads',done.name)),'hero videos are copied into builds');
 // A clip left running by a restart is marked failed and refunded.
 const m=builder.loadMeta(meta.id);m.videos.unshift({id:'aaaaaaaaaaaa',kind:'launch',photo:'pool.png',status:'running',at:new Date(Date.now()-60*60000).toISOString(),credits:10,ref:'video:x:1'});builder.saveMeta(m);
 const refunds=[];vg.sweep(meta.id,{refund:(n,ref)=>refunds.push([n,ref])});
 assert.deepEqual(refunds,[[10,'video:x:1']]);assert.equal(vg.list(meta.id)[0].status,'failed');
 assert.throws(()=>vg.start(meta.id,{kind:'launch',photos:['missing.png']}),/Pick a PNG/);
 delete process.env.FAL_KEY;
});

test('built sites serve videos in ranges',async()=>{
 const dir=fs.mkdtempSync(path.join(tmp,'dist-'));fs.writeFileSync(path.join(dir,'index.html'),'<p>x</p>');fs.mkdirSync(path.join(dir,'uploads'));fs.writeFileSync(path.join(dir,'uploads','hero-abcdefabcdef.mp4'),MP4);
 const s=http.createServer((req,res)=>builder.serveDist?builder.serveDist(req,res,dir,req.url,{sandbox:false}):res.end());
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 try{
  if(!builder.serveDist)return;
  const r=await request(s,'GET','/uploads/hero-abcdefabcdef.mp4',{headers:{range:'bytes=4-7'}});
  assert.equal(r.status,206);assert.equal(r.headers['content-type'],'video/mp4');assert.equal(r.buf.toString(),'ftyp');
  const all=await request(s,'GET','/uploads/hero-abcdefabcdef.mp4');
  assert.equal(all.status,200);assert.equal(all.headers['accept-ranges'],'bytes');assert.equal(all.buf.length,MP4.length);
 }finally{s.close()}
});
