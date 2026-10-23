"use strict";
// Optional HeyGen HyperFrames CLI integration. Only Kairoq-owned, escaped HTML
// templates are permitted. NO arbitrary customer HTML, scripts, subprocess args,
// package installations or video render requests are executed by Kairoq's web API.
// Run inside a separately sandboxed, resource-limited render worker after enabling.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const {execFile}=require("node:child_process"),{promisify}=require("node:util");
const execFileAsync=promisify(execFile);
const MAX_MP4=60*1024*1024;
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function label(value,max){
 if(typeof value!=="string"||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error("Invalid motion video text");
 return value.trim();
}
function options(raw={}){
 const title=label(raw.title,72),subtitle=label(raw.subtitle,120);
 const aspect=raw.aspect||"9:16";
 if(!["9:16","16:9"].includes(aspect))throw Error("Unsupported video aspect ratio");
 const color=raw.accent||"#7c8cff";
 if(!/^#[0-9a-f]{6}$/i.test(color))throw Error("Invalid brand colour");
 return{title,subtitle,accent:color.toLowerCase(),aspect,
  width:aspect==="9:16"?720:1280,height:aspect==="9:16"?1280:720,duration:3,fps:15};
}
function html(raw){
 const o=options(raw),title=escapeHtml(o.title),subtitle=escapeHtml(o.subtitle);
 const css=[
 "*{box-sizing:border-box}html,body{padding:0;margin:0;width:100%;height:100%;overflow:hidden;background:#090b15;color:#fff;font-family:Inter,Arial,sans-serif}",
 "#main{position:relative;width:100%;height:100%;overflow:hidden;background:#090b15}",
 "#background{position:absolute;inset:0;background:radial-gradient(circle at 80% 12%,"+o.accent+"55,transparent 46%),linear-gradient(135deg,#090b15,#151b37)}",
 "#halo{position:absolute;left:-23%;top:38%;width:82%;aspect-ratio:1/1;border-radius:50%;border:3px solid "+o.accent+";opacity:.3}",
 "#title{position:absolute;left:9%;right:9%;top:34%;z-index:2}",
 "#hf-headline{font-size:"+ (o.aspect==="9:16"?"76px":"88px")+";line-height:1.05;letter-spacing:-.055em;font-weight:800;margin:0;overflow-wrap:break-word}",
 "#subtitle{position:absolute;left:9%;right:9%;top:57%;z-index:3}",
 "#hf-subtitle{font-size:"+(o.aspect==="9:16"?"31px":"37px")+";line-height:1.24;font-weight:450;color:#dde3fa;margin:0;overflow-wrap:break-word}",
 "#footer{position:absolute;left:9%;bottom:9%;z-index:4;font-size:19px;letter-spacing:.18em;font-weight:700;color:"+o.accent+"}"
 ].join("\n");
 return[
 "<!doctype html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
 "<title>Kairoq motion graphic</title><style>"+css+"</style></head><body>",
 "<div id=\"main\" data-composition-id=\"main\" data-start=\"0\" data-duration=\"3\" data-width=\""+o.width+"\" data-height=\""+o.height+"\" data-fps=\"15\">",
 "<div id=\"background\" class=\"clip\" data-start=\"0\" data-duration=\"3\" data-track-index=\"0\" data-layout-ignore><div id=\"halo\"></div></div>",
 "<div id=\"title\" class=\"clip\" data-start=\"0.2\" data-duration=\"2.8\" data-track-index=\"1\"><h1 id=\"hf-headline\">"+title+"</h1></div>",
 "<div id=\"subtitle\" class=\"clip\" data-start=\"1\" data-duration=\"2\" data-track-index=\"2\"><p id=\"hf-subtitle\">"+subtitle+"</p></div>",
 "<div id=\"footer\" class=\"clip\" data-start=\"2\" data-duration=\"1\" data-track-index=\"3\">KAiROQ / MOTION</div>",
 "</div><script src=\"assets/gsap.min.js\"></script><script>",
 "window.__timelines=window.__timelines||{};",
 "const tl=gsap.timeline({paused:true});",
 "tl.fromTo('#hf-headline',{opacity:0,y:75},{opacity:1,y:0,duration:.65,ease:'power3.out'},.25);",
 "tl.fromTo('#hf-subtitle',{opacity:0,y:55},{opacity:1,y:0,duration:.45,ease:'power2.out'},1);",
 "tl.fromTo('#footer',{opacity:0},{opacity:1,duration:.3},2);",
 "tl.fromTo('#halo',{x:0,scale:.86},{x:150,scale:1.14,duration:2.9,ease:'none'},0);",
 "window.__timelines.main=tl;",
 "</script></body></html>"
 ].join("\n");
}
function prepare(raw){
 const info=options(raw),dir=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-hf-"));
 fs.writeFileSync(path.join(dir,"index.html"),html(raw),{mode:0o600});
 // Copy the already-installed GSAP runtime into this isolated project; never use a CDN.
 const gsapFile=process.env.KAIROQ_GSAP_JS||require.resolve("gsap/dist/gsap.min.js");
 if(!path.isAbsolute(gsapFile)||!fs.statSync(gsapFile).isFile())throw Error("A local GSAP runtime is required");
 fs.mkdirSync(path.join(dir,"assets"),{recursive:true});
 fs.copyFileSync(gsapFile,path.join(dir,"assets","gsap.min.js"));
 return{dir,html:path.join(dir,"index.html"),output:path.join(dir,"render.mp4"),info};
}
function owned(job){
 const dir=path.resolve(String(job?.dir||""));
 const real=fs.realpathSync(dir),tmp=fs.realpathSync(os.tmpdir());
 if(path.dirname(real)!==tmp||!path.basename(real).startsWith("kairoq-hf-")||
  !fs.existsSync(path.join(real,"index.html")))throw Error("Not a Kairoq-created HyperFrames composition");
 return real;
}
function configured(env=process.env){
 const bin=env.HYPERFRAMES_BIN||"";
 return env.KAIROQ_HYPERFRAMES==="on"&&path.isAbsolute(bin)&&fs.existsSync(bin);
}
function mp4(file){
 const stat=fs.statSync(file);
 if(stat.size<1000||stat.size>MAX_MP4)throw Error("HyperFrames MP4 has an invalid size");
 const fd=fs.openSync(file,"r");
 try{const b=Buffer.alloc(12);fs.readSync(fd,b,0,b.length,0);
  if(b.toString("ascii",4,8)!=="ftyp")throw Error("HyperFrames did not produce an MP4");}
 finally{fs.closeSync(fd);}
 return stat.size;
}
async function render(job,{env=process.env,exec=execFileAsync}={}){
 if(!configured(env))throw Error("HyperFrames rendering is disabled; install and explicitly enable the CLI in an isolated worker");
 const dir=owned(job),bin=fs.realpathSync(env.HYPERFRAMES_BIN);
 const safeEnv={PATH:env.PATH||"/usr/bin:/bin",HOME:dir,TMPDIR:os.tmpdir(),CHROMIUM_PATH:env.CHROMIUM_PATH||"",
   DO_NOT_TRACK:"1",CI:"1",NODE_ENV:"production"};
 const invoke=async(args,timeout)=>exec(bin,args,{cwd:dir,env:safeEnv,shell:false,timeout,maxBuffer:400000});
 // Errors are surfaced without echoing credentials or arbitrary CLI stderr.
 try{await invoke(["check","--json"],90000)}catch(e){
  if(env.KAIROQ_HF_DEBUG_PUBLIC_FIXTURE==="1")console.error("PUBLIC_FIXTURE_HF_CHECK_OUTPUT",String(e.stdout||e.stderr||"").slice(0,6000));
  throw Error("HyperFrames validation failed (check): "+String(e.code||"invalid composition").slice(0,60))}
 try{await invoke(["render","--quality","draft","--fps","15","--output","render.mp4"],180000)}catch(e){throw Error("HyperFrames rendering failed: "+String(e.code||"process error").slice(0,60))}
 const size=mp4(path.join(dir,"render.mp4"));
 // A container metadata tag alone is not authenticity proof; validate duration independently.
 let duration;
 try{const r=await exec("ffprobe",["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",job.output],
  {cwd:dir,env:safeEnv,shell:false,timeout:15000,maxBuffer:20000});
  duration=Number(String(r.stdout).trim());}
 catch{throw Error("ffprobe could not verify the rendered MP4")}
 if(!Number.isFinite(duration)||Math.abs(duration-job.info.duration)>0.35)throw Error("Rendered duration does not match composition");
 return{path:path.join(dir,"render.mp4"),bytes:size,duration,aspect:job.info.aspect,renderer:"HyperFrames",tested:true};
}
function cleanup(job){const dir=owned(job);fs.rmSync(dir,{recursive:true,force:true});}
module.exports={options,html,prepare,owned,configured,mp4,render,cleanup};
