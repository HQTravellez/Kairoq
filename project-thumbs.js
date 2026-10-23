"use strict";
// Pictures of the owner's apps for the project cards. After a build (and for older projects the
// first time they are listed) the server opens the current version in Chromium and keeps a JPEG
// of its first screen. One picture per project; a new version replaces it. Until a picture
// exists the card shows its initials.
const fs=require('fs'),path=require('path');

function dir(){return process.env.KAIROQ_PROJECT_THUMBS_DIR||path.join(path.dirname(require('./react-builder').ROOT()),'project-thumbs')}
function file(id,version){return path.join(dir(),id+'-v'+version+'.jpg')}
const valid=id=>/^[a-f0-9]{12}$/.test(String(id));
function base(){return process.env.KAIROQ_THUMBS_BASE||'http://127.0.0.1:'+(process.env.PORT||3002)}

// The card link for a project's picture (summary from react-builder list()), or null while there is none.
function url(p){
 if(!p||!valid(p.id)||!p.current_version)return null;
 if(!fs.existsSync(file(p.id,p.current_version))){later(p.id);return null}
 return '/api/create/projects/'+p.id+'/thumb?v='+p.current_version;
}
function read(id){
 if(!valid(id))return null;
 try{const m=require('./react-builder').loadMeta(id);return fs.readFileSync(file(id,m.current_version))}catch{return null}
}

async function shoot(id){
 const builder=require('./react-builder'),runtime=require('./runtime-check');
 const meta=builder.loadMeta(id),version=meta.current_version;
 if(!version||fs.existsSync(file(id,version)))return false;
 const phone=Boolean(meta.mobile&&meta.mobile.enabled);
 const context=await (await runtime.browser()).newContext(phone?{viewport:{width:390,height:780},deviceScaleFactor:1.6,isMobile:true,hasTouch:true}:{viewport:{width:1100,height:690},deviceScaleFactor:0.9});
 try{
  const page=await context.newPage();
  await page.goto(base()+builder.previewUrl(meta,version),{waitUntil:'load',timeout:30000});
  await page.waitForLoadState('networkidle',{timeout:12000}).catch(()=>{});
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,8000)})))).catch(()=>{});
  await page.evaluate(()=>{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();scrollTo(0,0)}).catch(()=>{});
  await page.waitForTimeout(1200);
  fs.mkdirSync(dir(),{recursive:true});
  const out=file(id,version),tmp=out+'.'+process.pid+'.tmp';
  fs.writeFileSync(tmp,await page.screenshot({type:'jpeg',quality:78}));
  fs.renameSync(tmp,out);
  for(const f of fs.readdirSync(dir()))if(f.startsWith(id+'-v')&&f.endsWith('.jpg')&&path.join(dir(),f)!==out)fs.rmSync(path.join(dir(),f),{force:true});
  return true;
 }finally{await context.close().catch(()=>{})}
}

// Pictures are taken one at a time in the background; asking twice for the same project is fine.
// Only the running server takes pictures (server.js calls start()); code that merely lists
// projects, such as the tests, never opens a browser in the background.
const queue=new Set(),failed=new Map();
let running=false,on=false;
function start(){on=process.env.KAIROQ_PROJECT_THUMBS!=='off'}
function later(id){
 if(!on||!valid(id)||!require('./runtime-check').available())return;
 const f=failed.get(id);if(f&&Date.now()-f<10*60*1000)return;
 queue.add(id);
 if(!running){running=true;setImmediate(drain)}
}
async function drain(){
 try{
  while(queue.size){
   const id=queue.values().next().value;queue.delete(id);
   try{await shoot(id);failed.delete(id)}catch(e){failed.set(id,Date.now());console.warn('[project-thumbs]',id,String(e.message||e).slice(0,160))}
  }
 }finally{running=false}
}
module.exports={url,read,later,shoot,file,start};
