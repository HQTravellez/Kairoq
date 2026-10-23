"use strict";
// Recent server-side events per app (function logs, function errors, failed backend
// requests), kept in memory for the editor's Logs view and the agent's view_logs tool.
const logs=new Map(),MAX=200;
function add(projectId,entry){
 let list=logs.get(projectId);
 if(!list){list=[];logs.set(projectId,list);if(logs.size>2000)logs.delete(logs.keys().next().value)}
 list.push({at:new Date().toISOString(),...entry,message:String(entry.message||'').slice(0,1000)});
 if(list.length>MAX)list.splice(0,list.length-MAX);
}
function list(projectId,{since}={}){const all=logs.get(projectId)||[];return since?all.filter(e=>e.at>since):all.slice()}
function clear(projectId){logs.delete(projectId)}
module.exports={add,list,clear};
