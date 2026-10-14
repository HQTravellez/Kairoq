"use strict";
// Mobile apps for Create projects.
// - Every published app is an installable PWA: web manifest, icons and an offline-capable
//   service worker, so "Add to Home Screen" works on iPhone and Android.
// - With the "mobile app" setting on, the AI designs phone-first, the code export becomes a
//   Capacitor iOS/Android project, and pushing to GitHub builds an Android APK with Actions.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const builder=require('./react-builder');

function fail(status,message){return Object.assign(Error(message),{status})}
const COLOR=/^#[0-9a-fA-F]{6}$/;
function slug(name){return String(name||'app').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'app'}
function defaultAppId(meta){return'app.kairoq.'+slug(meta.name).replace(/-/g,'').replace(/^(\d)/,'a$1').slice(0,30)+meta.id.slice(0,6)}
function settings(meta){
 const m=meta.mobile||{};
 const name=String(m.name||meta.seo?.title||meta.name||'App').slice(0,45);
 return{enabled:Boolean(m.enabled),name,short_name:String(m.short_name||name).slice(0,12),theme_color:COLOR.test(m.theme_color||'')?m.theme_color:'#111827',background_color:COLOR.test(m.background_color||'')?m.background_color:'#ffffff',icon:m.icon||null,app_id:m.app_id||defaultAppId(meta)};
}
function update(id,body){
 const meta=builder.loadMeta(id),b=body||{},next={...(meta.mobile||{})};
 if(b.enabled!==undefined)next.enabled=Boolean(b.enabled);
 if(b.name!==undefined)next.name=String(b.name).trim().slice(0,45)||undefined;
 if(b.short_name!==undefined)next.short_name=String(b.short_name).trim().slice(0,12)||undefined;
 for(const k of ['theme_color','background_color'])if(b[k]!==undefined){if(b[k]&&!COLOR.test(b[k]))throw fail(400,k.replace('_',' ')+' must look like #1a2b3c');next[k]=b[k]||undefined}
 if(b.icon!==undefined){
  if(b.icon&&!require('./react-assets').list(id).some(a=>a.name===b.icon&&/\.(png|jpe?g|webp)$/.test(a.name)))throw fail(400,'Pick a PNG, JPEG or WebP image from the project uploads as the icon');
  next.icon=b.icon||undefined;
 }
 if(b.app_id!==undefined){
  const v=String(b.app_id).trim();
  if(v&&!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(v)||v.length>100)throw fail(400,'App ID must look like com.yourcompany.yourapp (lowercase letters, numbers and dots)');
  next.app_id=v||undefined;
 }
 meta.mobile=next;builder.saveMeta(meta);
 clearIcons(id);
 return settings(meta);
}

// ---------- icons ----------
const SIZES={'icon-192.png':192,'icon-512.png':512,'apple-touch-icon.png':180};
function iconDir(id){return path.join(builder.projectDir(id),'mobile')}
function clearIcons(id){fs.rmSync(iconDir(id),{recursive:true,force:true})}
// A plain PNG in the theme colour, used until the rendered icon exists or without Chromium.
function solidPng(size,hex){
 const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const row=Buffer.alloc(1+size*3);for(let x=0;x<size;x++){row[1+x*3]=r;row[2+x*3]=g;row[3+x*3]=b}
 const raw=Buffer.concat(Array.from({length:size},()=>row));
 const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(zlib.crc32?zlib.crc32(td)>>>0:crc32(td));return Buffer.concat([len,td,crc])};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function crc32(buf){let c,crc=0xffffffff;for(const b of buf){c=(crc^b)&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c}return(crc^0xffffffff)>>>0}
function iconHtml(meta,size){
 const s=settings(meta);
 const asset=s.icon&&require('./react-assets').read(meta.id,s.icon);
 const initials=(s.name.match(/\b[\p{L}\p{N}]/gu)||['A']).slice(0,2).join('').toUpperCase();
 const inner=asset?'<img src="data:'+asset.type+';base64,'+asset.bytes.toString('base64')+'" style="width:100%;height:100%;object-fit:cover">'
  :'<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font:700 '+Math.round(size*(initials.length>1?0.38:0.5))+'px system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;letter-spacing:-0.02em">'+initials.replace(/[<>&"]/g,'')+'</div>';
 return'<!doctype html><html><body style="margin:0;width:'+size+'px;height:'+size+'px;background:'+s.theme_color+';overflow:hidden">'+inner+'</body></html>';
}
const rendering=new Map();
// Returns PNG bytes for an icon; renders it with Chromium once, otherwise a solid colour.
function icon(id,name){
 const size=SIZES[name];if(!size)return null;
 const file=path.join(iconDir(id),name);
 if(fs.existsSync(file))return fs.readFileSync(file);
 const meta=builder.loadMeta(id);
 renderIcons(id).catch(()=>{});
 return solidPng(size,settings(meta).theme_color);
}
async function renderIcons(id,{render=require('./runtime-check').renderHtml}={}){
 if(rendering.has(id))return rendering.get(id);
 const job=(async()=>{
  const meta=builder.loadMeta(id),dir=iconDir(id);
  fs.mkdirSync(dir,{recursive:true});
  for(const [name,size] of Object.entries(SIZES)){
   let png=null;
   try{png=await render(iconHtml(meta,size),{width:size,height:size})}catch{}
   fs.writeFileSync(path.join(dir,name),png||solidPng(size,settings(meta).theme_color));
  }
 })().finally(()=>rendering.delete(id));
 rendering.set(id,job);
 return job;
}

// ---------- PWA files for published sites ----------
function manifest(meta){
 const s=settings(meta);
 return{name:s.name,short_name:s.short_name,id:'./',start_url:'./',scope:'./',display:'standalone',orientation:s.enabled?'portrait':'any',theme_color:s.theme_color,background_color:s.background_color,
  ...(meta.seo?.description?{description:meta.seo.description}:{}),
  icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
}
// Network first for pages (offline falls back to the last copy), cache first for built assets.
// Backend requests (/api/) are never cached.
function serviceWorker(version){
 return `const CACHE='kairoq-${Number(version)||0}';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.add('./')).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kairoq-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);if(u.origin!==location.origin||u.pathname.includes('/api/'))return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('./',copy))}return res}).catch(()=>caches.match('./').then(hit=>hit||Response.error())));return}
  if(/\\/assets\\/|\\/uploads\\/|\\.(png|jpe?g|webp|gif|svg|woff2?)$/.test(u.pathname))e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return res})));
});
`;
}
const REGISTER="if('serviceWorker' in navigator){addEventListener('load',()=>{try{navigator.serviceWorker.register('sw.js').catch(()=>{})}catch(e){}})}\n";
function headTags(meta){
 const s=settings(meta),e=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return['<link rel="manifest" href="manifest.webmanifest">','<meta name="theme-color" content="'+s.theme_color+'">','<link rel="icon" type="image/png" href="icon-192.png">','<link rel="apple-touch-icon" href="apple-touch-icon.png">',
  '<meta name="mobile-web-app-capable" content="yes">','<meta name="apple-mobile-web-app-capable" content="yes">','<meta name="apple-mobile-web-app-title" content="'+e(s.short_name)+'">','<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<script src="kairoq-pwa.js" defer></script>'];
}
// Serves manifest, service worker and icons for a published site. Returns true when handled.
function serveSiteFile(req,res,meta,rel){
 const send=(type,body,cache='public, max-age=3600')=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':cache,'X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);return true};
 if(rel==='manifest.webmanifest')return send('application/manifest+json; charset=utf-8',JSON.stringify(manifest(meta)));
 if(rel==='sw.js')return send('text/javascript; charset=utf-8',serviceWorker(meta.published.version),'no-cache');
 if(rel==='kairoq-pwa.js')return send('text/javascript; charset=utf-8',REGISTER);
 if(SIZES[rel])return send('image/png',icon(meta.id,rel));
 return false;
}

// ---------- native projects (Capacitor) ----------
const CAPACITOR='^7.0.0';
const ANDROID_WORKFLOW=`name: Android app
# Built by Kairoq: makes a debug APK of this app on every push. Download it from the run's
# "Artifacts" section and install it on an Android phone (allow installs from this source).
on:
  push:
    branches: [main, master]
  workflow_dispatch:
jobs:
  apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
      - run: npm install
      - run: npm run build
      - run: npx cap add android
      - run: npx cap sync android
      - run: cd android && ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: android-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
`;
function nativeReadme(meta){
 const s=settings(meta);
 return`

## Mobile app (iOS and Android)

This project is set up with [Capacitor](https://capacitorjs.com), which packages the web app as a real iOS and Android app. App ID: \`${s.app_id}\`.

**Android APK without installing anything:** push this project to GitHub (Kairoq does this from Settings). The *Android app* workflow builds \`app-debug.apk\` on every push: open the run under **Actions** and download it from **Artifacts**. For the Play Store, build a signed release in Android Studio (\`npm run android\`) and upload it with a Google Play developer account.

**Android Studio:**
\`\`\`
npm install
npx cap add android
npm run android
\`\`\`

**iPhone (needs a Mac with Xcode):**
\`\`\`
npm install
npx cap add ios
npm run ios
\`\`\`
Publishing to the App Store needs an Apple Developer account.

The app talks to its Kairoq backend over the internet, so sign-in and data work the same as on the web. Google sign-in and password-reset links open the web version of the app.
`;
}
// Extra files and package.json changes for the export when the mobile setting is on.
function nativeFiles(meta,pkgJson){
 const s=settings(meta);
 const pkg=JSON.parse(pkgJson);
 pkg.scripts={...pkg.scripts,android:'npm run build && npx cap sync android && npx cap open android',ios:'npm run build && npx cap sync ios && npx cap open ios'};
 pkg.dependencies={...pkg.dependencies,'@capacitor/core':CAPACITOR};
 pkg.devDependencies={...pkg.devDependencies,'@capacitor/cli':CAPACITOR,'@capacitor/android':CAPACITOR,'@capacitor/ios':CAPACITOR};
 return{
  'package.json':JSON.stringify(pkg,null,2)+'\n',
  'capacitor.config.json':JSON.stringify({appId:s.app_id,appName:s.name,webDir:'dist',server:{androidScheme:'https'},backgroundColor:s.background_color},null,2)+'\n',
  '.github/workflows/kairoq-android.yml':ANDROID_WORKFLOW
 };
}
// The note added to the AI's instructions when the project is a mobile app.
function promptNote(meta){
 if(!settings(meta).enabled)return'';
 return'\n\nThis project is a MOBILE APP (installed on phones as a native iOS/Android app and a home-screen web app). Design phone-first for a 390px wide screen: a sticky top bar and bottom tab navigation for the main sections, full-width cards and lists, touch targets at least 44px, 16px+ body text, no hover-only interactions, and safe-area padding (padding-top: env(safe-area-inset-top), padding-bottom: env(safe-area-inset-bottom)). Use HashRouter for screens. Keep it usable on tablets and desktop too (center the content with a max width).';
}
// QR code (SVG) for opening a URL on a phone, rendered with the bundled qrcode.react.
function qrSvg(url){
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{QRCodeSVG}=require('qrcode.react');
 const svg=renderToStaticMarkup(React.createElement(QRCodeSVG,{value:String(url).slice(0,1000),size:200,marginSize:2,title:'Open on your phone'}));
 // An SVG shown through <img> needs its namespace.
 return/xmlns=/.test(svg)?svg:svg.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');
}
module.exports={settings,update,manifest,serviceWorker,headTags,serveSiteFile,icon,renderIcons,solidPng,nativeFiles,nativeReadme,promptNote,qrSvg,SIZES};
