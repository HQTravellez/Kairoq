"use strict";
// Pictures of the starter templates for the gallery. The server builds each template once,
// opens it in Chromium and keeps a JPEG of its first screen (a phone screen for mobile
// templates). A picture is redone when its template's files change, and the build is thrown
// away afterwards. Until a picture exists the gallery shows a drawn card instead.
const fs=require('fs'),path=require('path'),crypto=require('crypto');

function dir(){return process.env.KAIROQ_TEMPLATE_THUMBS_DIR||path.join(path.dirname(require('./react-builder').ROOT()),'template-thumbs')}
// SHOT changes when the way pictures are taken changes, so every picture is taken again.
const SHOT='2';
function key(t){return crypto.createHash('sha256').update(SHOT+JSON.stringify(t.files)).digest('hex').slice(0,12)}
function file(t){return path.join(dir(),t.id+'-'+key(t)+'.jpg')}
// The gallery link for a template's picture, or null while there is none.
function url(t){return fs.existsSync(file(t))?'/api/create/templates/'+t.id+'/thumb.jpg?v='+key(t):null}
function read(id){
 const t=require('./create-templates').get(String(id||''));
 if(!t)return null;
 try{return fs.readFileSync(file(t))}catch{return null}
}

async function shoot(t,base){
 const builder=require('./react-builder'),runtime=require('./runtime-check');
 const meta=builder.create({name:t.name,owner:'kairoq-template-thumbs'});
 let context=null;
 try{
  const built=await builder.initializeFrom(meta,t.files,'Template picture');
  const phone=Boolean(t.mobile);
  context=await (await runtime.browser()).newContext(phone?{viewport:{width:390,height:780},deviceScaleFactor:1.6,isMobile:true,hasTouch:true}:{viewport:{width:1100,height:690},deviceScaleFactor:0.9});
  const page=await context.newPage();
  await page.goto(base+builder.previewUrl(built),{waitUntil:'load',timeout:30000});
  await page.waitForLoadState('networkidle',{timeout:12000}).catch(()=>{});
  // Photos that arrive late, and entrance animations, settle first.
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,8000)})))).catch(()=>{});
  await page.evaluate(()=>{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();scrollTo(0,0)}).catch(()=>{});
  await page.waitForTimeout(1500);
  fs.mkdirSync(dir(),{recursive:true});
  const out=file(t),tmp=out+'.'+process.pid+'.tmp';
  fs.writeFileSync(tmp,await page.screenshot({type:'jpeg',quality:80}));
  fs.renameSync(tmp,out);
  // Older pictures of this template go.
  for(const f of fs.readdirSync(dir()))if(f.startsWith(t.id+'-')&&f.endsWith('.jpg')&&path.join(dir(),f)!==out)fs.rmSync(path.join(dir(),f),{force:true});
  return true;
 }finally{
  if(context)await context.close().catch(()=>{});
  try{builder.remove(meta.id)}catch{}
 }
}
// Takes the pictures that are missing, one at a time. base: this server's own address.
let running=null;
function run({base,only}={}){
 if(running)return running;
 running=(async()=>{
  const out={made:[],failed:[]};
  if(!require('./runtime-check').available())return out;
  for(const t of require('./create-templates').TEMPLATES){
   if(only&&!only.includes(t.id))continue;
   if(fs.existsSync(file(t)))continue;
   try{await shoot(t,base);out.made.push(t.id)}catch(e){out.failed.push(t.id+': '+String(e.message||e).slice(0,200))}
  }
  return out;
 })().finally(()=>{running=null});
 return running;
}
module.exports={run,url,read,key,file};
