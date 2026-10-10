'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),crypto=require('crypto');
const web=require('../developer-agent'),source=require('../website-source'),forms=require('../website-forms'),release=require('../website-release');
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
function files(){return{'index.html':'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reference</title><link rel="stylesheet" href="styles.css"></head><body><kairoq-component name="header"></kairoq-component><main><h1>Brand website</h1><p>'+('Meaningful site content. '.repeat(15))+'</p><img src="kairoq-asset:logo" alt="Brand logo"><kairoq-component name="contact"></kairoq-component></main><script src="app.js"></script></body></html>','styles.css':'body{font:16px Arial;margin:20px}input,button{min-height:44px;display:block;margin:12px 0}img{width:20px;height:20px} '.repeat(6),'app.js':'document.querySelector("form").addEventListener("submit",event=>{event.preventDefault();window.fakeSuccess=true;});','components.json':JSON.stringify({header:'<header><a href="index.html">Brand home</a></header>',contact:'<form data-kairoq-form="contact"><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Message<textarea name="message"></textarea></label><button type="submit">Send enquiry</button></form>'}),...source.assetFiles([{name:'logo.png',data:image,alt:'Brand logo'}])};}
function temporary(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-enquiry-'));return{root,id:'test-site-'+crypto.randomBytes(4).toString('hex'),version:crypto.randomBytes(8).toString('hex'),clean(){fs.rmSync(root,{recursive:true,force:true});}};}
test('shared components compile into every route, reject missing/recursive templates and validate their scripts',()=>{
 const value=files();value['about.html']=value['index.html'].replace('Brand website','About the brand');web.normalizeFiles(value);
 for(const route of ['index.html','about.html']){const html=web.assemble(value,route);assert.match(html,/<header>/);assert.match(html,/data:image\/png;base64/);assert.doesNotMatch(html,/kairoq-component|kairoq-asset:/);}
 const changed={...value,'components.json':JSON.stringify({...source.components(value),header:'<header>Updated identity</header>'})};assert.match(web.assemble(changed,'about.html'),/Updated identity/);
 assert.throws(()=>source.expand('<kairoq-component name="absent"></kairoq-component>',value),/Missing/);
 assert.throws(()=>source.expand('<kairoq-component name="loop"></kairoq-component>',{'components.json':JSON.stringify({loop:'<kairoq-component name="loop"></kairoq-component>'})}),/Recursive/);
 assert.throws(()=>web.normalizeFiles({...value,'components.json':JSON.stringify({...source.components(value),header:'<script src="https://evil.test/code.js"></script>'})}),/local app.js/);
});
test('uploaded assets reject masquerading files and unknown references and stay out of model contexts',()=>{
 const value=files();assert.doesNotMatch(JSON.stringify(source.modelSource(value)),/iVBOR/);
 assert.throws(()=>source.assets([{name:'photo',data:'data:image/png;base64,'+Buffer.from('not a picture').toString('base64')}]),/Invalid image/);
 assert.throws(()=>source.assets([{name:'photo',data:'data:image/svg+xml;base64,PHN2Zz4='}]),/PNG/);
 assert.throws(()=>source.assets([{name:'../photo',data:image}]),/unique image names/);
 assert.throws(()=>source.assets(Array.from({length:7},(_,n)=>({name:'pic-'+n,data:image}))),/six/);
 assert.throws(()=>source.resolveAssets('kairoq-asset:absent',value),/Missing uploaded image/);
});
test('component website ZIP contains compiled pages and editable shared source without live submission tokens',()=>{
 const value=files(),bundle=require('../project-portability').bundle({id:'portable-component-site',kind:'website',project_name:'Brand',files:value});
 assert.match(bundle['index.html'].toString(),/<header>/);assert.doesNotMatch(bundle['index.html'].toString(),/kairoq-component|kairoq-asset:/);
 assert.match(bundle['index.html'].toString(),/Publish this website to enable/);assert.match(bundle['source/index.html'].toString(),/kairoq-component/);
 assert.equal(bundle['source/assets.json'].toString(),value['assets.json']);assert.equal(JSON.parse(bundle['kairoq-project.json']).source_format,2);
 assert.match(bundle['README.md'].toString(),/Edit those files for GitHub sync/);
});
test('background website jobs persist failure and reject unsafe job paths',async()=>{
 const jobs=require('../website-jobs'),job=jobs.submit({brief:'short'},async()=>{throw Error('Should not call a model');});
 const file=path.join(__dirname,'..','workspace','website-jobs',job.id+'.json');try{
  assert.equal(job.status,'queued');await new Promise(resolve=>setImmediate(resolve));const saved=jobs.getJob(job.id);assert.equal(saved.status,'failed');assert.match(saved.error,/at least 12/);
  assert.throws(()=>jobs.getJob('../secret'),/Invalid website job/);
  fs.writeFileSync(file,JSON.stringify({...saved,status:'generating'}));assert.match(jobs.getJob(job.id).error,/interrupted by a restart/);
 }finally{fs.rmSync(file,{force:true});}
});
test('thirteen page generation uses bounded batches and preserves shared source and uploaded images through repairs',async()=>{
 const pages=['index.html',...Array.from({length:12},(_,n)=>'page-'+n+'.html')],value=files();let calls=0,batches=0;
 const result=await web.generateSite(async options=>{
  calls++;if(options.purpose==='website-sitemap')return{pages};batches++;
  const prompt=options.messages[0].content;assert.doesNotMatch(prompt,/iVBOR/);

  // Read the exact batch instruction without including sitemap mentions.
  const batch=prompt.split('Generate ONLY these page files in this batch: ')[1].split('. ')[0].split(', ');assert.ok(batch.length<=4);
  const generated={};for(const name of batch)generated[name]=value['index.html'].replace('Brand website',name);
  if(batches===1)Object.assign(generated,{'components.json':value['components.json'],'styles.css':value['styles.css'],'app.js':value['app.js']});
  return{project_name:'Large reference',files:generated};
 },{prompt:'Build the brand website',brief:'Build a thirteen page website',required:['index.html'],base:{'assets.json':value['assets.json']}});
 assert.equal(calls,5);assert.equal(batches,4);assert.equal(Object.keys(result.files).filter(n=>n.endsWith('.html')).length,13);assert.equal(result.files['assets.json'],value['assets.json']);
 const repaired=await web.generateFiles(async()=>({files:{'components.json':value['components.json'],'assets.json':'[]'}}),{messages:[]},{base:result.files,required:pages});assert.equal(repaired.files['assets.json'],value['assets.json']);
});
test('form submissions persist with required field validation, write-only tokens and bot/rate limits',()=>{
 const f=temporary();try{
  const config=forms.prepare(f.id,f.version,files(),{root:f.root,origin:'https://example.test'}),body={token:config.token,form:'contact',fields:{name:'A person',email:'person@example.test',message:'Hello'}};
  assert.throws(()=>forms.submit(f.id,f.version,body,{root:f.root}),/unavailable/);forms.activate(config);
  assert.throws(()=>forms.submit(f.id,f.version,{...body,token:'x'.repeat(48)},{root:f.root}),/unavailable/);
  assert.throws(()=>forms.submit(f.id,f.version,{...body,form:'__proto__'},{root:f.root}),/Unknown/);
  for(const fields of [{...body.fields,email:'bad'},{...body.fields,name:''},{...body.fields,password:'secret'},{...body.fields,message:'x'.repeat(2001)}])assert.throws(()=>forms.submit(f.id,f.version,{...body,fields},{root:f.root}),/field/);
  const sent=forms.submit(f.id,f.version,body,{root:f.root,ip:'visitor'});assert.equal(sent.ok,true);assert.equal(forms.inbox(f.id,{root:f.root})[0].fields.message,'Hello');
  forms.submit(f.id,f.version,{...body,website:'bot'},{root:f.root});assert.equal(forms.inbox(f.id,{root:f.root}).length,1);
  for(let n=0;n<19;n++)forms.submit(f.id,f.version,body,{root:f.root,ip:'visitor'});
  assert.throws(()=>forms.submit(f.id,f.version,body,{root:f.root,ip:'visitor'}),/Too many/);
  assert.doesNotThrow(()=>forms.submit(f.id,f.version,body,{root:f.root,ip:'another visitor'}));
 }finally{f.clean();}
});
test('repeated forms must agree and saved enquiry forms reject password collection',()=>{
 const value=files();assert.equal(forms.schemas(value).contact.email.required,true);
 assert.throws(()=>forms.schemas({...value,'about.html':source.expand(value['index.html'],value).replace('name="message"','name="details"')}),/same fields/);
 assert.throws(()=>forms.schemas({...value,'components.json':value['components.json'].replace('name=\\"message\\"','name=\\"password\\"')}),/Unsupported/);
 assert.equal(forms.schemas({'index.html':'<form data-kairoq-form="demo"><input name="company" placeholder="required company"><button>Send</button></form>'}).demo.company.required,false);
});
test('failed publication discards form credentials and successful immutable releases reuse them',async()=>{
 const f=temporary(),folder=path.join(__dirname,'..','workspace','developer-projects',f.id),outputRoot=path.join(f.root,'public');try{
  fs.mkdirSync(folder,{recursive:true});const value=files();for(const[name,code]of Object.entries(value))fs.writeFileSync(path.join(folder,name),code);
  fs.writeFileSync(path.join(folder,'project.json'),JSON.stringify({id:f.id,kind:'website',file_names:Object.keys(value),qa:{passed:true,visual_review:{passed:true,coverage:{complete:true,mode:'ai-screenshot-review'}}}}));
  await assert.rejects(release.deploy(f.id,{outputRoot,inboxRoot:f.root,origin:'https://example.test',verify:async()=>{throw Error('navigation failed');}}),/navigation failed/);
  assert.deepEqual(fs.readdirSync(path.join(f.root,f.id,'releases')),[]);
  const published=await release.deploy(f.id,{outputRoot,inboxRoot:f.root,origin:'https://example.test',verify:async()=>({passed:true})});assert.deepEqual(published.connected_forms,['contact']);
  const before=fs.readFileSync(path.join(outputRoot,f.id,published.published_version,'index.html'),'utf8');await release.deploy(f.id,{outputRoot,inboxRoot:f.root,origin:'https://example.test',verify:async()=>({passed:true})});assert.equal(fs.readFileSync(path.join(outputRoot,f.id,published.published_version,'index.html'),'utf8'),before);
 }finally{fs.rmSync(folder,{recursive:true,force:true});f.clean();}
});
test('real sandboxed website sends enquiries through CORS, preserves errors and keeps inbox private',{skip:!fs.existsSync(process.env.CHROMIUM_PATH||'/usr/bin/chromium')},async()=>{
 const f=temporary();let browser;const server=http.createServer(async(req,res)=>{
  if(await forms.handle(req,res,{root:f.root,authenticated:req=>req.headers.authorization==='Bearer owner',readBody:async req=>{let body='';for await(const chunk of req)body+=chunk;return JSON.parse(body);}}))return;
  if(req.url==='/index.html'){res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':release.contentPolicy('/generated/developer-sites/'+f.id+'/'+f.version+'/index.html',origin)});return res.end(web.assemble(files(),'index.html',{formConfig:config}));}
  res.writeHead(404);res.end();
 });let origin,config;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;config=forms.prepare(f.id,f.version,files(),{root:f.root,origin});forms.activate(config);
  browser=await require('playwright-core').chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.goto(origin+'/index.html');assert.equal(await page.evaluate(()=>window.origin),'null');
  await page.locator('[name=name]').fill('Browser visitor');await page.locator('[name=email]').fill('browser@example.test');await page.locator('[name=message]').fill('Real browser submission');await page.getByRole('button',{name:'Send enquiry'}).click();await page.waitForFunction(()=>document.querySelector('[data-kairoq-status]')?.textContent.includes('has been received'));
  assert.equal(forms.inbox(f.id,{root:f.root}).length,1);assert.equal(await page.evaluate(()=>window.fakeSuccess),undefined);assert.equal(await page.locator('[name=name]').inputValue(),'');
  assert.equal((await fetch(origin+'/api/developer/inbox/'+f.id)).status,401);const privateInbox=await fetch(origin+'/api/developer/inbox/'+f.id,{headers:{Authorization:'Bearer owner'}});assert.equal(privateInbox.status,200);assert.equal((await privateInbox.json()).entries[0].fields.message,'Real browser submission');
  await page.route(origin+'/api/website-forms/**',route=>route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify({error:'Try again later'})}));
  await page.locator('[name=name]').fill('Retry visitor');await page.locator('[name=email]').fill('retry@example.test');await page.getByRole('button',{name:'Send enquiry'}).click();await page.waitForFunction(()=>document.querySelector('[data-kairoq-status]')?.textContent.includes('Could not send'));assert.equal(await page.locator('[name=name]').inputValue(),'Retry visitor');assert.equal(forms.inbox(f.id,{root:f.root}).length,1);
  assert.equal(await page.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0),true);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));f.clean();}
});
