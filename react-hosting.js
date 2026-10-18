"use strict";
// Publishing for chat-built React projects: one-click publish to /sites/<slug>/,
// optional <slug>.<KAIROQ_SITES_DOMAIN> subdomains, and verified custom domains.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),dns=require('dns').promises;
const builder=require('./react-builder');

const RESERVED=new Set(['www','api','app','admin','mail','kairoq','builder','sites','static','assets','login','signup']);
function registryFile(){return path.join(builder.ROOT(),'hosting.json')}
function readRegistry(){try{const r=JSON.parse(fs.readFileSync(registryFile(),'utf8'));return{slugs:r.slugs||{},domains:r.domains||{}}}catch{return{slugs:{},domains:{}}}}
function writeRegistry(r){fs.mkdirSync(path.dirname(registryFile()),{recursive:true});const tmp=registryFile()+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(r,null,1));fs.renameSync(tmp,registryFile())}

function mainHost(env=process.env){
 const raw=env.KAIROQ_PUBLIC_URL||(env.RAILWAY_PUBLIC_DOMAIN?'https://'+env.RAILWAY_PUBLIC_DOMAIN:'');
 try{return raw?new URL(raw).hostname.toLowerCase():''}catch{return''}
}
function sitesDomain(env=process.env){return String(env.KAIROQ_SITES_DOMAIN||'').trim().toLowerCase().replace(/^\.+|\.+$/g,'')}
function normalizeSlug(value){
 const slug=String(value||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
 if(slug.length<3)throw Object.assign(Error('The site name needs at least 3 letters or numbers'),{status:400});
 if(RESERVED.has(slug))throw Object.assign(Error('That site name is reserved'),{status:400});
 return slug;
}
function normalizeHost(value){
 const host=String(value||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/\.$/,'');
 if(!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))throw Object.assign(Error('Enter a domain like www.example.com'),{status:400});
 const main=mainHost(),sites=sitesDomain();
 if(host===main||(sites&&(host===sites||host.endsWith('.'+sites))))throw Object.assign(Error('That domain belongs to Kairoq itself'),{status:400});
 return host;
}

function siteUrls(meta){
 if(!meta.published)return null;
 const sites=sitesDomain(),base=(process.env.KAIROQ_PUBLIC_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'')).replace(/\/$/,'');
 return{path:base+'/sites/'+meta.published.slug+'/',subdomain:sites?'https://'+meta.published.slug+'.'+sites+'/':null,domains:(meta.domains||[]).filter(d=>d.verified).map(d=>'https://'+d.hostname+'/')};
}

function publish(id,{slug,version}={}){
 const meta=builder.loadMeta(id);
 const n=Number(version||meta.current_version);
 if(!meta.versions.some(v=>v.n===n))throw Object.assign(Error('Build the app before publishing'),{status:409});
 const wanted=normalizeSlug(slug||meta.published?.slug||meta.name);
 const registry=readRegistry();
 if(registry.slugs[wanted]&&registry.slugs[wanted]!==id)throw Object.assign(Error('That site name is taken. Try another.'),{status:409});
 if(meta.published?.slug&&meta.published.slug!==wanted&&registry.slugs[meta.published.slug]===id)delete registry.slugs[meta.published.slug];
 registry.slugs[wanted]=id;
 writeRegistry(registry);
 const history=(meta.published?.history||[]).concat({version:n,at:new Date().toISOString()}).slice(-50);
 meta.published={slug:wanted,version:n,at:new Date().toISOString(),history};
 builder.saveMeta(meta);
 return{published:meta.published,urls:siteUrls(meta)};
}
function unpublish(id){
 const meta=builder.loadMeta(id),registry=readRegistry();
 if(meta.published&&registry.slugs[meta.published.slug]===id)delete registry.slugs[meta.published.slug];
 for(const d of meta.domains||[])if(registry.domains[d.hostname]===id)delete registry.domains[d.hostname];
 writeRegistry(registry);
 meta.published=null;meta.domains=(meta.domains||[]).map(d=>({...d,verified:false}));
 builder.saveMeta(meta);
 return{published:null};
}

function dnsInstructions(hostname,token,entry){
 const txt={type:'TXT',name:'_kairoq.'+hostname,value:'kairoq-verify='+token,note:'Proves you own the domain.'};
 // Railway's own records (when the domain was registered through its API) replace the generic CNAME.
 if(entry&&entry.railway&&entry.railway.dns&&entry.railway.dns.length)return[...entry.railway.dns.map(r=>({type:r.type,name:r.name,value:r.value,note:'Routes your domain to Kairoq and lets Railway issue the HTTPS certificate.'})),txt];
 const target=sitesDomain()?'sites.'+sitesDomain():mainHost()||'your Kairoq domain';
 return[
  {type:'CNAME',name:hostname,value:target,note:'Points your domain at Kairoq. For a root domain (example.com) use your DNS provider\'s ALIAS/ANAME or flattened CNAME.'},
  {type:'TXT',name:'_kairoq.'+hostname,value:'kairoq-verify='+token,note:'Proves you own the domain.'}
 ];
}
async function addDomain(id,hostname,{railway=require('./react-railway')}={}){
 const meta=builder.loadMeta(id),host=normalizeHost(hostname);
 const registry=readRegistry();
 if(registry.domains[host]&&registry.domains[host]!==id)throw Object.assign(Error('That domain is connected to another project'),{status:409});
 meta.domains=meta.domains||[];
 let entry=meta.domains.find(d=>d.hostname===host);
 if(!entry){if(meta.domains.length>=5)throw Object.assign(Error('A project can have up to 5 domains'),{status:400});entry={hostname:host,token:crypto.randomBytes(12).toString('hex'),verified:false,added_at:new Date().toISOString()};meta.domains.push(entry)}
 if(railway.configured()&&!entry.railway){
  try{entry.railway=await railway.addDomain(host);delete entry.railway_error}
  catch(e){entry.railway_error=String(e.message||e).slice(0,300)}
 }
 builder.saveMeta(meta);
 return{domain:entry,dns:dnsInstructions(host,entry.token,entry)};
}
async function verifyDomain(id,hostname,{resolveTxt=dns.resolveTxt}={}){
 const meta=builder.loadMeta(id),host=normalizeHost(hostname);
 const entry=(meta.domains||[]).find(d=>d.hostname===host);
 if(!entry)throw Object.assign(Error('Add the domain first'),{status:404});
 if(!meta.published)throw Object.assign(Error('Publish the app before connecting a domain'),{status:409});
 let records=[];
 try{records=(await resolveTxt('_kairoq.'+host)).map(parts=>parts.join(''))}catch{}
 if(!records.includes('kairoq-verify='+entry.token))return{verified:false,domain:entry,dns:dnsInstructions(host,entry.token,entry),error:'The TXT record was not found yet. DNS changes can take a few minutes to an hour.'};
 const registry=readRegistry();
 if(registry.domains[host]&&registry.domains[host]!==id)throw Object.assign(Error('That domain is connected to another project'),{status:409});
 registry.domains[host]=id;writeRegistry(registry);
 entry.verified=true;entry.verified_at=new Date().toISOString();
 builder.saveMeta(meta);
 return{verified:true,domain:entry,urls:siteUrls(meta)};
}
async function removeDomain(id,hostname,{railway=require('./react-railway')}={}){
 const meta=builder.loadMeta(id),host=normalizeHost(hostname),registry=readRegistry();
 const entry=(meta.domains||[]).find(d=>d.hostname===host);
 if(entry&&entry.railway&&entry.railway.id&&railway.configured()){try{await railway.removeDomain(entry.railway.id)}catch(e){console.warn('[railway] remove domain',host,e.message)}}
 if(registry.domains[host]===id){delete registry.domains[host];writeRegistry(registry)}
 meta.domains=(meta.domains||[]).filter(d=>d.hostname!==host);
 builder.saveMeta(meta);
 return{removed:host};
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function siteBase(req,basePath){
 const host=String(req.headers.host||'localhost');
 const proto=String(req.headers['x-forwarded-proto']||'').split(',')[0]||(/^(localhost|127\.|\[::1\])/.test(host)?'http':'https');
 return proto+'://'+host+basePath;
}
// Adds title, description, canonical and social share tags to the published page.
function withSeo(html,meta,base){
 const seo=meta.seo||{},title=seo.title||meta.name,desc=seo.description||'';
 const ogFile=path.join(builder.projectDir(meta.id),'og.png');
 const image=seo.image?new URL(seo.image,base).toString():fs.existsSync(ogFile)?base+'og-image.png':'';
 const tags=['<link rel="canonical" href="'+escapeHtml(base)+'">','<meta property="og:type" content="website">','<meta property="og:title" content="'+escapeHtml(title)+'">','<meta property="og:url" content="'+escapeHtml(base)+'">',
  ...(desc?['<meta name="description" content="'+escapeHtml(desc)+'">','<meta property="og:description" content="'+escapeHtml(desc)+'">']:[]),
  ...(image?['<meta property="og:image" content="'+escapeHtml(image)+'">','<meta name="twitter:card" content="summary_large_image">']:['<meta name="twitter:card" content="summary">'])];
 return html.replace(/<title>[\s\S]*?<\/title>/,()=>'<title>'+escapeHtml(title)+'</title>').replace('</head>',()=>'    '+tags.join('\n    ')+'\n  </head>');
}
// Installable app: manifest, icons and service worker tags (react-mobile.js).
function withPwa(html,meta){
 const mobile=require('./react-mobile');
 let out=html.replace('</head>',()=>'    '+mobile.headTags(meta).join('\n    ')+'\n  </head>');
 if(mobile.settings(meta).enabled)out=out.replace(/<meta name="viewport" content="([^"]*)"/,(m,c)=>/viewport-fit/.test(c)?m:'<meta name="viewport" content="'+c+', viewport-fit=cover"');
 return out;
}
function serveProject(req,res,id,rest,sandbox,basePath='/'){
 let meta;try{meta=builder.loadMeta(id)}catch{return false}
 if(!meta.published)return false;
 // Monthly hosting not paid after the grace period: a short "paused" page instead of the site.
 if(require('./hosting-billing').paused(meta)){require('./hosting-billing').pausedPage(res);return true}
 const dist=path.join(builder.versionDir(id,meta.published.version),'dist');
 let decoded;try{decoded=decodeURIComponent(String(rest||'/').split('?')[0])}catch{res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end('Bad request');return true}
 const rel=decoded.replace(/^\/+/,'');
 const base=siteBase(req,basePath);
 const text=(type,body)=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body)};
 if(require('./react-mobile').serveSiteFile(req,res,meta,rel))return true;
 if(rel==='robots.txt')return text('text/plain; charset=utf-8','User-agent: *\nAllow: /\nSitemap: '+base+'sitemap.xml\n'),true;
 if(rel==='sitemap.xml')return text('application/xml; charset=utf-8','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+escapeHtml(base)+'</loc><lastmod>'+meta.published.at.slice(0,10)+'</lastmod></url></urlset>\n'),true;
 if(rel==='og-image.png'){const f=path.join(builder.projectDir(id),'og.png');if(fs.existsSync(f)){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(f));return true}}
 const page=(req.method==='GET'||req.method==='HEAD')&&(!path.extname(rel)||rel.endsWith('.html'));
 if(page&&fs.existsSync(path.join(dist,'index.html'))&&(!rel||rel==='index.html'||!fs.existsSync(path.join(dist,rel)))){
  require('./react-analytics').record(id,req);
  const html=withPwa(withSeo(fs.readFileSync(path.join(dist,'index.html'),'utf8'),meta,base),meta);
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':builder.contentPolicy(sandbox)});
  res.end(req.method==='HEAD'?undefined:html);
  return true;
 }
 builder.serveDist(req,res,dist,rest,{sandbox});
 return true;
}
// Requests for a custom domain or <slug>.<KAIROQ_SITES_DOMAIN>. Returns true when handled.
function handleHost(req,res){
 const host=String(req.headers.host||'').toLowerCase().replace(/:\d+$/,'');
 if(!host||host===mainHost()||host==='localhost'||/^[\d.]+$/.test(host))return false;
 const registry=readRegistry(),sites=sitesDomain();
 let id=registry.domains[host];
 if(!id&&sites&&host.endsWith('.'+sites)){const slug=host.slice(0,-sites.length-1);if(/^[a-z0-9-]+$/.test(slug))id=registry.slugs[slug]}
 if(!id)return false;
 if(String(req.url||'').startsWith('/api/apps/'))return'backend:'+id;
 // Separate origin from Kairoq, so no sandbox is needed and storage works normally.
 if(!serveProject(req,res,id,String(req.url||'/').split('?')[0],false,'/')){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Site not found')}
 return true;
}
// /sites/<slug>/... on the main Kairoq host (sandboxed: same origin as the Kairoq API).
function handlePath(req,res){
 const m=/^\/sites\/([a-z0-9-]{3,40})(\/.*)?$/.exec(String(req.url||'').split('?')[0]);
 if(!m)return false;
 const id=readRegistry().slugs[m[1]];
 if(!id){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Site not found');return true}
 if(!m[2]){res.writeHead(301,{Location:'/sites/'+m[1]+'/'});res.end();return true}
 if(!serveProject(req,res,id,m[2],true,'/sites/'+m[1]+'/')){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Site not found')}
 return true;
}

module.exports={publish,unpublish,addDomain,verifyDomain,removeDomain,handleHost,handlePath,siteUrls,normalizeSlug,normalizeHost,dnsInstructions};
