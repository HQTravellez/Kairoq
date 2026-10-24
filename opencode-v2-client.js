"use strict";
// Direct OpenCode V2 server API client. Requires private loopback/sidecar deployment.
// Never forward user-provided URLs or execute arbitrary shell commands.
const DEFAULT="http://127.0.0.1:4096";
function config(env=process.env){
 const base=env.KAIROQ_OPENCODE_V2_URL||DEFAULT;
 const url=new URL(base);
 if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error("Invalid OpenCode URL");
 const host=url.hostname.toLowerCase();
 if(!["127.0.0.1","localhost","::1"].includes(host)&&(env.KAIROQ_OPENCODE_V2_TRUSTED_REMOTE!=="true"||url.protocol!=="https:"||!env.KAIROQ_OPENCODE_V2_TOKEN))throw Error("Remote OpenCode servers must be explicitly trusted");
 return {base:url.href.replace(/\/$/,""),key:env.KAIROQ_OPENCODE_V2_TOKEN||""};
}
function makeClient({env=process.env,fetchImpl=fetch}={}){
 const {base,key}=config(env);
 const username=env.KAIROQ_OPENCODE_V2_USERNAME||"opencode";
 const auth=key?"Basic "+Buffer.from(username+":"+key).toString("base64"):"";
 async function request(method,route,body){
  const response=await fetchImpl(base+route,{method,headers:{"Content-Type":"application/json",...(auth?{Authorization:auth}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error("OpenCode V2 HTTP "+response.status+": "+String(data?.error?.message||"unavailable").slice(0,180));
  return data.data??data;
 }
 return {
  health:()=>request("GET","/api/info"),
  models:()=>request("GET","/api/provider"),
  createSession:(directory)=>request("POST","/api/session",{location:{directory}}),
  setModel:(sessionID,model)=>request("POST","/api/session/"+encodeURIComponent(sessionID)+"/model",{model}),
  prompt:(sessionID,text)=>request("POST","/api/session/"+encodeURIComponent(sessionID)+"/prompt",{text}),
  wait:(sessionID)=>request("POST","/api/experimental/session/"+encodeURIComponent(sessionID)+"/wait",{}),
  messages:(sessionID)=>request("GET","/api/session/"+encodeURIComponent(sessionID)+"/message?order=desc&limit=30"),
  diffs:(sessionID)=>request("GET","/api/session/"+encodeURIComponent(sessionID)+"/diff"),
  async runTurn({directory,model,text,repairPrompt}){
   if(typeof directory!=="string"||!directory.startsWith("/")||!text)throw Error("An isolated absolute workspace directory and task are required");
   const session=await this.createSession(directory);
   const sessionID=session?.id;
   if(!sessionID)throw Error("OpenCode did not return a session ID");
   if(model)await this.setModel(sessionID,model);
   await this.prompt(sessionID,text);
   await this.wait(sessionID);
   const first={messages:await this.messages(sessionID),diffs:await this.diffs(sessionID)};
   if(!repairPrompt)return{sessionID,first};
   await this.prompt(sessionID,repairPrompt);
   await this.wait(sessionID);
   return{sessionID,first,repair:{messages:await this.messages(sessionID),diffs:await this.diffs(sessionID)}};
  },
 };
}
module.exports={config,makeClient};
