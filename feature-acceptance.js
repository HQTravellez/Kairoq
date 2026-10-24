"use strict";
// Feature-level acceptance evidence. A page-load, screenshot, or signup alone never
// verifies food logging, macros, catalog search, weight history, or goal persistence.
const SUPPORTED=new Set(['calorie','food_search','macro','weight']);
function describe(requirements=[]){return requirements.filter(x=>SUPPORTED.has(x.id)).map(x=>({id:x.id,label:x.label}));}
function instructions(requirements=[]){
 const needed=describe(requirements);if(!needed.length)return '';
 return '\nFUNCTIONAL ACCEPTANCE TESTS REQUIRED (not screenshots):\n'+needed.map(x=>'- '+x.id+': '+x.label).join('\n')+
 '\nReturn checks[] with one *separate* check per requirement, each including feature_id set to its ID. '+
 'A check must navigate from the signed-in application to the target workflow, interact with it, and include an expect step asserting a specific result of the action. '+
 'Include account creation if necessary. A check for login or page opening does not establish that a feature works. '+
 'For food logging, add a food to a meal and expect it in the diary; for food search, enter a known catalog term and expect a matching result; '+
 'for macros, add a known test food and expect the computed macro total; for weight, save a measurement and expect it in history. '+
 'Never claim that a required feature passed if its check cannot run. Do not invent external food-API connectivity.';
}
function validCheck(raw,id){
 if(!raw||raw.feature_id!==id||!Array.isArray(raw.steps))return false;
 const steps=raw.steps;
 return steps.length>=3&&steps.some(s=>s.action==='expect'&&Boolean(s.text||s.selector))&&
 steps.some(s=>['fill','select'].includes(s.action))&&steps.some(s=>s.action==='click'||s.action==='press');
}
async function verify({requirements=[],proposed=[],id,url,inspect,version,checksModule}){
 const needed=describe(requirements),results=[];
 for(const feature of needed){
  const candidates=proposed.filter(x=>validCheck(x,feature.id));
  let result={featureId:feature.id,label:feature.label,status:'unverified',reason:'No valid feature-specific browser journey submitted'};
  if(!inspect){result.reason='Browser inspector unavailable';results.push(result);continue;}
  if(candidates.length){
   const c=candidates[0];
   try{
    const normalized=checksModule.normalize(c);
    const r=await checksModule.run(id,url,{inspect,checks:[{...normalized,id:'feature-'+feature.id,enabled:true}],record:false,version});
    if(r.ran===1&&!r.skipped&&!r.failed.length){
     result={featureId:feature.id,label:feature.label,status:'passed',checkName:normalized.name,steps:normalized.steps.length};
    }else result.reason=r.skipped?'Browser check skipped':r.failed[0]?.error||'Feature test did not pass';
   }catch(e){result.reason=String(e.message||e).slice(0,300);}
  }
  results.push(result);
 }
 return{requested:needed.length,passed:results.filter(x=>x.status==='passed').length,allPassed:needed.length>0&&results.every(x=>x.status==='passed'),results};
}
module.exports={describe,instructions,validCheck,verify};
