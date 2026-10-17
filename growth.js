"use strict";
// Customers before code. Lovable and Replit help you build an app; this helps you build a
// business:
//  - Launch (before building): from an idea, Kairoq writes the pitch, builds a one-page landing
//    page with a waitlist, writes ready-to-post launch messages, and lets AI customers react to
//    the pitch. Real signups on the published page decide: build only when real people want it.
//  - Growth watch (after launch): every week the same kind of AI customers use the live app,
//    and real visitors and signups are counted. A plain-English brief says what is stopping
//    signups and offers the fix (Fix and retest: pay only when it works).
const builder=require('./react-builder');
const WAITLIST='waitlist';

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function lines(v,n){return String(v??'').replace(/\r/g,'').trim().slice(0,n)}
function json(content){
 const t=String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
 try{return JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('The model did not answer with JSON');return JSON.parse(t.slice(a,b+1))}
}

// ---------- the pitch and the launch posts ----------
const PITCH_PROMPT=`You help a founder test an idea before building it. From the idea, write the pitch for a one-page landing page with a waitlist, and launch posts the founder can share by hand.
Be concrete and honest: no invented numbers, customers, reviews, awards or press. The page promises only what the idea says.
Respond with ONLY JSON:
{"name":"product name (keep the founder's if given)","headline":"one line, the outcome for the customer","subheadline":"one or two sentences: who it is for and what it does","benefits":[{"title":"short","text":"one sentence"}],"cta":"waitlist button text, e.g. Join the waitlist","audience":"who the customers are, one sentence","question":"one optional question the waitlist form asks to learn about demand, or empty",
"posts":{"reddit":{"title":"","body":"","where":["subreddit names where this genuinely fits, without r/"]},"linkedin":"","whatsapp":"short and friendly, for a group chat","x":"under 260 characters","email":{"subject":"","body":"for friends and contacts"}}}
3 benefits. Each post asks for honest feedback and links to {link}. Posts must follow community rules: no spam, no fake urgency, disclose that you are the founder.`;
function normalizePitch(v,idea){
 const posts=v.posts||{};
 const reddit=posts.reddit||{};
 return{
  name:clip(v.name,60)||'New idea',headline:clip(v.headline,140),subheadline:clip(v.subheadline,300),
  benefits:(Array.isArray(v.benefits)?v.benefits:[]).slice(0,4).map(b=>({title:clip(b&&b.title,60),text:clip(b&&b.text,200)})).filter(b=>b.title),
  cta:clip(v.cta,40)||'Join the waitlist',audience:clip(v.audience,300),question:clip(v.question,160),idea:clip(idea,1500),
  posts:{reddit:{title:clip(reddit.title,200),body:lines(reddit.body,3000),where:(Array.isArray(reddit.where)?reddit.where:[]).map(x=>clip(x,40).replace(/^r\//,'')).filter(Boolean).slice(0,5)},linkedin:lines(posts.linkedin,3000),whatsapp:lines(posts.whatsapp,800),x:clip(posts.x,280),email:{subject:clip(posts.email&&posts.email.subject,140),body:lines(posts.email&&posts.email.body,3000)}}
 };
}
async function pitch(idea,{callModel,tier='standard',signal}){
 const v=await callModel({messages:[{role:'system',content:PITCH_PROMPT},{role:'user',content:'The idea:\n'+clip(idea,1500)}],temperature:0.5,maxOutputTokens:3000,signal,tier},json);
 const p=normalizePitch(v,idea);
 if(!p.headline)throw Error('The model did not write a pitch');
 return p;
}
// The builder request for the landing page. Signups go to a submit-only collection: visitors
// can add themselves, only the owner can read the list.
function landingRequest(p){
 return'Build a one-page landing page that tests demand for this idea before the product exists. Use exactly this copy:\n'+JSON.stringify({name:p.name,headline:p.headline,subheadline:p.subheadline,benefits:p.benefits,cta:p.cta,question:p.question},null,1)+
  '\n\nRequirements:\n- A hero with the headline, subheadline and a waitlist form near the top, then the benefits, then the form again at the bottom.\n- The waitlist form asks for an email (required)'+(p.question?' and this optional question: "'+p.question+'"':'')+'. On submit, save it with collection("'+WAITLIST+'").create({email'+(p.question?', answer':'')+'}) from the kairoq module, then replace the form with a thank-you message. Show a friendly error if saving fails.\n- In src/backend.json add the collection "'+WAITLIST+'" with access "submit-only", so visitors can join but only the owner can read the list.\n- Say plainly that the product is coming soon. No invented numbers, customers, reviews or logos.\n- Fast, clean, works well on phones.';
}
// Real launch posts, with the link filled in once the page is published.
function postsWithLink(posts,link){
 const fill=t=>String(t||'').split('{link}').join(link||'(publish the page to get your link)');
 return{reddit:{...posts.reddit,title:fill(posts.reddit.title),body:fill(posts.reddit.body)},linkedin:fill(posts.linkedin),whatsapp:fill(posts.whatsapp),x:fill(posts.x),email:{subject:fill(posts.email.subject),body:fill(posts.email.body)}};
}

// ---------- real numbers ----------
function signups(id,collection,{days=null,now=Date.now()}={}){
 try{
  const db=require('./react-backend').database(id);
  if(!days)return db.prepare('SELECT COUNT(*) n FROM records WHERE collection=?').get(collection).n;
  return db.prepare('SELECT COUNT(*) n FROM records WHERE collection=? AND created_at>=?').get(collection,new Date(now-days*86400000).toISOString()).n;
 }catch{return 0}
}
function visitors(id,days){try{return require('./react-analytics').summary(id,{days}).totals.visitors||0}catch{return 0}}
function liveLink(meta){
 if(!meta.published)return null;
 const u=require('./react-hosting').siteUrls(meta);
 return u.domains[0]||u.subdomain||u.path;
}
// Where the idea stands: no page yet, built but not published, collecting signups, or ready.
function status(meta){
 const l=meta.launch;if(!l)return null;
 const total=signups(meta.id,WAITLIST),seen=meta.published?visitors(meta.id,30):0,target=l.target||20;
 const stage=!l.version?'draft':!meta.published?'not_live':total>=target?'ready':'collecting';
 const say={draft:'The landing page is being prepared.',not_live:'Publish the landing page, then share the launch posts to start collecting signups.',collecting:total+' of '+target+' signups so far. Keep sharing: build when real people have asked for it.',ready:total+' real people joined the waitlist (your goal was '+target+'). People want this: build it.'}[stage];
 return{stage,say,signups:total,target,visitors_30d:seen,rate:seen?Math.round(total/seen*1000)/10:null,link:liveLink(meta)};
}

// ---------- growth watch ----------
const BRIEF_PROMPT=`You write a weekly growth brief for a founder who does not read code. Plain, friendly English, short sentences.
You get this week's real numbers (visitors and signups, and last week's), and a test where AI customers used the live app.
Respond with ONLY JSON: {"headline":"one sentence: the most important thing this week, with numbers","stopping":[{"what":"what is stopping signups","evidence":"the numbers or a customer's words that show it"}],"next":["the most valuable change to make, specific"],"good":"one thing that is working, or empty"}
At most 3 items in stopping and 3 in next. Never invent numbers; use only the ones given. If real visitors are very few, say the first job is getting people to the page and suggest where to share it.`;
function weekNumbers(id,goal,now=Date.now()){
 const sev=(a,b)=>{try{return require('./react-backend').database(id).prepare('SELECT COUNT(*) n FROM records WHERE collection=? AND created_at>=? AND created_at<?').get(goal,new Date(now-a*86400000).toISOString(),new Date(now-b*86400000).toISOString()).n}catch{return 0}};
 const v=(()=>{try{return require('./react-analytics').summary(id,{days:14,now}).series}catch{return[]}})();
 const vis=(from,to)=>v.slice(from,to).reduce((n,d)=>n+d.visitors,0);
 const thisWeek={visitors:vis(7,14),signups:sev(7,0)},lastWeek={visitors:vis(0,7),signups:sev(14,7)};
 const rate=w=>w.visitors?Math.round(w.signups/w.visitors*1000)/10:null;
 return{this_week:{...thisWeek,rate:rate(thisWeek)},last_week:{...lastWeek,rate:rate(lastWeek)}};
}
async function brief({numbers,report,goal},{callModel,tier='standard',signal}){
 const n=report.numbers,s=report.summary;
 const user='Signups are saved in "'+goal+'".\nThis week: '+numbers.this_week.visitors+' real visitors, '+numbers.this_week.signups+' signups'+(numbers.this_week.rate!=null?' ('+numbers.this_week.rate+'%)':'')+'.\nLast week: '+numbers.last_week.visitors+' visitors, '+numbers.last_week.signups+' signups.\n\nAI customers on the live app: '+n.completed+' of '+n.visitors+' reached the goal ('+n.completion_rate+'%). Where the others left: '+n.drop_off.map(d=>d.path+' ('+d.visitors+')').join(', ')+'.\nIssues:\n'+s.issues.map(x=>'- '+x.title+': '+x.why+(x.quote?' ("'+x.quote+'")':'')).join('\n');
 try{
  const v=await callModel({messages:[{role:'system',content:BRIEF_PROMPT},{role:'user',content:user}],temperature:0.3,maxOutputTokens:1500,signal,tier},json);
  return{headline:clip(v.headline,300),stopping:(Array.isArray(v.stopping)?v.stopping:[]).slice(0,3).map(x=>({what:clip(x&&x.what,200),evidence:clip(x&&x.evidence,300)})).filter(x=>x.what),next:(Array.isArray(v.next)?v.next:[]).slice(0,3).map(x=>clip(x,300)).filter(Boolean),good:clip(v.good,300)};
 }catch{
  return{headline:numbers.this_week.signups+' signups from '+numbers.this_week.visitors+' visitors this week; '+n.completed+' of '+n.visitors+' AI customers reached the goal.',stopping:s.issues.slice(0,3).map(x=>({what:x.title,evidence:x.quote||x.why})),next:s.fixes.slice(0,3),good:''};
 }
}
function watchDue(meta,now=Date.now()){
 const w=meta.watch;
 if(!w||!w.enabled||!meta.published)return false;
 return!w.last_at||now-Date.parse(w.last_at)>=(w.every_days||7)*86400000-3600000;
}
function emailText(meta,entry){
 const b=entry.brief,n=entry.numbers.this_week;
 return[b.headline,'','This week: '+n.visitors+' visitors, '+n.signups+' signups.'+(entry.ai?' AI customers: '+entry.ai.completed+' of '+entry.ai.visitors+' reached the goal.':''),
  b.stopping.length?'\nWhat is stopping signups:\n'+b.stopping.map(x=>'- '+x.what+(x.evidence?' ('+x.evidence+')':'')).join('\n'):'',
  b.next.length?'\nWhat to change next:\n'+b.next.map(x=>'- '+x).join('\n'):'',
  b.good?'\nWorking well: '+b.good:'','\nOpen '+meta.name+' in Kairoq and use Fix and retest on this week\'s report. You pay only for fixes that work.'].filter(Boolean).join('\n');
}
module.exports={pitch,normalizePitch,landingRequest,postsWithLink,signups,visitors,status,liveLink,weekNumbers,brief,watchDue,emailText,WAITLIST};
