'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const web=require('./developer-agent'),pipeline=require('./design-pipeline');
const ROOT=path.join(__dirname,'workspace','generated','developer-sites');
const CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; sandbox allow-scripts";
async function deploy(id,{outputRoot=ROOT,origin=require('./app-release').publicOrigin(),verify=require('./deployed-website-qa').verify}={}){
 const project=web.getProject(id),visual=project.qa?.visual_review;
 if(project.kind!=='website')throw Error('Use the application runtime to deploy interactive apps');
 if(!project.qa?.passed||!visual?.passed||!visual.coverage?.complete||visual.coverage.mode==='deterministic-browser-fallback')throw Error('Website publishing requires passing functional QA and complete AI screenshot review');
 if(!origin)throw Error('Configure the public Railway origin before publishing a website');
 const files=web.normalizeFiles(project.files),pages=Object.keys(files).filter(name=>name.endsWith('.html'));
 const version=crypto.createHash('sha256').update(JSON.stringify(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)))).digest('hex').slice(0,16);
 const folder=path.join(outputRoot,id,version),url='/generated/developer-sites/'+id+'/'+version+'/',created=!fs.existsSync(folder),routes=[],shots=[];
 fs.mkdirSync(folder,{recursive:true});
 try{
  for(const name of pages){const html=web.assemble(files,name),file=path.join(folder,name);if(created)fs.writeFileSync(file,html);else if(fs.readFileSync(file,'utf8')!==html)throw Error('Published website snapshot does not match its content version');}
  for(const name of pages){const result=await verify(origin+url+name);if(!result?.passed)throw Error('Published website failed QA: '+name);const evidence=pipeline.stripShots(result);shots.push(...evidence.map(shot=>({...shot,label:name+' · '+shot.label})));routes.push({page:name,...result});}
  const deployed_qa={passed:true,scope:'all public HTML routes',pages,routes,at:new Date().toISOString()};
  pipeline.saveEvidence(folder,shots);fs.writeFileSync(path.join(folder,'release.json'),JSON.stringify({id,version,deployed_qa},null,2));
  const meta={...project,status:'live',published_version:version,live_url:url,published_at:new Date().toISOString(),deployed_qa};delete meta.files;
  const metadata=path.join(__dirname,'workspace','developer-projects',id,'project.json'),temp=metadata+'.tmp';fs.writeFileSync(temp,JSON.stringify(meta,null,2));fs.renameSync(temp,metadata);
  return{...meta,url};
 }catch(error){if(created)fs.rmSync(folder,{recursive:true,force:true});throw error;}
}
module.exports={deploy,CSP};
