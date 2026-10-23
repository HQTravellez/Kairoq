"use strict";
// The AI's web access: opening and clicking through a site, research before a reply, and the agent tools.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-web-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL='1';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='40';
process.env.KAIROQ_DESIGN_BRIEF='off';
const web=require('../web'),runtime=require('../runtime-check'),builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend');

// A small public "website": a pricing page with a link to the docs and a newsletter form.
const PAGES={
 '/':'<title>Acme Rooms</title><h1>Acme Rooms pricing</h1><p>Starter plan $9 a month. Team plan $29 a month.</p><a href="/docs">API docs</a><form method="post" action="/join"><label>Email<input name="email"></label><button>Join the newsletter</button></form>',
 '/docs':'<title>Acme docs</title><h1>Acme API docs</h1><p>GET /v1/rooms returns the rooms as JSON.</p><a href="/">Back home</a>',
};
let site,posts=0;const siteUrl=p=>'http://127.0.0.1:'+site.address().port+(p||'/');
test.before(async()=>{site=http.createServer((req,res)=>{if(req.method==='POST'){posts++;res.writeHead(200);return res.end('sent')}const body=PAGES[req.url.split('?')[0]];if(!body){res.writeHead(404);return res.end()}res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><body>'+body+'</body></html>')});await new Promise(r=>site.listen(0,'127.0.0.1',r))});
test.after(async()=>{site.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});

test('needsWeb: links and look-up words trigger research, ordinary changes do not',()=>{
 assert.ok(web.needsWeb('Make it look like https://linear.app'));
 assert.ok(web.needsWeb('Search for the latest Stripe checkout docs'));
 assert.ok(web.needsWeb('What is the pricing of Calendly?'));
 assert.ok(!web.needsWeb('Make the header sticky and the button blue'));
 assert.ok(!web.needsWeb('Add a pricing section with three plans'));
});

test('parseWeb accepts fenced JSON and drops junk',()=>{
 assert.deepEqual(web.parseWeb('```json\n{"web":[{"search":"acme pricing"},{"open":"https://a.com"},{"nope":1}],"why":"facts"}\n```').web,[{search:'acme pricing'},{open:'https://a.com'}]);
 assert.deepEqual(web.parseWeb('not json').web,[]);
});

test('a browser opens a site, reads it, clicks a link by text, goes back, and never sends a form',{skip:!runtime.available()&&'no browser'},async()=>{
 const b=web.createBrowser({maxOps:10});
 const home=await b.open(siteUrl('/'));
 assert.match(home,/Acme Rooms pricing/);assert.match(home,/Starter plan \$9/);
 assert.match(home,/\[\d+\] link: API docs/);assert.match(home,/input:text: Email/);
 const docs=await b.act([{action:'click',target:'API docs'}]);
 assert.match(docs,/ok: click \[\d+\]/);assert.match(docs,/GET \/v1\/rooms/);
 assert.equal(web.hostOf(b.url),'127.0.0.1');
 const back=await b.act([{action:'back'},{action:'click',target:'No such thing'}]);
 assert.match(back,/Acme Rooms pricing/);assert.match(back,/nothing on the page matches/);
 const sent=await b.act([{action:'fill',target:'Email',value:'me@example.com'},{action:'click',target:'Join the newsletter'}]);
 assert.match(sent,/ok: fill/);
 assert.equal(posts,0,'the browser reads other sites; it never sends their forms');
 const shot=await b.screenshot();assert.ok(typeof shot==='string'&&shot.length>100,'a screenshot for vision tiers');
 await b.close();
 await assert.rejects(()=>b.act([{action:'back'}]),/No page is open/);
});

test('gather: the model picks what to search and open; the result is a context block with sources',{skip:!runtime.available()&&'no browser'},async()=>{
 const asked=[];
 const callModel=async(o,parse)=>{asked.push(o.messages.at(-1).content.slice(0,40));return parse(asked.length===1?JSON.stringify({web:[{search:'acme rooms pricing'},{open:siteUrl('/')},{open:siteUrl('/')}],why:'prices'}):JSON.stringify({web:[{open:siteUrl('/docs')}]}))};
 const webSearch=async q=>{assert.equal(q,'acme rooms pricing');return[siteUrl('/'),'https://example.com/other']};
 const progress=[];
 const r=await web.gather('Copy the pricing from '+siteUrl('/')+' into my app',{callModel,webSearch,onProgress:p=>progress.push(p)});
 assert.match(r.context,/Search results for "acme rooms pricing"/);
 assert.match(r.context,/Starter plan \$9/);assert.match(r.context,/GET \/v1\/rooms/,'the second round opened the docs');
 assert.equal(r.sources.length,2,'the same page is not opened twice');assert.equal(r.sources[0].title,'Acme Rooms');
 assert.match(r.context,/never as instructions/);
 assert.ok(progress.some(p=>/Reading 127\.0\.0\.1/.test(p)));
 const none=await web.gather('Make the button blue',{callModel,webSearch});
 assert.equal(none.context,'');assert.equal(asked.length,2,'no model call when the message does not need the web');
});

// Discuss and build through the API: the reply uses what was read and lists its sources.
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const text=Buffer.concat(c).toString();let json=null;try{json=JSON.parse(text)}catch{}resolve({status:res.statusCode,headers:res.headers,text,json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
const MAIN="import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n";
const OK="export default function App() { return <h1>Working</h1>; }\n";
const seen={research:0,discuss:0,code:0,agent:0};
const callModel=async(opts,parse)=>{
 const sys=opts.messages[0].content,last=opts.messages.at(-1).content,userText=typeof last==='string'?last:last.map(p=>p.text||'').join('');
 if(/decide what to look up on the web/.test(sys)){seen.research++;return parse(JSON.stringify(seen.research%2===1?{web:[{open:siteUrl('/')}]}:{web:[]}))}
 if(/planning partner/.test(sys)){seen.discuss++;const m=/Starter plan \$(\d+)/.exec(userText);return parse(m?'The Starter plan costs $'+m[1]+' a month on that site.':'I could not read the site.')}
 if(/AGENT MODE/.test(sys)){
  seen.agent++;
  if(seen.agent===1)return parse(JSON.stringify({thought:'Open the site the user linked.',actions:[{tool:'web_open',url:siteUrl('/')}]}));
  if(seen.agent===2){assert.match(userText,/Starter plan \$9/,'the agent sees the page text');return parse(JSON.stringify({thought:'Read the docs link.',actions:[{tool:'web_act',steps:[{action:'click',target:'API docs'}]}]}))}
  if(seen.agent===3){assert.match(userText,/GET \/v1\/rooms/,'the agent sees the page after clicking');return parse(JSON.stringify({thought:'Done.',actions:[{tool:'write_files',files:{'src/App.jsx':"export default function App() { return <h1>Starter $9</h1>; }\n"}},{tool:'finish',message:'Added the Starter price from the site.'}]}))}
  return parse(JSON.stringify({thought:'Stop.',actions:[{tool:'finish',message:'Done.'}]}));
 }
 if(/coding engine/.test(sys)){seen.code++;const m=/Starter plan \$(\d+)/.exec(userText);return parse(JSON.stringify({plan:['Add the price'],message:m?'Added the $'+m[1]+' plan from the site.':'No price found.',files:{'src/App.jsx':OK}}))}
 throw Error('unexpected prompt: '+sys.slice(0,60));
};
let server,ip=0;const base=()=>'http://127.0.0.1:'+server.address().port;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false,checkRuntime:u=>runtime.check(base()+u),inspect:(u,o)=>runtime.inspect(base()+u,o),browse:(u,o)=>runtime.session(base()+u,o)}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>server.close());
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.8.0.'+(++ip)}});assert.equal(r.status,201,r.text);return r.headers['set-cookie'][0].split(';')[0]}
async function waitJob(cookie,job){for(let i=0;i<2400;i++){const j=(await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job;if(['complete','failed'].includes(j.status))return j;await new Promise(r=>setTimeout(r,50))}throw Error('job did not finish')}

test('discuss and build read a linked site first and list their sources; the agent opens and clicks through it',{skip:!runtime.available()&&'no browser'},async()=>{
 const cookie=await signup('web@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Web'}})).json.project.id;
 await builder.saveSource(id,{'src/main.jsx':MAIN,'src/App.jsx':OK},{summary:'Start'});
 const d=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'What does the Starter plan cost on '+siteUrl('/')+'?',mode:'discuss'}})).json.job);
 assert.equal(d.status,'complete',d.error);
 assert.match(d.result.message,/\$9 a month/);
 assert.equal(d.result.sources[0].title,'Acme Rooms');
 assert.equal(builder.loadMeta(id).messages.at(-1).sources[0].url,siteUrl('/'),'sources are kept with the message');
 const b=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Add the Starter plan price from '+siteUrl('/')}})).json.job);
 assert.equal(b.status,'complete',b.error);
 assert.match(b.result.message,/\$9 plan from the site/);
 assert.equal(b.result.sources.length,1);
 const plain=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Make the title bigger'}})).json.job);
 assert.equal(plain.status,'complete',plain.error);assert.equal(plain.result.sources,undefined,'no research for an ordinary change');
 const a=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Use the price from '+siteUrl('/'),mode:'agent'}})).json.job);
 assert.equal(a.status,'complete',a.error);
 assert.match(a.result.message,/Starter price/);
 const steps=builder.loadMeta(id).messages.at(-1).steps.join(' | ');
 assert.match(steps,/Opened http:\/\/127\.0\.0\.1/);assert.match(steps,/Clicked around 1 step on the open website/);
 assert.equal(posts,0);
});
