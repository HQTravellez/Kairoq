"use strict";
// Runs Vite builds for Create projects off the main thread (see react-builder.js).
const {parentPort}=require('worker_threads');
parentPort.on('message',async({id,files,outDir,projectId,root})=>{
 if(root)process.env.KAIROQ_REACT_PROJECTS_DIR=root;
 try{const result=await require('./react-builder').runBuild(files,outDir,{projectId});parentPort.postMessage({id,ok:true,result})}
 catch(e){parentPort.postMessage({id,ok:false,message:String(e&&e.message||e),build:!!(e&&e.build)})}
});
