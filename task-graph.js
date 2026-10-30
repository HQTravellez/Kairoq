"use strict";
// Persistent tracer-bullet task graph inspired by mattpocock/skills (MIT).
// Tasks describe vertical, independently verifiable behavior; dependency edges determine the ready frontier.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const builder=require("./react-builder");
function key(instruction){return crypto.createHash("sha256").update(String(instruction||"")).digest("hex")}
function file(id,{root}={}){return path.join(root||builder.projectDir(id),".engineering-task-graph.json")}
function readAll(id,opts={}){try{const x=JSON.parse(fs.readFileSync(file(id,opts),"utf8"));return x&&x.graphs?x:{graphs:{}}}catch{return{graphs:{}}}}
function writeAll(id,data,opts={}){const f=file(id,opts),tmp=f+"."+process.pid+".tmp";fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(tmp,JSON.stringify(data,null,1));fs.renameSync(tmp,f)}
function clean(v,n){return String(v??"").replace(/\s+/g," ").trim().slice(0,n)}
function normalizeTask(t,i){
 const id=clean(t?.id||"T"+(i+1),32);if(!/^[A-Za-z0-9_-]{1,32}$/.test(id))throw Error("invalid task id "+id);
 const title=clean(t?.title,120),delivers=clean(t?.delivers,500);if(!title||!delivers)throw Error("task "+id+" needs title and delivers");
 const blockedBy=[...new Set((Array.isArray(t?.blockedBy)?t.blockedBy:[]).map(x=>clean(x,32)).filter(Boolean))];
 const acceptance=(Array.isArray(t?.acceptance)?t.acceptance:[]).map(x=>clean(x,300)).filter(Boolean).slice(0,10);
 return{id,title,delivers,blockedBy,acceptance,status:"pending"};
}
function validate(tasks){
 const ids=new Set(tasks.map(x=>x.id));if(ids.size!==tasks.length)throw Error("task ids must be unique");
 for(const t of tasks)for(const b of t.blockedBy)if(!ids.has(b)||b===t.id)throw Error("unknown/self blocker "+b+" for "+t.id);
 const temp=new Set(),done=new Set(),by=new Map(tasks.map(x=>[x.id,x]));
 function visit(id){if(done.has(id))return;if(temp.has(id))throw Error("task graph contains a cycle at "+id);temp.add(id);for(const b of by.get(id).blockedBy)visit(b);temp.delete(id);done.add(id)}
 for(const id of ids)visit(id);return true;
}
function define(id,{instruction,tasks,root}={}){
 if(!Array.isArray(tasks)||!tasks.length||tasks.length>24)throw Error("task graph needs 1-24 tasks");
 const normalized=tasks.map(normalizeTask);validate(normalized);
 const opts=root?{root}:{},data=readAll(id,opts),k=key(instruction),now=new Date().toISOString();
 data.graphs[k]={instruction:clean(instruction,4000),createdAt:now,updatedAt:now,tasks:normalized};writeAll(id,data,opts);
 return status(id,instruction,{root});
}
function get(id,instruction,{root}={}){return readAll(id,root?{root}:{}).graphs[key(instruction)]||null}
function ready(g){return g.tasks.filter(t=>t.status==="pending"&&t.blockedBy.every(b=>g.tasks.find(x=>x.id===b)?.status==="done"))}
function status(id,instruction,{root}={}){
 const g=get(id,instruction,{root});if(!g)return null;
 return{tasks:g.tasks,ready:ready(g).map(x=>x.id),done:g.tasks.filter(x=>x.status==="done").map(x=>x.id),complete:g.tasks.every(x=>x.status==="done")};
}
function setStatus(id,instruction,taskId,next,{evidence="",root}={}){
 const opts=root?{root}:{},data=readAll(id,opts),g=data.graphs[key(instruction)];if(!g)throw Error("task graph is not defined");
 const t=g.tasks.find(x=>x.id===taskId);if(!t)throw Error("unknown task "+taskId);
 if(next==="active"&&!ready(g).some(x=>x.id===taskId))throw Error("task "+taskId+" is blocked");
 if(next==="done"&&t.status!=="active"&&t.status!=="pending")throw Error("task "+taskId+" cannot complete from "+t.status);
 t.status=next;t.evidence=clean(evidence,1000);t.updatedAt=new Date().toISOString();g.updatedAt=t.updatedAt;writeAll(id,data,opts);return status(id,instruction,{root});
}
function start(id,instruction,taskId,opts={}){return setStatus(id,instruction,taskId,"active",opts)}
function complete(id,instruction,taskId,opts={}){return setStatus(id,instruction,taskId,"done",opts)}
function prompt(id,instruction,{root}={}){
 const s=status(id,instruction,{root});if(!s)return"";
 return"\n\nENGINEERING TASK GRAPH: "+s.done.length+"/"+s.tasks.length+" tracer-bullet tasks complete. Ready frontier: "+(s.ready.join(", ")||"none")+
  "\n"+s.tasks.map(t=>"- "+t.id+" ["+t.status+"] "+t.title+" — "+t.delivers+(t.blockedBy.length?"; blocked by "+t.blockedBy.join(", "):"")).join("\n");
}
module.exports={key,file,define,get,status,start,complete,prompt,validate,ready};
