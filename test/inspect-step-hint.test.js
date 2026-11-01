'use strict';
// When a browser test step misses (runtime-check.js inspect), the error says what is on the page:
// the visible fields and buttons, so the agent's next attempt is right first time instead of
// guessing for rounds.
const test=require('node:test'),assert=require('node:assert/strict'),http=require('http');
const runtime=require('../runtime-check');

test('a missed fill or click lists the fields and buttons on the page',{timeout:60000},async(t)=>{
 if(!runtime.available()){t.diagnostic('no browser here');return}
 const html='<!doctype html><html><body><div id="root"><h1>Sign up</h1><form><label for="n">Full name *</label><input id="n"><label>Email address<input type="email" name="email"></label><input placeholder="Dog\'s name"><input type="hidden" name="t"><button type="button">Create account</button><a href="#signin">Sign in instead</a></form></div></body></html>';
 const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/';
  const r=await runtime.inspect(url,{screenshot:false,steps:[{action:'fill',label:'Your name',value:'Maya'},{action:'click',text:'Sign up now'},{action:'fill',label:'Full name',value:'Maya'}]});
  assert.equal(r.steps.length,3);
  assert.equal(r.steps[0].ok,false);
  assert.match(r.steps[0].error,/On the page now, fields: Full name \* \(#n\); Email address; Dog's name \(placeholder "Dog's name"\)\./);
  assert.match(r.steps[0].error,/Buttons and links: Create account \| Sign in instead\./);
  assert.ok(!/hidden|\bt\b \(/.test(r.steps[0].error),'hidden inputs are not listed');
  assert.equal(r.steps[1].ok,false);assert.match(r.steps[1].error,/Buttons and links/);
  assert.equal(r.steps[2].ok,true,r.steps[2].error);
 }finally{server.close();await runtime.close()}
});
