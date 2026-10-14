"use strict";
// Regression tests for issues found in the security and reliability review.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-review-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.APP_ENCRYPTION_KEY='review-encryption-key-0123456789';
process.env.KAIROQ_FREE_CREDITS='20';
process.env.KAIROQ_FUNCTION_TIMEOUT_MS='3000';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),hosting=require('../react-hosting'),sql=require('../react-sql'),functions=require('../react-functions'),agent=require('../react-agent'),extras=require('../react-backend-extras');

let lastModelOpts=null;
const callModel=async(opts,parse)=>{lastModelOpts=opts;return parse(JSON.stringify(opts.messages[0].content.includes('planning partner')?'Plan.':{message:'ok',files:{'src/App.jsx':'export default function App(){return <p>ok</p>}\n'}}))};
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,headers:res.headers,json,text:buf.toString()})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.7.0.'+(++ip)}});return{cookie:r.headers['set-cookie'][0].split(';')[0],account:r.json.account}}
async function project(cookie,files){const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'R'}})).json.project.id;if(files)await builder.saveSource(id,{...builder.loadFiles(id,1),...files},{summary:'setup'});return id}

test('cookie-authenticated changes from another site are blocked',async()=>{
 const {cookie}=await signup('csrf@example.com');
 const id=await project(cookie);
 for(const headers of [{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'},{'sec-fetch-site':'same-site'},{origin:'null'}])
  assert.equal((await request(server,'POST','/api/create/projects/'+id+'/members',{headers:{cookie,...headers},body:{email:'x@evil.example',role:'editor'}})).status,403,JSON.stringify(headers));
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/members',{headers:{cookie,origin:'http://'+'127.0.0.1:'+server.address().port,'sec-fetch-site':'same-origin'},body:{email:'friend@example.com',role:'viewer'}})).status,200);
});

test('invited members must have verified their email when email or Google sign-in is set up',async()=>{
 const owner=await signup('owner-r@example.com');
 const id=await project(owner.cookie);
 await request(server,'POST','/api/create/projects/'+id+'/members',{headers:{cookie:owner.cookie},body:{email:'bob@corp.example',role:'editor'}});
 process.env.KAIROQ_GOOGLE_CLIENT_ID='cid';process.env.KAIROQ_GOOGLE_CLIENT_SECRET='sec';
 try{
  const squatter=await signup('bob@corp.example');
  assert.equal((await request(server,'GET','/api/create/projects/'+id,{headers:{cookie:squatter.cookie}})).status,404,'an unverified account gets no access');
  require('../builder-accounts').database().prepare('UPDATE accounts SET email_verified=1 WHERE email=?').run('bob@corp.example');
  assert.equal((await request(server,'GET','/api/create/projects/'+id,{headers:{cookie:squatter.cookie}})).json.project.role,'editor');
 }finally{delete process.env.KAIROQ_GOOGLE_CLIENT_ID;delete process.env.KAIROQ_GOOGLE_CLIENT_SECRET}
});

test('return URLs must be this app\'s own pages, not another app or host',async()=>{
 const {cookie}=await signup('ret@example.com');
 const a=await project(cookie),b=await project(cookie);
 hosting.publish(a,{slug:'app-a'});hosting.publish(b,{slug:'app-b'});
 const host='127.0.0.1:'+server.address().port,req={headers:{host}},meta=builder.loadMeta(a);
 assert.ok(extras.allowedReturn('http://'+host+'/sites/app-a/#/account',req,meta));
 assert.ok(extras.allowedReturn('http://'+host+'/builder/p/'+a+'-'+meta.preview_key+'/v/1/',req,meta));
 for(const bad of ['http://'+host+'/sites/app-b/','http://'+host+'/api/create/me','https://evil.example/','http://'+host+'/builder/p/'+b+'-'+builder.loadMeta(b).preview_key+'/v/1/'])
  assert.throws(()=>extras.allowedReturn(bad,req,meta),/must point to this app/,bad);
 const forged=await request(server,'POST','/api/apps/'+a+'/auth/reset/request',{headers:{host:'evil.example'},body:{email:'x@example.com',return_url:'http://evil.example/'}});
 assert.equal(forged.status,400,'a forged Host header is not trusted');
});

test('Discuss is priced by tier and internal tiers cannot be chosen',async()=>{
 process.env.KAIROQ_BUILDER_PAID_APPROVED='true';process.env.KAIROQ_MAX_MODELS='x/max';
 try{
  const {cookie}=await signup('tier@example.com');
  const id=await project(cookie);
  const max=await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Hi',mode:'discuss',tier:'max'}});
  assert.equal(max.json.job.credits,15,'Discuss on Max costs the Max price');
  for(let i=0;i<100&&(await request(server,'GET','/api/create/jobs/'+max.json.job.id,{headers:{cookie}})).json.job.status!=='complete';i++)await new Promise(r=>setTimeout(r,20));
  assert.equal((await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Hi',mode:'discuss',tier:'vision'}})).status,400,'vision is internal, not a choice');
 }finally{delete process.env.KAIROQ_BUILDER_PAID_APPROVED;delete process.env.KAIROQ_MAX_MODELS}
});

test('server functions: responses are sandboxed, mapped IPv6 is private, host helpers take strings, constructor is not a collection',async()=>{
 const {cookie}=await signup('fnr@example.com');
 const id=await project(cookie,{'src/backend.json':'{"collections":{}}','functions/svg.js':"export default async function(){return {status:200,headers:{'Content-Type':'image/svg+xml','content-type':'text/html'},body:'<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>'}}"});
 const r=await request(server,'GET','/api/apps/'+id+'/functions/svg');
 assert.match(r.headers['content-security-policy'],/sandbox/);
 for(const ipv6 of ['::ffff:7f00:1','::ffff:a9fe:a9fe','64:ff9b::a00:1'])assert.equal(functions.privateAddress(ipv6),true,ipv6);
 assert.equal(functions.privateAddress('::ffff:808:808'),false);
 const host={secret:async()=>null,db:async()=>null,ai:async()=>null,email:async()=>null};
 const out=await functions.invoke({source:"export default async function(){return {json:__hostSync('tseq',JSON.stringify({a:{length:600000000},b:'x'}))}}",request:{},user:null,host});
 assert.equal(JSON.parse(out.result.json).value,false,'array-likes are not expanded into huge buffers');
 assert.equal((await request(server,'POST','/api/apps/'+id+'/collections/constructor',{body:{data:{a:1}}})).status,404);
});

test('SQL: quoted reserved names are refused, triggers work, migrations are atomic, results are size-capped',async()=>{
 const dir=path.join(tmp,'sqldir');
 for(const q of ['DELETE FROM "_kairoq_migrations"','SELECT * FROM [pragma_database_list]','COMMIT'])assert.throws(()=>sql.check(q),/not allowed|reserved/,q);
 assert.throws(()=>sql.migrate(dir,{'sql/001_a.sql':'CREATE TABLE a(x);','sql/002_b.sql':'CREATE TABLE b(;'}),/none of the new migrations were applied/);
 assert.deepEqual(sql.overview(dir).tables,[],'the first migration was rolled back too');
 sql.migrate(dir,{'sql/001_a.sql':'CREATE TABLE a(x INTEGER, n INTEGER DEFAULT 0);\nCREATE TABLE log(x);\nCREATE TRIGGER a_log AFTER INSERT ON a BEGIN INSERT INTO log(x) VALUES (NEW.x); END;'});
 sql.query(dir,'INSERT INTO a(x) VALUES (?)',[7]);
 assert.deepEqual(sql.query(dir,'SELECT x FROM log'),[{x:7}]);
 assert.throws(()=>sql.query(dir,"SELECT hex(zeroblob(3000000)) AS big"),/larger than 4 MB/);
});

test('malformed URLs on published sites return 400 instead of crashing; SEO text with $ patterns is literal',async()=>{
 const {cookie}=await signup('url@example.com');
 const id=await project(cookie);
 hosting.publish(id,{slug:'dollar'});
 assert.equal((await request(server,'GET','/sites/dollar/%E0%A4%A')).status,400);
 assert.equal((await request(server,'GET','/builder/p/'+id+'-'+builder.loadMeta(id).preview_key+'/v/1/%')).status,400);
 await request(server,'POST','/api/create/projects/'+id+'/seo',{headers:{cookie},body:{title:"Deals from $' only",description:'Pay $& less'}});
 const page=await request(server,'GET','/sites/dollar/',{headers:{'user-agent':'Mozilla/5.0 Chrome/120'}});
 assert.match(page.text,/<title>Deals from \$&#39; only<\/title>|<title>Deals from \$' only<\/title>/);
 assert.match(page.text,/content="Pay \$&amp; less"/);
});

test('agent: a bad reply is retried, and finish never saves an older build than the latest changes',async()=>{
 const {cookie}=await signup('agentr@example.com');
 const id=await project(cookie);
 const script=['not json at all',{thought:'write',actions:[{tool:'write_files',files:{'src/App.jsx':'export default function App(){return <p>v2</p>}\n'}},{tool:'build_and_test'}]},
  {thought:'break it',actions:[{tool:'write_files',files:{'src/App.jsx':"import x from './nope';\nexport default function App(){return <p>v3</p>}\n"}},{tool:'finish',message:'Added v3'}]},
  opts=>{assert.match(opts.messages.at(-1).content,/latest changes do not build/);return{thought:'fix',actions:[{tool:'write_files',files:{'src/App.jsx':'export default function App(){return <p>v3</p>}\n'}},{tool:'finish',message:'Added v3'}]}}];
 const model=async(opts,parse)=>{const next=script.shift();return parse(typeof next==='function'?JSON.stringify(next(opts)):typeof next==='string'?next:JSON.stringify(next))};
 const r=await agent.run(id,'Make v3',{callModel:model,maxSteps:6});
 assert.equal(r.message,'Added v3');
 assert.match(builder.loadFiles(id,r.version)['src/App.jsx'],/v3/);
 assert.equal(script.length,0);
});
