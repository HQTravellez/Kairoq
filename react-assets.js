"use strict";
// Images uploaded to a Create project. Stored once per project and copied into
// every build at ./uploads/<name>, so generated code can reference them.
const fs=require('fs'),path=require('path');
const builder=require('./react-builder');

const TYPES={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml'};
const MAX_FILES=40,MAX_BYTES=3*1024*1024,MAX_TOTAL=40*1024*1024;
function dir(id){return path.join(builder.projectDir(id),'uploads')}
function list(id){
 const d=dir(id);if(!fs.existsSync(d))return[];
 return fs.readdirSync(d).filter(f=>/^[a-z0-9-]+\.(png|jpg|jpeg|webp|gif|svg)$/.test(f)).map(name=>({name,path:'./uploads/'+name,bytes:fs.statSync(path.join(d,name)).size})).sort((a,b)=>a.name.localeCompare(b.name));
}
function uniqueName(id,name){
 const existing=new Set(list(id).map(a=>a.name));
 if(!existing.has(name))return name;
 const ext=path.extname(name),stem=name.slice(0,-ext.length);
 for(let i=2;;i++){const n=stem+'-'+i+ext;if(!existing.has(n))return n}
}
// images: [{name:'logo.png',mime,data(base64)}]; returns the saved names.
function save(id,images,{maxBytes=MAX_BYTES}={}){
 builder.loadMeta(id);
 const d=dir(id);fs.mkdirSync(d,{recursive:true});
 const current=list(id);
 if(current.length+images.length>MAX_FILES)throw Object.assign(Error('A project can hold up to '+MAX_FILES+' images'),{status:400});
 let total=current.reduce((n,a)=>n+a.bytes,0);
 const saved=[];
 for(const img of images){
  if(!/^[a-z0-9-]+\.(png|jpg|jpeg|webp|gif)$/.test(img.name))throw Object.assign(Error('Bad image name'),{status:400});
  const bytes=Buffer.from(img.data,'base64');
  if(bytes.length>maxBytes)throw Object.assign(Error('Each image must be '+Math.round(maxBytes/1048576)+' MB or smaller'),{status:413});
  if(!looksLike(bytes,img.name))throw Object.assign(Error(img.name+' is not a valid image'),{status:400});
  total+=bytes.length;if(total>MAX_TOTAL)throw Object.assign(Error('Project images are limited to 40 MB'),{status:413});
  const name=uniqueName(id,img.name);
  fs.writeFileSync(path.join(d,name),bytes);
  saved.push(name);
 }
 return saved;
}
function looksLike(b,name){
 const ext=path.extname(name).slice(1);
 if(ext==='png')return b.slice(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(ext==='jpg'||ext==='jpeg')return b[0]===0xff&&b[1]===0xd8;
 if(ext==='gif')return b.slice(0,3).toString()==='GIF';
 if(ext==='webp')return b.slice(0,4).toString()==='RIFF'&&b.slice(8,12).toString()==='WEBP';
 return false;
}
function remove(id,name){
 if(!/^[a-z0-9-]+\.(png|jpg|jpeg|webp|gif|svg)$/.test(String(name)))throw Object.assign(Error('Unknown image'),{status:404});
 const file=path.join(dir(id),name);
 if(!fs.existsSync(file))throw Object.assign(Error('Unknown image'),{status:404});
 fs.rmSync(file);return{removed:name};
}
function read(id,name){
 if(!/^[a-z0-9-]+\.(png|jpg|jpeg|webp|gif|svg)$/.test(String(name)))return null;
 const file=path.join(dir(id),name);
 return fs.existsSync(file)?{bytes:fs.readFileSync(file),type:TYPES[path.extname(name).slice(1)]}:null;
}
// Copies uploads into a build's public folder (served at ./uploads/).
function copyInto(id,publicDir){
 const items=list(id);if(!items.length)return;
 fs.mkdirSync(path.join(publicDir,'uploads'),{recursive:true});
 for(const a of items)fs.copyFileSync(path.join(dir(id),a.name),path.join(publicDir,'uploads',a.name));
}
function note(id){
 const items=list(id);
 if(!items.length)return'';
 return'Uploaded images available in the app (use these exact relative paths in src attributes or CSS): '+items.map(a=>a.path).join(', ')+'. Images attached to this message are shown to you for reference; if the user wants them used in the app (logo, photos), use their uploaded paths.';
}
module.exports={list,save,remove,read,copyInto,note};
