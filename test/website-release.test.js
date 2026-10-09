'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const web=require('../developer-agent'),release=require('../website-release'),{starter}=require('../developer-starter');
function fixture(){const id='website-release-'+crypto.randomBytes(5).toString('hex'),folder=path.join(__dirname,'..','workspace','developer-projects',id),outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-website-release-')),files=starter('Build a corporate travel website','Travellez','tech').files;files['platform.html']=files['index.html'].replace('Travellez','Travellez Platform');fs.mkdirSync(folder,{recursive:true});for(const[name,code]of Object.entries(files))fs.writeFileSync(path.join(folder,name),code);const meta={id,kind:'website',project_name:'Travellez',file_names:Object.keys(files),pages:['index.html','platform.html'],qa:{passed:true,visual_review:{passed:true,coverage:{complete:true,mode:'ai-screenshot-review'}}},status:'draft'};fs.writeFileSync(path.join(folder,'project.json'),JSON.stringify(meta));return{id,folder,outputRoot,meta,clean(){fs.rmSync(folder,{recursive:true,force:true});fs.rmSync(outputRoot,{recursive:true,force:true});}};}
test('website publication checks every route and preserves immutable live snapshots',async()=>{
 const f=fixture(),seen=[];try{
  const published=await release.deploy(f.id,{outputRoot:f.outputRoot,origin:'https://example.test',verify:async url=>{seen.push(url);return{passed:true,tested:['public route'],_screenshots:[]};}});
  assert.equal(published.status,'live');assert.deepEqual(published.deployed_qa.pages,['index.html','platform.html']);assert.equal(seen.length,2);assert.ok(seen.some(url=>url.endsWith('/platform.html')));
  const live=path.join(f.outputRoot,f.id,published.published_version,'index.html'),before=fs.readFileSync(live,'utf8');assert.match(before,/<style>/);assert.match(before,/<script>/);
  fs.writeFileSync(path.join(f.folder,'styles.css'),fs.readFileSync(path.join(f.folder,'styles.css'),'utf8')+'\n/* new draft */');
  await assert.rejects(release.deploy(f.id,{outputRoot:f.outputRoot,origin:'https://example.test',verify:async()=>{throw Error('Public navigation failed');}}),/navigation failed/);
  assert.equal(web.getProject(f.id).live_url,published.url);assert.equal(fs.readFileSync(live,'utf8'),before);assert.deepEqual(fs.readdirSync(path.join(f.outputRoot,f.id)),[published.published_version]);
 }finally{f.clean();}
});
test('publication rejects fallback visual scores and incomplete review before exposure',async()=>{
 const f=fixture();try{for(const coverage of [{complete:true,mode:'deterministic-browser-fallback'},{complete:false,mode:'ai-screenshot-review'}]){fs.writeFileSync(path.join(f.folder,'project.json'),JSON.stringify({...f.meta,qa:{passed:true,visual_review:{passed:true,coverage}}}));await assert.rejects(release.deploy(f.id,{outputRoot:f.outputRoot,origin:'https://example.test',verify:async()=>{throw Error('Should not verify rejected project');}}),/complete AI screenshot review/);assert.equal(fs.existsSync(path.join(f.outputRoot,f.id)),false);}}finally{f.clean();}
});
test('legacy saved websites recover their preview URL when reopened',()=>{
 const f=fixture();try{assert.equal(web.getProject(f.id).preview_url,'/api/developer/preview/'+f.id+'/index.html');}finally{f.clean();}
});
