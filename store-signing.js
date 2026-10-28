"use strict";
// Signing for the app stores, made by Kairoq so the owner never opens Xcode or a terminal.
// - Apple: with the owner's App Store Connect API key, Kairoq registers the bundle ID, makes a
//   distribution certificate (from a key it creates here) and an App Store provisioning profile,
//   and finds the app record the owner created in App Store Connect.
// - Google: an upload keystore (RSA 2048, valid 30 years) for signing the Android app bundle.
// Keys are made with node-forge (BSD-3-Clause) and stored only as encrypted project secrets.
const crypto=require('crypto');
const forge=require('node-forge');
const API='https://api.appstoreconnect.apple.com';

function fail(status,message){return Object.assign(Error(message),{status})}
const b64url=b=>Buffer.from(b).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');

// ---------- App Store Connect API ----------
// key: {keyId, issuerId, p8} (the .p8 file's text).
function token(key,now=Math.floor(Date.now()/1000)){
 if(!/^[A-Z0-9]{8,12}$/.test(String(key.keyId||'')))throw fail(400,'The App Store Connect key ID looks wrong (10 letters and numbers, from Users and Access → Integrations).');
 if(!/^[0-9a-f-]{36}$/i.test(String(key.issuerId||'')))throw fail(400,'The issuer ID looks wrong (a long ID shown above the keys list in App Store Connect).');
 if(!/BEGIN PRIVATE KEY/.test(String(key.p8||'')))throw fail(400,'Paste the whole .p8 file, from -----BEGIN PRIVATE KEY----- to the end.');
 const head=b64url(JSON.stringify({alg:'ES256',kid:key.keyId,typ:'JWT'}));
 const body=b64url(JSON.stringify({iss:key.issuerId,iat:now,exp:now+15*60,aud:'appstoreconnect-v1'}));
 const sig=crypto.sign('sha256',Buffer.from(head+'.'+body),{key:String(key.p8),dsaEncoding:'ieee-p1363'});
 return head+'.'+body+'.'+b64url(sig);
}
function client(key,{fetchImpl=fetch}={}){
 const call=async(method,path,body)=>{
  const r=await fetchImpl(API+path,{method,headers:{Authorization:'Bearer '+token(key),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const j=await r.json().catch(()=>({}));
  if(r.status===401)throw fail(400,'Apple refused the App Store Connect key. Check the key ID, the issuer ID and the .p8 file, and that the key has the Admin or App Manager role.');
  if(!r.ok){const e=(j.errors||[])[0]||{};throw fail(r.status>=500?502:400,'Apple: '+(e.detail||e.title||('HTTP '+r.status)))}
  return j;
 };
 return{call};
}
async function bundleId(api,identifier,name){
 const found=await api.call('GET','/v1/bundleIds?filter[identifier]='+encodeURIComponent(identifier)+'&limit=5');
 const hit=(found.data||[]).find(b=>b.attributes&&b.attributes.identifier===identifier);
 if(hit)return hit.id;
 const made=await api.call('POST','/v1/bundleIds',{data:{type:'bundleIds',attributes:{identifier,name:String(name).replace(/[^A-Za-z0-9 ]/g,'').slice(0,60)||'App',platform:'IOS'}}});
 return made.data.id;
}
async function appRecord(api,identifier){
 const found=await api.call('GET','/v1/apps?filter[bundleId]='+encodeURIComponent(identifier)+'&limit=1');
 const app=(found.data||[])[0];
 return app?{id:app.id,name:app.attributes&&app.attributes.name}:null;
}
// A new distribution certificate and an App Store profile for the bundle ID.
async function appleSigning(api,{identifier,name}){
 const keys=forge.pki.rsa.generateKeyPair({bits:2048,e:0x10001});
 const csr=forge.pki.createCertificationRequest();
 csr.publicKey=keys.publicKey;
 csr.setSubject([{name:'commonName',value:'Kairoq distribution'},{name:'countryName',value:'CA'}]);
 csr.sign(keys.privateKey,forge.md.sha256.create());
 let cert;
 try{cert=await api.call('POST','/v1/certificates',{data:{type:'certificates',attributes:{csrContent:forge.pki.certificationRequestToPem(csr),certificateType:'DISTRIBUTION'}}})}
 catch(e){if(/maximum|limit|already have a current/i.test(e.message))throw fail(409,'Your Apple account already has the most distribution certificates it can have. In App Store Connect (Certificates, Identifiers & Profiles) revoke one you no longer use, then try again.');throw e}
 const certId=cert.data.id,der=Buffer.from(cert.data.attributes.certificateContent,'base64');
 const bid=await bundleId(api,identifier,name);
 const profile=await api.call('POST','/v1/profiles',{data:{type:'profiles',attributes:{name:('Kairoq '+identifier+' '+Date.now()).slice(0,100),profileType:'IOS_APP_STORE'},relationships:{bundleId:{data:{type:'bundleIds',id:bid}},certificates:{data:[{type:'certificates',id:certId}]}}}});
 const password=crypto.randomBytes(18).toString('base64url');
 const x509=forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(der.toString('binary'))));
 const p12=forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey,[x509],password,{algorithm:'3des',friendlyName:'Kairoq distribution'})).getBytes();
 return{p12:Buffer.from(p12,'binary').toString('base64'),p12Password:password,profile:profile.data.attributes.profileContent,certificateId:certId,profileId:profile.data.id,bundleIdId:bid};
}

// ---------- Android upload keystore ----------
function androidKeystore(name='Kairoq app'){
 const keys=forge.pki.rsa.generateKeyPair({bits:2048,e:0x10001});
 const cert=forge.pki.createCertificate();
 cert.publicKey=keys.publicKey;
 cert.serialNumber='01'+crypto.randomBytes(8).toString('hex');
 cert.validity.notBefore=new Date();
 cert.validity.notAfter=new Date(Date.now()+30*365.25*86400000);
 const subject=[{name:'commonName',value:String(name).slice(0,60)||'App'},{name:'organizationName',value:'Kairoq'}];
 cert.setSubject(subject);cert.setIssuer(subject);
 cert.sign(keys.privateKey,forge.md.sha256.create());
 const password=crypto.randomBytes(18).toString('base64url'),alias='upload';
 const p12=forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey,[cert],password,{algorithm:'3des',friendlyName:alias})).getBytes();
 return{keystore:Buffer.from(p12,'binary').toString('base64'),keystorePassword:password,keyAlias:alias,keyPassword:password};
}
module.exports={token,client,bundleId,appRecord,appleSigning,androidKeystore,API};
