"use strict";
// Where Kairoq keeps its data. Everything it saves (accounts, projects, builds, previews, sites,
// backups) lives under workspace/. A container's own disk is wiped on every deploy, so when a
// persistent volume is attached (Railway sets RAILWAY_VOLUME_MOUNT_PATH; KAIROQ_DATA_DIR works
// anywhere), workspace/ is moved onto it and linked back, before the server starts.
const fs=require('fs'),path=require('path');

function volume(env=process.env){return String(env.KAIROQ_DATA_DIR||env.RAILWAY_VOLUME_MOUNT_PATH||'').trim()}

// Puts workspace/ on the volume. Data already on the volume wins; data in the container's own
// workspace (a first run before the volume existed) is copied over without overwriting.
function prepare({root=__dirname,env=process.env,log=console.log}={}){
 const vol=volume(env),ws=path.join(root,'workspace');
 if(!vol)return{persistent:false,reason:'no-volume'};
 const target=path.join(vol,'workspace');
 try{
  fs.mkdirSync(target,{recursive:true});
  const st=fs.lstatSync(ws,{throwIfNoEntry:false});
  if(st&&st.isSymbolicLink()){
   if(path.resolve(path.dirname(ws),fs.readlinkSync(ws))===path.resolve(target))return{persistent:true,path:target};
   fs.unlinkSync(ws);
  }else if(st&&st.isDirectory()){
   fs.cpSync(ws,target,{recursive:true,force:false,errorOnExist:false});
   fs.rmSync(ws,{recursive:true,force:true});
  }
  fs.symlinkSync(target,ws,'dir');
  log('[storage] workspace is on the persistent volume: '+target);
  return{persistent:true,path:target};
 }catch(e){
  log('[storage] could not use the volume at '+vol+': '+e.message);
  return{persistent:false,reason:'error',error:e.message};
 }
}
// For the owner's screens: is the data safe from a redeploy?
function status({root=__dirname,env=process.env}={}){
 if(env.KAIROQ_PERSISTENT==='1')return{persistent:true};
 const ws=path.join(root,'workspace');
 try{if(fs.lstatSync(ws).isSymbolicLink())return{persistent:true,path:fs.realpathSync(ws)}}catch{}
 // Custom storage paths are the operator's own choice.
 if(env.KAIROQ_REACT_PROJECTS_DIR&&env.KAIROQ_BUILDER_ACCOUNTS_DB)return{persistent:true};
 return{persistent:env.NODE_ENV!=='production',reason:'no-volume'};
}
module.exports={prepare,status,volume};
