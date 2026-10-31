"use strict";
// Native Figma connection for Kairoq projects.
// OAuth tokens stay encrypted in project-secrets via oauth-connect.js and never reach the browser.

const oauth=require("./oauth-connect"),figma=require("./react-figma");
const API="https://api.figma.com/v1";

function status(id,{fallbackOrigin}={}){
 const s=oauth.status(id,"figma",{fallbackOrigin});
 return{...s,configured:Boolean(oauth.client(id,"figma")),provider:"figma"};
}

async function api(id,path,{fetchImpl=fetch}={}){
 const {access_token}=await oauth.token(id,"figma",{fetchImpl});
 const r=await fetchImpl(API+path,{headers:{Authorization:"Bearer "+access_token,Accept:"application/json"},signal:AbortSignal.timeout(30000)});
 const body=await r.json().catch(()=>({}));
 if(r.status===401||r.status===403)throw Object.assign(Error("Figma connection cannot access this resource. Reconnect Figma or check file permissions."),{status:409});
 if(r.status===404)throw Object.assign(Error("Figma could not find that resource for the connected account."),{status:404});
 if(r.status===429)throw Object.assign(Error("Figma rate limit reached. Try again shortly."),{status:429});
 if(!r.ok)throw Object.assign(Error("Figma API returned HTTP "+r.status+(body.err?": "+String(body.err).slice(0,180):"")),{status:502});
 return body;
}

async function profile(id,{fetchImpl=fetch}={}){
 const me=await api(id,"/me",{fetchImpl});
 return{
  id:String(me.id||""),
  handle:String(me.handle||"").slice(0,120),
  email:String(me.email||"").slice(0,200),
  img_url:/^https:\/\//.test(String(me.img_url||""))?String(me.img_url):null
 };
}

async function importFrame(id,url,{fetchImpl=fetch}={}){
 const {access_token}=await oauth.token(id,"figma",{fetchImpl});
 return figma.importFrame({url,token:access_token,auth:"oauth"},{fetchImpl});
}

module.exports={status,profile,importFrame,api};
