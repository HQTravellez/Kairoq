"use strict";
// Watches on an RSS or Atom feed (a competitor's news, a supplier's offers, a council's
// notices, a blog): the feed is the site's own published list of what is new, so it is read
// directly, with no browser, no AI and no credits, and the owner hears about new items only.
// The idea of reading feeds as a first-class channel comes from Agent-Reach (MIT); this is
// Kairoq's own small reader. Fetches go through the same guard as server functions (public
// addresses only).
const MAX_ITEMS=50,MAX_SEEN=300;
function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
const ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
function decode(s){
 return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1))):ENTITIES[e.toLowerCase()]??m)
  .replace(/<[^>]+>/g,' ');
}
function tag(block,name){const m=new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i').exec(block);return m?clip(decode(m[1]),400):''}
function isFeed(body,type=''){
 const head=String(body||'').slice(0,2000).replace(/^﻿/,'').trim();
 return /(rss|atom|xml)/i.test(type)&&/<(rss|feed|rdf:RDF)\b/i.test(head)||/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)\b/i.test(head);
}
// The items of an RSS 2.0, RSS 1.0 (RDF) or Atom feed, newest first as published.
function parse(xml){
 const text=String(xml||'');
 const blocks=[...text.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map(m=>m[0]).slice(0,MAX_ITEMS);
 const title=tag(text.replace(/<(item|entry)\b[\s\S]*?<\/\1>/gi,''),'title');
 const items=blocks.map(b=>{
  const atomLink=/<link\b[^>]*\brel=["']?alternate["']?[^>]*\bhref=["']([^"']+)["']/i.exec(b)||/<link\b[^>]*\bhref=["']([^"']+)["']/i.exec(b);
  const link=tag(b,'link')||(atomLink?decode(atomLink[1]).trim():'');
  const id=tag(b,'guid')||tag(b,'id')||link||tag(b,'title');
  return{id:clip(id,300),title:tag(b,'title')||'(untitled)',link:/^https?:\/\//.test(link)?clip(link,500):'',date:tag(b,'pubDate')||tag(b,'updated')||tag(b,'published')||tag(b,'dc:date'),summary:clip(tag(b,'description')||tag(b,'summary')||tag(b,'content'),300)};
 }).filter(i=>i.id);
 return{title,items};
}
function answerOf(feed,limit=10){
 return (feed.title?'Latest from '+feed.title+':\n':'')+feed.items.slice(0,limit).map(i=>'- '+i.title+(i.date?' ('+i.date+')':'')+(i.link?'\n  '+i.link:'')).join('\n');
}
async function fetchFeed(url,{fetchImpl}={}){
 const r=fetchImpl?await fetchImpl(url):await require('./react-functions').guardedFetch({url,headers:{Accept:'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8','User-Agent':'KairoqFeedWatch/1.0 (+https://kairoq.app)'}});
 if(!(r.status>=200&&r.status<300))throw Object.assign(Error('The feed answered '+r.status),{status:502});
 const type=(r.headers&&(r.headers['content-type']||r.headers.get?.('content-type')))||'';
 if(!isFeed(r.body,type))return null;
 return parse(r.body);
}
// Compares the feed with what the watch saw before. First look: remembers, reports nothing new.
function diff(feed,seen=[]){
 const known=new Set(seen),fresh=feed.items.filter(i=>!known.has(i.id));
 const nextSeen=[...new Set([...feed.items.map(i=>i.id),...seen])].slice(0,MAX_SEEN);
 return{fresh:seen.length?fresh:[],seen:nextSeen,first:!seen.length};
}
module.exports={isFeed,parse,answerOf,fetchFeed,diff};
