"use strict";
// 3D in Create: models uploaded or added from Poly Haven become one GLB with a preview picture,
// apps show them with Model3D from 'kairoq/3d', and Blender converts other formats.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-3d-'));
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),M=require('../react-models'),blender=require('../blender');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const noBlender={INPUTS:blender.INPUTS,available:()=>false,run:()=>Promise.reject(Object.assign(Error('Blender is not set up on this server, so this file type cannot be converted. Upload a .glb file instead.'),{status:409}))};

// A tiny valid glTF: one triangle, its .bin and a 1x1 PNG texture, as separate files.
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
function triangle(){
 const bin=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((v,i)=>bin.writeFloatLE(v,i*4));
 const json={asset:{version:'2.0'},scenes:[{nodes:[0]}],scene:0,nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],
  materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}],textures:[{source:0}],images:[{uri:'textures/red.png'}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],buffers:[{uri:'tri.bin',byteLength:36}]};
 return{json,files:{'tri.bin':bin,'textures/red.png':PNG}};
}
function glbParts(glb){
 const jlen=glb.readUInt32LE(12);const json=JSON.parse(glb.subarray(20,20+jlen).toString());
 const blen=glb.length>20+jlen?glb.readUInt32LE(20+jlen):0;return{json,bin:glb.subarray(28+jlen,28+jlen+blen)};
}
async function project(name){const meta=builder.create({name,owner:'owner'});await builder.initialize(meta);return meta}

test('a glTF with separate files is packed into one valid GLB with its texture inside',()=>{
 const {json,files}=triangle();
 const glb=M.packGlb(json,uri=>files[uri]);
 assert.ok(M.isGlb(glb),'GLB header and length');
 assert.equal(glb.length%4,0);
 const {json:doc,bin}=glbParts(glb);
 assert.equal(doc.buffers.length,1);assert.equal(doc.buffers[0].uri,undefined);
 assert.equal(doc.images[0].uri,undefined);assert.equal(doc.images[0].mimeType,'image/png');
 const view=doc.bufferViews[doc.images[0].bufferView];
 assert.ok(bin.subarray(view.byteOffset,view.byteOffset+view.byteLength).equals(PNG),'texture bytes inside the GLB');
 assert.equal(bin.readFloatLE(doc.bufferViews[0].byteOffset+12),1,'mesh data kept');
 assert.throws(()=>M.packGlb(json,()=>null),/missing its \.bin/);
});

test('a .glb upload is kept as it is, listed with its path, told to the builder and removable',async()=>{
 const meta=await project('Chairs');
 const {json,files}=triangle();const glb=M.packGlb(json,uri=>files[uri]);
 const added=await M.upload(meta.id,'Lounge Chair.glb',glb,{blender:noBlender});
 assert.match(added.file,/^lounge-chair-[0-9a-f]{8}\.glb$/);
 assert.equal(added.path,'./models/'+added.file);
 assert.deepEqual(M.read(meta.id,added.file).bytes,glb);
 assert.equal(M.read(meta.id,'../models.json'),null,'only model files can be read');
 const note=M.note(meta.id,builder.loadMeta(meta.id));
 assert.match(note,/import \{ Model3D \} from 'kairoq\/3d'/);
 assert.ok(note.includes(added.path));
 await assert.rejects(M.upload(meta.id,'x.glb',Buffer.from('nope'),{blender:noBlender}),/not a valid \.glb/);
 await assert.rejects(M.upload(meta.id,'x.fbx',Buffer.from('fbx'),{blender:noBlender}),/Blender is not set up/);
 await assert.rejects(M.upload(meta.id,'x.exe',Buffer.from('MZ'),{blender:noBlender}),/Upload a 3D model/);
 // A self-contained .gltf is packed into a GLB; one that needs other files asks for a zip.
 const inline=JSON.parse(JSON.stringify(json));inline.buffers[0].uri='data:application/octet-stream;base64,'+files['tri.bin'].toString('base64');inline.images[0].uri='data:image/png;base64,'+PNG.toString('base64');
 const fromGltf=await M.upload(meta.id,'inline.gltf',Buffer.from(JSON.stringify(inline)),{blender:noBlender});
 assert.match(fromGltf.file,/\.glb$/);
 await assert.rejects(M.upload(meta.id,'tri.gltf',Buffer.from(JSON.stringify(json)),{blender:noBlender}),/Upload a \.zip/);
 assert.equal(M.list(meta.id).length,2);
 assert.equal(M.remove(meta.id,added.file).length,1);
 assert.equal(fs.existsSync(path.join(M.dir(meta.id),added.file)),false);
});

test('Poly Haven models are downloaded, packed into one GLB and get the Poly Haven picture',async()=>{
 const meta=await project('Plants');
 const {json,files}=triangle(),seen=[];
 const fetchImpl=async url=>{
  seen.push(url);const u=new URL(url);
  const ok=body=>({ok:true,status:200,json:async()=>body,arrayBuffer:async()=>{const b=Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));return b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}});
  if(u.pathname==='/assets')return ok(u.searchParams.get('t')==='models'?{potted_plant_01:{name:'Potted Plant 01',tags:['plant','pot'],categories:['furniture'],authors:{'Rico Cilliers':'All'}},chair_02:{name:'Chair',tags:['chair']}}:{studio_small:{name:'Studio Small',tags:['studio','indoor']}});
  if(u.pathname==='/files/potted_plant_01')return ok({gltf:{'1k':{gltf:{url:'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/potted_plant_01/potted_plant_01_1k.gltf',include:{'tri.bin':{url:'https://dl.polyhaven.org/x/tri.bin'},'textures/red.png':{url:'https://dl.polyhaven.org/x/red.png'}}}}}});
  if(u.pathname.endsWith('.gltf'))return ok(json);
  if(u.pathname.endsWith('tri.bin'))return ok(files['tri.bin']);
  if(u.pathname.endsWith('red.png')||u.hostname==='cdn.polyhaven.com')return ok(PNG);
  return{ok:false,status:404};
 };
 const results=await M.searchPolyHaven('green plant',{fetchImpl});
 assert.equal(results[0].id,'potted_plant_01');
 assert.match(results[0].thumb,/^https:\/\/cdn\.polyhaven\.com\//);
 const added=await M.addPolyHaven(meta.id,'potted_plant_01',{fetchImpl});
 assert.ok(M.isGlb(M.read(meta.id,added.file).bytes));
 assert.equal(added.poster_path,'./models/'+added.poster);
 assert.equal(added.source.license,'CC0');
 await assert.rejects(M.addPolyHaven(meta.id,'potted_plant_01',{fetchImpl}),/already in this project/);
 await assert.rejects(M.addPolyHaven(meta.id,'../../etc',{fetchImpl}),/Pick a Poly Haven model/);
 assert.ok(seen.every(u=>/^https:\/\/(api|dl|cdn)\.polyhaven\.(com|org)\//.test(u)),'only Poly Haven addresses');
 // A picked 3D style with no model: the AI names an object once and the best match is added.
 const other=await project('Shop');const m2=builder.loadMeta(other.id);m2.three_d={style:'product'};builder.saveMeta(m2);
 const auto=await M.autoModel(other.id,'An online shop for indoor plants',{callModel:async()=>({query:'plant'}),fetchImpl});
 assert.equal(auto.source.id,'potted_plant_01');
 assert.equal(await M.autoModel(other.id,'again',{callModel:async()=>({query:'plant'}),fetchImpl}),null,'only once');
 assert.match(M.note(other.id,builder.loadMeta(other.id)),/3D style "Product viewer"/);
});

test('an app that imports kairoq/3d builds, and gets its models and the viewer script',async()=>{
 const meta=await project('Showroom');
 const {json,files}=triangle();const added=await M.upload(meta.id,'sofa.glb',M.packGlb(json,uri=>files[uri]),{blender:noBlender});
 const APP=`import { Model3D } from 'kairoq/3d';
export default function App(){return <main><Model3D src="${added.path}" alt="A sofa" mode="product" className="h-96 w-full" /></main>}
`;
 const model=async(_o,parse)=>parse(JSON.stringify({message:'Added a 3D sofa.',files:{'src/App.jsx':APP}}));
 const r=await builder.edit(meta.id,'Show the sofa in 3D',{callModel:model});
 const dist=path.join(builder.versionDir(meta.id,r.version),'dist');
 assert.ok(fs.existsSync(path.join(dist,'models',added.file)),'model copied into the build');
 assert.ok(fs.existsSync(path.join(dist,'_kairoq',M.VIEWER_FILE)),'viewer copied into the build');
 const js=fs.readdirSync(path.join(dist,'assets')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(dist,'assets',f),'utf8')).join('\n');
 assert.match(js,/model-viewer/);assert.match(js,new RegExp(M.VIEWER_FILE.replace(/\./g,'\\.')));
 // The exported code runs outside Kairoq with the same component and files.
 const out=require('../react-export').exportFiles(meta.id);
 assert.match(out['src/kairoq-3d.js'],/export function Model3D/);
 assert.match(out['vite.config.js'],/kairoq\\\/3d/);
 assert.ok(out['public/models/'+added.file]);assert.ok(out['public/_kairoq/'+M.VIEWER_FILE]);
});

test('the editor API uploads raw model bytes, saves the 3D style and serves only model files',async()=>{
 const http=require('http'),createApi=require('../create-api');
 const s=await new Promise(r=>{const srv=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,callModel:async()=>({}),secure:false}))return;res.writeHead(404);res.end()});srv.listen(0,'127.0.0.1',()=>r(srv))});
 const call=(method,url,body,type)=>new Promise((resolve,reject)=>{
  const payload=body==null?null:Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
  const req=http.request({host:'127.0.0.1',port:s.address().port,method,path:url,headers:payload?{'Content-Type':type||'application/json','Content-Length':payload.length}:{}},res=>{const parts=[];res.on('data',c=>parts.push(c));res.on('end',()=>{const buf=Buffer.concat(parts);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,json,buf,headers:res.headers})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
 try{
  const meta=await project('Api');const base='/api/create/projects/'+meta.id;
  const {json,files}=triangle();const glb=M.packGlb(json,uri=>files[uri]);
  const up=await call('POST',base+'/models?op=upload&name=Desk%20Lamp.glb',glb,'application/octet-stream');
  assert.equal(up.status,201,JSON.stringify(up.json));
  assert.equal(up.json.models.length,1);assert.match(up.json.added.path,/^\.\/models\/desk-lamp-/);
  const got=await call('GET',base+'/model?file='+up.json.added.file);
  assert.equal(got.status,200);assert.equal(got.headers['content-type'],'model/gltf-binary');assert.ok(got.buf.equals(glb));
  assert.equal((await call('GET',base+'/model?file=models.json')).status,404);
  const styled=await call('POST',base+'/models?op=style',{style:'scroll'});
  assert.equal(styled.json.style,'scroll');assert.equal(builder.loadMeta(meta.id).three_d.style,'scroll');
  assert.equal((await call('POST',base+'/models?op=style',{style:'hologram'})).status,400);
  const poster=await call('POST',base+'/models?op=poster&file='+up.json.added.file,PNG,'image/png');
  assert.equal(poster.json.models[0].poster_path,'./models/'+up.json.added.file.replace('.glb','.png'));
  const del=await call('DELETE',base+'/models',{file:up.json.added.file});
  assert.equal(del.json.models.length,0);
 }finally{s.close()}
});

test('Model3D keeps the poster for old phones and reduced motion, and the scroll camera moves smoothly',async()=>{
 const src=require('../react-model3d').source();
 assert.match(src,/prefers-reduced-motion/);
 assert.match(src,/getContext\('webgl2'\)/);
 assert.match(src,/'ar-modes'\]='webxr scene-viewer quick-look'/);
 const orbitAt=new Function(`${/function parseOrbit[\s\S]*?\n\}/.exec(src)[0]}\n${/function mix[\s\S]*?\}/.exec(src)[0]}\n${/function orbitAt[\s\S]*?\n\}/.exec(src)[0]}\nreturn orbitAt;`)();
 assert.equal(orbitAt(['0deg 80deg 100%','90deg 60deg 80%'],0.5),'45.0deg 70.0deg 90.0%');
 assert.equal(orbitAt(['0deg 80deg 100%','90deg 60deg 80%'],1),'90.0deg 60.0deg 80.0%');
});

test('the look step asks about 3D and the Design dialog manages models',()=>{
 const look=read('public/create-look.js'),html=read('public/create.html'),js=read('public/create.js'),api=read('create-api.js');
 for(const s of ['Add 3D?','Product viewer','Room walkthrough','Scroll story','3D background'])assert.ok(look.includes(s),s);
 assert.match(look,/three_d:st\.three/);
 for(const id of ['models-section','models-upload','models-file','models-query','models-search','models-style'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/op=upload&name=/);assert.match(js,/toBlob\(/);
 assert.match(api,/'GET:\/models':'viewer','POST:\/models':'editor','DELETE:\/models':'editor','GET:\/model':'viewer'/);
 assert.ok(fs.existsSync(M.VIEWER_SRC),'viewer script vendored');
 assert.match(fs.readFileSync(path.join(path.dirname(M.VIEWER_SRC),'LICENSE'),'utf8'),/Apache License/);
});

// Real Blender, when this machine has it (KAIROQ_BPY_PYTHON or KAIROQ_BLENDER).
test('Blender converts an FBX into a GLB with a preview picture',{skip:!blender.available()&&'Blender not installed here'},async()=>{
 const meta=await project('Blender');
 const make=path.join(tmp,'make.py'),fbx=path.join(tmp,'cube.fbx');
 fs.writeFileSync(make,`import bpy\nbpy.ops.wm.read_factory_settings(use_empty=True)\nbpy.ops.mesh.primitive_cube_add()\nbpy.ops.export_scene.fbx(filepath=${JSON.stringify(fbx)})\n`);
 await new Promise((ok,bad)=>require('child_process').execFile(blender.command().file,blender.command().file===process.env.KAIROQ_BLENDER?['-b','--factory-startup','--python',make]:[make],e=>e?bad(e):ok()));
 const added=await M.upload(meta.id,'cube.fbx',fs.readFileSync(fbx));
 assert.ok(M.isGlb(M.read(meta.id,added.file).bytes));
 assert.match(added.converted,/from \.fbx/);
 assert.ok(added.poster,'preview picture rendered');
 await assert.rejects(M.upload(meta.id,'bad.stl',Buffer.from('solid nothing\nendsolid\n')),/no 3D shapes|could not read/i);
});
