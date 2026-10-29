"use strict";
// The free website check: anyone checks a site with an email, gets a report with a score, the
// AI customers' results and technical basics; limits and the daily cache keep costs bounded.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-sitecheck-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL='1';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_SITE_CHECKS_DIR=path.join(tmp,'checks');
process.env.KAIROQ_SITE_CHECK_VISITORS='3';
process.env.KAIROQ_SITE_CHECK_PER_EMAIL='2';
const createApi=require('../create-api'),siteCheck=require('../site-check');

// A scripted model: says what the site is, makes personas, two visitors book, one gives up.
let modelCalls=0,limitHit=false;
const callModel=async(opts,parse)=>{
 modelCalls++;
 const sys=opts.messages[0].content,user=opts.messages.at(-1).content;
 if(limitHit&&/role-playing a real person/.test(sys))throw Error('Experiential 429: org_token_rate_limit_day: Free core models share 1000000 tokens per UTC day');
 if(/say what it is for/.test(sys))return parse(JSON.stringify({business:'A small yoga studio in Lisbon',audience:'Locals who want to try yoga',goal:'Book a first class'}));
 if(/customer personas/.test(sys))return parse(JSON.stringify({personas:[{name:'Ana',age:31,device:'phone',patience:'low',tech:'medium',wants:'a class tonight'},{name:'Rui',age:52,device:'desktop',patience:'high',tech:'low',wants:'a beginner class'},{name:'Mia',age:24,device:'phone',patience:'medium',tech:'high',wants:'prices'}]}));
 if(/role-playing a real person/.test(sys)){
  if(/You are: Ana/.test(user))return parse(JSON.stringify({thought:'I cannot find the price anywhere.',feeling:'frustrated',action:'give_up'}));
  return parse(JSON.stringify({thought:'Booked, easy.',feeling:'confident',action:'done'}));
 }
 if(/analyse a usability test/.test(sys))return parse(JSON.stringify({headline:'Phone visitors cannot find prices.',issues:[{title:'No prices on phones',why:'The price list is hidden behind a menu on phones',who:'phone visitors',visitors:1,quote:'I cannot find the price anywhere.'}],fixes:['Show prices on the home page']}));
 throw Error('unexpected prompt: '+sys.slice(0,50));
};
// A scripted browser: one page with a Book button, no phone viewport, one image without a description.
const JPEG=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64').toString('base64');
let opened=0;
const browseSite=async(url,{viewport})=>{
 opened++;
 return{
  observe:async()=>({title:'Lotus Yoga Lisbon',path:'/',text:'Lotus Yoga. Classes every day. Book a class.',elements:[{id:1,kind:'button',label:'Book a class'}],errors:[],sent:0}),
  act:async()=>{},
  audit:async()=>({viewport:viewport!=='phone',description:'',title:'Lotus Yoga Lisbon',h1:1,lang:'en',overflow:viewport==='phone'?40:0,images:3,images_no_alt:1,load_ms:1200,forms:1,small_text:0}),
  screenshot:async()=>JPEG,
  url:()=>url,close:async()=>{}
 };
};
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const raw=Buffer.concat(c),text=raw.toString();let json=null;try{json=JSON.parse(text)}catch{}resolve({status:res.statusCode,headers:res.headers,text,json,raw})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,site;
test.before(async()=>{
 site=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>Lotus Yoga</h1>')});
 await new Promise(r=>site.listen(0,'127.0.0.1',r));
 server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>false,callModel,browseSite,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>{server.close();site.close();fs.rmSync(tmp,{recursive:true,force:true})});
const siteUrl=p=>'http://127.0.0.1:'+site.address().port+(p||'/');
async function finish(id){for(let i=0;i<400;i++){const r=await request(server,'GET','/api/create/site-check/'+id);if(r.json.check.status!=='running')return r.json.check;await new Promise(r=>setTimeout(r,25))}throw Error('check did not finish')}

test('technical basics and the score are plain facts',()=>{
 const t=siteCheck.technical({load_ms:4200,title:'Hi',description:'',h1:0,images:4,images_no_alt:2},{viewport:false,overflow:30,small_text:9});
 const bad=t.filter(x=>!x.ok).map(x=>x.title);
 for(const title of ['Slow to load','Not set up for phones','Wider than the phone screen','Small text on phones','Weak page title','No search description','No main heading','Images without descriptions'])assert.ok(bad.includes(title),title);
 assert.equal(siteCheck.score({visitors:4,completion_rate:100},t.map(x=>({...x,ok:true}))),100);
 assert.equal(siteCheck.score({visitors:4,completion_rate:50},t),35);
});

test('anyone can check a website: a report with a score, visitors, technical basics and screenshots',async()=>{
 const r=await request(server,'POST','/api/create/site-check',{body:{url:siteUrl(),email:'owner@lotus.pt'}});
 assert.equal(r.status,202,r.text);assert.match(r.json.id,/^[a-f0-9]{24}$/);assert.equal(r.json.cached,false);
 const c=await finish(r.json.id);
 assert.equal(c.status,'complete',JSON.stringify(c));
 assert.equal(c.goal,'Book a first class');assert.equal(c.business,'A small yoga studio in Lisbon');
 assert.equal(c.numbers.visitors,3);assert.equal(c.numbers.completed,2);
 assert.equal(c.summary.headline,'Phone visitors cannot find prices.');
 assert.ok(c.technical.some(t=>t.title==='Not set up for phones'&&!t.ok));
 assert.ok(c.technical.some(t=>t.title==='Wider than the phone screen'&&!t.ok));
 assert.ok(c.technical.some(t=>t.title==='Loads quickly'&&t.ok));
 assert.ok(c.score>0&&c.score<100);
 assert.deepEqual(c.shots,['desktop','phone']);
 assert.equal(c.visits.find(v=>v.name==='Ana').outcome,'gave_up');
 // No email or IP in what the link shows.
 assert.ok(!JSON.stringify(c).includes('owner@lotus.pt'));
 const shot=await request(server,'GET','/api/create/site-check/'+r.json.id+'/shot?name=phone');
 assert.equal(shot.status,200);assert.equal(shot.headers['content-type'],'image/jpeg');
 assert.equal((await request(server,'GET','/api/create/site-check/'+r.json.id+'/shot?name=../x')).status,404);
 assert.equal((await request(server,'GET','/api/create/site-check/'+'0'.repeat(24))).status,404);
});

test('the same site the same day returns the saved report without running again',async()=>{
 const calls=modelCalls,pages=opened;
 const r=await request(server,'POST','/api/create/site-check',{body:{url:siteUrl('/?ref=ad'),email:'other@lotus.pt'}});
 assert.equal(r.status,202);assert.equal(r.json.cached,true);
 assert.equal(modelCalls,calls);assert.equal(opened,pages);
 // The owner sees both requests as leads; customers cannot.
 const leads=siteCheck.adminList();
 assert.deepEqual(leads.map(l=>l.email).sort(),['other@lotus.pt','owner@lotus.pt']);
 const signup=await request(server,'POST','/api/create/signup',{body:{email:'cust@example.com',password:'password1'},headers:{'x-forwarded-for':'10.7.0.1'}});
 assert.equal((await request(server,'GET','/api/create/site-checks',{headers:{cookie:signup.headers['set-cookie'][0].split(';')[0]}})).status,403);
});

test('when the AI itself is unavailable for every visitor, there is no made-up score: the check says so',async()=>{
 limitHit=true;
 try{
  const r=await request(server,'POST','/api/create/site-check',{body:{url:siteUrl(),email:'limits@lotus.pt',goal:'See the class timetable'}});
  assert.equal(r.status,202,r.text);
  const c=await finish(r.json.id);
  assert.equal(c.status,'failed',JSON.stringify(c));
  assert.match(JSON.stringify(c),/reached their limit for today/);
  assert.equal(c.score,undefined);
 }finally{limitHit=false}
});

test('bad input, limits and the off switch',async()=>{
 const post=(body,ip='10.8.0.1')=>request(server,'POST','/api/create/site-check',{body,headers:{'x-forwarded-for':ip}});
 assert.equal((await post({url:siteUrl(),email:'not-an-email'})).status,400);
 assert.equal((await post({url:'http://example.com',email:'a@b.co'})).status,400);
 assert.equal((await post({url:'https://10.0.0.5/',email:'a@b.co'})).status,400);
 // A new goal for the same site is a new check; the same email can do two a day here.
 const a=await post({url:siteUrl(),email:'limit@b.co',goal:'Find the timetable'});assert.equal(a.status,202);assert.equal(a.json.cached,false);await finish(a.json.id);
 const b=await post({url:siteUrl(),email:'limit@b.co',goal:'Buy a gift card'});assert.equal(b.status,202);await finish(b.json.id);
 const c=await post({url:siteUrl(),email:'limit@b.co',goal:'Find the address'});assert.equal(c.status,429);assert.match(c.json.error,/today/);
 process.env.KAIROQ_SITE_CHECK_DAILY='1';
 assert.equal((await post({url:siteUrl(),email:'new@b.co',goal:'Something else'},'10.8.0.9')).status,503);
 delete process.env.KAIROQ_SITE_CHECK_DAILY;
 process.env.KAIROQ_SITE_CHECK='off';
 assert.equal((await post({url:siteUrl(),email:'new@b.co',goal:'Again'},'10.8.0.10')).status,503);
 delete process.env.KAIROQ_SITE_CHECK;
});

test('the Kairoq owner is not held to the free check\'s daily limits',async()=>{
 const deps={callModel,browseSite};
 const go=(i,owner)=>siteCheck.start({url:siteUrl(),email:'owner-limits@lotus.pt',goal:'Owner test '+i,ip:'198.51.100.7',owner},deps);
 for(let i=0;i<4;i++)assert.equal((await go(i,true)).status,'running');
 await assert.rejects(go(9,false),/used today/);
});
