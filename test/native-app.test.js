'use strict';
// Native mobile apps (react-native-app.js): an iPhone or Android request becomes a React Native app
// (Expo), previewed in the browser through react-native-web, opened on a phone through Expo Snack and
// Expo Go, and downloaded as a ready Expo project.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-native-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_WEB_RESEARCH:'off',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'p'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_CRAFT_CHECK:'off'});
const nat=require('../react-native-app'),builder=require('../react-builder'),runtime=require('../runtime-check');
const FIX=path.join(__dirname,'fixtures','native');
const fixture=()=>{const out={};const walk=(d,rel)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name;if(e.isDirectory())walk(path.join(d,e.name),r);else out['src/'+r]=fs.readFileSync(path.join(d,e.name),'utf8')}};walk(FIX,'');return out};
test.after(()=>runtime.close());

test('phone app requests become native apps; web requests do not',()=>{
 for(const t of ['Build a mobile app: a café ordering app','An iPhone app like Quiver','android app for my gym','a React Native app'])assert.equal(nat.wanted(t),true,t);
 for(const t of ['A website for my café','A booking page that works on mobile'])assert.equal(nat.wanted(t),false,t);
});

test('the design becomes src/theme.js; web code is sent back with the exact fix',()=>{
 const theme=nat.themeFile({palette:{background:'#fbf7f2',foreground:'#1d1b19',primary:'#f2b632'},radius:'0.75rem'});
 assert.match(theme,/"primary": "#f2b632"/);assert.match(theme,/"onPrimary": "#111111"/,'dark text on a light main colour');assert.match(theme,/radius = 12/);
 const bad=nat.problems({'src/App.jsx':"import { Link } from 'react-router-dom';\nexport default()=> <div className=\"p-4\">Hi</div>"});
 assert.equal(bad.length,3);assert.match(bad[0],/<div>.*View/);
 assert.deepEqual(nat.problems(fixture()),[]);
});

test('Snack files and the Expo download: .jsx become .js with imports that still resolve',()=>{
 const files={...nat.starterFiles('Café',null),...fixture()};
 const snack=nat.snackFiles(files);
 assert.ok(snack['App.js']&&snack['src/screens/Menu.js']&&!snack['src/main.js']);
 assert.match(snack['src/App.js'].contents,/from '\.\/screens\/Menu'/);
 assert.doesNotMatch(Object.values(snack).map(f=>f.contents).join('\n'),/\.jsx['"]/);
 const pj=JSON.parse(nat.expoProject(files,{name:'Café Order'})['package.json']);
 assert.equal(pj.main,'expo/AppEntry.js');assert.match(pj.dependencies.expo,/^~\d+\.\d+\.\d+$/);assert.match(pj.dependencies['react-native'],/^0\.\d+\.\d+$/,'pinned to the SDK');
});

test('Run on your phone: the version is saved on Expo Snack and a QR code comes back',async()=>{
 const sent=[];
 const fetchImpl=async(url,opts)=>{sent.push({url:String(url),body:opts&&opts.body});return{ok:true,status:200,json:async()=>({id:'@snack/abc123',hashId:'abc123'}),text:async()=>'{}'}};
 const r=await nat.runOnPhone({name:'Café'},{...nat.starterFiles('Café',null),...fixture()},{fetchImpl});
 const save=sent.find(s=>/\/--\/api\/v2\/snack\/save$/.test(s.url));
 assert.ok(save,'saved to Expo');
 const body=JSON.parse(save.body);assert.ok(body.code['App.js']&&body.code['src/screens/Order.js']);
 assert.match(r.exp_url,/^exp:\/\//);assert.equal(r.snack_url,'https://snack.expo.dev/abc123');assert.match(r.qr,/^<svg/);
});

test('a native app builds with the real build and works in the phone preview',{timeout:240000},async(t)=>{
 const meta=builder.create({name:'Café Order',owner:'owner'});
 await builder.initialize(meta);
 const callModel=async(o,parse)=>{
  if(/art director/.test(String(o.messages[0].content||'')))return parse(JSON.stringify({name:'Warm',summary:'s',palette:{background:'#fbf7f2',foreground:'#1d1b19',primary:'#2f5d50',secondary:'#efe8de',accent:'#c8553d',muted:'#f1ece4'},fonts:{display:'Inter',body:'Inter'},radius:'0.75rem'}));
  const sys=String(o.messages[0].content||'');
  assert.match(sys,/NATIVE MOBILE APP/,'the builder is told it is a native app');
  return parse(JSON.stringify({message:'Built the café ordering app.',files:fixture()}));
 };
 const r=await builder.edit(meta.id,'Build a mobile app: a café ordering app with the menu, an order and opening hours',{callModel});
 const m=builder.loadMeta(meta.id);
 assert.equal(m.native.enabled,true);
 const files=builder.loadFiles(meta.id,r.version);
 assert.ok(files['src/components/native.jsx']&&files['src/theme.js']&&!files['src/index.css']&&!files['src/components/ui/button.jsx']);
 if(!runtime.available()){t.diagnostic('no browser here: only the build was checked');return}
 const server=http.createServer((req,res)=>{if(!builder.handlePreview(req,res)){res.writeHead(404);res.end()}});
 await new Promise(res=>server.listen(0,'127.0.0.1',res));
 const ctx=await (await runtime.browser()).newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+builder.previewUrl(m),{waitUntil:'networkidle'});
  await page.getByText('Flat white').waitFor();
  if(process.env.KAIROQ_KIT_SHOTS)await page.screenshot({path:path.join(process.env.KAIROQ_KIT_SHOTS,'native-menu.png')});
  await page.getByText('Flat white').click();await page.getByText('Cardamom bun').click();
  await page.getByText('2 in your order').waitFor();
  await page.getByRole('tab',{name:'Order'}).click();
  await page.getByPlaceholder('Your first name').fill('Ka');
  await page.getByText('Send order ($8.70)').click();
  await page.getByText('Thanks, Ka.').waitFor();
  if(process.env.KAIROQ_KIT_SHOTS)await page.screenshot({path:path.join(process.env.KAIROQ_KIT_SHOTS,'native-order.png')});
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();server.close()}
});
