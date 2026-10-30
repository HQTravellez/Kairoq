"use strict";
// Executes deterministic verification files from the current in-memory project before a version is saved.
// Verification files live under src/verification/*.test.js|mjs and may import only relative project JS.
// They run in a temporary directory with a stripped environment and strict source guards.
const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
const TEST_RE=/^src\/verification\/.+\.test\.(?:js|mjs)$/;
const SAFE_MODULE_RE=/^(?:src\/(?:verification|lib|utils|domain|core)\/).+\.(?:js|mjs)$/;
const FORBIDDEN=[
 /\brequire\s*\(/, /\bimport\s*\(/, /\bprocess\b/, /\bglobalThis\b/, /\bfetch\s*\(/,
 /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\beval\s*\(/, /\bFunction\s*\(/,
 /\bchild_process\b/, /\bnode:/, /\bDeno\b/, /\bBun\b/
];
function tests(files={}){return Object.keys(files).filter(n=>TEST_RE.test(n)).sort()}
function resolveImport(from,spec,files){
 if(!spec.startsWith("."))throw Error(from+': verification imports must be relative; found "'+spec+'"');
 const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));
 const candidates=path.posix.extname(base)?[base]:[base+".js",base+".mjs"];
 const found=candidates.find(n=>Object.hasOwn(files,n));
 if(!found)throw Error(from+': verification import "'+spec+'" does not match a project file');
 if(!SAFE_MODULE_RE.test(found))throw Error(from+': verification may import only pure JS under src/lib, src/utils, src/domain, src/core or src/verification; found '+found);
 return found;
}
function imports(code){
 const out=[];
 for(const m of String(code).matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g))out.push(m[1]);
 return out;
}
function validate(name,code){
 if(typeof code!=="string")throw Error(name+" must be text");
 for(const re of FORBIDDEN)if(re.test(code))throw Error(name+": forbidden capability in verification code ("+re.source+")");
 if(/<\s*[A-Za-z][^>]*>/.test(code))throw Error(name+": verification modules must be pure JavaScript, not JSX");
}
function collect(files,entry,set=new Set()){
 if(set.has(entry))return set;
 const code=files[entry];validate(entry,code);set.add(entry);
 for(const spec of imports(code))collect(files,resolveImport(entry,spec,files),set);
 return set;
}
function numberFrom(text,re){const m=re.exec(String(text));return m?Number(m[1]):0}
function run(files={},opts={}){
 const entries=tests(files);
 if(!entries.length)return{ok:false,skipped:true,ran:0,passed:0,failed:0,files:[],output:"No src/verification/*.test.js files were found."};
 let needed=new Set();
 try{for(const e of entries)needed=collect(files,e,needed)}
 catch(e){return{ok:false,skipped:false,ran:entries.length,passed:0,failed:entries.length,files:entries,output:String(e.message||e).slice(0,4000)}}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-verify-"));
 try{
  fs.writeFileSync(path.join(dir,"package.json"),'{"type":"module","private":true}');
  for(const name of needed){
   const dest=path.join(dir,...name.split("/"));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,files[name],"utf8");
  }
  const timeout=Math.min(15000,Math.max(1000,Number(opts.timeoutMs)||8000));
  const child=spawnSync(process.execPath,["--test","--test-reporter=tap",...entries],{
   cwd:dir,encoding:"utf8",timeout,maxBuffer:1024*1024,
   env:{NODE_NO_WARNINGS:"1",TZ:"UTC"}
  });
  const output=String(child.stdout||"")+(child.stderr?"\n"+child.stderr:"");
  const passed=numberFrom(output,/# pass (\d+)/),failed=numberFrom(output,/# fail (\d+)/);
  const timedOut=Boolean(child.error&&child.error.code==="ETIMEDOUT");
  return{ok:child.status===0&&!timedOut,skipped:false,ran:entries.length,passed,failed:failed||(child.status===0?0:1),files:entries,timedOut,output:output.slice(0,12000)};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
module.exports={run,tests,collect,resolveImport};
