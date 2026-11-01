"use strict";
// Impeccable (pbakaus/impeccable, Apache-2.0): a deterministic design detector, 62 rules for the
// "made by AI" tells and quality problems (overused fonts, purple gradients, nested cards, flat
// type hierarchy, low contrast, tiny text, cramped padding, skipped headings…). No model, no key.
// Kairoq runs it as a second pair of eyes in the builder's loop (craft-check.js and the agent's
// kairoq_check): once on the app's source files and once on the rendered test build, and the
// findings go back to the builder with the other measured giveaways, so they are fixed before
// the owner sees the app. Fail-open: no binary, a crash or a timeout means no findings.
//
// The binary comes with the `impeccable` npm package (@impeccable/cli-linux-x64 on Railway);
// IMPECCABLE_BIN points at another copy (tests use a stub). URL scans use Kairoq's Chromium.

const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');

function binary(){
 if(process.env.IMPECCABLE_BIN)return fs.existsSync(process.env.IMPECCABLE_BIN)?process.env.IMPECCABLE_BIN:null;
 for(const p of [path.join(__dirname,'node_modules','.bin','impeccable'),path.join(__dirname,'node_modules','@impeccable','cli-'+({linux:'linux',darwin:'darwin',win32:'windows'}[process.platform]||process.platform)+'-'+({x64:'x64',arm64:'arm64'}[process.arch]||process.arch),'bin','impeccable')])if(fs.existsSync(p))return p;
 return null;
}
function enabled(env=process.env){return env.KAIROQ_IMPECCABLE!=='off'&&Boolean(binary())}
function chromium(){return[process.env.CHROMIUM_PATH,'/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>p&&fs.existsSync(p))||''}

// `impeccable detect --json <targets>` → the findings array ([] when clean, unavailable or failed).
function scan(targets,{cwd=os.tmpdir(),timeout=60000,env={}}={}){
 const bin=binary();
 if(!bin||!targets.length)return Promise.resolve([]);
 return new Promise(resolve=>{
  let out='',err='',done=false;
  const finish=v=>{if(!done){done=true;resolve(v)}};
  let child;
  try{child=spawn(bin,['detect','--json','--no-advisory',...targets],{cwd,env:{...process.env,IMPECCABLE_BROWSER:chromium(),IMPECCABLE_HOME:path.join(os.tmpdir(),'impeccable-home'),...env},stdio:['ignore','pipe','pipe']})}
  catch(e){return finish([])}
  const timer=setTimeout(()=>{try{child.kill('SIGKILL')}catch{}finish([])},timeout);
  child.stdout.on('data',d=>{out+=d});child.stderr.on('data',d=>{err+=d});
  child.on('error',()=>{clearTimeout(timer);finish([])});
  child.on('close',code=>{
   clearTimeout(timer);
   if(code!==0&&code!==2){if(err)console.warn('[impeccable]',String(err).slice(0,300));return finish([])}
   const text=out.trim();if(!text)return finish([]);
   try{const list=JSON.parse(text);finish(Array.isArray(list)?list:[])}catch{finish([])}
  });
 });
}

// Findings → the craft check's issue shape ({severity, kind, issue, fix}), one per rule, the
// worst first, with the file and the snippet so the builder knows where to look.
function issues(findings){
 const byRule=new Map();
 for(const f of findings||[]){
  if(!f||!f.antipattern||f.advisory===true||f.severity==='advisory')continue;
  const id=String(f.antipattern);
  const where=f.file&&!/^https?:/.test(f.file)?'('+String(f.file).replace(/^.*?(src\/|index\.html)/,'$1')+(f.line?':'+f.line:'')+')':'';
  const snippet=f.snippet?String(f.snippet).replace(/\s+/g,' ').trim().slice(0,160):'';
  const cur=byRule.get(id);
  if(cur){cur.count++;if(cur.count<=3&&where&&!cur.where.includes(where))cur.where.push(where);continue}
  byRule.set(id,{id,name:String(f.name||id),description:String(f.description||'').trim(),severity:'major',snippet,where:where?[where]:[],count:1,category:f.category||''});
 }
 return[...byRule.values()].sort((a,b)=>b.count-a.count).map(r=>({
  severity:r.severity,kind:'impeccable:'+r.id,
  issue:r.name+(r.snippet?': '+r.snippet:'')+(r.where.length?' '+r.where.join(' '):'')+(r.count>1?' (and '+(r.count-1)+' more)':''),
  fix:r.description||'Remove this pattern everywhere it appears.',
 }));
}

// The check the builder loop calls: the app's files (src/ and index.html) as a folder, and the
// rendered page when a URL is given. Returns craft-check issues; [] when nothing or unavailable.
async function check({files,url}={}){
 if(!enabled())return[];
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kq-impeccable-'));
 try{
  const targets=[];
  if(files&&typeof files==='object'){
   let n=0;
   for(const [name,body] of Object.entries(files)){
    if(!/^(src\/.*\.(jsx?|tsx?|css|html)|index\.html)$/.test(name)||typeof body!=='string')continue;
    const f=path.join(dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,body);n++;
   }
   if(n)targets.push(dir);
  }
  // A preview path ('/builder/p/…') is served by this very server.
  const abs=url?(/^https?:\/\//.test(String(url))?String(url):'http://127.0.0.1:'+Number(process.env.PORT||3002)+String(url)):'';
  if(abs&&chromium())targets.push(abs);
  if(!targets.length)return[];
  const found=await scan(targets,{cwd:dir,timeout:Number(process.env.KAIROQ_IMPECCABLE_TIMEOUT||90000)});
  return issues(found);
 }catch(e){console.warn('[impeccable]',String(e.message||e).slice(0,200));return[]}
 finally{fs.rmSync(dir,{recursive:true,force:true})}
}

module.exports={binary,enabled,scan,issues,check};
