"use strict";
// Persistent execution ledger: survives model/provider switches and context loss.
// Stored outside generated app source in the Kairoq project directory.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const builder=require("./react-builder"),MAX_EVENTS=240;
function key(instruction){return crypto.createHash("sha256").update(String(instruction||"")).digest("hex")}
function file(id,{root}={}){return path.join(root||builder.projectDir(id),".execution-ledger.json")}
function read(id,opts={}){try{return JSON.parse(fs.readFileSync(file(id,opts),"utf8"))}catch{return{runs:{}}}}
function write(id,data,opts={}){const f=file(id,opts),tmp=f+"."+process.pid+".tmp";fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(tmp,JSON.stringify(data,null,1));fs.renameSync(tmp,f)}
function start(id,{instruction,baseVersion,workflow,root}){
 const opts=root?{root}:{},data=read(id,opts),k=key(instruction),now=new Date().toISOString();
 let run=data.runs[k];
 if(!run||run.baseVersion!==baseVersion||run.status==="complete"){
  run={key:k,baseVersion,instruction:String(instruction||"").slice(0,4000),kind:workflow?.kind||"change",phases:workflow?.phases||[],status:"active",startedAt:now,updatedAt:now,events:[]};
  data.runs[k]=run;write(id,data,opts);
 }
 return run;
}
function record(id,instruction,event,{root}={}){
 const opts=root?{root}:{},data=read(id,opts),k=key(instruction),run=data.runs[k];if(!run)return null;
 const e={at:new Date().toISOString(),...event};
 run.events.push(e);if(run.events.length>MAX_EVENTS)run.events=run.events.slice(-MAX_EVENTS);
 run.updatedAt=e.at;write(id,data,opts);return e;
}
function complete(id,instruction,{verified=false,version=null,message="",root}={}){
 const opts=root?{root}:{},data=read(id,opts),k=key(instruction),run=data.runs[k];if(!run)return null;
 run.status=verified?"complete":"stopped";run.verified=Boolean(verified);run.version=version;run.result=String(message||"").slice(0,1000);run.updatedAt=new Date().toISOString();
 write(id,data,opts);return run;
}
function current(id,instruction,{root}={}){
 const run=read(id,root?{root}:{}).runs[key(instruction)];return run&&run.status==="active"?run:null;
}
function summary(run){
 if(!run)return"";
 const recent=(run.events||[]).slice(-14).map(e=>"- "+(e.step?"step "+e.step+" ":"")+(e.tool?e.tool+": ":"")+(e.status||e.summary||e.result||"event")).join("\n");
 return"\n\nPERSISTENT EXECUTION LEDGER: This task was previously started. Resume from recorded evidence; do not repeat completed work.\n"+
  "Workflow: "+run.kind+" · base version "+run.baseVersion+" · events "+(run.events||[]).length+"\n"+(recent||"- no completed tool events yet");
}
module.exports={key,file,read,start,record,complete,current,summary};
