"use strict";
// Photo links in an app that do not exist. The builder often uses photos from other sites
// (https://images.unsplash.com/...) and can get an address wrong; the browser check does not see
// it (photos further down load late, and other sites' failures are not reported as errors). After
// each build Kairoq asks those sites for every photo address in the code, and an address they say
// does not exist (404 or 410) goes back to the builder like any other problem.
const MAX_LINKS=40,DAY=24*3600000,cache=new Map();
const LINK=/https:\/\/(?:images\.unsplash\.com|images\.pexels\.com|cdn\.pixabay\.com)\/[^\s"'`)\\]+|https:\/\/[^\s"'`)\\]+\.(?:jpe?g|png|webp|avif|gif)(?:\?[^\s"'`)\\]*)?/gi;
// The photo addresses in the app's own source, with the first file each one is in.
function links(files){
 const out=new Map();
 for(const [name,code] of Object.entries(files||{})){
  if(!/^(src|index\.html)/.test(name)||typeof code!=='string'||name.startsWith('src/components/ui/'))continue;
  for(const m of code.matchAll(LINK)){const u=m[0].replace(/&amp;/g,'&');if(!out.has(u))out.set(u,name)}
 }
 return[...out].slice(0,MAX_LINKS).map(([url,file])=>({url,file}));
}
// HTTP status for one address (cached for a day); null when the site could not be asked.
async function status(url,fetchUrl){
 const hit=cache.get(url);if(hit&&Date.now()-hit.at<DAY)return hit.status;
 let s=null;
 try{s=(await fetchUrl({url,method:'HEAD'})).status;if(s===405||s===403)s=(await fetchUrl({url,method:'GET',headers:{Range:'bytes=0-0'}})).status}catch{s=null}
 if(s!==null){cache.set(url,{status:s,at:Date.now()});if(cache.size>5000)cache.delete(cache.keys().next().value)}
 return s;
}
// Problems for the builder: addresses that do not exist. Sites that cannot be reached count as fine.
async function broken(files,{fetchUrl=require('./react-functions').guardedFetch}={}){
 const list=links(files),out=[];
 for(let i=0;i<list.length;i+=6){
  const part=await Promise.all(list.slice(i,i+6).map(async l=>({...l,status:await status(l.url,fetchUrl)})));
  for(const l of part)if(l.status===404||l.status===410)out.push('A photo address in '+l.file+' does not exist (HTTP '+l.status+'): '+l.url+'. Use another real photo address, or remove the image.');
 }
 return out;
}
module.exports={links,broken,status,_cache:cache};
