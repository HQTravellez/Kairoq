"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const builder=require("./react-builder");
const MAX_AGE=24*60*60*1000;
function file(id){return path.join(builder.projectDir(id),".agent-checkpoint.json")}
function key(instruction){return crypto.createHash("sha256").update(String(instruction||"")).digest("hex")}
function save(id,{instruction,baseVersion,files,step=0}){
 try{
  fs.mkdirSync(builder.projectDir(id),{recursive:true});
  fs.writeFileSync(file(id),JSON.stringify({key:key(instruction),baseVersion,step,at:new Date().toISOString(),files}));
 }catch{}
}
function load(id,{instruction,baseVersion}){
 try{
  const v=JSON.parse(fs.readFileSync(file(id),"utf8"));
  if(v.key!==key(instruction)||v.baseVersion!==baseVersion||Date.now()-Date.parse(v.at)>MAX_AGE||!v.files||typeof v.files!=="object")return null;
  return v;
 }catch{return null}
}
function clear(id){try{fs.rmSync(file(id),{force:true})}catch{}}
module.exports={save,load,clear,key};
