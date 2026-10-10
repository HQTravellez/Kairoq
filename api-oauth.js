"use strict";
// OAuth2 authorization-code + PKCE, client-credentials and encrypted refresh tokens.
// Provider endpoints are configured by the operator, never by browser-supplied URLs.
const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),https=require("node:https"),dns=require("node:dns").promises;
const docs=require("./api-docs");
const STORE=path.join(__dirname,"workspace","api-oauth");
const safeName=n=>{if(!/^[a-z][a-z0-9_-]{0,49}$/i.test(String(n||"")))throw Error("Invalid OAuth provider");return n;};
function key(){const value=process.env.KAIROQ_OAUTH_ENCRYPTION_KEY||"";const buf=/^[0-9a-f]{64}$/i.test(value)?Buffer.from(value,"hex"):Buffer.from(value,"base64");if(buf.length!==32)throw Error("Configure KAIROQ_OAUTH_ENCRYPTION_KEY as a persistent 32-byte hex or base64 secret");return buf;}
function configs(){let parsed;try{parsed=JSON.parse(process.env.KAIROQ_OAUTH_PROVIDERS||"{}");}catch{throw Error("Invalid KAIROQ_OAUTH_PROVIDERS JSON");}if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("Invalid OAuth provider configuration");return parsed;}
function config(name){
 safeName(name);const c=configs()[name];if(!c||typeof c!=="object")throw Error("OAuth provider is not configured");
 const tokenUrl=docs.validUrl(c.tokenUrl);const grant=c.grantType||"authorization_code";
 if(!["authorization_code","client_credentials"].includes(grant))throw Error("Unsupported OAuth grant type");
 const authUrl=grant==="authorization_code"?docs.validUrl(c.authorizationUrl):null;
 const clientId=String(c.clientId||"");if(!clientId||clientId.length>250)throw Error("OAuth client ID is missing");
 const secretName=String(c.clientSecretEnv||"");if(secretName&&!/^[A-Z][A-Z0-9_]{2,90}$/.test(secretName))throw Error("Invalid OAuth secret environment variable");
 const secret=secretName?process.env[secretName]||"":"";
 if(grant==="client_credentials"&&!secret)throw Error("Client credentials grant requires a configured secret");
 const scopes=Array.isArray(c.scopes)?c.scopes.map(x=>String(x).slice(0,120)).slice(0,30):[];
 const redirect=grant==="authorization_code"?docs.validUrl(process.env.KAIROQ_OAUTH_REDIRECT_URI||""):null;
 if(redirect&&redirect.pathname!=="/api/developer/oauth/callback")throw Error("OAuth callback URL must end in /api/developer/oauth/callback");
 return{name,clientId,secret,scopes,grant,authUrl,tokenUrl,redirect};
}
function seal(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64");}
function unseal(value){const bytes=Buffer.from(value,"base64");if(bytes.length<29)throw Error("Invalid encrypted OAuth state");const decipher=crypto.createDecipheriv("aes-256-gcm",key(),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString("utf8"));}
function file(name,type){safeName(name);return path.join(STORE,type+"-"+name+".json.enc");}
function write(filename,value){fs.mkdirSync(STORE,{recursive:true,mode:0o700});const temp=filename+"."+crypto.randomBytes(6).toString("hex")+".tmp";fs.writeFileSync(temp,seal(value),{mode:0o600,flag:"wx"});fs.renameSync(temp,filename);}
function read(filename){return unseal(fs.readFileSync(filename,"utf8"));}
function providers(){return Object.keys(configs()).filter(n=>/^[a-z][a-z0-9_-]{0,49}$/i.test(n)).map(n=>{try{const c=config(n);return{name:n,grantType:c.grant,scopes:c.scopes,connected:fs.existsSync(file(n,"token"))};}catch(e){return{name:n,ready:false,error:e.message};}});}
function start(name){
 const c=config(name);if(c.grant!=="authorization_code")throw Error("Provider uses client credentials, not browser authorization");
 const state=crypto.randomBytes(32).toString("base64url"),verifier=crypto.randomBytes(32).toString("base64url"),challenge=crypto.createHash("sha256").update(verifier).digest("base64url");
 write(file(state,"state"),{provider:name,verifier,created:Date.now()});
 const u=new URL(c.authUrl.href);u.searchParams.set("response_type","code");u.searchParams.set("client_id",c.clientId);u.searchParams.set("redirect_uri",c.redirect.href);u.searchParams.set("state",state);u.searchParams.set("code_challenge",challenge);u.searchParams.set("code_challenge_method","S256");if(c.scopes.length)u.searchParams.set("scope",c.scopes.join(" "));
 return{url:u.href,state,cookie:"kq_oauth_state="+state+"; HttpOnly; Secure; SameSite=Lax; Path=/api/developer/oauth; Max-Age=600"};
}
async function postToken(c,params,{lookup=dns.lookup,timeout=12000}={}){
 const ip=await lookup(c.tokenUrl.hostname,{all:true});if(!ip?.length||ip.some(x=>!docs.publicIp(x.address)))throw Error("OAuth token host resolves to a private or unsafe address");
 const data=new URLSearchParams(params);data.set("client_id",c.clientId);if(c.secret)data.set("client_secret",c.secret);
 const body=data.toString();
 return new Promise((resolve,reject)=>{
  const req=https.request(c.tokenUrl,{method:"POST",timeout,maxHeaderSize:16000,headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded","Content-Length":Buffer.byteLength(body)},lookup:(host,opts,cb)=>cb(null,ip[0].address,ip[0].family)},res=>{
   let size=0,chunks=[];res.on("data",part=>{size+=part.length;if(size>200000){req.destroy(Error("OAuth token response too large"));return;}chunks.push(part);});
   res.on("end",()=>{if(res.statusCode<200||res.statusCode>=300)return reject(Error("OAuth provider returned HTTP "+res.statusCode));let data;try{data=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{return reject(Error("Invalid OAuth token response");}if(typeof data.access_token!=="string"||!data.access_token||data.access_token.length>20000)return reject(Error("OAuth provider returned no usable access token"));resolve(data);});
  });req.on("timeout",()=>req.destroy(Error("OAuth token request timed out")));req.on("error",reject);req.end(body);
 });
}
function save(name,tokens,previous={}){
 const expiry=Number(tokens.expires_in);const value={access_token:tokens.access_token,refresh_token:tokens.refresh_token||previous.refresh_token||null,token_type:tokens.token_type||"Bearer",scope:tokens.scope||previous.scope||"",expires_at:Number.isFinite(expiry)&&expiry>0?Date.now()+Math.min(expiry,31536000)*1000:null};
 write(file(name,"token"),value);return{provider:name,connected:true,expiresAt:value.expires_at,hasRefreshToken:!!value.refresh_token};
}
async function complete({state,code,cookie,exchange=postToken}){
 if(typeof state!=="string"||!/^[a-zA-Z0-9_-]{30,100}$/.test(state)||state!==cookie)throw Error("OAuth state/cookie mismatch");
 const filename=file(state,"state");let pending;
 try{pending=read(filename);}catch{throw Error("OAuth state expired or already used");}
 fs.unlinkSync(filename);
 if(Date.now()-pending.created>600000||Date.now()<pending.created-60000)throw Error("OAuth state expired");
 const c=config(pending.provider);if(c.grant!=="authorization_code")throw Error("Invalid OAuth grant");
 if(typeof code!=="string"||!code||code.length>4000)throw Error("OAuth authorization code missing");
 const tokens=await exchange(c,{grant_type:"authorization_code",code,redirect_uri:c.redirect.href,code_verifier:pending.verifier});
 return save(c.name,tokens);
}
const inflight=new Map();
async function accessToken(name,{exchange=postToken}={}){
 const c=config(name);const filename=file(name,"token");let saved;
 try{saved=read(filename);}catch(e){if(e.code!=="ENOENT")throw e;}
 if(saved?.access_token&&(!saved.expires_at||saved.expires_at>Date.now()+60000))return saved.access_token;
 if(inflight.has(name))return inflight.get(name);
 const refresh=(async()=>{
  let tokens;
  if(saved?.refresh_token)tokens=await exchange(c,{grant_type:"refresh_token",refresh_token:saved.refresh_token});
  else if(c.grant==="client_credentials")tokens=await exchange(c,{grant_type:"client_credentials",...(c.scopes.length?{scope:c.scopes.join(" ")}:{})});
  else throw Error("OAuth connection expired; reconnect the provider");
  save(name,tokens,saved||{});return tokens.access_token;
 })();
 inflight.set(name,refresh);try{return await refresh;}finally{inflight.delete(name);}
}
function disconnect(name){config(name);try{fs.unlinkSync(file(name,"token"));}catch(e){if(e.code!=="ENOENT")throw e;}return{provider:name,connected:false};}
module.exports={config,providers,start,complete,accessToken,disconnect,postToken};
