"use strict";
// Kairoq-owned adapter around Graphify's deterministic AST extractor.
// Generated project files stay local: they are materialized into a temporary
// directory, analyzed by a pinned local Python package, then immediately removed.
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {execFile}=require("node:child_process"),{promisify}=require("node:util");
const execFileAsync=promisify(execFile);
const CODE=/\.(?:[cm]?[jt]sx?|py|go|rs|java|c|h|cc|cpp|hpp|rb|cs|kt|kts|scala|php)$/i;
const MAX_FILES=1200,MAX_BYTES=8*1024*1024,MAX_OUTPUT=12*1024*1024;
const cache=new Map();

function safePath(name){
 return typeof name==="string"&&name.length<=300&&!name.includes("\\")&&!path.posix.isAbsolute(name)&&
  !name.split("/").some(x=>!x||x==="."||x==="..")&&!/(^|\/)(?:\.git|node_modules|\.env(?:\.|$)|uploads)(\/|$)/i.test(name);
}
function sourceFiles(files={}){
 const out={};let total=0;
 for(const name of Object.keys(files).sort()){
  const body=files[name];
  if(!safePath(name)||!CODE.test(name)||typeof body!=="string")continue;
  const n=Buffer.byteLength(body);
  if(n>1_000_000||total+n>MAX_BYTES||Object.keys(out).length>=MAX_FILES)continue;
  total+=n;out[name]=body;
 }
 return out;
}
function fingerprint(files){
 const h=crypto.createHash("sha1");
 for(const [name,body] of Object.entries(sourceFiles(files))){h.update(name);h.update("\0");h.update(body);h.update("\0")}
 return h.digest("hex");
}
function pythonPath(env=process.env){return String(env.KAIROQ_GRAPHIFY_PYTHON||"/opt/kairoq-graphify/bin/python").trim()}
function available(env=process.env){
 if(["off","false","0"].includes(String(env.KAIROQ_GRAPHIFY||"on").toLowerCase()))return false;
 try{return fs.existsSync(pythonPath(env))&&fs.existsSync(path.join(__dirname,"scripts","graphify-kairoq.py"))}catch{return false}
}
function materialize(files,root){
 for(const [name,body] of Object.entries(sourceFiles(files))){
  const target=path.join(root,...name.split("/"));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body,"utf8");
 }
}
function normNode(n){
 const id=String(n?.id||n?.name||n?.label||"").slice(0,500);
 return{id,label:String(n?.label||n?.name||id).slice(0,240),file:String(n?.source_file||n?.filePath||n?.file_path||"").slice(0,300),
  kind:String(n?.kind||n?.type||n?.file_type||"symbol").slice(0,80)};
}
function normalize(raw,source,fp){
 const nodes=(Array.isArray(raw?.nodes)?raw.nodes:[]).map(normNode).filter(n=>n.id);
 const ids=new Set(nodes.map(n=>n.id));
 const edges=(Array.isArray(raw?.edges)?raw.edges:[]).map(e=>({
   source:String(e?.source||""),target:String(e?.target||""),relation:String(e?.relation||e?.type||"related").slice(0,100),
   confidence:String(e?.confidence||"EXTRACTED").slice(0,30),
   score:Number.isFinite(Number(e?.confidence_score))?Number(e.confidence_score):1
 })).filter(e=>ids.has(e.source)&&ids.has(e.target));
 return{source,fingerprint:fp,version:String(raw?.upstream_version||""),mode:String(raw?.mode||"structural"),nodes,edges,
   stats:{nodes:nodes.length,edges:edges.length,files:new Set(nodes.map(n=>n.file).filter(Boolean)).size}};
}
async function graphifyExtract(files,{env=process.env,runner}={}){
 const src=sourceFiles(files),fp=fingerprint(src);
 if(typeof runner==="function")return normalize(await runner(src),"graphify",fp);
 if(!available(env))throw Error("Graphify is not installed");
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-graphify-"));
 try{
  materialize(src,dir);
  const {stdout}=await execFileAsync(pythonPath(env),[path.join(__dirname,"scripts","graphify-kairoq.py"),dir],{
   timeout:Math.max(3000,Math.min(60000,Number(env.KAIROQ_GRAPHIFY_TIMEOUT_MS)||20000)),
   maxBuffer:MAX_OUTPUT,env:{PATH:process.env.PATH||"",PYTHONNOUSERSITE:"1",PYTHONDONTWRITEBYTECODE:"1"}
  });
  const raw=JSON.parse(String(stdout||"{}"));if(raw.error)throw Error(raw.error);
  return normalize(raw,"graphify",fp);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
function fallback(files){
 const src=sourceFiles(files),fp=fingerprint(src);
 try{
  const raw=require("./integrations/agent-stack/understand").graph(src,{name:"Kairoq project",commit:fp,analyzedAt:new Date(0).toISOString()});
  return normalize(raw,"native-import-fallback",fp);
 }catch{return normalize({nodes:Object.keys(src).map(n=>({id:n,label:path.posix.basename(n),source_file:n,type:"file"})),edges:[]},"native-file-fallback",fp)}
}
async function build(files,{projectId="",env=process.env,runner,force=false}={}){
 const fp=fingerprint(files),key=String(projectId||"anonymous");
 const hit=cache.get(key);if(!force&&hit?.fingerprint===fp)return hit;
 let graph;
 try{graph=await graphifyExtract(files,{env,runner})}catch(e){graph=fallback(files);graph.warning=String(e.message||e).slice(0,300)}
 cache.set(key,graph);if(cache.size>50)cache.delete(cache.keys().next().value);
 return graph;
}
function words(q){return [...new Set(String(q||"").toLowerCase().match(/[a-z0-9_.$/-]{2,}/g)||[])].slice(0,20)}
function nodeScore(n,terms){
 const hay=(n.id+" "+n.label+" "+n.file+" "+n.kind).toLowerCase();let score=0;
 for(const t of terms){if(n.label.toLowerCase()===t)score+=8;else if(n.id.toLowerCase().includes(t))score+=5;else if(n.file.toLowerCase().includes(t))score+=4;else if(hay.includes(t))score+=2}
 return score;
}
function query(graph,q,{limit=12,neighbors=24}={}){
 const terms=words(q);if(!terms.length)return{matches:graph.nodes.slice(0,limit),neighbors:[]};
 const matches=graph.nodes.map(n=>({n,score:nodeScore(n,terms)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.n.id.localeCompare(b.n.id)).slice(0,limit);
 const ids=new Set(matches.map(x=>x.n.id)),near=[],seen=new Set(ids);
 for(const e of graph.edges){
  let id=null,via=null;if(ids.has(e.source)&&!seen.has(e.target)){id=e.target;via=e}else if(ids.has(e.target)&&!seen.has(e.source)){id=e.source;via=e}
  if(id){const n=graph.nodes.find(x=>x.id===id);if(n){near.push({node:n,via});seen.add(id);if(near.length>=neighbors)break}}
 }
 return{matches:matches.map(x=>({...x.n,score:x.score})),neighbors:near,source:graph.source,stats:graph.stats};
}
function resolveNode(graph,term){
 const ranked=query(graph,term,{limit:1,neighbors:0}).matches;return ranked[0]||null;
}
function shortestPath(graph,from,to,{maxDepth=8}={}){
 const a=resolveNode(graph,from),b=resolveNode(graph,to);if(!a||!b)return{found:false,from:a,to:b,path:[]};
 const adj=new Map();for(const n of graph.nodes)adj.set(n.id,[]);
 for(const e of graph.edges){adj.get(e.source)?.push({id:e.target,edge:e,direction:"out"});adj.get(e.target)?.push({id:e.source,edge:e,direction:"in"})}
 const q=[a.id],prev=new Map([[a.id,null]]),via=new Map(),depth=new Map([[a.id,0]]);
 while(q.length){const cur=q.shift();if(cur===b.id)break;for(const x of adj.get(cur)||[]){if(prev.has(x.id)||depth.get(cur)>=maxDepth)continue;prev.set(x.id,cur);via.set(x.id,x);depth.set(x.id,depth.get(cur)+1);q.push(x.id)}}
 if(!prev.has(b.id))return{found:false,from:a,to:b,path:[]};
 const ids=[];for(let cur=b.id;cur;cur=prev.get(cur))ids.push(cur);ids.reverse();
 return{found:true,from:a,to:b,path:ids.map((id,i)=>({node:graph.nodes.find(n=>n.id===id),via:i?via.get(id):null}))};
}
function impact(graph,changed,{limit=80}={}){
 const files=new Set((Array.isArray(changed)?changed:[]).filter(Boolean)),seed=new Set(graph.nodes.filter(n=>files.has(n.file)||files.has(n.id)).map(n=>n.id));
 const affected=new Set(seed),queue=[...seed];
 while(queue.length&&affected.size<limit*4){const target=queue.shift();for(const e of graph.edges){if(e.target===target&&!affected.has(e.source)){affected.add(e.source);queue.push(e.source)}}}
 const nodes=graph.nodes.filter(n=>affected.has(n.id)).slice(0,limit);
 return{changed:[...files],affectedFiles:[...new Set(nodes.map(n=>n.file).filter(Boolean))].sort(),nodes,source:graph.source};
}
function invalidate(projectId){cache.delete(String(projectId||"anonymous"))}
module.exports={safePath,sourceFiles,fingerprint,available,build,query,shortestPath,impact,invalidate,normalize};
