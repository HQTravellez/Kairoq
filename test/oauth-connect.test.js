"use strict";
// "Connect with …" (oauth-connect.js): the owner signs in on the service's page, Kairoq swaps the
// code for tokens, keeps them encrypted, renews them, and only server functions get them.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-oauth-'));
Object.assign(process.env,{NODE_ENV:'test',APP_ENCRYPTION_KEY:'test-encryption-key-123456',KAIROQ_PUBLIC_URL:'https://kairoq.example',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_HOSTING_REGISTRY:path.join(tmp,'hosting.json')});
const builder=require('../react-builder'),O=require('../oauth-connect'),secrets=require('../project-secrets');
let meta;
test.before(async()=>{meta=builder.create({name:'Shop',owner:'owner'});await builder.initialize(meta)});

test('without an OAuth app the owner is told how to use their own, with the exact return address',()=>{
 assert.throws(()=>O.start(meta.id,'hubspot',{who:'owner'}),/no OAuth app for HubSpot yet.*https:\/\/kairoq\.example\/api\/create\/oauth\/callback/);
 assert.throws(()=>O.start(meta.id,'sendgrid',{who:'owner'}),/does not sign in with OAuth/);
 assert.equal(O.status(meta.id,'hubspot').app,null);
 assert.equal(O.status(meta.id,'gitea').needs_urls,true);
 assert.throws(()=>O.saveClient(meta.id,'gitea',{client_id:'abcd',client_secret:'efgh'}),/add the authorize and token addresses/);
});

test('the sign-in link: Kairoq\'s app from Railway, the scopes, PKCE and Google\'s offline access',()=>{
 process.env.KAIROQ_OAUTH_HUBSPOT_CLIENT_ID='hub-client';process.env.KAIROQ_OAUTH_HUBSPOT_CLIENT_SECRET='hub-secret';
 const u=new URL(O.start(meta.id,'hubspot',{who:'owner'}).url);
 assert.equal(u.origin+u.pathname,'https://app.hubspot.com/oauth/authorize');
 assert.equal(u.searchParams.get('client_id'),'hub-client');assert.equal(u.searchParams.get('redirect_uri'),'https://kairoq.example/api/create/oauth/callback');
 assert.match(u.searchParams.get('scope'),/crm\.objects\.contacts\.write/);assert.ok(u.searchParams.get('state').length>=40);
 assert.equal(O.status(meta.id,'hubspot').app,'kairoq');
 O.saveClient(meta.id,'google-calendar',{client_id:'g-id-123',client_secret:'g-secret-123'});
 const g=new URL(O.start(meta.id,'google-calendar',{who:'owner'}).url);
 assert.equal(g.searchParams.get('access_type'),'offline');assert.equal(g.searchParams.get('code_challenge_method'),'S256');assert.match(g.searchParams.get('scope'),/calendar\.events/);
 assert.equal(O.status(meta.id,'google-calendar').app,'own');
});

test('coming back: the code becomes tokens kept encrypted; the link works once, for the same person',async()=>{
 const state=new URL(O.start(meta.id,'hubspot',{who:'owner'}).url).searchParams.get('state');
 const seen=[];const fetchImpl=async(url,o)=>{seen.push({url,body:Object.fromEntries(new URLSearchParams(o.body))});return{ok:true,status:200,text:async()=>JSON.stringify({access_token:'AT-1',refresh_token:'RT-1',expires_in:3600,token_type:'bearer'})}};
 await assert.rejects(O.finish({state,code:'c1'},{fetchImpl,who:'someone-else'}),/started by someone else/);
 const state2=new URL(O.start(meta.id,'hubspot',{who:'owner'}).url).searchParams.get('state');
 const r=await O.finish({state:state2,code:'c2'},{fetchImpl,who:'owner'});
 assert.equal(r.name,'HubSpot');
 assert.equal(seen[0].url,'https://api.hubapi.com/oauth/v1/token');
 assert.deepEqual({g:seen[0].body.grant_type,c:seen[0].body.code,r:seen[0].body.redirect_uri,id:seen[0].body.client_id},{g:'authorization_code',c:'c2',r:'https://kairoq.example/api/create/oauth/callback',id:'hub-client'});
 await assert.rejects(O.finish({state:state2,code:'c2'},{fetchImpl}),/expired or was already used/);
 assert.equal(O.status(meta.id,'hubspot').connected,true);
 assert.doesNotMatch(fs.readFileSync(path.join(builder.projectDir(meta.id),'secrets.json'),'utf8'),/AT-1|RT-1/,'tokens are encrypted on disk');
 assert.equal((await O.token(meta.id,'hubspot',{fetchImpl:async()=>{throw Error('no refresh needed')}})).access_token,'AT-1');
});

test('an expiring token is renewed with the refresh token',async()=>{
 const raw=JSON.parse(secrets.get(meta.id,'oauth_hubspot'));raw.expires_at=Date.now()+1000;secrets.set(meta.id,'oauth_hubspot',JSON.stringify(raw));
 let body=null;const t=await O.token(meta.id,'hubspot',{fetchImpl:async(u,o)=>{body=Object.fromEntries(new URLSearchParams(o.body));return{ok:true,status:200,text:async()=>JSON.stringify({access_token:'AT-2',expires_in:3600})}}});
 assert.equal(t.access_token,'AT-2');assert.equal(body.grant_type,'refresh_token');assert.equal(body.refresh_token,'RT-1');
 assert.equal(JSON.parse(secrets.get(meta.id,'oauth_hubspot')).refresh_token,'RT-1','the refresh token is kept');
});

test('server functions get the token with secrets.oauth, and it never shows in their logs',async()=>{
 const backend=require('../react-backend');
 const FN="export default async function (request, { secrets, log }) {\n  const { access_token } = await secrets.oauth('hubspot');\n  log('token ' + access_token);\n  return { status: 200, json: { starts: access_token.slice(0, 3) } };\n}\n";
 await builder.saveSource(meta.id,{...builder.loadFiles(meta.id,1),'functions/crm.js':FN},{summary:'crm'});
 const server=http.createServer(async(req,res)=>{try{if(await backend.handle(req,res))return}catch(e){res.writeHead(e.status||500);return res.end(String(e.message))}res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/apps/'+meta.id+'/functions/crm',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.starts,'AT-');
  const logs=JSON.stringify(require('../react-logs').list?require('../react-logs').list(meta.id):'');
  assert.match(logs,/token •••/,'the log line is kept with the token hidden');assert.doesNotMatch(logs,/AT-2/);
 }finally{server.close()}
});

test('the editor API: start, the callback page, and disconnect (owner only)',async()=>{
 const createApi=require('../create-api');
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,callModel:async()=>({}),secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/api/create';
 try{
  const s=await (await fetch(base+'/projects/'+meta.id+'/oauth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'start',service:'hubspot'})})).json();
  const state=new URL(s.url).searchParams.get('state');
  const bad=await fetch(base+'/oauth/callback?state=nope&code=x');assert.equal(bad.status,400);assert.match(await bad.text(),/expired or was already used/);
  const denied=await fetch(base+'/oauth/callback?state='+state+'&error=access_denied');assert.match(await denied.text(),/did not allow the connection/);
  const off=await (await fetch(base+'/projects/'+meta.id+'/oauth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'disconnect',service:'hubspot'})})).json();
  assert.equal(off.oauth.connected,false);
 }finally{server.close()}
});
