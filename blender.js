"use strict";
// Blender on the server (blender.org, GPL; used unmodified as its own program). Kairoq uses it
// only to turn uploaded 3D files (FBX, OBJ, STL, PLY, .blend, zipped glTF) into web-ready GLB
// files, make heavy models lighter for phones, and render a still preview picture. It runs
// without a screen, one job at a time, with a time limit, and scripts inside files never run.
// Found through KAIROQ_BLENDER (the Blender app) or KAIROQ_BPY_PYTHON (a Python with the "bpy"
// module); the Docker image sets KAIROQ_BPY_PYTHON unless built with KAIROQ_BLENDER_INSTALL=off.
const fs=require('fs'),path=require('path'),os=require('os');
const {execFile}=require('child_process');
const SCRIPT=path.join(__dirname,'scripts','blender-kairoq.py');
const INPUTS=['glb','gltf','fbx','obj','stl','ply','blend','zip'];
const TIMEOUT_MS=Number(process.env.KAIROQ_BLENDER_TIMEOUT_MS)||240000;

function command(env=process.env){
 const app=String(env.KAIROQ_BLENDER||'').trim(),py=String(env.KAIROQ_BPY_PYTHON||'').trim();
 if(app&&fs.existsSync(app))return{file:app,args:extra=>['-b','--factory-startup','-noaudio','--python-exit-code','1','--python',SCRIPT,'--',...extra]};
 if(py&&fs.existsSync(py))return{file:py,args:extra=>['-I',SCRIPT,...extra]};
 return null;
}
function available(env=process.env){return Boolean(command(env))}

// One job at a time: Blender uses every CPU core while it renders.
let queue=Promise.resolve();
function serial(fn){const run=queue.then(fn,fn);queue=run.catch(()=>{});return run}

// The plain-words message the script printed when it stopped (KAIROQ_ERROR ...).
function reason(stdout){
 const line=String(stdout||'').split('\n').reverse().find(l=>l.startsWith('KAIROQ_ERROR '));
 return line?line.slice(13).trim().replace(/\(Error: /,'(').slice(0,240):'Blender could not read this file.';
}

// input: a file path. Returns {glb (path or null), poster (path or null), info}.
// Options: out (write GLB), poster (render a picture), maxTris, maxTexture, size, samples.
function run(input,{out=true,poster=true,maxTris=200000,maxTexture=2048,size=800,samples=24,env=process.env,execImpl=execFile}={}){
 const cmd=command(env);
 if(!cmd)return Promise.reject(Object.assign(Error('Blender is not set up on this server, so this file type cannot be converted. Upload a .glb file instead.'),{status:409}));
 const ext=path.extname(input).slice(1).toLowerCase();
 if(!INPUTS.includes(ext))return Promise.reject(Object.assign(Error('Blender cannot read .'+ext+' files'),{status:400}));
 return serial(()=>new Promise((resolve,reject)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-blender-out-'));
  const glb=out?path.join(dir,'model.glb'):'',png=poster?path.join(dir,'poster.png'):'';
  const args=cmd.args(['--in',input,'--out',glb,'--poster',png,'--max-tris',String(maxTris),'--max-texture',String(maxTexture),'--size',String(size),'--samples',String(samples)]);
  // A clean environment: no keys or settings from the server reach Blender.
  const childEnv={PATH:env.PATH||'/usr/bin:/bin',HOME:dir,TMPDIR:dir,LANG:'C.UTF-8',BLENDER_USER_CONFIG:dir,BLENDER_USER_SCRIPTS:dir,PYTHONNOUSERSITE:'1'};
  execImpl(cmd.file,args,{env:childEnv,cwd:dir,timeout:TIMEOUT_MS,killSignal:'SIGKILL',maxBuffer:8*1024*1024,windowsHide:true},(err,stdout,stderr)=>{
   const line=String(stdout||'').split('\n').find(l=>l.startsWith('KAIROQ_RESULT '));
   let info=null;try{info=line?JSON.parse(line.slice(14)):null}catch{}
   const has=f=>Boolean(f)&&fs.existsSync(f)&&fs.statSync(f).size>0;
   if(err||!info||(out&&!has(glb))){
    fs.rmSync(dir,{recursive:true,force:true});
    if(err&&err.killed)return reject(Object.assign(Error('Blender took too long with this file. Try a smaller model.'),{status:422}));
    return reject(Object.assign(Error(reason(stdout)),{status:422,detail:String(stderr||'').slice(-600)}));
   }
   resolve({dir,glb:has(glb)?glb:null,poster:has(png)?png:null,info});
  });
 }));
}
function status(env=process.env){const c=command(env);return c?{on:true,via:env.KAIROQ_BLENDER&&c.file===env.KAIROQ_BLENDER?'app':'python'}:{on:false,why:'Set KAIROQ_BPY_PYTHON or KAIROQ_BLENDER'}}
module.exports={INPUTS,available,run,status,command,SCRIPT};
