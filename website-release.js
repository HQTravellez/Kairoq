'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const web=require('./developer-agent'),pipeline=require('./design-pipeline');
const gates=require('./benchmark-gates'),forms=require('./website-forms');
const ROOT=path.join(__dirname,'workspace','generated','developer-sites');
const CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src data:; connect-src 'self'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; sandbox allow-scripts";
function contentPolicy(route,origin=require('./app-release').publicOrigin()){
 const match=/^\/generated\/developer-sites\/([a-z0-9-]{5,85})\/([a-f0-9]{16})\/[a-z0-9-]+\.html$/.exec(route);
 if(!match||!origin)return CSP;
 const url=new URL(origin);if(!['http:','https:'].includes(url.protocol)||url.origin!==origin)throw Error('Invalid public website origin');
 // Opaque sandbox frames require an explicit URL, not a same-origin exception.
 return CSP.replace("connect-src 'self'",'connect-src '+origin+'/builder-assets/ '+origin+'/api/website-forms/'+match[1]+'/'+match[2]);
}
async function deploy(id,{outputRoot=ROOT,origin=require('./app-release').publicOrigin(),verify=require('./deployed-website-qa').verify,callModel,inboxRoot}={}){
 const project=web.getProject(id),visual=project.qa?.visual_review;
 if(project.kind!=='website')throw Error('Use the application runtime to deploy interactive apps');
 if(!project.qa?.passed||!gates.validVisual(visual))throw Error('Website publishing requires passing functional QA and complete AI screenshot review');
 if(!origin)throw Error('Configure the public Railway origin before publishing a website');
 const files=web.normalizeFiles(project.files),pages=Object.keys(files).filter(name=>name.endsWith('.html'));
 const version=crypto.createHash('sha256').update('website-runtime-v2|'+origin+'|'+JSON.stringify(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)))).digest('hex').slice(0,16);
 const folder=path.join(outputRoot,id,version),baseURL='/generated/developer-sites/'+id+'/'+version+'/',url=baseURL+'index.html',created=!fs.existsSync(folder),routes=[],shots=[];
 fs.mkdirSync(folder,{recursive:true});
 let formConfig;
 try{
  formConfig=forms.prepare(id,version,files,{root:inboxRoot,origin});
  for(const name of pages){const html=web.assemble(files,name,{formConfig}),file=path.join(folder,name);if(created)fs.writeFileSync(file,html);else if(fs.readFileSync(file,'utf8')!==html)throw Error('Published website snapshot does not match its content version');}
  for(const name of pages){const result=await verify(origin+baseURL+name);if(!result?.passed)throw Error('Published website failed QA: '+name);const evidence=pipeline.stripShots(result);shots.push(...evidence.map(shot=>({...shot,label:name+' · '+shot.label})));routes.push({page:name,...result});}
  const deployed_qa={passed:true,scope:'all public HTML routes',pages,routes,evidence:gates.evidenceManifest(shots),at:new Date().toISOString()};
  if(callModel)deployed_qa.visual_review=await gates.reviewEvidence(callModel,pipeline.restoreScope(project.design_plan,project.design_plan?.user_brief||project.brief),shots,project.deployed_qa?.visual_review);
  else if(id.startsWith('travellez-corporate-travel-website-benchmark-'))throw Error('Travellez publication requires a public screenshot reviewer');
  pipeline.saveEvidence(folder,shots);fs.writeFileSync(path.join(folder,'release.json'),JSON.stringify({id,version,deployed_qa},null,2));
  forms.activate(formConfig);
  forms.activate(formConfig);
  const meta={...project,connected_forms:formConfig?Object.keys(formConfig.forms):[],status:'live',published_version:version,live_url:url,published_at:new Date().toISOString(),deployed_qa,connected_forms:formConfig?Object.keys(formConfig.forms):[]};delete meta.files;
  const metadata=path.join(__dirname,'workspace','developer-projects',id,'project.json'),temp=metadata+'.tmp';fs.writeFileSync(temp,JSON.stringify(meta,null,2));fs.renameSync(temp,metadata);
  return{...meta,url};
 }catch(error){forms.discard(formConfig);if(created)fs.rmSync(folder,{recursive:true,force:true});throw error;}
}
module.exports={deploy,CSP,contentPolicy};
