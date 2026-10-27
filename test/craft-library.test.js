"use strict";
// What the best sites do, measured (craft-norms.json, craft-norms.js); real licensed photos for new
// sites (photo-finder.js); a hand-made art style where photos do not fit.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-craftlib-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const norms=require('../craft-norms'),finder=require('../photo-finder'),design=require('../react-design'),builder=require('../react-builder');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

test('the craft library: about 120 measured sites in 12 kinds, numbers only',()=>{
 const d=norms.DATA,types=Object.keys(d.types);
 assert.equal(types.length,12);
 const sites=types.reduce((n,t)=>n+d.types[t].sites,0);
 assert.ok(sites>=100,'measured '+sites+' sites');
 for(const t of types){
  const n=d.types[t];assert.ok(n.sites>=5,t);
  assert.ok(n.h1_px[1]>=28&&n.h1_px[1]<=110,t+' headline size');
  assert.ok(n.examples.every(u=>/^[a-z0-9.-]+\.[a-z]{2,}$/.test(u)),'only site addresses are kept');
 }
 // Nothing from the sites themselves: no headline text, button labels or colours of a site.
 const raw=fs.readFileSync(path.join(__dirname,'..','craft-norms.json'),'utf8');
 assert.doesNotMatch(raw,/"cta"|"text"|"h1":\[|rgb\(/);
 assert.ok(d.all.eyebrow_share<0.2&&d.all.arrows_share<0.2,'the AI giveaways are rare on the best sites');
});

test('the norms for a business reach the art director and the builder, and the built page is compared with them',async()=>{
 assert.equal(norms.typeOf('Hale Whitford Law, a Toronto law firm; a first consultation'),'law');
 assert.equal(norms.typeOf('Ember & Oat, a cosy café in Ottawa'),'food');
 assert.equal(norms.typeOf('Ledgerly bookkeeping software for small businesses'),'saas');
 assert.match(norms.note('law'),/^What the best websites for law and professional services do \(measured on \d+ of them, e\.g\. [^)]*\): a hero headline of about \d+ to \d+ px/);
 const issues=norms.compare({h1px:30,h1words:16,radius:28,shadows:14,sections:14},'law').map(i=>i.kind);
 assert.deepEqual(issues,['norm-h1','norm-words','norm-radius','norm-shadows','norm-sections']);
 assert.deepEqual(norms.compare({h1px:52,h1words:6,radius:0,shadows:1,sections:6},'law'),[],'a page like the best law sites passes');
 // The brief: the law site gets its norms; the art director saw them.
 let prompt='';
 const reply={name:'x',summary:'y',palette:{background:'#ffffff',foreground:'#141414',primary:'#7a1426',secondary:'#f4f1ee',accent:'#b08d57',muted:'#f6f4f2'},fonts:{display:'Newsreader',body:'Public Sans'},radius:'0.25rem',photos:['lawyers meeting a client in a Toronto office','downtown Toronto skyline at dusk']};
 const b=await design.createBrief('Hale Whitford Law, a Toronto law firm for employment disputes',{projectName:'Hale Whitford Law',callModel:async(o,parse)=>{prompt=o.messages[1].content;return parse(JSON.stringify(reply))}});
 assert.equal(b.norms,'law');assert.match(prompt,/What the best websites for law and professional services do[\s\S]*Follow these proportions\./);
 assert.deepEqual(b.photos,reply.photos);assert.equal(b.art,undefined,'a law firm gets real photos, not generated art');
 assert.match(design.designNote(b),/What the best websites for law and professional services do/);
 // Software: no photos; a hand-made art style instead, kept for generated images.
 const s=await design.createBrief('Ledgerly, bookkeeping software for small businesses',{projectName:'Ledgerly',callModel:async(o,parse)=>parse(JSON.stringify({...reply,photos:[]}))});
 assert.equal(s.norms,'saas');assert.ok(design.ART[s.art],s.art);
 assert.match(s.imagery,/Generated images in one hand-made style: /);
 assert.match(design.designNote(s),/Artwork: if you generate images, make every one in this hand-made style: [\s\S]*Never glossy 3D renders/);
});

const JPEG=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(2000,7)]);
test('real photos are found and downloaded with their licence; Pexels with a key, Openverse without',async()=>{
 const seen=[];
 const read=async(url,o={})=>{seen.push({url,headers:o.headers||{},limit:o.limit});
  if(url.startsWith('https://api.openverse.org/'))return{bytes:Buffer.from(JSON.stringify({results:[{url:'https://live.staticflickr.com/big.jpg',width:4000,license:'by',license_version:'2.0',title:'Kitchen',creator:'Ana',foreign_landing_url:'https://flickr.com/p/1',license_url:'https://creativecommons.org/licenses/by/2.0/'},{url:'https://live.staticflickr.com/ok.jpg',width:2400,license:'cc0',title:'Kitchen 2',creator:'Ben',foreign_landing_url:'https://flickr.com/p/2',license_url:'https://creativecommons.org/publicdomain/zero/1.0/'},{url:'http://insecure/x.jpg',license:'cc0'}]})),type:'application/json'};
  if(url.startsWith('https://api.pexels.com/'))return{bytes:Buffer.from(JSON.stringify({photos:[{width:5000,alt:'Latte art',photographer:'Cara',photographer_url:'https://www.pexels.com/@cara',url:'https://www.pexels.com/photo/1/',src:{large2x:'https://images.pexels.com/photos/1/a.jpeg?w=1880'}}]})),type:'application/json'};
  if(url.includes('big.jpg'))throw Error('Asset exceeds download size limit');
  return{bytes:JPEG,type:'image/jpeg'};
 };
 const ov=await finder.find(['modern kitchen renovation'],{env:{},read});
 assert.equal(ov.length,1);assert.equal(ov[0].name,'photo-modern-kitchen-renovation.jpg');
 assert.equal(ov[0].credit.creator,'Ben','a photo over the size limit is skipped for the next one');
 assert.equal(ov[0].credit.license,'CC0');assert.equal(ov[0].credit.attribution_required,false);
 assert.ok(seen.some(s=>/license=cc0,by&license_type=commercial/.test(s.url)),'only licences that allow commercial use');
 assert.ok(seen.filter(s=>s.url.includes('staticflickr')).every(s=>s.limit===3*1024*1024));
 seen.length=0;
 const px=await finder.find(['barista pouring latte art'],{env:{PEXELS_API_KEY:'k-1'},read});
 assert.equal(px[0].credit.provider,'Pexels');assert.equal(seen[0].headers.Authorization,'k-1');
 assert.equal(seen[1].headers.Authorization,undefined,'the key is only sent to the Pexels API');
 assert.match(finder.creditLine(px.map(p=>({...p,path:'./uploads/'+p.name}))),/"Latte art" by Cara \(Pexels License, https:\/\/www\.pexels\.com\/photo\/1\/\); and "Photos from Pexels" linking to https:\/\/www\.pexels\.com/);
 assert.equal(finder.creditLine(ov),'','CC0 photos need no credit');
});

test('a new site gets its photos before the first build, and the builder is told to use them and credit them',async()=>{
 const meta=builder.create({name:'Ember & Oat',owner:'owner'});await builder.initialize(meta);
 const real=finder.find;
 finder.find=async q=>q.map((query,i)=>({name:'photo-'+i+'.jpg',data:JPEG.toString('base64'),query,credit:{title:'Latte '+i,creator:'Cara '+i,source_url:'https://www.pexels.com/photo/'+i+'/',license:'Pexels License',license_url:'https://www.pexels.com/license/',provider:'Pexels',attribution_required:true}}));
 try{
  const callModel=async(o,parse)=>parse(JSON.stringify({name:'x',summary:'y',palette:{background:'#fffdf9',foreground:'#1d1a17',primary:'#e2321b',secondary:'#fff1ea',accent:'#1d1a17',muted:'#faf3ee'},fonts:{display:'Fraunces',body:'Instrument Sans'},radius:'0.25rem',photos:['barista pouring latte art','croissants on a bakery counter']}));
  const brief=await builder.prepareDesign(meta.id,'Ember & Oat, a cosy café in Ottawa',{callModel});
  assert.equal(brief.photo_files.length,2);assert.match(brief.photo_files[0].path,/^\.\/uploads\/photo-0\.jpg$/);
  assert.deepEqual(require('../react-assets').list(meta.id).map(a=>a.name).sort(),['photo-0.jpg','photo-1.jpg']);
  const saved=builder.loadMeta(meta.id).design;
  assert.equal(saved.photo_files[1].credit.creator,'Cara 1','the licence and credit are kept with the project');
  const note=design.designNote(saved);
  assert.match(note,/Real photos for this site are ready \(found and licensed by Kairoq\): \.\/uploads\/photo-0\.jpg \(barista pouring latte art\)/);
  assert.match(note,/Photo credits \(show them in small text in the footer, as links\): "Latte 0" by Cara 0/);
 }finally{finder.find=real}
});
