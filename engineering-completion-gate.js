"use strict";
// Superpowers: verification before completion. Karpathy: simple, evidence-led fixes.
// This gate evaluates actual browser tool results, not the model's self-assessment.
function evaluate({built,dirty,inspect,lastTest,checks,requirements=[]}={}){
 const issues=[];
 if(!built||dirty)issues.push('The current source has not completed a clean build.');
 if(typeof inspect!=='function')issues.push('Browser verification is unavailable.');
 if(!lastTest)issues.push('No current browser test was executed.');
 else{
  if(!Array.isArray(lastTest.errors)||lastTest.errors.length)issues.push('Browser test reported runtime errors.');
  if(lastTest.failed>0)issues.push('Browser interaction steps failed.');
  if(!Number.isInteger(lastTest.steps)||lastTest.steps<1)issues.push('No user interaction was tested.');
 }
 if(checks?.skipped)issues.push('Saved regression checks were skipped.');
 if(checks&&checks.failed?.length)issues.push('Previously passing workflows regressed.');
 const needsFeatures=Array.isArray(requirements)&&requirements.some(x=>['calorie','food_search','macro','weight'].includes(x.id));
 if(needsFeatures&&!checks?.featurePassed)issues.push('Requested feature workflows have not passed independent acceptance checks.');
 return{verified:issues.length===0,issues};
}
function resultMessage(message,result){
 const text=String(message||'').slice(0,2000);
 if(result.verified)return text;
 return 'Build saved for review; NOT functionally verified. '+result.issues.join(' ')+'\n\nBuilder notes: '+text;
}
module.exports={evaluate,resultMessage};
