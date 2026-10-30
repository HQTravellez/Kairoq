"use strict";
const discipline=require("./execution-discipline");
function lastUser(messages){
 const list=Array.isArray(messages)?messages:[];for(let i=list.length-1;i>=0;i--)if(list[i]?.role==="user"){
  const c=list[i].content;if(typeof c==="string")return c;
  if(Array.isArray(c))return c.filter(x=>x?.type==="text").map(x=>x.text).join("\n");
 }
 return"";
}
function inject(messages){
 const request=lastUser(messages),bootstrap=discipline.hermesBootstrap(request);
 const list=Array.isArray(messages)?messages.slice():[];
 const existing=list.findIndex(x=>x?.role==="system");
 if(existing>=0)list[existing]={...list[existing],content:String(list[existing].content||"")+"\n\n"+bootstrap};
 else list.unshift({role:"system",content:bootstrap});
 return list;
}
module.exports={inject,lastUser};
