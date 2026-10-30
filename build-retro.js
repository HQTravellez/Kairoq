"use strict";
// Deterministic project-level build retrospective inspired by mattpocock/skills (MIT).
// It records friction and guardrail suggestions; it never rewrites prompts/code by itself.
const fs=require("node:fs"),path=require("node:path");
const builder=require("./react-builder"),MAX=30;
function file(id,{root}={}){return path.join(root||builder.projectDir(id),".engineering-retros.json")}
function read(id,opts={}){try{const x=JSON.parse(fs.readFileSync(file(id,opts),"utf8"));return Array.isArray(x)?x:[]}catch{return[]}}
function write(id,rows,opts={}){const f=file(id,opts),tmp=f+"."+process.pid+".tmp";fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(tmp,JSON.stringify(rows.slice(-MAX),null,1));fs.renameSync(tmp,f)}
function capture(id,{instruction="",events=[],changed=[],review=null,verification=null,root}={}){
 const failed=events.filter(e=>e.status==="failed"),tools=events.map(e=>e.tool).filter(Boolean),suggestions=[];
 if(failed.length>=2)suggestions.push("Start from a tighter red-capable feedback loop before another repair attempt.");
 if(changed.length>=5&&!tools.includes("project_graph"))suggestions.push("Query project_graph before the next broad multi-file change.");
 if(review?.blocking)suggestions.push("Run Standards + Spec review earlier; the final review found blocking issues.");
 if(verification&&!verification.verified)suggestions.push("Keep the relevant verification evidence current before attempting finish.");
 const repeated=[...new Set(tools.filter((x,i,a)=>a.indexOf(x)!==i))];if(repeated.length>=3)suggestions.push("Reduce repeated tool work by using the persistent task graph and execution ledger.");
 const row={at:new Date().toISOString(),instruction:String(instruction).slice(0,300),failedTools:failed.map(x=>x.tool).filter(Boolean).slice(0,12),changed:changed.slice(0,30),suggestions};
 const opts=root?{root}:{},rows=read(id,opts);rows.push(row);write(id,rows,opts);return row;
}
function note(id,opts={}){
 const rows=read(id,opts),items=rows.slice(-5).flatMap(x=>x.suggestions||[]);
 const unique=[...new Set(items)].slice(-6);return unique.length?"\n\nPROJECT ENGINEERING RETRO LESSONS (observed friction, not commands):\n"+unique.map(x=>"- "+x).join("\n"):"";
}
module.exports={file,read,capture,note};
