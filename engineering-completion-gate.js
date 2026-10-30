"use strict";
// Executor-owned completion gate: a model cannot declare success without observed evidence.
function requiresUnitTests(requirements=[],files={}){
 const requested=Array.isArray(requirements)&&requirements.some(x=>["automated_tests","numerical_accuracy"].includes(x.id));
 const present=Object.keys(files||{}).some(n=>/^src\/verification\/.+\.test\.(?:js|mjs)$/.test(n));
 return requested||present;
}
function evaluate({built,dirty,inspect,lastTest,checks,requirements=[],unitTests,files={}}={}){
 const issues=[];
 if(!built||dirty)issues.push("The current source has not completed a clean build.");
 if(typeof inspect!=="function")issues.push("Browser verification is unavailable.");
 if(!lastTest)issues.push("No current browser test was executed.");
 else{
  if(!Array.isArray(lastTest.errors)||lastTest.errors.length)issues.push("Browser test reported runtime errors.");
  if(lastTest.failed>0)issues.push("Browser interaction steps failed.");
  if(!Number.isInteger(lastTest.steps)||lastTest.steps<1)issues.push("No user interaction was tested.");
 }
 if(checks?.skipped)issues.push("Saved regression checks were skipped.");
 if(checks&&checks.failed?.length)issues.push("Previously passing workflows regressed.");
 const needsFeatures=Array.isArray(requirements)&&requirements.some(x=>["calorie","food_search","macro","weight"].includes(x.id));
 if(needsFeatures&&!checks?.featurePassed)issues.push("Requested feature workflows have not passed independent acceptance checks.");
 const unitRequired=requiresUnitTests(requirements,files);
 if(unitRequired){
  if(!unitTests||unitTests.skipped)issues.push("Required verification tests were not executed.");
  else if(!unitTests.ok||unitTests.failed>0)issues.push("Verification tests failed.");
 }
 const evidence={
  build:built&&!dirty?"passed":"failed",
  browser:lastTest&&Array.isArray(lastTest.errors)&&!lastTest.errors.length&&lastTest.failed===0&&lastTest.steps>0?"passed":"failed",
  unit_tests:unitRequired?(unitTests&&unitTests.ok?"passed":"failed"):"not-required",
  saved_checks:checks?.skipped?"skipped":checks?.failed?.length?"failed":checks?.ran>0?"passed":"not-required"
 };
 return{verified:issues.length===0,issues,evidence,unit_tests_required:unitRequired};
}
function resultMessage(message,result){
 const text=String(message||"").slice(0,2000);
 if(result.verified){
  const e=result.evidence||{};
  const proof=["clean build",e.browser==="passed"?"browser interactions":null,e.unit_tests==="passed"?"verification tests":null,e.saved_checks==="passed"?"saved regression checks":null].filter(Boolean);
  return "VERIFIED BUILD · "+proof.join(" · ")+"\n\n"+text;
 }
 return "UNVERIFIED DRAFT · "+result.issues.join(" ")+"\n\nBuilder notes: "+text;
}
module.exports={evaluate,resultMessage,requiresUnitTests};
