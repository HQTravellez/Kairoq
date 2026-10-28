'use strict';
// Kairoq → Figma (figma-export.js, figma-plugin/): the page captured as layers, a short code, and
// the plugin that rebuilds it in Figma (run here against a stand-in for Figma's plugin API).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),vm=require('vm');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-figma-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'p'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const builder=require('../react-builder'),design=require('../react-design'),fx=require('../figma-export'),runtime=require('../runtime-check');
test.after(()=>runtime.close());

// A stand-in for Figma's plugin API: records what the plugin creates.
function fakeFigma(){
 const made=[],fonts=[];
 const node=type=>{const n={type,children:[],x:0,y:0,width:0,height:0,resize(w,h){this.width=w;this.height=h},rescale(k){this.width*=k;this.height*=k},appendChild(c){this.children.push(c)}};made.push(n);return n};
 let onmessage=null;const posted=[];
 const figma={showUI(){},ui:{postMessage:m=>posted.push(m),set onmessage(f){onmessage=f},get onmessage(){return onmessage}},
  createFrame:()=>node('FRAME'),createRectangle:()=>node('RECTANGLE'),createText:()=>node('TEXT'),createNodeFromSvg:svg=>{const n=node('VECTOR');n.width=24;n.height=24;n.svg=svg;return n},
  createImage:bytes=>({hash:'h'+bytes.length}),base64Decode:b=>Buffer.from(b,'base64'),
  loadFontAsync:async f=>{if(!/^(Inter|Archivo)$/.test(f.family)||!/^(Regular|Medium|Semi Bold|Bold)$/.test(f.style))throw Error('no font');fonts.push(f.family+' '+f.style)},
  viewport:{center:{x:0,y:0},scrollAndZoomIntoView(){}},currentPage:{selection:[]}};
 const ctx=vm.createContext({figma,__html__:'',console,Math,String,Number,Map,JSON,Promise});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','figma-plugin','code.js'),'utf8'),ctx);
 return{figma,made,fonts,posted,send:m=>onmessage(m)};
}

test('the plugin rebuilds a page: frames, boxes, text in its fonts, images and icons',async()=>{
 const f=fakeFigma();
 const png=Buffer.from('89504e470d0a1a0a00','hex').toString('base64');
 await f.send({type:'build',data:{frames:[{name:'Site · Desktop',width:1440,height:900,background:{r:1,g:1,b:1,a:1},nodes:[
  {t:'box',x:0,y:0,w:1440,h:80,fill:{r:.95,g:.95,b:.97,a:1},radius:0,shadow:'rgba(0, 0, 0, 0.1) 0px 1px 2px 0px'},
  {t:'text',x:40,y:20,w:300,h:40,text:'Business travel',font:'Archivo Variable',weight:600,size:40,lineHeight:44,color:{r:0,g:0,b:0,a:1},align:'left'},
  {t:'text',x:40,y:70,w:300,h:20,text:'sample',font:'Fancy Serif',weight:400,size:16,color:{r:.2,g:.2,b:.2,a:1},align:'center',transform:'uppercase'},
  {t:'image',x:40,y:120,w:200,h:100,data:png,fit:'cover'},
  {t:'svg',x:400,y:20,w:48,h:48,svg:'<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>'}]}]}});
 const plain=v=>JSON.parse(JSON.stringify(v));
 assert.deepEqual(plain(f.posted.at(-1)),{type:'done',layers:5});
 const frame=f.made.find(n=>n.type==='FRAME');assert.equal(frame.width,1440);assert.equal(frame.children.length,5);
 const [title,sample]=f.made.filter(n=>n.type==='TEXT');
 assert.deepEqual(plain(title.fontName),{family:'Archivo',style:'Semi Bold'},'"Archivo Variable" becomes the Figma font Archivo');
 assert.deepEqual(plain(sample.fontName),{family:'Inter',style:'Regular'},'a missing font falls back to Inter');
 assert.equal(sample.characters,'SAMPLE');assert.equal(sample.textAlignHorizontal,'CENTER');
 assert.equal(f.made.find(n=>n.name==='Image').fills[0].type,'IMAGE');
 assert.equal(f.made.find(n=>n.type==='VECTOR').width,48);
 assert.equal(f.made.find(n=>n.type==='RECTANGLE').effects[0].type,'DROP_SHADOW');
});

test('a real page captured as layers, sent with a code, and rebuilt by the plugin',{timeout:240000},async(t)=>{
 if(!runtime.available()){t.diagnostic('no browser here');return}
 const meta=builder.create({name:'Travellez',owner:'owner'});
 await builder.initializeFrom(meta,{...design.starterFiles('Travellez'),'src/App.jsx':fs.readFileSync(path.join(__dirname,'fixtures','show-it-working-app.jsx'),'utf8')},'Sample');
 const server=http.createServer((req,res)=>{if(!builder.handlePreview(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const out=await fx.create(meta.id,{capture:(u,o)=>runtime.captureLayout(base+u,o),fetchRemote:async()=>null});
  assert.match(out.code,/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.deepEqual(out.frames.map(f=>f.name),['Travellez (desktop)','Travellez (phone)']);
  const data=fx.take(out.code.toLowerCase().replace('-',''));
  const desk=data.frames[0],texts=desk.nodes.filter(n=>n.t==='text').map(n=>n.text);
  assert.ok(texts.some(x=>/Business travel/.test(x)),'the headline is a text layer');
  assert.ok(texts.includes('Search trips'));
  assert.ok(desk.nodes.some(n=>n.t==='box'&&n.fill),'boxes with their colours');
  assert.equal(desk.width,1440);
  const f=fakeFigma();await f.send({type:'build',data});
  assert.equal(f.posted.at(-1).type,'done');assert.ok(f.posted.at(-1).layers>20,'layers: '+f.posted.at(-1).layers);
  assert.throws(()=>fx.take('ZZZZ-ZZZZ'),/not valid or has expired/);
 }finally{server.close()}
});

test('the plugin download points at this Kairoq, and the code route answers Figma',async()=>{
 const files=fx.pluginFiles('https://kairoq.example');
 const manifest=JSON.parse(files['Kairoq for Figma/manifest.json']);
 assert.deepEqual(manifest.networkAccess.allowedDomains,['https://kairoq.example']);
 assert.match(files['Kairoq for Figma/ui.html'],/const ORIGIN='https:\/\/kairoq\.example'/);
 const createApi=require('../create-api');
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const get=(p,method='GET')=>new Promise((resolve,reject)=>{const q=http.request({host:'127.0.0.1',port:server.address().port,method,path:p},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(c)}))});q.on('error',reject);q.end()});
 try{
  const pre=await get('/api/create/figma/ABCD-2345','OPTIONS');assert.equal(pre.status,204);assert.equal(pre.headers['access-control-allow-origin'],'*');
  const bad=await get('/api/create/figma/ABCD-2345');assert.equal(bad.status,404);assert.match(String(bad.body),/expired/);
  const zip=await get('/api/create/figma-plugin.zip');assert.equal(zip.status,200);assert.equal(zip.body.subarray(0,2).toString(),'PK');
 }finally{server.close()}
});
