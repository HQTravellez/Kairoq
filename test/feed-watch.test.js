"use strict";
// Watches on RSS and Atom feeds (feed-watch.js, web-tasks.feedCheck): read directly, no browser
// or credits; the owner is told about new items only; a page that is not a feed is left to the
// browser agent.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-feeds-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_WEB_TASKS_DIR=path.join(tmp,'web-tasks');
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const feeds=require('../feed-watch'),web=require('../web-tasks');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

const RSS=items=>`<?xml version="1.0"?><rss version="2.0"><channel><title>Rival Bakery &amp; Co</title>${items.map(([id,t])=>`<item><title><![CDATA[${t}]]></title><link>https://rival.example/${id}</link><guid>${id}</guid><pubDate>Tue, 20 Oct 2026 08:00:00 GMT</pubDate><description>&lt;p&gt;Fresh ${t}&lt;/p&gt;</description></item>`).join('')}</channel></rss>`;
const ATOM='<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Council notices</title><entry><title>Road works on Main St</title><link rel="alternate" href="https://council.example/n/1"/><id>tag:council,1</id><updated>2026-10-19T10:00:00Z</updated><summary>From Monday</summary></entry></feed>';

test('RSS and Atom feeds are read; a web page is not mistaken for one',()=>{
 const r=feeds.parse(RSS([['a1','Autumn menu'],['a2','New sourdough']]));
 assert.equal(r.title,'Rival Bakery & Co');
 assert.deepEqual(r.items.map(i=>[i.id,i.title,i.link]),[['a1','Autumn menu','https://rival.example/a1'],['a2','New sourdough','https://rival.example/a2']]);
 assert.equal(r.items[0].summary,'Fresh Autumn menu');
 const a=feeds.parse(ATOM);assert.equal(a.items[0].link,'https://council.example/n/1');assert.equal(a.items[0].id,'tag:council,1');
 assert.ok(feeds.isFeed(RSS([]),'application/rss+xml'));assert.ok(feeds.isFeed(ATOM,''));
 assert.ok(!feeds.isFeed('<!doctype html><html><body><rss>no</rss></body></html>','text/html'));
});

test('a feed watch reports only new items, without a browser or credits, and a page falls back to the browser',async()=>{
 const owner='feed-owner@example.com';
 const w=web.addWatch(owner,{url:'https://rival.example/feed.xml',task:'New posts from the rival bakery',every:'day'});
 let items=[['a1','Autumn menu'],['a2','New sourdough']];
 const fetchImpl=async()=>({status:200,headers:{'content-type':'application/rss+xml'},body:RSS(items)});
 const first=await web.feedCheck(owner,w.id,{fetchImpl});
 assert.equal(first.changed,false,'the first look only remembers');
 assert.match(first.run.answer,/Latest from Rival Bakery & Co:\n- Autumn menu/);
 items=[['a3','Pumpkin buns'],...items];
 const second=await web.feedCheck(owner,w.id,{fetchImpl});
 assert.equal(second.changed,true);assert.match(second.run.change,/^1 new: Pumpkin buns/);
 assert.equal((await web.feedCheck(owner,w.id,{fetchImpl})).changed,false,'nothing new, nothing sent');
 const watch=web.list(owner).watches.find(x=>x.id===w.id);assert.equal(watch.feed,true);
 // A normal page: the watch is marked, and the browser agent checks it from then on.
 const page=web.addWatch(owner,{url:'https://rival.example/prices',task:'Price of a sourdough loaf',every:'week'});
 assert.equal(await web.feedCheck(owner,page.id,{fetchImpl:async()=>({status:200,headers:{'content-type':'text/html'},body:'<!doctype html><h1>Prices</h1>'})}),null);
 assert.equal(web.list(owner).watches.find(x=>x.id===page.id).feed,false);
 assert.equal(await web.feedCheck(owner,page.id,{fetchImpl:async()=>{throw Error('must not fetch again')}}),null);
});
