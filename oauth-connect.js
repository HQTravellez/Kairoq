"use strict";
// "Connect with …" for an app's outside services (OAuth 2.0): the owner signs in on the
// service's own page and presses Allow; the service sends back a code that Kairoq exchanges for
// tokens. The tokens are kept encrypted with the project's secrets (project-secrets.js), renewed
// automatically, and reach only the app's server functions (await secrets.oauth('mailchimp')),
// never the browser.
// Each service needs an OAuth app registered by someone (a Client ID and Secret, and Kairoq's
// return address): Kairoq's own, from Railway (KAIROQ_OAUTH_<SERVICE>_CLIENT_ID and
// _CLIENT_SECRET), or else the owner's own, entered in the editor.
// Safety: the state in the link is random, single-use, bound to the project and the person, and
// expires after 10 minutes; PKCE where the service supports it; the return address is fixed.
const crypto=require('crypto');
const secrets=require('./project-secrets');

const STATE_TTL=10*60000,states=new Map();
function fail(status,message){return Object.assign(Error(message),{status})}
function envKey(id){return'KAIROQ_OAUTH_'+String(id).toUpperCase().replace(/[^A-Z0-9]+/g,'_')}
function publicOrigin(fallback){return(process.env.KAIROQ_PUBLIC_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'')||fallback||'').replace(/\/$/,'')}
function redirectUri(fallback){return publicOrigin(fallback)+'/api/create/oauth/callback'}
function piece(service){
 const native=require('./native-connections').find(service);
 const p=native||require('./integrations').find(service);
 if(!p||!p.auth||p.auth.type!=='OAuth2')throw fail(404,'"'+String(service).slice(0,60)+'" does not sign in with OAuth');
 return p;
}
// Reading a saved value; with saving switched off (no APP_ENCRYPTION_KEY) there is none.
function read(id,name){try{return secrets.get(id,name)}catch{return null}}
function prune(){const now=Date.now();for(const [k,v] of states)if(v.expires<now)states.delete(k)}

// The OAuth app to use: Kairoq's own (Railway) or the owner's own (saved per project).
function client(id,service){
 const k=envKey(service);
 if(process.env[k+'_CLIENT_ID']&&process.env[k+'_CLIENT_SECRET'])return{id:process.env[k+'_CLIENT_ID'],secret:process.env[k+'_CLIENT_SECRET'],own:false};
 const raw=read(id,'oauthapp_'+service.replace(/[^a-z0-9]+/g,'_'));
 if(raw)try{const c=JSON.parse(raw);if(c.id&&c.secret)return{...c,own:true}}catch{}
 return null;
}
// The owner's own OAuth app (and, for services whose addresses Kairoq does not know, the addresses).
function saveClient(id,service,{client_id,client_secret,auth_url,token_url,scope}={}){
 const p=piece(service);
 const cid=String(client_id||'').trim(),cs=String(client_secret||'').trim();
 if(cid.length<4||cs.length<4||cid.length>400||cs.length>400)throw fail(400,'Paste the Client ID and the Client Secret from the service\'s developer settings.');
 const ok=u=>!u||/^https:\/\/[^\s]+$/.test(String(u));
 if(!ok(auth_url)||!ok(token_url))throw fail(400,'The authorize and token addresses must start with https://');
 if(!(auth_url||p.auth.authUrl)||!(token_url||p.auth.tokenUrl))throw fail(400,'Kairoq does not know '+p.displayName+'\'s sign-in addresses: add the authorize and token addresses from its developer docs.');
 secrets.set(id,'oauthapp_'+p.id.replace(/[^a-z0-9]+/g,'_'),JSON.stringify({id:cid,secret:cs,...(auth_url?{auth_url:String(auth_url)}:{}),...(token_url?{token_url:String(token_url)}:{}),...(scope?{scope:String(scope).slice(0,1000)}:{})}));
 return status(id,p.id);
}
function urls(p,c){
 const auth=String(c&&c.auth_url||p.auth.authUrl||''),token=String(c&&c.token_url||p.auth.tokenUrl||''),refresh=String(c&&c.refresh_url||p.auth.refreshUrl||token);
 if(/\{|\$\{/.test(auth+token+refresh))throw fail(409,p.displayName+'\'s sign-in address depends on your account (it has a placeholder). Add your own authorize and token addresses in "Use your own OAuth app".');
 if(!/^https:\/\//.test(auth)||!/^https:\/\//.test(token)||!/^https:\/\//.test(refresh))throw fail(409,'Kairoq does not know '+p.displayName+'\'s sign-in addresses. Add them in "Use your own OAuth app".');
 return{auth,token,refresh};
}
// Step 1: the link to the service's sign-in page.
function start(id,service,{who,fallbackOrigin}={}){
 const p=piece(service),c=client(id,p.id);
 if(!c)throw fail(409,'Kairoq has no OAuth app for '+p.displayName+' yet. Use your own (Client ID and Secret), registering this return address with it: '+redirectUri(fallbackOrigin));
 const {auth}=urls(p,c);prune();
 const state=crypto.randomBytes(32).toString('base64url'),verifier=p.auth.pkce?crypto.randomBytes(48).toString('base64url'):null;
 states.set(state,{id,service:p.id,who:String(who||''),verifier,expires:Date.now()+STATE_TTL,redirect:redirectUri(fallbackOrigin)});
 const u=new URL(auth);
 u.searchParams.set('response_type','code');u.searchParams.set('client_id',c.id);u.searchParams.set('redirect_uri',redirectUri(fallbackOrigin));u.searchParams.set('state',state);
 const scope=c.scope||(p.auth.scope||[]).join(' ');if(scope&&!u.searchParams.has('scope'))u.searchParams.set('scope',scope);
 for(const [k,v] of Object.entries(p.auth.extra||{}))if(!u.searchParams.has(k))u.searchParams.set(k,v);
 if(/google\.com/.test(u.host)){u.searchParams.set('access_type','offline');u.searchParams.set('prompt','consent')}
 if(verifier){u.searchParams.set('code_challenge',crypto.createHash('sha256').update(verifier).digest('base64url'));u.searchParams.set('code_challenge_method','S256')}
 return{url:u.href,service:p.id,expires_in:STATE_TTL/1000};
}
async function tokenRequest(p,c,params,fetchImpl){
 const u=urls(p,c),endpoint=params.refresh_token?u.refresh:u.token;
 const body=new URLSearchParams(params),headers={'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'};
 if(p.auth.method==='HEADER')headers.Authorization='Basic '+Buffer.from(c.id+':'+c.secret).toString('base64');
 else{body.set('client_id',c.id);body.set('client_secret',c.secret)}
 const r=await fetchImpl(endpoint,{method:'POST',headers,body:body.toString(),signal:AbortSignal.timeout(20000)});
 const text=await r.text();let j;try{j=JSON.parse(text)}catch{j=Object.fromEntries(new URLSearchParams(text))}
 if(!r.ok||!j.access_token)throw fail(502,p.displayName+' did not give a token'+(j.error_description||j.error?': '+String(j.error_description||j.error).slice(0,160):' (HTTP '+r.status+')'));
 return j;
}
function keep(id,service,j,prev={}){
 const saved={access_token:String(j.access_token),refresh_token:j.refresh_token?String(j.refresh_token):prev.refresh_token||null,token_type:j.token_type||'Bearer',scope:j.scope||prev.scope||null,
  expires_at:j.expires_in?Date.now()+Number(j.expires_in)*1000:null,connected_at:prev.connected_at||new Date().toISOString(),refreshed_at:new Date().toISOString(),
  ...(j.instance_url?{instance_url:String(j.instance_url)}:{}),...(j.team&&j.team.name?{account:String(j.team.name)}:{})};
 secrets.set(id,'oauth_'+service.replace(/[^a-z0-9]+/g,'_'),JSON.stringify(saved));
 return saved;
}
// Step 2: the service sends the owner back with a code; Kairoq swaps it for tokens.
async function finish({state,code,error},{fetchImpl=fetch,who=null}={}){
 prune();const s=states.get(String(state||''));states.delete(String(state||''));
 if(!s)throw fail(400,'This sign-in link has expired or was already used. Press Connect again.');
 // The person who comes back must be the one who started (when the browser is signed in).
 if(who&&s.who&&who!==s.who)throw fail(403,'This connection was started by someone else.');
 if(error)throw fail(400,'The service did not allow the connection ('+String(error).slice(0,80)+').');
 if(!code)throw fail(400,'The service sent no code. Press Connect again.');
 const p=piece(s.service),c=client(s.id,s.service);if(!c)throw fail(409,'The OAuth app was removed. Add it again.');
 const j=await tokenRequest(p,c,{grant_type:'authorization_code',code:String(code),redirect_uri:s.redirect,...(s.verifier?{code_verifier:s.verifier}:{})},fetchImpl);
 keep(s.id,s.service,j);
 return{id:s.id,service:s.service,name:p.displayName};
}
// The access token for a server function, renewed when it is about to expire.
async function token(id,service,{fetchImpl=fetch}={}){
 const p=piece(service),raw=secrets.get(id,'oauth_'+p.id.replace(/[^a-z0-9]+/g,'_'));
 if(!raw)throw fail(409,p.displayName+' is not connected. The owner connects it in Connectors → 744 apps.');
 let t=JSON.parse(raw);
 if(t.expires_at&&t.expires_at-Date.now()<120000){
  if(!t.refresh_token)throw fail(409,p.displayName+'\'s connection has expired. The owner connects it again in Connectors.');
  const c=client(id,p.id);if(!c)throw fail(409,'The OAuth app for '+p.displayName+' was removed.');
  const refreshParams=p.auth.refreshWithoutGrant?{refresh_token:t.refresh_token}:{grant_type:'refresh_token',refresh_token:t.refresh_token};
  t=keep(id,p.id,await tokenRequest(p,c,refreshParams,fetchImpl),t);
 }
 return{access_token:t.access_token,token_type:t.token_type||'Bearer',...(t.instance_url?{instance_url:t.instance_url}:{})};
}
function status(id,service,{fallbackOrigin}={}){
 const p=piece(service),c=client(id,p.id),raw=read(id,'oauth_'+p.id.replace(/[^a-z0-9]+/g,'_'));
 let t=null;try{t=raw?JSON.parse(raw):null}catch{}
 return{service:p.id,name:p.displayName,app:c?(c.own?'own':'kairoq'):null,connected:Boolean(t),connected_at:t&&t.connected_at||null,account:t&&t.account||null,scopes:(p.auth.scope||[]).slice(),
  needs_urls:!p.auth.authUrl||!p.auth.tokenUrl||/\{|\$\{/.test(String(p.auth.authUrl)+String(p.auth.tokenUrl)),redirect_uri:redirectUri(fallbackOrigin)};
}
function disconnect(id,service){const p=piece(service);secrets.set(id,'oauth_'+p.id.replace(/[^a-z0-9]+/g,'_'),'');return status(id,p.id)}
module.exports={start,finish,token,status,saveClient,disconnect,client,redirectUri,envKey,_states:states};
