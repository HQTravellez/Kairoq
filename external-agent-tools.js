"use strict";
// Explicit opt-in wrappers for HKUDS/CLI-Anything and morluto/rea.
// No shell, npx installs, remote target scanning, arbitrary commands or mutations.
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
const MAX_OUTPUT=128*1024;
function enabled(name,env=process.env){return env["KAIROQ_"+name+"_ENABLED"]==="true";}
function toolError(message){return Object.assign(new Error(message),{status:400});}
function under(root,target){
 const base=fs.realpathSync(root),resolved=fs.realpathSync(target);
 if(resolved!==base&&!resolved.startsWith(base+path.sep))throw toolError("Target must be inside an approved workspace");
 return resolved;
}
async function execute(bin,args,{env=process.env,timeoutMs=30000,spawnImpl=spawn}={}){
 return new Promise((resolve,reject)=>{
  const child=spawnImpl(bin,args,{shell:false,env:{PATH:env.PATH||process.env.PATH,HOME:env.HOME||process.env.HOME},stdio:["ignore","pipe","pipe"]});
  let output="",size=0,finished=false;
  const timer=setTimeout(()=>child.kill("SIGKILL"),timeoutMs);
  const consume=data=>{size+=data.length;if(size>MAX_OUTPUT){child.kill("SIGKILL");return}output+=data.toString("utf8")};
  child.stdout.on("data",consume);child.stderr.on("data",consume);
  child.on("error",e=>{if(finished)return;finished=true;clearTimeout(timer);reject(e)});
  child.on("close",code=>{if(finished)return;finished=true;clearTimeout(timer);if(size>MAX_OUTPUT)return reject(toolError("Tool output exceeded limit"));if(code!==0)return reject(toolError("Tool exited "+code+": "+output.slice(-1200)));resolve(output.slice(0,MAX_OUTPUT))});
 });
}
async function cliHubList(opts={}){
 if(!enabled("CLI_ANYTHING",opts.env))throw toolError("CLI-Anything adapter disabled");
 const binary=opts.env?.KAIROQ_CLI_HUB_BIN||"cli-hub";
 return execute(binary,["list"],opts);
}
async function cliHubInfo(name,opts={}){
 if(!enabled("CLI_ANYTHING",opts.env))throw toolError("CLI-Anything adapter disabled");
 if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(String(name||"")))throw toolError("Invalid CLI harness name");
 return execute(opts.env?.KAIROQ_CLI_HUB_BIN||"cli-hub",["info",name],opts);
}
async function inspectJavascript(relative,opts={}){
 if(!enabled("REA",opts.env))throw toolError("REA adapter disabled");
 const root=opts.workspaceRoot;
 if(!root)throw toolError("Workspace root is required");
 if(typeof relative!=="string"||relative.length>256||path.isAbsolute(relative))throw toolError("Only workspace-relative paths are allowed");
 const target=under(root,path.resolve(root,relative));
 if(!fs.statSync(target).isDirectory()&&!/\.asar$/i.test(target))throw toolError("Expected an extracted JavaScript application directory or ASAR");
 return execute(opts.env?.KAIROQ_REA_BIN||"rea",["analyze-javascript-application",target,"--json"],opts);
}
module.exports={enabled,under,execute,cliHubList,cliHubInfo,inspectJavascript};
