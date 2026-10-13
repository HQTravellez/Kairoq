"use strict";
// Google sign-in for Kairoq accounts and for users of generated apps. One redirect URI
// (<KAIROQ_PUBLIC_URL>/api/create/auth/google/callback) serves both; state is kept on the
// server, and apps receive a one-time code in the URL fragment, never a session token.
const crypto=require('crypto');
const states=new Map(),codes=new Map();
function clientId(){return process.env.KAIROQ_GOOGLE_CLIENT_ID||process.env.GOOGLE_CLIENT_ID||''}
function clientSecret(){return process.env.KAIROQ_GOOGLE_CLIENT_SECRET||process.env.GOOGLE_CLIENT_SECRET||''}
function configured(){return Boolean(clientId()&&clientSecret())}
function publicOrigin(fallback){return(process.env.KAIROQ_PUBLIC_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'')||fallback||'').replace(/\/$/,'')}
function redirectUri(fallback){return publicOrigin(fallback)+'/api/create/auth/google/callback'}
function prune(map){const now=Date.now();if(map.size>5000)map.clear();for(const [k,v] of map)if(v.expires<now)map.delete(k)}
// kind: 'kairoq' | 'app'; for apps, appId and a validated returnUrl.
function startUrl({kind,appId,returnUrl},fallbackOrigin){
 if(!configured())throw Object.assign(Error('Google sign-in is not set up on this server'),{status:409});
 prune(states);
 const state=crypto.randomBytes(18).toString('base64url');
 states.set(state,{kind,appId:appId||null,returnUrl:returnUrl||null,expires:Date.now()+600000});
 const q=new URLSearchParams({client_id:clientId(),redirect_uri:redirectUri(fallbackOrigin),response_type:'code',scope:'openid email profile',state,prompt:'select_account'});
 return'https://accounts.google.com/o/oauth2/v2/auth?'+q;
}
async function finish(query,fallbackOrigin,{fetchImpl=fetch}={}){
 const entry=states.get(String(query.state||''));
 if(!entry||entry.expires<Date.now())throw Object.assign(Error('Sign-in expired. Please try again.'),{status:400});
 states.delete(String(query.state));
 if(query.error)throw Object.assign(Error('Google sign-in was cancelled'),{status:400});
 const tokenRes=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(query.code||''),client_id:clientId(),client_secret:clientSecret(),redirect_uri:redirectUri(fallbackOrigin),grant_type:'authorization_code'}).toString(),signal:AbortSignal.timeout(15000)});
 const tokens=await tokenRes.json().catch(()=>({}));
 if(!tokenRes.ok||!tokens.access_token)throw Object.assign(Error('Google sign-in failed'),{status:400});
 const infoRes=await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(15000)});
 const profile=await infoRes.json().catch(()=>({}));
 if(!infoRes.ok||!profile.sub||!profile.email||profile.email_verified!==true)throw Object.assign(Error('Google did not confirm this email address'),{status:400});
 return{entry,profile:{sub:String(profile.sub),email:String(profile.email),email_verified:true,name:profile.name?String(profile.name).slice(0,120):null}};
}
// One-time, 60-second codes that an app exchanges for a session token.
function issueAppCode(appId,session){prune(codes);const code=crypto.randomBytes(24).toString('base64url');codes.set(code,{appId,session,expires:Date.now()+60000});return code}
function redeemAppCode(appId,code){
 const entry=codes.get(String(code||''));codes.delete(String(code||''));
 if(!entry||entry.expires<Date.now()||entry.appId!==appId)throw Object.assign(Error('Sign-in expired. Please try again.'),{status:400});
 return entry.session;
}
module.exports={configured,startUrl,finish,issueAppCode,redeemAppCode,redirectUri,_states:states};
