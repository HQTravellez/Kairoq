"use strict";
// Partners and sponsored templates: how other companies pay to be on Kairoq without touching
// anyone's app or data.
//
// - Partner integrations: the owner lists services Kairoq can build with (payments, booking,
//   email, domains…), each with how to add it (instructions for the builder), the secrets it
//   needs, and a sign-up link that may carry a referral code. People see them under Integrations
//   in the editor, labelled "Partner" (or "Sponsored" when paid placement). "Add to my app" sends
//   the instructions as a normal chat request; "Create an account" goes through a counting
//   redirect to the partner's own link.
// - Sponsored templates: a time-boxed slot at the front of the template gallery, labelled
//   "Sponsored · <partner>", that starts a project from a prompt or one of Kairoq's templates.
//
// Counts per partner and month (impressions, clicks, adds, starts) let the owner invoice
// partners. Nothing about a person or their project is shared with partners; Kairoq only knows
// that someone clicked or added.
const fs=require('fs'),path=require('path'),crypto=require('crypto');

const CATEGORIES=['payments','booking','email','domains','hosting','analytics','marketing','other'];
function dir(){return process.env.KAIROQ_PARTNERS_DIR||path.join(path.dirname(require('./react-builder').ROOT()),'partners')}
function file(){return path.join(dir(),'partners.json')}
function load(){try{const d=JSON.parse(fs.readFileSync(file(),'utf8'));return{partners:d.partners||[],slots:d.slots||[],stats:d.stats||{}}}catch{return{partners:[],slots:[],stats:{}}}}
function save(d){fs.mkdirSync(dir(),{recursive:true});fs.writeFileSync(file(),JSON.stringify(d,null,1))}
function clip(v,n){return String(v??'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,n)}
function err(m,s){return Object.assign(Error(m),{status:s})}
function maxSlots(){const n=Number(process.env.KAIROQ_SPONSORED_MAX);return Number.isFinite(n)&&n>=0?Math.min(4,Math.floor(n)):2}
function month(t=Date.now()){return new Date(t).toISOString().slice(0,7)}

function httpsUrl(u,label){
 if(!u)return'';
 let x;try{x=new URL(String(u).trim())}catch{throw err(label+' must be a full link, like https://partner.com/signup?ref=kairoq',400)}
 if(x.protocol!=='https:'||x.username||x.password)throw err(label+' must be an https link',400);
 return x.href.slice(0,500);
}

// ---------- counting ----------
function count(id,kind,n=1){
 if(!id)return;
 const d=load(),s=d.stats[id]||(d.stats[id]={});
 s[kind]=(s[kind]||0)+n;
 const m=(s.months||(s.months={}))[month()]||(s.months[month()]={});m[kind]=(m[kind]||0)+n;
 save(d);
}

// ---------- partners ----------
function normalizePartner(p,old={}){
 const name=clip(p.name,60);if(name.length<2)throw err('Give the partner a name',400);
 const category=CATEGORIES.includes(p.category)?p.category:'other';
 const instructions=clip(p.instructions,2000);
 if(instructions.length<20)throw err('Write how Kairoq should add it to an app (at least a sentence), e.g. which server function, which secret and which page',400);
 const secrets=String(p.secrets||'').split(/[\s,]+/).map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z][A-Z0-9_]{1,59}$/.test(s)).slice(0,6);
 return{
  id:old.id||crypto.randomBytes(5).toString('hex'),
  name,category,
  description:clip(p.description,240),
  instructions,secrets,
  signup_url:httpsUrl(p.signup_url,'The sign-up link'),
  sponsored:Boolean(p.sponsored),
  active:p.active!==false,
  note:clip(p.note,300), // for the owner only: the deal, the contact
  created_at:old.created_at||new Date().toISOString(),updated_at:new Date().toISOString()
 };
}
// What people see: active partners, sponsored first, without the owner's notes.
function publicPartners(){
 const d=load();
 return d.partners.filter(p=>p.active).sort((a,b)=>(b.sponsored?1:0)-(a.sponsored?1:0)||a.name.localeCompare(b.name)).map(p=>({id:p.id,name:p.name,category:p.category,description:p.description,secrets:p.secrets,sponsored:p.sponsored,has_signup:Boolean(p.signup_url)}));
}
function get(id){const p=load().partners.find(x=>x.id===id&&x.active);if(!p)throw err('Unknown partner',404);return p}
// The chat request that adds a partner to an app (a normal, paid build).
function addMessage(id){
 const p=get(id);count(p.id,'adds');
 return{message:'Add '+p.name+' to this app. '+p.instructions+(p.secrets.length?'\nRead '+p.secrets.join(', ')+' from the app secrets in a server function; never put them in the page code. If a secret is missing, show a clear message on the page saying it needs to be added in Settings, then Secrets.':''),partner:{id:p.id,name:p.name,secrets:p.secrets}};
}
// The sign-up link, counted. Only links the owner saved are ever redirected to.
function signupUrl(id){const p=get(id);if(!p.signup_url)throw err('This partner has no sign-up link',404);count(p.id,'clicks');return p.signup_url}

// ---------- sponsored template slots ----------
function normalizeSlot(s,partners,old={}){
 const partner=partners.find(p=>p.id===s.partner_id);if(!partner)throw err('Choose the partner who sponsors this slot',400);
 const title=clip(s.title,70);if(title.length<3)throw err('Give the slot a title',400);
 const template=s.template?String(s.template):'';
 if(template&&!require('./create-templates').get(template))throw err('Unknown template',400);
 const prompt=clip(s.prompt,1500);
 if(!template&&prompt.length<20)throw err('Write what Kairoq should build (at least a sentence), or pick one of the templates',400);
 const day=v=>{if(!v)return null;const t=Date.parse(String(v));if(!Number.isFinite(t))throw err('Dates must look like 2026-11-01',400);return new Date(t).toISOString().slice(0,10)};
 const starts=day(s.starts),ends=day(s.ends);
 if(starts&&ends&&ends<starts)throw err('The end date is before the start date',400);
 return{id:old.id||crypto.randomBytes(5).toString('hex'),partner_id:partner.id,title,description:clip(s.description,200),category:clip(s.category,24)||partner.category,template:template||null,prompt:template?prompt||null:prompt,starts,ends,active:s.active!==false,created_at:old.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};
}
function running(s,partners,now=Date.now()){
 const today=new Date(now).toISOString().slice(0,10);
 return s.active&&(!s.starts||s.starts<=today)&&(!s.ends||s.ends>=today)&&partners.some(p=>p.id===s.partner_id&&p.active);
}
// Slots for the gallery right now (at most KAIROQ_SPONSORED_MAX), each counted as an impression.
function gallerySlots({countImpressions=true}={}){
 const d=load(),list=d.slots.filter(s=>running(s,d.partners)).slice(0,maxSlots());
 if(countImpressions&&list.length){for(const s of list){const st=d.stats[s.id]||(d.stats[s.id]={});st.impressions=(st.impressions||0)+1;const m=(st.months||(st.months={}))[month()]||(st.months[month()]={});m.impressions=(m.impressions||0)+1}save(d)}
 return list.map(s=>({id:s.id,title:s.title,description:s.description,category:s.category,sponsor:d.partners.find(p=>p.id===s.partner_id).name,sponsored:true}));
}
// Starting a project from a slot: what to create it with. Counted as a start.
function startFromSlot(id){
 const d=load(),s=d.slots.find(x=>x.id===id);
 if(!s||!running(s,d.partners))throw err('This sponsored template has ended',404);
 count(s.id,'starts');
 return{template:s.template||undefined,prompt:s.prompt||undefined,name:s.title};
}

// ---------- the owner's view ----------
function adminView(){
 const d=load(),st=id=>d.stats[id]||{},m=id=>(st(id).months||{})[month()]||{};
 return{
  categories:CATEGORIES,max_slots:maxSlots(),month:month(),
  partners:d.partners.map(p=>({...p,stats:{clicks:st(p.id).clicks||0,adds:st(p.id).adds||0,this_month:m(p.id)}})),
  slots:d.slots.map(s=>({...s,running:running(s,d.partners),sponsor:(d.partners.find(p=>p.id===s.partner_id)||{}).name||'(removed)',stats:{impressions:st(s.id).impressions||0,starts:st(s.id).starts||0,this_month:m(s.id)}}))
 };
}
function adminEdit(b){
 const d=load();
 if(b.action==='save_partner'){
  const i=b.partner&&b.partner.id?d.partners.findIndex(p=>p.id===b.partner.id):-1;
  const p=normalizePartner(b.partner||{},i>=0?d.partners[i]:{});
  if(i>=0)d.partners[i]=p;else d.partners.push(p);
 }else if(b.action==='delete_partner'){
  if(d.slots.some(s=>s.partner_id===b.id&&running(s,d.partners)))throw err('End this partner\'s sponsored templates first',409);
  d.partners=d.partners.filter(p=>p.id!==b.id);
 }else if(b.action==='save_slot'){
  const i=b.slot&&b.slot.id?d.slots.findIndex(s=>s.id===b.slot.id):-1;
  const s=normalizeSlot(b.slot||{},d.partners,i>=0?d.slots[i]:{});
  if(i>=0)d.slots[i]=s;else d.slots.push(s);
 }else if(b.action==='delete_slot'){d.slots=d.slots.filter(s=>s.id!==b.id)}
 else throw err('Unknown action',400);
 save(d);return adminView();
}
module.exports={publicPartners,addMessage,signupUrl,gallerySlots,startFromSlot,adminView,adminEdit,normalizePartner,normalizeSlot,CATEGORIES,dir};
