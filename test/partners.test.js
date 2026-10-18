"use strict";
// Partners and sponsored templates: owner-managed, clearly labelled, counted for invoicing,
// and nothing about a person's app goes to the partner.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-partners-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_PARTNERS_DIR=path.join(tmp,'partners');
process.env.KAIROQ_MEMORY_DIR=path.join(tmp,'memory');
process.env.KAIROQ_LEARNING_DIR=path.join(tmp,'learning');
process.env.KAIROQ_RUNTIME_CHECK='off';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_WEB_RESEARCH='off';
const builder=require('../react-builder'),createApi=require('../create-api'),P=require('../partners');

const prompts=[];
const callModel=async(opts,parse)=>{prompts.push(JSON.stringify(opts.messages.at(-1).content));return parse(JSON.stringify({plan:[],message:'Done.',files:{'src/App.jsx':"export default function App() { return <h1>Hi</h1>; }\n"}}))};
let owner=false,server;
function req(method,url,body,cookie){return new Promise((resolve,reject)=>{const payload=body?Buffer.from(JSON.stringify(body)):null;const r=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...(cookie?{cookie}:{}),'x-forwarded-for':'10.3.3.'+Math.floor(Math.random()*200)}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const t=Buffer.concat(c).toString();let j=null;try{j=JSON.parse(t)}catch{}resolve({status:res.statusCode,json:j,headers:res.headers})})});r.on('error',reject);if(payload)r.write(payload);r.end()})}
test.before(async()=>{server=http.createServer(async(rq,rs)=>{if(builder.handlePreview(rq,rs))return;if(await createApi.handle(rq,rs,{isOwner:()=>owner,callModel,secure:false}))return;rs.writeHead(404);rs.end()});await new Promise(r=>server.listen(0,'127.0.0.1',r))});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});

const CLOUDBEDS={name:'Cloudbeds',category:'booking',description:'Hotel booking engine with live availability',instructions:'Add a booking page that loads room availability from the Cloudbeds API in a server function and shows a date picker.',secrets:'CLOUDBEDS_API_KEY, bad key!',signup_url:'https://www.cloudbeds.com/signup?ref=kairoq',note:'20% of first year, contact ana@cloudbeds.example',sponsored:true};

test('partner details are checked before they are saved',()=>{
 assert.throws(()=>P.normalizePartner({...CLOUDBEDS,signup_url:'http://cloudbeds.com'}),/https link/);
 assert.throws(()=>P.normalizePartner({...CLOUDBEDS,signup_url:'javascript:alert(1)'}),/https link/);
 assert.throws(()=>P.normalizePartner({...CLOUDBEDS,instructions:'Add it'}),/how Kairoq should add it/);
 assert.throws(()=>P.normalizePartner({...CLOUDBEDS,name:''}),/name/);
 const p=P.normalizePartner(CLOUDBEDS);
 assert.deepEqual(p.secrets,['CLOUDBEDS_API_KEY','BAD']);assert.equal(p.category,'booking');
 assert.equal(P.normalizePartner({...CLOUDBEDS,category:'nonsense'}).category,'other');
});

test('the owner manages partners; people see them labelled, add them to an app, and sign up through a counted link',async()=>{
 const s=await req('POST','/api/create/signup',{email:'hotel@example.com',password:'password1'});
 const cookie=s.headers['set-cookie'][0].split(';')[0];
 assert.equal((await req('GET','/api/create/admin/partners',null,cookie)).status,403);
 assert.equal((await req('POST','/api/create/admin/partners',{action:'save_partner',partner:CLOUDBEDS},cookie)).status,403);
 owner=true;
 let d=(await req('POST','/api/create/admin/partners',{action:'save_partner',partner:CLOUDBEDS})).json.partners;
 d=(await req('POST','/api/create/admin/partners',{action:'save_partner',partner:{name:'Resend',category:'email',instructions:'Send booking confirmation emails from a server function with the Resend API.',secrets:'RESEND_API_KEY'}})).json.partners;
 d=(await req('POST','/api/create/admin/partners',{action:'save_partner',partner:{name:'Hidden Co',category:'other',instructions:'Something that should not be visible to people yet.',active:false}})).json.partners;
 assert.equal(d.partners.length,3);
 owner=false;
 const list=(await req('GET','/api/create/partners',null,cookie)).json.partners;
 assert.deepEqual(list.map(p=>p.name),['Cloudbeds','Resend'],'sponsored first, hidden ones left out');
 assert.equal(list[0].sponsored,true);assert.equal(list[0].has_signup,true);assert.equal(list[1].has_signup,false);
 assert.ok(!JSON.stringify(list).includes('20% of first year'),'the owner\'s note stays private');
 assert.ok(!JSON.stringify(list).includes('ref=kairoq'),'the referral link only lives behind the redirect');
 assert.equal((await req('GET','/api/create/partners')).status,401);
 // Add to my app: the message carries the owner's instructions and how to handle secrets.
 const cb=list[0].id;
 const add=(await req('POST','/api/create/partners/'+cb+'/add',null,cookie)).json;
 assert.match(add.message,/^Add Cloudbeds to this app\. Add a booking page[\s\S]*CLOUDBEDS_API_KEY[\s\S]*never put them in the page code/);
 const id=(await req('POST','/api/create/projects',{name:'Hotel'},cookie)).json.project.id;
 const job=(await req('POST','/api/create/projects/'+id+'/chat',{message:add.message},cookie)).json.job;
 for(let i=0;i<200;i++){const j=(await req('GET','/api/create/jobs/'+job.id,null,cookie)).json.job;if(j.status==='complete')break;await new Promise(r=>setTimeout(r,25))}
 assert.match(prompts.at(-1),/Add Cloudbeds to this app/);
 // Create an account: a redirect to the saved link, counted; anything else is refused.
 const go=await req('GET','/api/create/partners/'+cb+'/go');
 assert.equal(go.status,302);assert.equal(go.headers.location,'https://www.cloudbeds.com/signup?ref=kairoq');assert.equal(go.headers['referrer-policy'],'no-referrer');
 assert.equal((await req('GET','/api/create/partners/'+list[1].id+'/go')).status,404,'no sign-up link');
 assert.equal((await req('GET','/api/create/partners/0123456789/go')).status,404);
 owner=true;
 const st=(await req('GET','/api/create/admin/partners')).json.partners.partners.find(p=>p.name==='Cloudbeds');
 assert.equal(st.stats.clicks,1);assert.equal(st.stats.adds,1);assert.equal(st.stats.this_month.clicks,1);
 owner=false;
});

test('sponsored templates: labelled, time-boxed, capped, counted, and start a real project',async()=>{
 owner=true;
 const admin=(await req('GET','/api/create/admin/partners')).json.partners;
 const cb=admin.partners.find(p=>p.name==='Cloudbeds').id;
 const today=new Date().toISOString().slice(0,10),past='2020-01-01',future='2099-01-01';
 assert.equal((await req('POST','/api/create/admin/partners',{action:'save_slot',slot:{partner_id:cb,title:'Hotel',prompt:'short'}})).status,400);
 assert.equal((await req('POST','/api/create/admin/partners',{action:'save_slot',slot:{partner_id:cb,title:'Hotel x',template:'nope'}})).status,400);
 assert.equal((await req('POST','/api/create/admin/partners',{action:'save_slot',slot:{partner_id:cb,title:'Hotel x',prompt:'A boutique hotel site with Cloudbeds booking and room photos',starts:'2026-12-01',ends:'2026-11-01'}})).status,400);
 const save=slot=>req('POST','/api/create/admin/partners',{action:'save_slot',slot:{partner_id:cb,...slot}});
 await save({title:'Boutique hotel with Cloudbeds booking',description:'Rooms, photos and live availability',prompt:'A boutique hotel website with rooms, photos and a booking page using Cloudbeds.',starts:today,ends:future,category:'hospitality'});
 await save({title:'Hotel guest portal by Cloudbeds',template:'guest-portal',starts:past,ends:future});
 await save({title:'Ended campaign',prompt:'A campaign that has already finished and should not show.',starts:past,ends:'2020-02-01'});
 await save({title:'Third running slot',prompt:'A third slot that goes over the limit of two at once.',starts:past});
 owner=false;
 const t=(await req('GET','/api/create/templates')).json;
 assert.deepEqual(t.sponsored.map(s=>s.title),['Boutique hotel with Cloudbeds booking','Hotel guest portal by Cloudbeds'],'running ones only, at most two');
 assert.equal(t.sponsored[0].sponsor,'Cloudbeds');assert.equal(t.sponsored[0].sponsored,true);
 assert.ok(t.templates.length>0,'the normal templates are still there');
 // Starting from a slot: the slot decides what is built.
 const s=await req('POST','/api/create/signup',{email:'slot@example.com',password:'password1'});
 const cookie=s.headers['set-cookie'][0].split(';')[0];
 const fromPrompt=(await req('POST','/api/create/projects',{sponsored:t.sponsored[0].id,prompt:'ignored'},cookie)).json;
 assert.equal(fromPrompt.project.name,'Boutique hotel with Cloudbeds booking');assert.ok(fromPrompt.job);
 for(let i=0;i<200;i++){const j=(await req('GET','/api/create/jobs/'+fromPrompt.job.id,null,cookie)).json.job;if(j.status==='complete')break;await new Promise(r=>setTimeout(r,25))}
 assert.match(prompts.at(-1),/boutique hotel website with rooms, photos and a booking page using Cloudbeds/);
 const fromTpl=(await req('POST','/api/create/projects',{sponsored:t.sponsored[1].id},cookie)).json;
 assert.equal(fromTpl.job,null);assert.match(builder.loadMeta(fromTpl.project.id).versions[0].summary,/template/i);
 const ended=(await req('GET','/api/create/admin/partners')).status;assert.equal(ended,401);
 owner=true;
 const d=(await req('GET','/api/create/admin/partners')).json.partners;
 const first=d.slots.find(x=>x.title.startsWith('Boutique'));
 assert.equal(first.stats.impressions,1);assert.equal(first.stats.starts,1);assert.equal(first.running,true);
 assert.equal(d.slots.find(x=>x.title==='Ended campaign').running,false);
 const endedId=d.slots.find(x=>x.title==='Ended campaign').id;
 owner=false;
 assert.equal((await req('POST','/api/create/projects',{sponsored:endedId},cookie)).status,404);
 owner=true;
 // A partner with a running slot cannot be removed until the slot ends.
 assert.equal((await req('POST','/api/create/admin/partners',{action:'delete_partner',id:cb})).status,409);
 owner=false;
});
