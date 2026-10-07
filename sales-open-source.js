const https = require('node:https');
const dns = require('node:dns');
const path = require('node:path');
const fs = require('node:fs');
const BASE = './vendor/openenrich/dist/';
const modules = Promise.all([
  import(BASE+'core/enrich.js'), import(BASE+'core/cache.js'),
  import(BASE+'core/providers.js'), import(BASE+'core/csv.js')
]);
function publicIPv4(ip) {
  const p=ip.split('.').map(Number);
  return p.length===4 && p.every(n=>Number.isInteger(n)&&n>=0&&n<=255) &&
    ![0,10,127].includes(p[0]) && p[0]<224 && !(p[0]===169&&p[1]===254) &&
    !(p[0]===172&&p[1]>=16&&p[1]<=31) && !(p[0]===192&&p[1]===168) &&
    !(p[0]===100&&p[1]>=64&&p[1]<=127) && !(p[0]===198&&[18,19].includes(p[1]));
}
function safeUrl(raw) {
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!u.hostname.includes('.')||/^\[/.test(u.hostname))throw new Error('Use a public HTTPS company website.');
  if(/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)&&!publicIPv4(u.hostname))throw new Error('Private addresses are not allowed.');
  return u;
}
function fetchCompanyText(raw, redirects=0) {
  return new Promise(resolve=>{
    let u;try{u=safeUrl(raw)}catch{return resolve(null)}
    const req=https.get(u,{headers:{'User-Agent':'Kairoq-OpenEnrich/1.0','Accept':'text/html,text/plain'},lookup:(host,opts,cb)=>{
      dns.lookup(host,{family:4},(err,address,family)=>{
        if(err||!publicIPv4(address||''))return cb(err||new Error('Private address blocked'));
        cb(null,opts.all?[{address,family}]:address,family);
      });
    }},res=>{
      if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location&&redirects<3){res.resume();try{return resolve(fetchCompanyText(new URL(res.headers.location,u).href,redirects+1))}catch{return resolve(null)}}
      if(res.statusCode!==200||!/text\/(html|plain)/i.test(res.headers['content-type']||'')){res.resume();return resolve(null)}
      const chunks=[];let size=0;res.on('data',c=>{size+=c.length;if(size>2_000_000){res.destroy();resolve(null)}else chunks.push(c)});res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));res.on('error',()=>resolve(null));
    });req.setTimeout(8000,()=>req.destroy());req.on('error',()=>resolve(null));
  });
}
function selectableEmail(result) {return !!result?.verified&&['scrape','smtp','api'].includes(result.method)&&!result.unverifiable;}
let queue=Promise.resolve();
function enrichContact(lead, workspace, options={}) {
  const run=queue.then(async()=>{
    if(!lead.contact_name||!lead.domain)return null;
    safeUrl(`https://${lead.domain}`);
    const [{enrichRow},{Cache},{buildProviders}]=await modules;
    fs.mkdirSync(workspace,{recursive:true});
    const cache=new Cache(path.join(workspace,'.openenrich-cache.json'));
    const providers=buildProviders({providers:['scrape','local'],noSmtp:true,maxPages:3,fetchText:options.fetchText||fetchCompanyText});
    // Do not read cached guesses as verified contacts. Upstream cache rewrites method to cache.
    const result=await enrichRow({name:lead.contact_name,domain:lead.domain},providers,{domains:cache.domains,budget:{max:0,spent:0}});
    cache.flush();
    if(!result)return {source:'OpenEnrich',status:'not_found',cost:0};
    const selectable=selectableEmail(result);
    return {...result,source:`OpenEnrich · ${result.source}`,status:selectable?'published':'unverified',selectable};
  });queue=run.catch(()=>{});return run;
}
async function parseLeadExport(text) {
  if(typeof text!=='string'||Buffer.byteLength(text)>1_000_000)throw new Error('Upload a CSV or JSONL export smaller than 1 MB.');
  const input=text.replace(/^\uFEFF/,'').trim();if(!input)throw new Error('The export is empty.');
  const [{},{},{},{parseCsv}]=await modules;
  let rows;
  try{rows=input.startsWith('[')?JSON.parse(input):input.startsWith('{')?input.split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x)):parseCsv(input)}catch{throw new Error('Invalid CSV or JSONL export.');}
  if(!Array.isArray(rows)||!rows.length||rows.length>500)throw new Error('Import between 1 and 500 lead records.');
  return rows.map((r,i)=>{
    if(!r||typeof r!=='object'||Array.isArray(r))throw new Error(`Invalid record ${i+1}.`);
    const company=String(r.company||'').trim();
    if(!company)throw new Error(`Record ${i+1} needs a company.`);
    const name=String(r.full_name||r.contact_name||[r.first_name,r.last_name].filter(Boolean).join(' ')).trim();
    let website=String(r.website||r.domain||'').trim();if(website){website=safeUrl(/^https:\/\//i.test(website)?website:`https://${website.replace(/^http:\/\//i,'')}`).href;}
    const email=String(r.email||'').trim().toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error(`Record ${i+1} has an invalid email.`);
    const profile=String(r.profile_text||'').slice(0,12000);
    const sourceUrl=String(r.linkedin_url||r.source_url||'').trim();if(sourceUrl)safeUrl(sourceUrl);
    return {company,website,contact_name:name,contact_title:String(r.title||r.contact_title||''),email,source:'lead export',source_url:sourceUrl,signal:String(r.reason||'Imported prospect; research buyer fit'),status:'new',score:0,
      evidence:profile?[{type:'imported_profile',summary:profile,url:sourceUrl}]:[],
      enrichment:{imported:{provider:'OpenOutFind / CSV',lead_id:String(r.lead_id||''),reason:String(r.reason||'').slice(0,3000),email_status:email?'unverified':'missing'}},
      next_action:'Research this prospect against the Travellez ICP. Confirm recipient before outreach.'};
  });
}
function leadKey(lead) {return [String(lead.domain||lead.website||'').replace(/^https?:\/\//,'').replace(/\/$/,'').toLowerCase(),String(lead.contact_name||lead.email||lead.company||'').trim().toLowerCase()].join('|');}
module.exports={enrichContact,parseLeadExport,selectableEmail,leadKey,publicIPv4,safeUrl,fetchCompanyText};
