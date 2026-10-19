"use strict";
// The launch kit for a published app: ready-to-post texts (Instagram, Google Business,
// WhatsApp, Facebook, LinkedIn), an email to existing customers and a printable QR poster for
// the counter or window, all pointing to the live link. Written from what the live pages say
// (site-search.js), so it promises only what the business actually offers.
const builder=require('./react-builder');

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function lines(v,n){return String(v??'').replace(/\r/g,'').trim().slice(0,n)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
// The address customers should get: the custom domain, else the subdomain, else the path.
function liveUrl(meta,origin=''){
 const urls=meta.published?require('./react-hosting').siteUrls(meta):null;
 if(!urls)return null;
 const best=urls.domains[0]||urls.subdomain||urls.path;
 return /^https?:/.test(best)?best:origin+best;
}

const PROMPT=`You write the launch kit for a small business whose website or app just went live. You get the text of its live pages.
Write in the language of the pages. Use ONLY facts written there: no invented prices, discounts, reviews, awards or claims. Friendly and specific, never spammy, no fake urgency.
Every text ends with or contains {link} (it is replaced by the live address).
Respond with ONLY JSON:
{"instagram":"caption, 2 to 4 short lines, then 3 to 6 relevant hashtags","google_business":"Google Business Profile post, under 1200 characters","whatsapp":"short message for WhatsApp status or a broadcast to customers","facebook":"post","linkedin":"post, a little more formal","email":{"subject":"","body":"email to existing customers announcing the new site and what they can do there"},"poster":{"headline":"3 to 7 words for a printed poster","line":"one short sentence: what people get by scanning"}}`;
async function write(meta,{callModel,tier='standard',signal,origin=''}){
 const search=require('./site-search');
 const status=search.status(meta);
 if(!meta.published)throw Object.assign(Error('Publish the app first.'),{status:409});
 const snapText=search.pageText?search.pageText(meta):'';
 if(!snapText)throw Object.assign(Error('Kairoq has not read your live pages yet. Use "Read the live pages again", then try once more.'),{status:409});
 const b=meta.business||{};
 const facts=[b.name&&'Business: '+b.name,b.city&&'City: '+b.city,b.hours&&b.hours.length&&'Hours: '+b.hours.join('; ')].filter(Boolean).join('\n');
 const v=await callModel({messages:[{role:'system',content:PROMPT},{role:'user',content:'Site name: '+meta.name+(facts?'\n'+facts:'')+'\n\nLive pages:\n'+snapText}],tier,temperature:0.5,maxOutputTokens:2500,signal,purpose:'launch-kit'},c=>{const t=String(c).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const a=t.indexOf('{'),z=t.lastIndexOf('}');return JSON.parse(t.slice(a,z+1))});
 const link=liveUrl(meta,origin)||'';
 const fill=t=>{t=String(t||'');return t.includes('{link}')?t.split('{link}').join(link):(t?t+'\n'+link:'')};
 const kit={at:new Date().toISOString(),link,pages:status.pages.length,
  instagram:fill(lines(v.instagram,2200)),google_business:fill(lines(v.google_business,1500)),whatsapp:fill(lines(v.whatsapp,700)),facebook:fill(lines(v.facebook,2000)),linkedin:fill(lines(v.linkedin,3000)),
  email:{subject:clip(v.email&&v.email.subject,140).split('{link}').join(link),body:fill(lines(v.email&&v.email.body,3000))},
  poster:{headline:clip(v.poster&&v.poster.headline,60)||clip(b.name||meta.name,60),line:clip(v.poster&&v.poster.line,140).split('{link}').join('')}};
 if(!kit.instagram&&!kit.whatsapp)throw Error('The launch kit came back empty. Try again.');
 const fresh=builder.loadMeta(meta.id);fresh.launch_kit=kit;builder.saveMeta(fresh);
 return kit;
}
// A printable A4 poster: headline, one line, a large QR code and the address.
function poster(meta,{origin=''}={}){
 const url=liveUrl(meta,origin);
 if(!url)throw Object.assign(Error('Publish the app first.'),{status:409});
 const kit=meta.launch_kit||{},p=kit.poster||{},b=meta.business||{};
 const qr=require('./react-mobile').qrSvg(url);
 return`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(b.name||meta.name)} · poster</title>
<style>@page{size:A4;margin:0}html,body{margin:0;background:#fff;color:#111;font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
.sheet{box-sizing:border-box;width:210mm;min-height:297mm;margin:0 auto;padding:22mm 18mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10mm}
.name{font-size:14pt;letter-spacing:.12em;text-transform:uppercase;color:#555}h1{font-size:38pt;line-height:1.1;margin:0;max-width:170mm}
.line{font-size:16pt;color:#333;max-width:150mm;margin:0}.qr{width:110mm;height:110mm}.qr svg{width:100%;height:100%}
.url{font-size:13pt;color:#333;word-break:break-all}.hint{font-size:11pt;color:#777}
.print{position:fixed;top:12px;right:12px;padding:10px 16px;border-radius:10px;border:1px solid #ddd;background:#111;color:#fff;font:inherit;cursor:pointer}@media print{.print{display:none}}</style></head>
<body><button class="print" onclick="print()">Print</button><div class="sheet"><div class="name">${escapeHtml(b.name||meta.name)}</div><h1>${escapeHtml(p.headline||'Scan to visit us')}</h1>${p.line?'<p class="line">'+escapeHtml(p.line)+'</p>':''}<div class="qr">${qr}</div><div class="url">${escapeHtml(url.replace(/^https?:\/\//,''))}</div><div class="hint">Point your phone camera at the code</div></div></body></html>`;
}
module.exports={write,poster,liveUrl};
