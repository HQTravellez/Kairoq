'use strict';
// Called only after generation and all existing QA gates. Defaults remain preview-only.
async function finish(job,result,{save=()=>{},callModel,deployApp,deployWebsite}={}){
 job.result=result;
 if(job.auto_deploy!==true){job.status='complete';return result;}
 if(!result.qa?.passed)throw Error('Automatic publication requires passing build QA');
 job.status='deploying';save(job);
 const published=result.kind==='fullstack'
  ?await(deployApp||require('./app-release').deploy)(result.id)
  :result.kind==='website'
   ?await(deployWebsite||require('./website-release').deploy)(result.id,{callModel})
   :null;
 if(!published)throw Error('Automatic publication is supported for full-stack apps and websites');
 if(published.deployed_qa?.passed!==true)throw Error('Public deployment verification did not pass');
 job.result=published;job.status='complete';return published;
}
module.exports={finish};
