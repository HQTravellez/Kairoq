'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
process.env.KAIROQ_OUTREACH_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-outreach-'));
const gate=require('../email-gate'),O=require('../outreach');

const FOOT={sender:'Ana Silva',address:'12 Mill Lane, Leeds LS1 4AB'};
const GOOD={to:'hello@cafe-rosa.co.uk',subject:'Lunch for your team on Fridays',text:'Hi Cafe Rosa team,\n\nI saw you open early for the market crowd. We cook office lunches nearby and could cover your staff meals on busy Fridays. Would a free tasting box next week be useful?\n\nAna Silva\nOlive Kitchen\n12 Mill Lane, Leeds LS1 4AB\n\nIf you would rather not hear from me, reply "stop" and I will not email you again.'};

test('the email gate blocks bad drafts with reasons, in code',()=>{
 assert.deepEqual(gate.check(GOOD,{footer:FOOT}),{ok:true,reasons:[]});
 const bad=gate.check({to:'not-an-address',subject:'Re: '+'x'.repeat(95),text:'Hi {first_name}, act now! <p>Click</p> https://a.co https://b.co https://c.co'},{footer:FOOT});
 assert.equal(bad.ok,false);
 const all=bad.reasons.join(' ');
 for(const re of [/not a valid email/,/longer than 90/,/reply or forward/,/placeholder/,/HTML/,/3 links/,/act now/,/postal address/,/opt out/,/who sends it/])assert.match(all,re);
 assert.match(gate.check(GOOD,{footer:FOOT,suppressed:['HELLO@cafe-rosa.co.uk']}).reasons.join(' '),/asked not to be emailed/);
 assert.match(gate.check(GOOD,{footer:FOOT,expectedTo:'other@x.com'}).reasons.join(' '),/does not match/);
 assert.ok(!gate.validEmail('logo@2x.png'));
});

test('find customers: OpenStreetMap search, free website reading, owner signals, draft, approve, send, opt-out and bounce stop',async()=>{
 const owner='acct-1',calls=[];
 const osm={elements:[
  {type:'node',id:1,tags:{name:'Cafe Rosa',amenity:'cafe',website:'cafe-rosa.co.uk','addr:street':'Kirkgate','addr:city':'Leeds',opening_hours:'Mo-Fr 07:00-16:00'}},
  {type:'way',id:2,tags:{name:'Bean There',amenity:'cafe',email:'hi@beanthere.co.uk'}},
  {type:'node',id:3,tags:{amenity:'cafe'}}
 ]};
 const html='<html><head><title>Cafe Rosa | Leeds</title><meta name="description" content="Coffee and cakes by the market"></head><body>Call us to order. <a href="mailto:hello@cafe-rosa.co.uk">Email</a> © 2019 Cafe Rosa</body></html>';
 const fetchImpl=async(url,opts={})=>{calls.push(String(url));
  if(String(url).startsWith('https://nominatim'))return{ok:true,status:200,json:async()=>[{boundingbox:['53.7','53.9','-1.7','-1.4'],lat:'53.8',lon:'-1.55'}]};
  if(String(url).startsWith('https://overpass')){assert.match(decodeURIComponent(opts.body),/\["amenity"="cafe"\]/);return{ok:true,status:200,json:async()=>osm}}
  if(String(url).startsWith('https://cafe-rosa'))return{ok:true,status:200,url:'https://cafe-rosa.co.uk/',text:async()=>html};
  throw Error('unexpected '+url)};
 await assert.rejects(O.search(owner,{area:'Leeds',kind:'spaceships'},{fetchImpl}),/Pick a kind of business/);
 const found=await O.search(owner,{area:'Leeds',kind:'coffee shops and cafes'},{fetchImpl});
 assert.equal(found.added,2,'listings without a name are skipped');
 assert.match(found.attribution,/OpenStreetMap contributors/);
 assert.equal((await O.search(owner,{area:'Leeds',kind:'cafe'},{fetchImpl})).added,0,'the same businesses are not added twice');
 // Reading their website: no AI, facts with their source.
 const rosa=await O.profile(owner,'osm-node-1',{fetchImpl,now:Date.parse('2026-10-20')});
 assert.equal(rosa.email,'hello@cafe-rosa.co.uk');assert.match(rosa.email_source,/published on https:\/\/cafe-rosa/);
 const on=c=>rosa.observations.find(o=>o.code===c).value;
 assert.equal(on('outdated_site'),true);assert.equal(on('no_mobile'),true);assert.equal(on('no_booking'),true);assert.equal(on('opening_hours'),true);
 // Only the signals the owner confirmed count.
 let v=O.settings(owner,{signals:['outdated_site','no_booking','nonsense']});
 assert.deepEqual(v.settings.signals,['outdated_site','no_booking']);
 assert.equal(v.leads[0].id,'osm-node-1');assert.equal(v.leads[0].score,2.5);
 // Drafts need the owner's details first (the law needs a postal address).
 const callModel=async(req,parse)=>{assert.match(req.messages[1].content,/untrusted text/);assert.match(req.messages[1].content,/Website looks out of date/);return parse(JSON.stringify({subject:'Friday lunches for Cafe Rosa',body:'Hi Cafe Rosa team,\n\nI saw on your website that orders are by phone only. We cook office lunches nearby and could help on busy Fridays. Would a tasting box next week be useful?'}))};
 await assert.rejects(O.draft(owner,'osm-node-1',{callModel}),/postal address/);
 O.settings(owner,{offer:'Office lunches delivered by 12:30',sender:'Ana Silva',sender_business:'Olive Kitchen',address:'12 Mill Lane, Leeds LS1 4AB',reply_to:'ana@olive.kitchen'});
 const mail=await O.draft(owner,'osm-node-1',{callModel});
 assert.equal(mail.status,'waiting');assert.match(mail.text,/12 Mill Lane[\s\S]*reply "stop"/);
 await assert.rejects(O.draft(owner,'osm-node-1',{callModel}),/already an email/);
 // Nothing sends before approval, nor without its own sending address.
 await assert.rejects(O.send(owner,mail.id,{deliver:async()=>{}}),/Approve the email/);
 // An edit that breaks a rule blocks the email.
 assert.equal(O.edit(owner,mail.id,{text:'Act now! {name}'}).status,'blocked');
 assert.throws(()=>O.decide(owner,mail.id,'approve'),/cannot be approved yet/);
 O.edit(owner,mail.id,{text:mail.text});
 assert.equal(O.decide(owner,mail.id,'approve').status,'approved');
 delete process.env.KAIROQ_OUTREACH_FROM;
 await assert.rejects(O.send(owner,mail.id,{deliver:async()=>{}}),/its own sending address/);
 process.env.KAIROQ_OUTREACH_FROM='Ana <ana@mail.olive-outreach.com>';
 const sent=[];
 const done=await O.send(owner,mail.id,{deliver:async(...a)=>sent.push(a)});
 assert.equal(done.status,'sent');
 assert.equal(sent[0][0],'hello@cafe-rosa.co.uk');assert.equal(sent[0][3],'ana@olive.kitchen','replies go to the owner');assert.deepEqual(sent[0][4],{from:'Ana <ana@mail.olive-outreach.com>'});
 // Opting out is final: no new draft for that address.
 v=O.mark(owner,'osm-node-1','opted_out');
 assert.ok(O.load(owner).suppressed.includes('hello@cafe-rosa.co.uk'));
 O.mark(owner,'osm-node-1','new');
 await assert.rejects(O.draft(owner,'osm-node-1',{callModel}),/asked not to be emailed/);
 // Too many bounces stop all sending.
 const st=O.load(owner);st.stats.sent=20;fs.writeFileSync(path.join(process.env.KAIROQ_OUTREACH_DIR,fs.readdirSync(process.env.KAIROQ_OUTREACH_DIR)[0]),JSON.stringify(st));
 const bean=await O.draft(owner,'osm-way-2',{callModel:async(r,parse)=>parse('{"subject":"Lunch boxes for Bean There","body":"Hi Bean There team, we cook office lunches nearby. Would a tasting box next week be useful?"}')});
 O.decide(owner,bean.id,'approve');
 O.mark(owner,'osm-way-2','bounced');
 assert.equal(O.view(owner).outbox.find(o=>o.id===bean.id).status,'rejected','queued emails to a bounced address are dropped');
 O.mark(owner,'osm-node-1','bounced');
 assert.match(O.view(owner).paused.reason,/3% of emails bounced/);
 delete process.env.KAIROQ_OUTREACH_FROM;
});
