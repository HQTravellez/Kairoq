"use strict";
// Publishing a native app to the App Store and Google Play with Expo's cloud (EAS Build and EAS
// Submit, eas-cli, MIT). Kairoq writes the Expo project, the signing it made (store-signing.js)
// and the store keys into a folder of its own, runs eas-cli there without a terminal, and follows
// the build until it is in App Store Connect (TestFlight, then review) or ready for Google Play.
// Needs on the server: EXPO_TOKEN (Ka's Expo account, Railway) and the eas program (Dockerfile).
// Each owner brings their own store accounts: an App Store Connect API key and the app record
// they created there, and for Google Play a service account key (the very first Android upload is
// done by hand in the Play Console, which Google requires).
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const builder=require('./react-builder'),secrets=require('./project-secrets');
const listing=require('./store-listing'),signing=require('./store-signing');

const S={ascKeyId:'store_asc_key_id',ascIssuer:'store_asc_issuer_id',ascP8:'store_asc_p8',ascAppId:'store_asc_app_id',
 iosP12:'store_ios_p12',iosP12Password:'store_ios_p12_password',iosProfile:'store_ios_profile',
 playJson:'store_play_service_account',keystore:'store_android_keystore',keystorePassword:'store_android_keystore_password'};
function fail(status,message){return Object.assign(Error(message),{status})}
function binary(){
 const given=process.env.KAIROQ_EAS_BIN;if(given)return fs.existsSync(given)?given:null;
 for(const d of String(process.env.PATH||'').split(path.delimiter)){const f=path.join(d,'eas');try{fs.accessSync(f,fs.constants.X_OK);return f}catch{}}
 return null;
}
function ready(){return{eas:Boolean(binary()),expo_token:Boolean(String(process.env.EXPO_TOKEN||'').trim())}}
const has=(id,k)=>{try{return Boolean(secrets.get(id,k))}catch{return false}};

// ---------- the owner's store keys ----------
async function saveApple(id,{keyId,issuerId,p8},{fetchImpl}={}){
 const meta=builder.loadMeta(id),ids=listing.identifiers(meta);
 const key={keyId:String(keyId||'').trim(),issuerId:String(issuerId||'').trim(),p8:String(p8||'').trim()};
 const api=signing.client(key,{fetchImpl});
 // Checked with Apple before saving: the key works and the app record exists.
 const app=await signing.appRecord(api,ids.bundle_id);
 secrets.set(id,S.ascKeyId,key.keyId);secrets.set(id,S.ascIssuer,key.issuerId);secrets.set(id,S.ascP8,key.p8);
 if(app)secrets.set(id,S.ascAppId,app.id);
 const m=builder.loadMeta(id);m.store={...(m.store||{}),apple:{...(m.store&&m.store.apple||{}),key_saved_at:new Date().toISOString(),app_found:Boolean(app),app_name:app&&app.name||null}};builder.saveMeta(m);
 return{app_found:Boolean(app),bundle_id:ids.bundle_id};
}
function saveGoogle(id,{serviceAccount}){
 let j;try{j=JSON.parse(String(serviceAccount||''))}catch{throw fail(400,'Paste the whole JSON key file of the Google Cloud service account.')}
 if(j.type!=='service_account'||!j.client_email||!j.private_key)throw fail(400,'That is not a service account key (it needs "type": "service_account", client_email and private_key).');
 secrets.set(id,S.playJson,JSON.stringify(j));
 const m=builder.loadMeta(id);m.store={...(m.store||{}),google:{...(m.store&&m.store.google||{}),key_saved_at:new Date().toISOString(),client_email:j.client_email}};builder.saveMeta(m);
 return{client_email:j.client_email};
}
function firstUploadDone(id,done=true){const m=builder.loadMeta(id);m.store={...(m.store||{}),google:{...(m.store&&m.store.google||{}),first_upload_done:Boolean(done)}};builder.saveMeta(m);return status(id)}

// ---------- the folder eas-cli works in ----------
function writeTree(dir,files){for(const [n,c] of Object.entries(files)){const f=path.join(dir,n);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)}}
function workspace(id,platform){
 const meta=builder.loadMeta(id),s=meta.store||{},ids=listing.identifiers(meta);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-eas-'));
 const icon=listing.file(id,'icon.png');
 const pal=(meta.design&&meta.design.palette)||{};
 const files=require('./react-native-app').expoProject(builder.loadFiles(id,meta.current_version),meta,{slug:(String(meta.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'app')+'-'+meta.id.slice(0,6),bundleId:ids.bundle_id,packageName:ids.package_name,icon,iconBackground:pal.primary,projectId:s.expo_project_id});
 writeTree(dir,files);
 const eas={cli:{version:'>= 16.0.0',appVersionSource:'remote'},build:{production:{credentialsSource:'local',autoIncrement:true,distribution:'store',...(platform==='android'?{android:{buildType:'app-bundle'}}:{})}},submit:{production:{}}};
 const creds={};
 if(platform==='ios'){
  fs.mkdirSync(path.join(dir,'certs'),{recursive:true});
  if(has(id,S.iosP12)){
   fs.writeFileSync(path.join(dir,'certs/dist.p12'),Buffer.from(secrets.get(id,S.iosP12),'base64'));
   fs.writeFileSync(path.join(dir,'certs/profile.mobileprovision'),Buffer.from(secrets.get(id,S.iosProfile),'base64'));
   creds.ios={provisioningProfilePath:'certs/profile.mobileprovision',distributionCertificate:{path:'certs/dist.p12',password:secrets.get(id,S.iosP12Password)}};
  }
  if(has(id,S.ascP8)&&has(id,S.ascAppId)){
   fs.writeFileSync(path.join(dir,'certs/asc.p8'),secrets.get(id,S.ascP8));
   eas.submit.production.ios={ascAppId:secrets.get(id,S.ascAppId),ascApiKeyPath:'certs/asc.p8',ascApiKeyIssuerId:secrets.get(id,S.ascIssuer),ascApiKeyId:secrets.get(id,S.ascKeyId)};
  }
 }else{
  fs.mkdirSync(path.join(dir,'certs'),{recursive:true});
  if(has(id,S.keystore)){
   fs.writeFileSync(path.join(dir,'certs/upload.jks'),Buffer.from(secrets.get(id,S.keystore),'base64'));
   const pw=secrets.get(id,S.keystorePassword);
   creds.android={keystore:{keystorePath:'certs/upload.jks',keystorePassword:pw,keyAlias:'upload',keyPassword:pw}};
  }
  if(has(id,S.playJson)){fs.writeFileSync(path.join(dir,'certs/play.json'),secrets.get(id,S.playJson));eas.submit.production.android={serviceAccountKeyPath:'certs/play.json',track:'internal',releaseStatus:'draft'}}
 }
 fs.writeFileSync(path.join(dir,'eas.json'),JSON.stringify(eas,null,2));
 fs.writeFileSync(path.join(dir,'credentials.json'),JSON.stringify(creds,null,2));
 // The keys never go into the uploaded project archive; eas-cli sends the signing separately.
 fs.writeFileSync(path.join(dir,'.easignore'),'certs/\ncredentials.json\nnode_modules/\n');
 return dir;
}
// Runs eas-cli in the folder. Only the Expo token is in its environment.
function run(dir,args,{timeoutMs=10*60000}={}){
 const bin=binary();if(!bin)return Promise.reject(fail(503,'Publishing to the stores is not installed on this server yet (the eas program).'));
 const token=String(process.env.EXPO_TOKEN||'').trim();if(!token)return Promise.reject(fail(503,'Publishing to the stores needs EXPO_TOKEN on the server (Railway).'));
 const env={PATH:process.env.PATH||'/usr/local/bin:/usr/bin:/bin',HOME:dir,EXPO_TOKEN:token,EAS_NO_VCS:'1',CI:'1',EXPO_NO_TELEMETRY:'1',EAS_BUILD_NO_EXPO_GO_WARNING:'true'};
 for(const k of ['HTTPS_PROXY','HTTP_PROXY','NO_PROXY','https_proxy','http_proxy','no_proxy','SSL_CERT_FILE','NODE_EXTRA_CA_CERTS'])if(process.env[k])env[k]=process.env[k];
 return new Promise((resolve,reject)=>{
  const child=spawn(bin,args,{cwd:dir,env,stdio:['ignore','pipe','pipe']});
  let out='',err='';child.stdout.on('data',d=>{out+=d});child.stderr.on('data',d=>{err=(err+d).slice(-6000)});
  const timer=setTimeout(()=>{try{child.kill('SIGKILL')}catch{}},timeoutMs);
  child.on('close',code=>{clearTimeout(timer);if(code===0)resolve({out,err});else reject(fail(502,'Expo: '+(lastLine(err)||lastLine(out)||'stopped with code '+code)))});
 });
}
function lastLine(t){return String(t||'').split('\n').map(l=>l.replace(/\x1b\[[0-9;]*m/g,'').trim()).filter(l=>l&&!/^[›»✔-]\s*$/.test(l)).slice(-2).join(' ').slice(0,400)}
function json(t){const s=String(t||''),a=s.search(/[[{]/);if(a<0)return null;try{return JSON.parse(s.slice(a))}catch{return null}}

// ---------- what is still needed, in plain words ----------
function checklist(id){
 const meta=builder.loadMeta(id),s=meta.store||{},view=listing.view(meta),r=ready();
 const items=[
  {key:'native',ok:require('./react-native-app').enabled(meta),text:'A native iPhone and Android app (ask for "an iPhone app…")'},
  {key:'listing',ok:Boolean(view.listing)&&!view.missing.length,text:view.listing?(view.missing.length?'Store listing: still needs '+view.missing.join(' ').toLowerCase():'Store listing ready'):'Prepare the store listing'},
  {key:'server',ok:r.eas&&r.expo_token,text:r.eas&&r.expo_token?'Kairoq can build for the stores':'Kairoq needs EXPO_TOKEN and the eas program on the server (admin)'},
  {key:'apple',ok:has(id,S.ascP8)&&has(id,S.ascAppId),text:has(id,S.ascP8)?(has(id,S.ascAppId)?'Apple: key saved, app found in App Store Connect':'Apple: key saved, but no app with the ID '+view.bundle_id+' in App Store Connect yet'):'Apple: add your App Store Connect API key'},
  {key:'google',ok:has(id,S.playJson),text:has(id,S.playJson)?'Google Play: service account saved'+(s.google&&s.google.first_upload_done?'':' (the first upload is done by hand)'):'Google Play: add a service account key (optional for the first upload)'},
 ];
 return items;
}
function status(id){
 const meta=builder.loadMeta(id),s=meta.store||{};
 return{...listing.view(meta),checklist:checklist(id),runs:(s.runs||[]).slice(-10).reverse(),server:ready(),apple:s.apple||null,google:s.google||null,locked:s.locked||{}};
}

// ---------- publish ----------
// Starts a store build for one platform; returns at once. The build is followed by refresh().
async function publish(id,platform,{fetchImpl,onRun=()=>{}}={}){
 if(!['ios','android'].includes(platform))throw fail(400,'Choose iOS or Android');
 let meta=builder.loadMeta(id);
 if(!require('./react-native-app').enabled(meta))throw fail(409,'Only native apps go to the stores. Ask for "an iPhone app…" to make one.');
 const view=listing.view(meta);
 if(!view.listing)throw fail(409,'Prepare the store listing first.');
 const r=ready();if(!r.eas||!r.expo_token)throw fail(503,'Publishing to the stores is not set up on this server yet (EXPO_TOKEN and the eas program).');
 if((meta.store&&meta.store.runs||[]).some(x=>x.platform===platform&&['starting','building','submitting'].includes(x.state)))throw fail(409,'A '+(platform==='ios'?'iOS':'Android')+' build is already running.');
 // Signing, made once and kept.
 if(platform==='ios'){
  if(!has(id,S.ascP8))throw fail(409,'Add your App Store Connect API key first.');
  if(!has(id,S.iosP12)){
   const key={keyId:secrets.get(id,S.ascKeyId),issuerId:secrets.get(id,S.ascIssuer),p8:secrets.get(id,S.ascP8)};
   const made=await signing.appleSigning(signing.client(key,{fetchImpl}),{identifier:view.bundle_id,name:meta.name});
   secrets.set(id,S.iosP12,made.p12);secrets.set(id,S.iosP12Password,made.p12Password);secrets.set(id,S.iosProfile,made.profile);
   if(!has(id,S.ascAppId)){const app=await signing.appRecord(signing.client(key,{fetchImpl}),view.bundle_id);if(app)secrets.set(id,S.ascAppId,app.id)}
  }
 }else if(!has(id,S.keystore)){
  const k=signing.androidKeystore(meta.name);secrets.set(id,S.keystore,k.keystore);secrets.set(id,S.keystorePassword,k.keystorePassword);
 }
 const runId=Date.now().toString(36);
 const record=patch=>{const m=builder.loadMeta(id);m.store=m.store||{};m.store.runs=(m.store.runs||[]).map(x=>x.id===runId?{...x,...patch,updated_at:new Date().toISOString()}:x);builder.saveMeta(m);onRun(m.store.runs.find(x=>x.id===runId))};
 {const m=builder.loadMeta(id);m.store=m.store||{};m.store.runs=[...(m.store.runs||[]).slice(-19),{id:runId,platform,version:m.current_version,state:'starting',text:'Getting the app ready for Expo',at:new Date().toISOString()}];
  m.store.locked={...(m.store.locked||{}),[platform==='ios'?'bundle_id':'package_name']:true};builder.saveMeta(m)}
 // The slow part runs in the background; the panel shows each step.
 (async()=>{
  const dir=workspace(id,platform);
  try{
   meta=builder.loadMeta(id);
   if(!meta.store.expo_project_id){
    const init=await run(dir,['init','--non-interactive','--force','--json']);
    const j=json(init.out)||{};const app=JSON.parse(fs.readFileSync(path.join(dir,'app.json'),'utf8'));
    const pid=j.id||j.projectId||(app.expo&&app.expo.extra&&app.expo.extra.eas&&app.expo.extra.eas.projectId);
    if(!pid)throw fail(502,'Expo did not create the project.');
    const m=builder.loadMeta(id);m.store.expo_project_id=pid;builder.saveMeta(m);
   }
   record({state:'building',text:'Building on Expo\'s servers (usually 10 to 30 minutes)'});
   const b=await run(dir,['build','--platform',platform,'--profile','production','--non-interactive','--no-wait','--json']);
   const build=[].concat(json(b.out)||[])[0];
   if(!build||!build.id)throw fail(502,'Expo did not start the build.');
   record({build_id:build.id,build_url:'https://expo.dev/accounts/'+(build.project&&build.project.ownerAccount&&build.project.ownerAccount.name||'_')+'/projects/'+(build.project&&build.project.slug||'_')+'/builds/'+build.id});
  }catch(e){record({state:'failed',text:String(e.message||e).slice(0,400)})}
  finally{fs.rmSync(dir,{recursive:true,force:true})}
 })();
 return status(id);
}
// Follows the running builds (called when the panel is open): finished iOS builds are sent to
// App Store Connect; finished Android builds to Google Play once the first upload is done.
async function refresh(id){
 const meta=builder.loadMeta(id),runs=(meta.store&&meta.store.runs)||[];
 for(const r of runs.filter(x=>x.state==='building'&&x.build_id)){
  if(r.checked_at&&Date.now()-Date.parse(r.checked_at)<30000)continue;
  const dir=workspace(id,r.platform);
  const patch=p=>{const m=builder.loadMeta(id);m.store.runs=m.store.runs.map(x=>x.id===r.id?{...x,...p,checked_at:new Date().toISOString()}:x);builder.saveMeta(m)};
  try{
   const v=json((await run(dir,['build:view',r.build_id,'--json'],{timeoutMs:60000})).out)||{};
   const st=String(v.status||'').toUpperCase();
   if(st==='ERRORED'||st==='CANCELED')patch({state:'failed',text:'The build failed on Expo'+(v.error&&v.error.message?': '+String(v.error.message).slice(0,300):'')+'. Open the build log for details.'});
   else if(st==='FINISHED'){
    const file=v.artifacts&&(v.artifacts.applicationArchiveUrl||v.artifacts.buildUrl)||null;
    const m=builder.loadMeta(id),canSubmit=r.platform==='ios'?has(id,S.ascAppId):has(id,S.playJson)&&Boolean(m.store.google&&m.store.google.first_upload_done);
    if(!canSubmit){patch({state:'built',file,text:r.platform==='ios'?'Built. Create the app in App Store Connect with the bundle ID '+listing.identifiers(m).bundle_id+', then press Send to App Store.':'Built. Upload this file once in the Google Play Console (Internal testing), then Kairoq sends the next ones.'})}
    else{
     patch({state:'submitting',file,text:r.platform==='ios'?'Sending to App Store Connect':'Sending to Google Play (internal testing)'});
     try{await run(dir,['submit','--platform',r.platform,'--id',r.build_id,'--profile','production','--non-interactive','--wait'],{timeoutMs:30*60000});
      patch({state:'submitted',text:r.platform==='ios'?'In App Store Connect. It appears in TestFlight in a few minutes; add the listing and press Submit for Review there.':'In Google Play internal testing as a draft. Review it in the Play Console and roll it out.'})}
     catch(e){patch({state:'failed',text:'Sending to the store failed: '+String(e.message||e).slice(0,300)})}
    }
   }else patch({text:st==='IN_QUEUE'||st==='NEW'?'Waiting in Expo\'s queue':'Building on Expo\'s servers'});
  }catch(e){patch({text:'Could not check the build just now ('+String(e.message||e).slice(0,160)+').'})}
  finally{fs.rmSync(dir,{recursive:true,force:true})}
 }
 return status(id);
}
// The owner created the App Store record after the build: find it and send the finished build.
async function sendBuilt(id,runId,{fetchImpl}={}){
 const meta=builder.loadMeta(id),r=((meta.store&&meta.store.runs)||[]).find(x=>x.id===runId);
 if(!r||r.state!=='built')throw fail(409,'There is no finished build waiting to be sent.');
 if(r.platform==='ios'&&!has(id,S.ascAppId)){
  const key={keyId:secrets.get(id,S.ascKeyId),issuerId:secrets.get(id,S.ascIssuer),p8:secrets.get(id,S.ascP8)};
  const app=await signing.appRecord(signing.client(key,{fetchImpl}),listing.identifiers(meta).bundle_id);
  if(!app)throw fail(409,'There is still no app with the bundle ID '+listing.identifiers(meta).bundle_id+' in App Store Connect. Create it there (My Apps → + → New App) and try again.');
  secrets.set(id,S.ascAppId,app.id);
 }
 const m=builder.loadMeta(id);
 // Android: the owner uploaded this build by hand (Google's rule for the first one); from now on
 // Kairoq sends the builds itself.
 if(r.platform==='android'){
  m.store.google={...(m.store.google||{}),first_upload_done:true};
  m.store.runs=m.store.runs.map(x=>x.id===runId?{...x,state:'submitted',text:'Uploaded by hand in the Play Console. Kairoq sends the next builds to Google Play itself'+(has(id,S.playJson)?'.':' once the service account key is added.')}:x);
  builder.saveMeta(m);return status(id);
 }
 m.store.runs=m.store.runs.map(x=>x.id===runId?{...x,state:'building',checked_at:null}:x);
 builder.saveMeta(m);
 return refresh(id);
}
module.exports={publish,refresh,sendBuilt,status,checklist,saveApple,saveGoogle,firstUploadDone,workspace,ready,binary,S};
