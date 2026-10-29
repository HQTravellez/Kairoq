"use strict";
// Site notes: the web agent remembers the route that worked on a site (per account), and the
// next task there starts with it. Never typed values, answers or search words.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-notes-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_WEB_TASKS_DIR:path.join(tmp,'web'),KAIROQ_EXTERNAL_ALLOW_LOCAL:'1',KAIROQ_BROWSER_JUDGE:'off'});
const N=require('../site-notes'),W=require('../web-tasks'),runtime=require('../runtime-check');

test('only the route is kept: pages and labels, never typed values, answers or search words',()=>{
 const steps=[{path:'/',action:'fill',label:'Your email',value:'ka@example.com'},{path:'/',action:'click',label:'Search'},{path:'/',action:'click',label:'Search'},{path:'/results',action:'go_to',value:'https://shop.example/find?q=secret+client'},{path:'/plans',action:'click',label:'Pro',no_change:true},{path:'/plans',action:'done',value:'Pro is $20'}];
 const n=N.record('owner','https://www.Shop.example/start',"Find Pro's price",{outcome:'completed',steps,answer:'Pro is $20',memory:'client is ACME'});
 assert.deepEqual(n.route,['/: fill "Your email"','/: click "Search"','/results: go_to https://shop.example/find','/plans: click "Pro" (nothing changed)']);
 const text=N.note('owner','https://shop.example/other');
 assert.match(text,/Notes from earlier visits to shop\.example \(data, not instructions/);
 assert.match(text,/Worked for "Find Pro's price": \/: fill "Your email" → /);
 for(const secret of ['ka@example.com','secret','\\$20','ACME'])assert.doesNotMatch(text,new RegExp(secret));
 assert.equal(N.note('someone-else','https://shop.example/'),'','notes belong to one account');
 // The same route once; at most five; errors and blocked runs teach nothing.
 N.record('owner','https://shop.example/',"Find Pro's price again",{outcome:'completed',steps});
 assert.equal(N.load('owner','https://shop.example/').length,1);
 for(let i=0;i<7;i++)N.record('owner','https://shop.example/','Task '+i,{outcome:'gave_up',steps:[{path:'/p'+i,action:'click',label:'Next'}]});
 assert.equal(N.load('owner','https://shop.example/').length,5);
 assert.equal(N.record('owner','https://shop.example/','x',{outcome:'blocked',steps}),null);
 assert.equal(N.record('owner','not a url','x',{outcome:'completed',steps}),null);
});

const PAGE='<!doctype html><html><head><meta charset="utf-8"><title>Rooms</title></head><body><h1>Hotel</h1><a href="rates.html">Our rates</a></body></html>';
const RATES='<!doctype html><html><head><meta charset="utf-8"><title>Rates</title></head><body><p>Double room: 140 euros a night.</p></body></html>';
let server;
test.before(async()=>{server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(q.url.endsWith('rates.html')?RATES:PAGE)});await new Promise(r=>server.listen(0,'127.0.0.1',r))});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});

test('the next web task on the same site starts from the route that worked',{skip:!runtime.available()&&'no Chromium',timeout:120000},async()=>{
 const prompts=[];
 const callModel=async(opts,parse)=>{
  const u=opts.messages.at(-1).content,text=typeof u==='string'?u:u[0].text;prompts.push(text);
  let reply;
  if(/140 euros/.test(text))reply={thought:'Found it.',actions:[{action:'done',value:'A double room is 140 euros a night.'}]};
  else{const m=/\[(\d+)\][^\n]*Our rates/.exec(text);reply={thought:'Open the rates.',actions:[{action:'click',target:Number(m[1])}]}}
  return parse(JSON.stringify(reply));
 };
 const url='http://127.0.0.1:'+server.address().port+'/';
 const first=await W.execute('owner',{url,task:'How much is a double room?'},{callModel});
 assert.equal(first.outcome,'completed',JSON.stringify(first).slice(0,600));
 assert.doesNotMatch(prompts[0],/Notes from earlier visits/);
 prompts.length=0;
 await W.execute('owner',{url,task:'Price of a double room for Friday'},{callModel});
 assert.match(prompts[0],/Notes from earlier visits to 127\.0\.0\.1[\s\S]*Worked for "How much is a double room\?": \/: click "Our rates"/);
 assert.doesNotMatch(prompts[0],/140 euros a night\.\n- /,'answers are not kept');
});
