'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const hash=token=>crypto.createHash('sha256').update(token).digest('hex');
function store(){return process.env.KAIROQ_MAGIC_STORE_DIR||path.join(__dirname,'workspace','magic-login');}
function configured(){return /^[a-f0-9]{64}$/.test(process.env.KAIROQ_MAGIC_LOGIN_HASH||'')&&Number(process.env.KAIROQ_MAGIC_LOGIN_EXPIRES)>Date.now();}
function issue(ttl=15*60*1000){
 const token=crypto.randomBytes(32).toString('base64url'),digest=hash(token),expires=Date.now()+Math.min(Math.max(ttl,60000),3600000);
 fs.mkdirSync(store(),{recursive:true,mode:0o700});fs.writeFileSync(path.join(store(),digest+'.json'),JSON.stringify({expires}),{mode:0o600,flag:'wx'});
 return{token,expires};
}
function consume(token){
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('Invalid or expired sign-in link.');
 const digest=hash(token),filename=path.join(store(),digest+'.json');let expires;
 if(configured()&&digest===process.env.KAIROQ_MAGIC_LOGIN_HASH)expires=Number(process.env.KAIROQ_MAGIC_LOGIN_EXPIRES);
 else{try{expires=JSON.parse(fs.readFileSync(filename,'utf8')).expires;}catch{throw Error('Invalid or expired sign-in link.');}}
 if(!Number.isFinite(expires)||expires<=Date.now())throw Error('Invalid or expired sign-in link.');
 fs.mkdirSync(store(),{recursive:true,mode:0o700});
 // Atomic persistent claim: concurrent redeems and replicas sharing the volume cannot reuse a link.
 try{fs.writeFileSync(path.join(store(),digest+'.used'),'used',{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST')throw Error('This sign-in link has already been used.');throw e;}
 return{ok:true};
}
module.exports={issue,consume,configured};
