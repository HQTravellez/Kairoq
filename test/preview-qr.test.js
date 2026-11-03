'use strict';
// Open on your phone: the preview bar has a QR button; GET /previewqr returns a QR code (SVG) for
// this project's preview address, which carries its unguessable preview key.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-pqr-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'p'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const builder=require('../react-builder'),api=require('../create-api');

test('GET /previewqr returns a QR code for the preview',async()=>{
 const meta=builder.create({name:'Yoga',owner:'owner'});await builder.initialize(meta);
 const server=http.createServer(async(req,res)=>{if(!(await api.handle(req,res,{isOwner:()=>true,secure:false,callModel:async()=>({})}))){res.statusCode=404;res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/create/projects/'+meta.id+'/previewqr');
  assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/svg\+xml/);
  const svg=await r.text();assert.match(svg,/^<svg/);assert.ok(svg.length>1000,'a real QR code');
 }finally{server.close()}
});

test('the preview bar has an Open on your phone button with the QR popover',()=>{
 const js=fs.readFileSync(path.join(__dirname,'..','public','create.js'),'utf8');
 assert.match(js,/el\('button','pv-btn pv-qr'\)/);
 assert.match(js,/'\/api\/create\/projects\/'\+p\.id\+'\/previewqr/);
 assert.match(js,/Open on your phone/);
 const api=fs.readFileSync(path.join(__dirname,'..','create-api.js'),'utf8');
 assert.match(api,/'GET:\/previewqr':'viewer'/);
});
