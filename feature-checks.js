"use strict";
// Feature coverage: every flow a customer uses on a published app gets a saved browser check,
// so the live guard (live-guard.js) protects all of it, not only the flows the AI happened to
// write checks for while building. Once per published version, Kairoq (at its own cost):
//  1. lists the app's customer flows from its code, money path first (book, order, pay, enquire,
//     sign up), leaving out the ones existing checks already cover;
//  2. writes a check for each (react-checks.write) and runs it on the published version against
//     a test copy of the data;
//  3. keeps only the checks that pass. A flow that cannot be checked is listed as not covered,
//     with why, so the owner sees what is and is not protected.
const builder=require('./react-builder');

const MAX_FLOWS=5,MAX_NEW=3;
function enabled(){return process.env.KAIROQ_COVERAGE!=='off'}
const LIST_PROMPT=`You list the flows customers use in a small business web app, so each can get an automated browser test.
Return the flows that change something or start business: book, reserve, order, add to cart, check out or start a payment, send an enquiry or contact form, sign up, sign in, subscribe, upload, leave a review, add or edit a record. Not: reading pages, scrolling, purely visual things, admin-only screens behind a staff login.
Leave out flows the existing checks already cover. Order by how directly the flow brings in money or customers. At most ${MAX_FLOWS}.
Respond with ONLY JSON: {"flows":[{"name":"short name, e.g. Book a table","description":"what a customer does and what proves it worked, using the exact button texts and field labels in the code","money":true}]}`;
function parseJson(content){
 const t=String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
 try{return JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('not JSON');return JSON.parse(t.slice(a,b+1))}
}
async function listFlows(id,n,{callModel,signal}){
 const meta=builder.loadMeta(id),files=builder.loadFiles(id,n),checks=require('./react-checks').list(meta);
 const memory=require('./project-memory').note(meta,files);
 const have=checks.length?'Existing checks: '+checks.map(c=>c.name).join('; '):'There are no checks yet.';
 const v=await callModel({messages:[{role:'system',content:LIST_PROMPT},{role:'user',content:have+memory+'\n\nApp source:\n'+builder.contextFiles(files,50000)}],temperature:0,maxOutputTokens:1500,signal,tier:'standard',purpose:'feature-checks'},parseJson);
 return(Array.isArray(v&&v.flows)?v.flows:[]).map(f=>({name:String(f&&f.name||'').replace(/\s+/g,' ').trim().slice(0,80),description:String(f&&f.description||'').trim().slice(0,600),money:Boolean(f&&f.money)})).filter(f=>f.name&&f.description).slice(0,MAX_FLOWS);
}
// Runs coverage once per version: the published one (the live guard), or the one about to be
// published (the launch gate). Returns the coverage record.
async function ensure(id,{callModel,inspect,signal,force=false,version}={}){
 const checks=require('./react-checks');
 let meta=builder.loadMeta(id);
 const n=Number(version)||(meta.published&&meta.published.version);
 if(!n||!enabled()||!callModel||!inspect)return null;
 if(!force&&meta.coverage&&meta.coverage.version===n)return meta.coverage;
 const flows=await listFlows(id,n,{callModel,signal});
 const url=builder.previewUrl(meta,n),out=[];
 let added=0;
 for(const f of flows){
  meta=builder.loadMeta(id);
  if(added>=MAX_NEW||checks.list(meta).length>=checks.MAX_CHECKS){out.push({name:f.name,money:f.money,covered:false,why:'waiting for the next check-up'});continue}
  let draft;
  try{draft=await checks.write(id,f.name+': '+f.description,{callModel,signal,version:n})}
  catch(e){out.push({name:f.name,money:f.money,covered:false,why:'Kairoq could not write a check for it'});continue}
  draft={...draft,name:f.name};
  const r=await checks.run(id,url,{inspect,checks:[{...draft,id:'draft',enabled:true}],record:false,version:n}).catch(()=>null);
  if(!r||r.skipped)return null;// no browser: try again next time
  if(r.failed.length){out.push({name:f.name,money:f.money,covered:false,why:'it did not pass in Kairoq\'s browser: '+String(r.failed[0].step||r.failed[0].error||'').slice(0,160)});continue}
  const saved=checks.save(id,draft,{source:'kairoq'});
  added++;out.push({name:f.name,money:f.money,covered:true,check:saved.id});
 }
 meta=builder.loadMeta(id);
 meta.coverage={version:n,at:new Date().toISOString(),flows:out,checks:checks.list(meta).filter(c=>c.enabled!==false).map(c=>c.name)};
 builder.saveMeta(meta);
 return meta.coverage;
}
function view(meta){const c=meta.coverage;return c?{version:c.version,at:c.at,flows:c.flows,protected:c.checks||[]}:null}
module.exports={ensure,listFlows,view,enabled};
