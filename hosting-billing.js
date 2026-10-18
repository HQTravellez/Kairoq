"use strict";
// Live hosting is paid monthly in credits, like a hosting plan:
// - Publishing a site charges its first 30 days (KAIROQ_HOSTING_CREDITS, default 50). Publishing
//   again, a new version or after unpublishing, costs nothing while the 30 days last.
// - Every 30 days the owner of the project is charged again. If they do not have the credits, they
//   get an email and the site stays live for a grace period (KAIROQ_HOSTING_GRACE_DAYS, default 7);
//   after that it shows a "paused" page until the credits are there, then comes back by itself.
// - Sites that were already live when billing started get their first 30 days free.
// - The Kairoq owner's own projects are never charged. KAIROQ_HOSTING_CREDITS=0 turns billing off.
const DAY=86400000;
function intEnv(k,d){const n=Number(process.env[k]);return Number.isFinite(n)&&n>=0?Math.floor(n):d}
function price(){return intEnv('KAIROQ_HOSTING_CREDITS',50)}
function period(){return Math.max(1,intEnv('KAIROQ_HOSTING_DAYS',30))*DAY}
function grace(){return intEnv('KAIROQ_HOSTING_GRACE_DAYS',7)*DAY}
function billable(meta){return price()>0&&Boolean(meta.owner)&&meta.owner!=='owner'}
function iso(t){return new Date(t).toISOString()}

// Before a publish: pays for the first 30 days unless they are already paid. Returns what was
// charged, so the caller can give it back if publishing then fails.
function beforePublish(id,now=Date.now()){
 const builder=require('./react-builder'),accounts=require('./builder-accounts');
 const meta=builder.loadMeta(id);
 if(!billable(meta))return{charged:0};
 const b=meta.hosting_billing||{};
 if(b.paid_until&&Date.parse(b.paid_until)>now&&!b.paused)return{charged:0,paid_until:b.paid_until};
 const ref='hosting:'+id+':'+now;
 try{accounts.charge(meta.owner,price(),'Live site: '+meta.name+' (30 days)',ref)}
 catch(e){if(e.status===402)throw Object.assign(Error('Putting a site live costs '+price()+' credits a month, and this account does not have enough. Buy credits, then publish again.'),{status:402});throw e}
 meta.hosting_billing={paid_until:iso(now+period()),last_charge:iso(now)};
 builder.saveMeta(meta);
 return{charged:price(),paid_until:meta.hosting_billing.paid_until,ref};
}
function refund(id,charge){
 if(!charge||!charge.charged)return;
 const builder=require('./react-builder'),meta=builder.loadMeta(id);
 try{require('./builder-accounts').grant(meta.owner,charge.charged,'Refund: site was not published','refund:'+charge.ref)}catch{}
 delete meta.hosting_billing;builder.saveMeta(meta);
}

async function mail(meta,subject,text){
 const accounts=require('./builder-accounts');
 if(!accounts.mailReady())return;
 const to=accounts.email(meta.owner);if(!to)return;
 await require('./react-backend-extras').deliver(to,subject,text).catch(()=>{});
}
function siteName(meta){return meta.name+(meta.published&&meta.published.slug?' ('+meta.published.slug+')':'')}

// Runs every hour: renews what is due, warns, pauses after the grace period, and brings paused
// sites back once the credits are there.
async function tick(now=Date.now()){
 const builder=require('./react-builder'),accounts=require('./builder-accounts');
 const out={renewed:[],warned:[],paused:[],resumed:[],started:[]};
 if(price()<=0)return out;
 for(const p of builder.list()){
  let meta;try{meta=builder.loadMeta(p.id)}catch{continue}
  if(!meta.published||!billable(meta))continue;
  const b=meta.hosting_billing;
  // Live before billing existed: the first 30 days are on Kairoq.
  if(!b||!b.paid_until){meta.hosting_billing={paid_until:iso(now+period()),started:'existing site'};builder.saveMeta(meta);out.started.push(p.id);continue}
  if(Date.parse(b.paid_until)>now)continue;
  try{
   accounts.charge(meta.owner,price(),'Live site: '+meta.name+' (30 days)','hosting:'+p.id+':'+b.paid_until);
   const from=Math.max(Date.parse(b.paid_until),now-period());
   const wasPaused=b.paused;
   meta.hosting_billing={paid_until:iso(Math.max(from+period(),now+DAY)),last_charge:iso(now)};
   builder.saveMeta(meta);
   (wasPaused?out.resumed:out.renewed).push(p.id);
  }catch(e){
   if(e.status!==402)continue;
   if(!b.failed_since){
    b.failed_since=iso(now);builder.saveMeta(meta);out.warned.push(p.id);
    await mail(meta,'Your site '+meta.name+' needs '+price()+' credits to stay live','Your site '+siteName(meta)+' could not renew: it costs '+price()+' credits a month and your account does not have enough.\n\nIt stays live until '+new Date(now+grace()).toDateString()+'. After that it is paused until you add credits; your app and its data are kept.\n\nAdd credits: '+(process.env.KAIROQ_PUBLIC_URL||'')+'/create');
   }else if(!b.paused&&now-Date.parse(b.failed_since)>=grace()){
    b.paused=true;b.paused_at=iso(now);builder.saveMeta(meta);out.paused.push(p.id);
    await mail(meta,'Your site '+meta.name+' is paused','Your site '+siteName(meta)+' is paused because its monthly '+price()+' credits could not be charged. Add credits and it comes back within the hour; nothing was deleted.\n\n'+(process.env.KAIROQ_PUBLIC_URL||'')+'/create');
   }
  }
 }
 return out;
}
function paused(meta){return Boolean(meta&&meta.hosting_billing&&meta.hosting_billing.paused)}
// The page visitors see while a site is paused.
function pausedPage(res){
 res.writeHead(503,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Retry-After':'3600'});
 res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site paused</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#faf9f7;color:#0f0f0f}main{max-width:420px;padding:32px;text-align:center}h1{font-size:22px;margin:0 0 8px}p{color:#6b6b6b;margin:0}</style></head><body><main><h1>This site is taking a short break</h1><p>It will be back soon. If it is your site, sign in to Kairoq to keep it live.</p></main></body></html>');
}
// For the publish dialog and the API.
function view(meta){
 const b=meta.hosting_billing||{};
 return{price:billable(meta)?price():0,paid_until:b.paid_until||null,failing_since:b.failed_since||null,paused:Boolean(b.paused),grace_days:Math.round(grace()/DAY)};
}
module.exports={beforePublish,refund,tick,paused,pausedPage,view,price,billable};
