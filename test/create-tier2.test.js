"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),crypto=require('crypto'),zlib=require('zlib');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-tier2-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.APP_ENCRYPTION_KEY='test-encryption-key-0123456789';
const builder=require('../react-builder'),hosting=require('../react-hosting'),createApi=require('../create-api'),backend=require('../react-backend'),extras=require('../react-backend-extras'),exporter=require('../react-export'),secrets=require('../project-secrets');

function reply(obj){return(_o,parse)=>Promise.resolve(parse(JSON.stringify(obj)))}
function request(server,method,url,{body,raw,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=raw!==undefined?raw:body?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':raw!==undefined?'application/octet-stream':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const buf=Buffer.concat(chunks);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,headers:res.headers,buf,text:buf.toString(),json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,cookie,accountEmail='owner2@example.com';
test.before(async()=>{
 server=http.createServer(async(req,res)=>{const h=hosting.handleHost(req,res);if(typeof h==='string'){if(!await backend.handle(req,res,{onlyProject:h.slice(8)})){res.writeHead(404);res.end()}return}if(h)return;if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(await createApi.handle(req,res,{isOwner:()=>false,callModel:reply({message:'x',files:{}}),secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 cookie=(await request(server,'POST','/api/create/signup',{body:{email:accountEmail,password:'password1'}})).headers['set-cookie'][0].split(';')[0];
});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function project(files){
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'T2'}})).json.project.id;
 if(files)await builder.edit(id,'x',{callModel:reply({message:'setup',files})});
 return id;
}
const APP=`export default function App(){const name='x';return (
  <main className="p-6">
    <h1 className="text-xl">Hello bakery</h1>
    <p>{name}</p>
    <img src="https://example.com/a.png" alt="old" />
  </main>);}
`;

test('visual edits change text, classes and images without the AI and save a version',async()=>{
 const id=await project({'src/App.jsx':APP});
 const v=builder.loadMeta(id).current_version;
 const bundle=()=>{const d=path.join(builder.versionDir(id,builder.loadMeta(id).current_version),'dist','assets');return fs.readFileSync(path.join(d,fs.readdirSync(d).find(f=>f.endsWith('.js'))),'utf8')};
 assert.match(bundle(),/"data-kq":"src\/App\.jsx:3:4"/,'elements are tagged with their source location');
 const el=(await request(server,'POST','/api/create/projects/'+id+'/inspect',{headers:{cookie},body:{loc:'src/App.jsx:3:4',version:v}})).json.element;
 assert.deepEqual([el.tag,el.text,el.class_name,el.latest],['h1','Hello bakery','text-xl',true]);
 const r=await request(server,'POST','/api/create/projects/'+id+'/visual',{headers:{cookie},body:{loc:'src/App.jsx:3:4',version:v,changes:{text:'Rosa Bakery',className:'text-4xl font-bold text-rose-600'}}});
 assert.equal(r.status,200,r.text);
 assert.equal(r.json.project.current_version,v+1);
 assert.match(builder.loadFiles(id,v+1)['src/App.jsx'],/<h1 className="text-4xl font-bold text-rose-600">Rosa Bakery<\/h1>/);
 assert.match(bundle(),/Rosa Bakery/);
 const img=await request(server,'POST','/api/create/projects/'+id+'/visual',{headers:{cookie},body:{loc:'src/App.jsx:5:4',version:v+1,changes:{src:'./uploads/logo.png',alt:'Logo'}}});
 assert.equal(img.status,200,img.text);
 const bad=await request(server,'POST','/api/create/projects/'+id+'/visual',{headers:{cookie},body:{loc:'src/App.jsx:4:4',version:v+2,changes:{text:'x'}}});
 assert.equal(bad.status,400);assert.match(bad.json.error,/comes from code/);
 const stale=await request(server,'POST','/api/create/projects/'+id+'/visual',{headers:{cookie},body:{loc:'src/App.jsx:3:4',version:v,changes:{text:'x'}}});
 assert.equal(stale.status,409);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/visual',{headers:{cookie},body:{loc:'src/App.jsx:5:4',version:v+2,changes:{src:'javascript:alert(1)'}}})).status,400);
 const me=(await request(server,'GET','/api/create/me',{headers:{cookie}})).json.viewer.account;
 assert.equal(me.credits,30,'visual edits are free');
});

const PNG=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(30)]);
test('file uploads respect access, type and ownership',async()=>{
 const id=await project({'src/App.jsx':APP,'src/backend.json':JSON.stringify({collections:{},storage:{access:'signed-in'}})});
 const base='/api/apps/'+id;
 const ana=(await request(server,'POST',base+'/auth/signup',{body:{email:'ana@x.co',password:'password1'}})).json.token;
 const bo=(await request(server,'POST',base+'/auth/signup',{body:{email:'bo@x.co',password:'password1'}})).json.token;
 assert.equal((await request(server,'POST',base+'/files?name=a.png',{raw:PNG,headers:{'Content-Type':'image/png'}})).status,401);
 const up=await request(server,'POST',base+'/files?name=photo.png',{raw:PNG,headers:{'Content-Type':'image/png',authorization:'Bearer '+ana}});
 assert.equal(up.status,201,up.text);
 const file=await request(server,'GET',up.json.file.url);
 assert.equal(file.status,200);assert.ok(file.buf.equals(PNG));assert.equal(file.headers['content-type'],'image/png');assert.match(file.headers['content-security-policy'],/sandbox/);
 assert.equal((await request(server,'POST',base+'/files',{raw:Buffer.from('<script>'),headers:{'Content-Type':'text/html',authorization:'Bearer '+ana}})).status,415);
 assert.equal((await request(server,'DELETE',up.json.file.url,{headers:{authorization:'Bearer '+bo}})).status,403);
 assert.equal((await request(server,'DELETE',up.json.file.url,{headers:{authorization:'Bearer '+ana}})).status,200);
 assert.equal((await request(server,'GET',up.json.file.url)).status,404);
});

test('email goes only to the app owner or the signed-in user, with limits',async()=>{
 const id=await project({'src/App.jsx':APP,'src/backend.json':JSON.stringify({collections:{},email:true})});
 const base='/api/apps/'+id,sent=[],original=global.fetch;
 process.env.KAIROQ_RESEND_API_KEY='re_test';process.env.KAIROQ_EMAIL_FROM='Kairoq <apps@example.com>';
 global.fetch=async(url,init)=>{if(String(url).startsWith('https://api.resend.com')){sent.push(JSON.parse(init.body));return new Response('{"id":"e1"}',{status:200})}return original(url,init)};
 try{
  assert.equal((await request(server,'POST',base+'/email',{body:{to:'owner',subject:'New booking',text:'Table for 2'}})).status,200);
  assert.deepEqual(sent[0].to,[accountEmail]);assert.match(sent[0].text,/Table for 2/);
  assert.equal((await request(server,'POST',base+'/email',{body:{to:'victim@example.com',subject:'x',text:'y'}})).status,400);
  assert.equal((await request(server,'POST',base+'/email',{body:{to:'me',subject:'x',text:'y'}})).status,401);
  for(let i=0;i<4;i++)await request(server,'POST',base+'/email',{body:{to:'owner',subject:'s',text:'t'}});
  assert.equal((await request(server,'POST',base+'/email',{body:{to:'owner',subject:'s',text:'t'}})).status,429,'anonymous senders are limited to 5 an hour');
  delete process.env.KAIROQ_RESEND_API_KEY;
  const tok=(await request(server,'POST',base+'/auth/signup',{body:{email:'cy@x.co',password:'password1'}})).json.token;
  const kept=await request(server,'POST',base+'/email',{body:{to:'me',subject:'Your booking',text:'See you at 7'},headers:{authorization:'Bearer '+tok}});
  assert.equal(kept.status,200,'email not set up does not fail the customer');assert.equal(kept.json.sent,false);assert.equal(kept.json.saved,true);
  assert.equal(sent.length,5,'nothing is sent without the key');
  const outbox=require('../react-backend').overview(id).outbox;assert.equal(outbox[0].subject,'Your booking');assert.equal(outbox[0].user_email,'cy@x.co');
 }finally{global.fetch=original;delete process.env.KAIROQ_EMAIL_FROM}
});

test('payments use the owner Stripe key, check the return URL and record verified purchases once',async()=>{
 const id=await project({'src/App.jsx':APP,'src/backend.json':JSON.stringify({collections:{},payments:{products:{pro:{price:'price_123',mode:'payment'}}}})});
 const base='/api/apps/'+id,original=global.fetch,calls=[];
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/settings',{headers:{cookie},body:{stripe_secret_key:'not-a-key'}})).status,400);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/settings',{headers:{cookie},body:{stripe_secret_key:'sk_test_abcdefghijkl123',stripe_webhook_secret:'whsec_abcdefghijklmnop'}})).status,200);
 const stored=fs.readFileSync(path.join(builder.projectDir(id),'secrets.json'),'utf8');
 assert.doesNotMatch(stored,/sk_test_abcdefghijkl123/,'keys are encrypted at rest');
 const settings=(await request(server,'GET','/api/create/projects/'+id+'/settings',{headers:{cookie}})).json.settings;
 assert.equal(settings.secrets.stripe_secret_key.hint,'…l123');assert.doesNotMatch(JSON.stringify(settings),/sk_test_abcdef/);
 const user=(await request(server,'POST',base+'/auth/signup',{body:{email:'buyer@x.co',password:'password1'}})).json;
 global.fetch=async(url,init)=>{if(String(url).startsWith('https://api.stripe.com')){calls.push({url:String(url),auth:init.headers.Authorization,body:init.body});
   if(init.method==='POST')return new Response(JSON.stringify({id:'cs_test_9',url:'https://checkout.stripe.com/c/cs_test_9'}),{status:200});
   return new Response(JSON.stringify({id:'cs_test_9',mode:'payment',payment_status:'paid',amount_total:900,currency:'usd',metadata:{kairoq_app:id,product:'pro',user_id:user.user.id}}),{status:200})}
  return original(url,init)};
 try{
  const host='127.0.0.1:'+server.address().port;
  assert.equal((await request(server,'POST',base+'/payments/checkout',{body:{product:'pro',return_url:'http://'+host+'/sites/x/'}})).status,401);
  assert.equal((await request(server,'POST',base+'/payments/checkout',{body:{product:'pro',return_url:'https://evil.example/'},headers:{authorization:'Bearer '+user.token}})).status,400);
  const co=await request(server,'POST',base+'/payments/checkout',{body:{product:'pro',return_url:'http://'+host+'/builder/p/'+id+'-'+require('../react-builder').loadMeta(id).preview_key+'/v/2/#/pricing'},headers:{authorization:'Bearer '+user.token}});
  assert.equal(co.status,200,co.text);assert.equal(co.json.url,'https://checkout.stripe.com/c/cs_test_9');
  assert.equal(calls[0].auth,'Bearer sk_test_abcdefghijkl123');assert.match(calls[0].body,/price_123/);assert.match(decodeURIComponent(calls[0].body),/kairoq_payment=success/);
  const raw=JSON.stringify({type:'checkout.session.completed',data:{object:{id:'cs_test_9'}}}),stamp=Math.floor(Date.now()/1000);
  const sig='t='+stamp+',v1='+crypto.createHmac('sha256','whsec_abcdefghijklmnop').update(stamp+'.'+raw).digest('hex');
  assert.equal((await request(server,'POST',base+'/payments/webhook',{raw:Buffer.from(raw),headers:{'stripe-signature':sig.replace(/v1=(.)/,(m,c)=>'v1='+(c==='0'?'1':'0'))}})).status,401);
  assert.equal((await request(server,'POST',base+'/payments/webhook',{raw:Buffer.from(raw),headers:{'stripe-signature':sig}})).json.recorded,'cs_test_9');
  await request(server,'POST',base+'/payments/webhook',{raw:Buffer.from(raw),headers:{'stripe-signature':sig}});
  const mine=(await request(server,'GET',base+'/payments/mine',{headers:{authorization:'Bearer '+user.token}})).json.purchases;
  assert.deepEqual(mine.map(p=>[p.product,p.status]),[['pro','active']]);
  const overview=(await request(server,'GET','/api/create/projects/'+id+'/data',{headers:{cookie}})).json;
  assert.equal(overview.payments.length,1);assert.equal(overview.payments[0].email,'buyer@x.co');
 }finally{global.fetch=original}
});

test('scheduled jobs delete old records and email the owner a summary when due',async()=>{
 const id=await project({'src/App.jsx':APP,'src/backend.json':JSON.stringify({collections:{logs:{access:'public'},bookings:{access:'public'}},schedules:[{name:'cleanup',every:'day',action:'delete_older_than',collection:'logs',days:7},{name:'digest',every:'day',action:'email_owner_summary',collection:'bookings'}]})});
 const db=backend.database(id),old=new Date(Date.now()-10*86400000).toISOString(),now=new Date().toISOString();
 db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)').run('a','logs',null,'{}',old,old);
 db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)').run('b','logs',null,'{}',now,now);
 db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)').run('c','bookings',null,JSON.stringify({name:'Ana',guests:2}),now,now);
 const mails=[],send=async(to,subject,text)=>mails.push({to,subject,text});
 const meta=builder.loadMeta(id),cfg=backend.parseConfig(builder.loadFiles(id,meta.current_version));
 const first=await extras.runSchedules(id,cfg,db,meta,{send});
 assert.deepEqual(first.map(r=>r.result),['deleted 1 records','emailed 1 records']);
 assert.equal(mails[0].to,accountEmail);assert.match(mails[0].text,/name: Ana, guests: 2/);
 assert.deepEqual(await extras.runSchedules(id,cfg,db,meta,{send}),[],'not due again within a day');
 assert.equal((await extras.runSchedules(id,cfg,db,meta,{send,now:Date.now()+86400000+1000})).length,2);
 assert.throws(()=>backend.parseConfig({'src/backend.json':JSON.stringify({collections:{},schedules:[{name:'x',every:'day',action:'delete_older_than',collection:'nope'}]})}),/not declared/);
});

function unzip(buf){const out={};let i=0;while(buf.readUInt32LE(i)===0x04034b50){const size=buf.readUInt32LE(i+18),nameLen=buf.readUInt16LE(i+26),extra=buf.readUInt16LE(i+28),name=buf.slice(i+30,i+30+nameLen).toString();out[name]=zlib.inflateRawSync(buf.slice(i+30+nameLen+extra,i+30+nameLen+extra+size));i+=30+nameLen+extra+size}return out}
test('code download is a runnable Vite project that keeps the Kairoq backend',async()=>{
 const id=await project({'src/App.jsx':APP});
 const r=await request(server,'GET','/api/create/projects/'+id+'/download',{headers:{cookie}});
 assert.equal(r.status,200);assert.equal(r.headers['content-type'],'application/zip');
 const files=unzip(r.buf);
 for(const f of ['package.json','vite.config.js','tailwind.config.js','postcss.config.js','index.html','src/App.jsx','src/main.jsx','src/kairoq.js','README.md'])assert.ok(files[f],f);
 const pkg=JSON.parse(files['package.json']);assert.equal(pkg.dependencies.react,'18.3.1');assert.ok(pkg.devDependencies.vite);
 assert.doesNotMatch(files['index.html'].toString(),/kairoq-reporter/);
 assert.match(files['src/kairoq.js'].toString(),new RegExp('/api/apps/'+id));
});

test('GitHub push writes a commit that keeps unrelated files, and pull brings src changes back',async()=>{
 const id=await project({'src/App.jsx':APP});
 const original=global.fetch,log=[];let blobs=0,headSha='c1';
 const remoteApp=APP.replace('Hello bakery','Edited on GitHub');
 global.fetch=async(url,init={})=>{
  const u=String(url);if(!u.startsWith('https://api.github.com'))return original(url,init);
  const p=u.slice('https://api.github.com'.length),m=init.method||'GET',body=init.body?JSON.parse(init.body):null;log.push([m,p,body]);
  const ok=d=>new Response(JSON.stringify(d),{status:200});
  if(p==='/repos/ana/shop'&&m==='GET')return ok({default_branch:'main'});
  if(p==='/repos/ana/shop/git/ref/heads/main')return ok({object:{sha:headSha}});
  if(p==='/repos/ana/shop/git/commits/c1')return ok({sha:'c1',tree:{sha:'t1'}});
  if(p==='/repos/ana/shop/git/commits/c2')return ok({sha:'c2',tree:{sha:'t2'}});
  if(p==='/repos/ana/shop/git/trees/t1?recursive=1')return ok({tree:[{path:'.github/workflows/ci.yml',mode:'100644',type:'blob',sha:'keep'},{path:'src/Old.jsx',mode:'100644',type:'blob',sha:'old'}]});
  if(p==='/repos/ana/shop/git/blobs'&&m==='POST')return ok({sha:'b'+(++blobs)});
  if(p==='/repos/ana/shop/git/trees'&&m==='POST')return ok({sha:'t2'});
  if(p==='/repos/ana/shop/git/commits'&&m==='POST')return ok({sha:'c2'});
  if(p==='/repos/ana/shop/git/refs/heads/main'&&m==='PATCH'){headSha=body.sha;return ok({})}
  // The pushed tree: every project source file (App.jsx edited on GitHub) plus the generated client.
  const current=()=>builder.loadFiles(id,builder.loadMeta(id).current_version);
  if(p==='/repos/ana/shop/git/trees/t2?recursive=1')return ok({tree:[...Object.keys(current()).map((f,i)=>({path:f,type:'blob',sha:'s'+i,size:400})),{path:'src/kairoq.js',type:'blob',sha:'ignored',size:10}]});
  if(p.startsWith('/repos/ana/shop/git/blobs/s')){const files=current(),name=Object.keys(files)[Number(p.split('/').pop().slice(1))];return ok({content:Buffer.from(name==='src/App.jsx'?remoteApp:files[name]).toString('base64')})}
  return new Response(JSON.stringify({message:'Not Found'}),{status:404});
 };
 try{
  assert.equal((await request(server,'POST','/api/create/projects/'+id+'/push',{headers:{cookie},body:{repo:'ana/shop'}})).status,409,'needs a token');
  await request(server,'POST','/api/create/projects/'+id+'/settings',{headers:{cookie},body:{github_token:'github_pat_abcdefghijklmnopqrstuvwxyz'}});
  const pushed=await request(server,'POST','/api/create/projects/'+id+'/push',{headers:{cookie},body:{repo:'https://github.com/ana/shop.git'}});
  assert.equal(pushed.status,200,pushed.text);assert.equal(pushed.json.result.commit,'c2');
  const tree=log.find(([m,p])=>m==='POST'&&p==='/repos/ana/shop/git/trees')[2].tree.map(e=>e.path);
  assert.ok(tree.includes('.github/workflows/ci.yml'),'unrelated files are kept');
  assert.ok(!tree.includes('src/Old.jsx'),'stale managed files are removed');
  assert.ok(tree.includes('src/kairoq.js')&&tree.includes('package.json'));
  assert.equal(log.find(([m,p])=>m==='PATCH')[2].sha,'c2');
  const before=builder.loadMeta(id).current_version;
  const pulled=await request(server,'POST','/api/create/projects/'+id+'/pull',{headers:{cookie}});
  assert.equal(pulled.status,200,pulled.text);assert.deepEqual(pulled.json.result.changed,['src/App.jsx']);
  assert.equal(builder.loadMeta(id).current_version,before+1);
  assert.match(builder.loadFiles(id,before+1)['src/App.jsx'],/Edited on GitHub/);
 }finally{global.fetch=original}
});

test('custom domains are registered with Railway and show Railway DNS records',async()=>{
 const id=await project({'src/App.jsx':APP});
 const calls=[],railway={configured:()=>true,addDomain:async d=>{calls.push(['add',d]);return{id:'rd_1',dns:[{type:'CNAME',name:'www.shop.example',value:'abc123.up.railway.app'}],certificate:'CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP'}},removeDomain:async rid=>{calls.push(['remove',rid])}};
 const r=await hosting.addDomain(id,'www.shop.example',{railway});
 assert.equal(r.dns[0].value,'abc123.up.railway.app');assert.equal(r.dns[1].type,'TXT');
 const view=(await request(server,'GET','/api/create/projects/'+id,{headers:{cookie}})).json.project.domains[0];
 assert.equal(view.dns[0].value,'abc123.up.railway.app');
 await hosting.removeDomain(id,'www.shop.example',{railway});
 assert.deepEqual(calls,[['add','www.shop.example'],['remove','rd_1']]);
 const failing={configured:()=>true,addDomain:async()=>{throw Error('Railway: Not Authorized')}};
 const f=await hosting.addDomain(id,'shop2.example',{railway:failing});
 assert.match(f.domain.railway_error,/Not Authorized/);assert.equal(f.dns[0].type,'CNAME');
});

test('secrets need APP_ENCRYPTION_KEY and round-trip encrypted',async()=>{
 const id=await project();
 secrets.set(id,'github_token','github_pat_secret_value_123');
 assert.equal(secrets.get(id,'github_token'),'github_pat_secret_value_123');
 const saved=process.env.APP_ENCRYPTION_KEY;delete process.env.APP_ENCRYPTION_KEY;
 try{assert.throws(()=>secrets.set(id,'github_token','x'),/APP_ENCRYPTION_KEY/)}finally{process.env.APP_ENCRYPTION_KEY=saved}
});
