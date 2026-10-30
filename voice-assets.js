'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const builder=require('./react-builder');
const NAME=/^narration-[a-f0-9]{16}\.wav$/;
function dir(id){return path.join(builder.projectDir(id),'narration');}
function list(id){const d=dir(id);return fs.existsSync(d)?fs.readdirSync(d).filter(n=>NAME.test(n)):[];}
async function narrate(id,args,{service=require('./voice-provider')}={}){
 builder.loadMeta(id);
 if(list(id).length>=20)throw Error('A project can hold up to 20 narrations.');
 const bytes=await service.speech(args),name='narration-'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16)+'.wav';
 fs.mkdirSync(dir(id),{recursive:true});fs.writeFileSync(path.join(dir(id),name),bytes);
 return 'Generated Kokoro narration at ./narration/'+name+'. Play it with an audio element after a user click. Model: Kokoro-82M (Apache-2.0).';
}
function copyInto(id,publicDir){for(const name of list(id)){const dest=path.join(publicDir,'narration');fs.mkdirSync(dest,{recursive:true});fs.copyFileSync(path.join(dir(id),name),path.join(dest,name));}}
module.exports={narrate,copyInto,list};
