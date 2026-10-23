"use strict";
// Opt-in evaluation only. Existing Kairoq builder, auth, DB and deployments unchanged.
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const api=require("../api-learning");
function onlookCompatibility(files){
 if(!files||typeof files!=="object"||Array.isArray(files))throw Error("File map required");
 const names=Object.keys(files),jsx=names.filter(n=>/^src\/.*\.(jsx|tsx)$/.test(n));
 const combined=jsx.map(n=>String(files[n]||"")).join("\n").slice(0,200000);
 return {mode:"onlook-inspired-inspection",directOnlookCompatible:false,
  reason:"Kairoq builds Vite/React; Onlook's published editor primarily targets Next.js/Tailwind",
  jsxFiles:jsx.length,sourceMarkers:(combined.match(/data-kq=/g)||[]).length,
  styledElements:(combined.match(/className=/g)||[]).length,
  hasDesignTokens:String(files["src/index.css"]||"").includes("kairoq:tokens")};
}
async function inspectVisualDom(page){
 if(!page||typeof page.evaluate!=="function")throw Error("Playwright page required");
 return page.evaluate(()=>[...document.querySelectorAll("[data-kq]")].filter(e=>{
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);
  return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden";
 }).slice(0,200).map(e=>{
  const s=getComputedStyle(e),r=e.getBoundingClientRect();
  return {source:String(e.getAttribute("data-kq")).slice(0,160),tag:e.tagName.toLowerCase(),
   classes:typeof e.className==="string"?e.className.slice(0,200):"",
   bounds:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)},
   style:{display:s.display,position:s.position,gap:s.gap,padding:s.padding,fontSize:s.fontSize,color:s.color,background:s.backgroundColor}};
 }));
}
function validateLocalSpec(raw){
 const str=typeof raw==="string"?raw:JSON.stringify(raw);
 if(Buffer.byteLength(str)>2_000_000)throw Error("2 MB OpenAPI limit");
 const spec=JSON.parse(str),plan=api.learn(spec);
 function check(v,d=0){
  if(d>50)throw Error("Spec nesting limit");
  if(!v||typeof v!=="object")return;
  for(const [k,x] of Object.entries(v)){
   if(k==="$ref"&&(!String(x).startsWith("#/")||String(x).includes("..")))throw Error("External OpenAPI references forbidden");
   if(k==="externalValue")throw Error("External OpenAPI examples forbidden");
   check(x,d+1);
  }
 }
 check(spec);return {spec,plan};
}
function run(bin,args,opts){
 return new Promise((resolve,reject)=>{
  const child=cp.spawn(bin,args,{cwd:opts.cwd,env:opts.env,stdio:["ignore","pipe","pipe"]});
  let stdout="",stderr="",done=false;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(result)};
  child.stdout.on("data",x=>stdout=(stdout+x).slice(-30000));
  child.stderr.on("data",x=>stderr=(stderr+x).slice(-30000));
  child.on("error",finish);child.on("close",code=>code===0?finish(null,{stdout}):finish(Error("Trial process exit "+code+": "+stderr.slice(-1000))));
  const timer=setTimeout(()=>{child.kill("SIGKILL");finish(Error("Trial timeout"))},opts.timeout||90000);
 });
}
async function heyApiTrial(raw,{bin=path.resolve(__dirname,"../node_modules/.bin/openapi-ts")}={}){
 const {spec,plan}=validateLocalSpec(raw);
 if(!path.isAbsolute(bin))throw Error("Absolute SDK generator path required");
 if(!fs.existsSync(bin))return {status:"unavailable",operations:plan.operations.length};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-hey-"));
 try{
  const input=path.join(dir,"spec.json"),output=path.join(dir,"sdk");
  fs.writeFileSync(input,JSON.stringify(spec));
  await run(bin,["-i",input,"-o",output],{cwd:dir,env:{PATH:process.env.PATH||"/usr/bin:/bin",HOME:dir,TMPDIR:dir,CI:"true"}});
  if(!fs.existsSync(output))throw Error("Generator returned no output");
  const names=fs.readdirSync(output);
  if(!names.length)throw Error("No generated SDK artifacts");
  return {status:"generated",operations:plan.operations.length,files:names};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
function localPreview(raw){
 const u=new URL(raw);
 if(u.protocol!=="http:"||!["localhost","127.0.0.1","[::1]"].includes(u.hostname)||u.username||u.password)
  throw Error("Only local HTTP previews supported");
 return u.href;
}
async function stagehandTrial(raw,{runner=path.join(__dirname,"stagehand-readonly.mjs")}={}){
 const url=localPreview(raw);
 if(!process.env.KAIROQ_STAGEHAND_TRIAL_KEY)return{status:"unavailable",reason:"Missing isolated test key"};
 const response=await run(process.execPath,[runner,url],{
  cwd:path.dirname(__dirname),timeout:120000,
  env:{PATH:process.env.PATH||"/usr/bin:/bin",HOME:os.tmpdir(),KAIROQ_STAGEHAND_TRIAL_KEY:process.env.KAIROQ_STAGEHAND_TRIAL_KEY,
   KAIROQ_STAGEHAND_TRIAL_MODEL:process.env.KAIROQ_STAGEHAND_TRIAL_MODEL||"openai/gpt-5.4-mini"}
 });
 try{return JSON.parse(response.stdout.trim().split("\n").at(-1))}
 catch{throw Error("Stagehand returned no structured report")}
}
module.exports={onlookCompatibility,inspectVisualDom,validateLocalSpec,heyApiTrial,localPreview,stagehandTrial};
