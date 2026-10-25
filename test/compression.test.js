"use strict";
// Published apps and previews are sent compressed (brotli or gzip) when the browser accepts it.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),zlib=require('zlib');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-zip-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),hosting=require('../react-hosting');
function get(port,p,enc){return new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path:p,headers:enc?{'Accept-Encoding':enc}:{}},r=>{const c=[];r.on('data',d=>c.push(d));r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body:Buffer.concat(c)}))}).on('error',reject)})}

test('built files and published pages are compressed, and come back identical',async()=>{
 const meta=builder.create({name:'Zip',owner:'owner'});
 await builder.initializeFrom(meta,{'src/main.jsx':"import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",'src/App.jsx':'export default function App(){return <h1>'+'Zip '.repeat(400)+'</h1>}\n'},'Start');
 hosting.publish(meta.id,{slug:'zip-test'});
 const server=http.createServer((req,res)=>{if(!hosting.handlePath(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 try{
  const html=(await get(port,'/sites/zip-test/')).body.toString();
  // Asset links are absolute on published pages (real page addresses); older builds used "./assets/".
  const src=/src="([^"]*assets\/[^"]+\.js)"/.exec(html)[1],js=src.startsWith('/')?src:'/sites/zip-test/'+src.replace(/^\.?\//,'');
  const plain=await get(port,js);
  assert.equal(plain.status,200);assert.equal(plain.headers['content-encoding'],undefined);
  const br=await get(port,js,'gzip, deflate, br');
  assert.equal(br.headers['content-encoding'],'br');assert.equal(br.headers.vary,'Accept-Encoding');
  assert.ok(br.body.length<plain.body.length/2,br.body.length+' vs '+plain.body.length);
  assert.deepEqual(zlib.brotliDecompressSync(br.body),plain.body);
  const gz=await get(port,js,'gzip');
  assert.equal(gz.headers['content-encoding'],'gzip');assert.deepEqual(zlib.gunzipSync(gz.body),plain.body);
  assert.equal((await get(port,js+'.kq.br')).status,404,'the stored compressed copy is not served by name');
  const sitemap=await get(port,'/sites/zip-test/sitemap.xml','gzip');
  assert.equal(sitemap.status,200);
 }finally{server.close()}
});
