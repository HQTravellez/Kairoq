"use strict";
// Privacy-friendly analytics for published Create apps: page views and daily
// unique visitors counted on the server. No cookies, no third-party scripts; a
// visitor is a salted hash of IP and browser that changes every day.
const crypto=require('crypto');
const BOTS=/bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|curl|wget|python-requests/i;
let salt=null;
function daySalt(){return salt||(salt=process.env.APP_ENCRYPTION_KEY||crypto.randomBytes(16).toString('hex'))}
function db(id){
 const d=require('./react-backend').database(id);
 d.exec('CREATE TABLE IF NOT EXISTS site_views(day TEXT NOT NULL,visitor TEXT NOT NULL,referrer TEXT,at INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS site_views_day ON site_views(day)');
 return d;
}
function record(id,req,{now=Date.now()}={}){
 try{
  const ua=String(req.headers['user-agent']||'');
  if(!ua||BOTS.test(ua)||req.method!=='GET'||String(req.headers['purpose']||req.headers['sec-purpose']||'').includes('prefetch'))return false;
  const day=new Date(now).toISOString().slice(0,10);
  const ip=require('./client-ip').clientIp(req);
  const visitor=crypto.createHash('sha256').update(day+'|'+ip+'|'+ua+'|'+daySalt()).digest('hex').slice(0,20);
  let referrer=null;
  try{const r=new URL(String(req.headers.referer||''));if(r.host!==String(req.headers.host||''))referrer=r.host.slice(0,120)}catch{}
  db(id).prepare('INSERT INTO site_views(day,visitor,referrer,at) VALUES(?,?,?,?)').run(day,visitor,referrer,now);
  return true;
 }catch{return false}
}
function summary(id,{days=30,now=Date.now()}={}){
 const d=db(id),since=new Date(now-(days-1)*86400000).toISOString().slice(0,10);
 const rows=d.prepare('SELECT day,COUNT(*) views,COUNT(DISTINCT visitor) visitors FROM site_views WHERE day>=? GROUP BY day').all(since);
 const byDay=Object.fromEntries(rows.map(r=>[r.day,r]));
 const series=[];
 for(let i=days-1;i>=0;i--){const day=new Date(now-i*86400000).toISOString().slice(0,10);series.push({day,views:byDay[day]?.views||0,visitors:byDay[day]?.visitors||0})}
 const totals=d.prepare('SELECT COUNT(*) views,COUNT(DISTINCT day||visitor) visitors FROM site_views WHERE day>=?').get(since);
 const referrers=d.prepare('SELECT referrer,COUNT(*) views FROM site_views WHERE day>=? AND referrer IS NOT NULL GROUP BY referrer ORDER BY views DESC LIMIT 8').all(since);
 return{days,series,totals,referrers};
}
module.exports={record,summary};
