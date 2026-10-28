'use strict';
// Publishing native apps to the App Store and Google Play: the listing (store-listing.js), the
// signing Kairoq makes (store-signing.js) and the Expo build and submit (store-publish.js), with
// stand-ins for Apple's API and for eas-cli (test/fixtures/eas/eas).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const forge=require('node-forge');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-stores-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'p'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),APP_ENCRYPTION_KEY:'test-encryption-key-1234567890',
 KAIROQ_EAS_BIN:path.join(__dirname,'fixtures','eas','eas'),EXPO_TOKEN:'expo-test-token',KAIROQ_EAS_LOG:path.join(os.tmpdir(),'kairoq-eas-fake.log')});
const builder=require('../react-builder'),nat=require('../react-native-app');
const signing=require('../store-signing'),listing=require('../store-listing'),publish=require('../store-publish'),secrets=require('../project-secrets');
const runtime=require('../runtime-check');
test.after(()=>runtime.close());
const FIX=path.join(__dirname,'fixtures','native');
const fixture=()=>{const out={};const walk=(d,rel)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name;if(e.isDirectory())walk(path.join(d,e.name),r);else out['src/'+r]=fs.readFileSync(path.join(d,e.name),'utf8')}};walk(FIX,'');return out};
const wait=async(f,ms=5000)=>{for(let t=0;t<ms;t+=50){const v=f();if(v)return v;await new Promise(r=>setTimeout(r,50))}throw Error('timed out')};

async function nativeProject(name='Café Order'){
 const meta=builder.create({name,owner:'owner'});
 await builder.initializeFrom(meta,{...nat.starterFiles(name,null),...fixture()},'Native app');
 const m=builder.loadMeta(meta.id);m.native={enabled:true,sdk:nat.SDK()};builder.saveMeta(m);
 return meta.id;
}
// Apple's API: answers like App Store Connect, signing the certificate it is asked for.
function fakeApple({appExists=true}={}){
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  const u=new URL(url),body=opts.body?JSON.parse(opts.body):null;calls.push({method:opts.method,path:u.pathname+u.search,auth:opts.headers.Authorization,body});
  const ok=j=>({ok:true,status:200,json:async()=>j});
  if(u.pathname==='/v1/apps')return ok({data:appExists?[{id:'1234567890',attributes:{name:'Café Order'}}]:[]});
  if(u.pathname==='/v1/bundleIds'&&opts.method==='GET')return ok({data:[]});
  if(u.pathname==='/v1/bundleIds')return ok({data:{id:'BID1'}});
  if(u.pathname==='/v1/certificates'){
   const csr=forge.pki.certificationRequestFromPem(body.data.attributes.csrContent);
   const ca=forge.pki.rsa.generateKeyPair(1024),c=forge.pki.createCertificate();
   c.publicKey=csr.publicKey;c.serialNumber='02';c.validity.notBefore=new Date();c.validity.notAfter=new Date(Date.now()+86400000*365);
   c.setSubject(csr.subject.attributes);c.setIssuer([{name:'commonName',value:'Apple test'}]);c.sign(ca.privateKey,forge.md.sha256.create());
   return ok({data:{id:'CERT1',attributes:{certificateContent:Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes(),'binary').toString('base64')}}});
  }
  if(u.pathname==='/v1/profiles')return ok({data:{id:'PROF1',attributes:{profileContent:Buffer.from('profile-bytes').toString('base64')}}});
  return{ok:false,status:404,json:async()=>({errors:[{detail:'not found'}]})};
 };
 return{fetchImpl,calls};
}
const ecKey=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
const P8=ecKey.privateKey.export({type:'pkcs8',format:'pem'});
const KEY={keyId:'ABC123DEFG',issuerId:'69a6de70-03db-47e3-e053-5b8c7c11a4d1',p8:P8};

test('the App Store Connect token is a valid ES256 JWT for Apple',()=>{
 const t=signing.token(KEY,1800000000);
 const [h,b,s]=t.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(h,'base64url')),{alg:'ES256',kid:'ABC123DEFG',typ:'JWT'});
 const body=JSON.parse(Buffer.from(b,'base64url'));assert.equal(body.aud,'appstoreconnect-v1');assert.equal(body.exp-body.iat,900);
 assert.ok(crypto.verify('sha256',Buffer.from(h+'.'+b),{key:ecKey.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url')));
 assert.throws(()=>signing.token({...KEY,p8:'nope'}),/whole \.p8 file/);
});

test('Android upload keystore: a PKCS12 key with the alias and password Kairoq keeps',()=>{
 const k=signing.androidKeystore('Café Order');
 const p12=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(k.keystore,'base64').toString('binary'))),k.keystorePassword);
 const bags=p12.getBags({friendlyName:'upload'}).friendlyName;
 assert.ok(bags.some(b=>b.key)&&bags.some(b=>b.cert),'key and certificate under the alias');
 assert.equal(k.keyPassword,k.keystorePassword,'Gradle needs the same password for a PKCS12 keystore');
});

test('the listing: written from the app, cleaned to the store limits, with what is still missing',async()=>{
 const id=await nativeProject();
 let prompt='';
 const callModel=async(o,parse)=>{prompt=o.messages[1].content;return parse(JSON.stringify({name:'Café Order: coffee ahead of time, every day',subtitle:'Order coffee ahead',promo:'Skip the line.',description:'Order your coffee before you arrive.\nPick it up at the counter.',keywords:'coffee, cafe, order ahead,coffee,flat white,'+'x'.repeat(90),category:'Food & Drink',privacy:{collects:false,data:[]}}))};
 const png=Buffer.from('89504e470d0a1a0a','hex');
 const st=await listing.prepare(id,{callModel,renderHtml:async(h,{width})=>{assert.equal(width,1024);assert.match(h,/background:#/);return png},storeShots:async(u,size)=>{assert.match(u,/\/builder\/p\//);return size.width===440?[png,png,png]:[png,png]}});
 assert.match(prompt,/src\/screens\/Menu\.js|Menu/);
 assert.equal(st.listing.name.length<=30,true);
 assert.equal(st.listing.keywords,'coffee,cafe,order ahead,flat white','deduplicated, under 100 characters');
 assert.equal(st.listing.category,'Food & Drink');
 assert.deepEqual(st.shots,{ios:['ios-1.png','ios-2.png','ios-3.png'],android:['android-1.png','android-2.png']});
 assert.ok(listing.file(id,'icon.png'));assert.equal(listing.file(id,'../secrets.json'),null);
 assert.ok(st.missing.some(m=>/privacy policy/.test(m)),'a privacy policy link is still needed');
 const after=listing.update(id,{listing:{privacy_url:'https://cafe.example/privacy',support_url:'https://cafe.example/help'},bundle_id:'com.cafeorder.app'});
 assert.deepEqual(after.missing,[]);assert.equal(after.bundle_id,'com.cafeorder.app');
 assert.throws(()=>listing.update(id,{bundle_id:'bad id'}),/reverse-domain/);
});

test('iPhone: the Apple key is checked, Kairoq signs, Expo builds, and the build goes to App Store Connect',async()=>{
 const id=await nativeProject('Northline');
 await listing.prepare(id,{callModel:async(o,p)=>p(JSON.stringify({name:'Northline',description:'Book a renovation visit.',keywords:'renovation',category:'Lifestyle'}))});
 listing.update(id,{listing:{privacy_url:'https://n.example/privacy',support_url:'https://n.example/help'}});
 const apple=fakeApple();
 const saved=await publish.saveApple(id,{...KEY},{fetchImpl:apple.fetchImpl});
 assert.equal(saved.app_found,true);
 assert.match(apple.calls[0].auth,/^Bearer ey/);
 fs.rmSync(process.env.KAIROQ_EAS_LOG,{force:true});
 await publish.publish(id,'ios',{fetchImpl:apple.fetchImpl});
 assert.ok(apple.calls.some(c=>c.path==='/v1/certificates'&&c.body.data.attributes.certificateType==='DISTRIBUTION'));
 assert.ok(apple.calls.some(c=>c.path==='/v1/profiles'&&c.body.data.attributes.profileType==='IOS_APP_STORE'));
 assert.ok(secrets.get(id,publish.S.iosP12),'signing kept as an encrypted secret');
 const run=await wait(()=>(builder.loadMeta(id).store.runs||[]).find(r=>r.build_id));
 assert.equal(run.state,'building');assert.equal(run.build_id,'build-ios');
 const log=fs.readFileSync(process.env.KAIROQ_EAS_LOG,'utf8').trim().split('\n').map(JSON.parse);
 const build=log.find(l=>l.args[0]==='build');
 assert.deepEqual(build.args,['build','--platform','ios','--profile','production','--non-interactive','--no-wait','--json']);
 assert.equal(build.app.expo.ios.bundleIdentifier,listing.identifiers(builder.loadMeta(id)).bundle_id);
 assert.equal(build.app.expo.extra.eas.projectId,'proj-123');
 assert.equal(build.eas.build.production.credentialsSource,'local');
 assert.equal(build.eas.submit.production.ios.ascAppId,'1234567890');
 assert.ok(build.creds.ios.distributionCertificate.password);
 assert.match(build.ignore,/certs\//);assert.match(build.ignore,/credentials\.json/);
 assert.equal(build.token,true);assert.ok(!fs.existsSync(build.cwd),'the folder with the keys is removed');
 const st=await publish.refresh(id);
 assert.equal(st.runs[0].state,'submitted');
 const submit=fs.readFileSync(process.env.KAIROQ_EAS_LOG,'utf8').trim().split('\n').map(JSON.parse).find(l=>l.args[0]==='submit');
 assert.deepEqual(submit.args.slice(0,4),['submit','--platform','ios','--id']);
 assert.deepEqual(publish.status(id).checklist.filter(c=>!c.ok).map(c=>c.key),['listing','google'],'no icon or screenshots in this test; no Google key');
});

test('Android: the first build is a file to upload by hand; after that Kairoq sends them',async()=>{
 const id=await nativeProject('Gym Pass');
 await listing.prepare(id,{callModel:async(o,p)=>p(JSON.stringify({name:'Gym Pass',description:'Book classes.',keywords:'gym',category:'Health & Fitness'}))});
 await publish.publish(id,'android');
 await wait(()=>(builder.loadMeta(id).store.runs||[]).find(r=>r.build_id));
 let st=await publish.refresh(id);
 assert.equal(st.runs[0].state,'built');assert.match(st.runs[0].file,/\.aab$/);assert.match(st.runs[0].text,/Upload this file once/);
 await assert.rejects(publish.publish(id,'nope'),/iOS or Android/);
 publish.saveGoogle(id,{serviceAccount:JSON.stringify({type:'service_account',client_email:'kairoq@proj.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n'})});
 assert.throws(()=>publish.saveGoogle(id,{serviceAccount:'{"type":"user"}'}),/not a service account/);
 st=await publish.sendBuilt(id,st.runs[0].id);
 assert.equal(st.runs[0].state,'submitted');assert.equal(builder.loadMeta(id).store.google.first_upload_done,true);
 assert.ok(builder.loadMeta(id).store.locked.package_name,'the package name cannot change after the first build');
});

test('store screenshots are real screens of the app at the sizes the stores ask for',{timeout:240000},async(t)=>{
 if(!runtime.available()){t.diagnostic('no browser here');return}
 const id=await nativeProject('Screens');
 const meta=builder.loadMeta(id);
 await builder.saveSource(id,builder.loadFiles(id,meta.current_version),{summary:'Build'});
 const http=require('http'),server=http.createServer((req,res)=>{if(!builder.handlePreview(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const pics=await runtime.storeShots('http://127.0.0.1:'+server.address().port+builder.previewUrl(builder.loadMeta(id)),listing.SHOTS.ios);
  assert.equal(pics.length,3,'the first screen and one per other tab');
  assert.equal(pics[0].readUInt32BE(16),1320);assert.equal(pics[0].readUInt32BE(20),2868);
  if(process.env.KAIROQ_KIT_SHOTS)pics.forEach((p,i)=>fs.writeFileSync(path.join(process.env.KAIROQ_KIT_SHOTS,'store-ios-'+(i+1)+'.png'),p));
 }finally{server.close()}
});

test('the editor routes: Run on your phone, the store panel, the listing files',async()=>{
 const http=require('http'),createApi=require('../create-api');
 const id=await nativeProject('Routes');
 const snackFetch=async(url,opts)=>({ok:true,status:200,json:async()=>({id:'@snack/r1',hashId:'r1'}),text:async()=>'{}'});
 const apple=fakeApple();
 const callModel=async(o,parse)=>parse(JSON.stringify({name:'Routes',description:'A test app for routes.',keywords:'test',category:'Utilities'}));
 const png=Buffer.from('89504e470d0a1a0a','hex');
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,callModel,secure:false,snackFetch,appleFetch:apple.fetchImpl,storeShots:async()=>[png]}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=(method,url,body)=>new Promise((resolve,reject)=>{const p=body?Buffer.from(JSON.stringify(body)):null;const q=http.request({host:'127.0.0.1',port:server.address().port,method,path:'/api/create/projects/'+id+url,headers:p?{'Content-Type':'application/json','Content-Length':p.length}:{}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const t=Buffer.concat(c);let j=null;try{j=JSON.parse(t)}catch{}resolve({status:res.statusCode,json:j,bytes:t,type:res.headers['content-type']})})});q.on('error',reject);if(p)q.write(p);q.end()});
 try{
  const phone=await call('POST','/phone',{});
  assert.equal(phone.status,200,JSON.stringify(phone.json));assert.match(phone.json.phone.exp_url,/^exp:\/\//);assert.match(phone.json.phone.qr,/^<svg/);
  const again=await call('POST','/phone',{});assert.equal(again.json.phone.snack_url,phone.json.phone.snack_url,'one upload per version');
  let st=await call('GET','/stores');assert.equal(st.status,200);assert.ok(Array.isArray(st.json.stores.checklist));
  st=await call('POST','/stores',{action:'prepare'});assert.equal(st.status,200,JSON.stringify(st.json));assert.equal(st.json.stores.listing.name,'Routes');
  assert.deepEqual(st.json.stores.shots.ios,['ios-1.png']);
  const f=await call('GET','/storefile?name=ios-1.png');assert.equal(f.status,200);assert.equal(f.type,'image/png');
  assert.equal((await call('GET','/storefile?name=../secrets.json')).status,404);
  st=await call('POST','/stores',{action:'apple',...KEY});assert.equal(st.status,200,JSON.stringify(st.json));assert.equal(st.json.apple.app_found,true);
  assert.ok(!JSON.stringify(st.json).includes('PRIVATE KEY'),'keys never come back to the browser');
  assert.equal((await call('POST','/stores',{action:'nope'})).status,400);
 }finally{server.close()}
});
