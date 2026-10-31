"use strict";
// Executor-owned completion gate: a model cannot declare success without observed evidence.
function requiresUnitTests(requirements=[],files={}){
 const requested=Array.isArray(requirements)&&requirements.some(x=>["automated_tests","numerical_accuracy"].includes(x.id));
 const present=Object.keys(files||{}).some(n=>/^src\/verification\/.+\.test\.(?:js|mjs)$/.test(n));
 return requested||present;
}
function evaluate({built,dirty,inspect,lastTest,checks,requirements=[],unitTests,files={},review=null,reviewRequired=false,visualQuality=null,visualRequired=false,repairs=0}={}){
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
 if(reviewRequired){
  if(!review)issues.push("Independent Standards + Spec review was not executed.");
  else if(Array.isArray(review.blocking)&&review.blocking.length)issues.push("Independent engineering review has blocking findings.");
 }
 if(visualRequired){
  if(!visualQuality)issues.push("Visual quality was not evaluated.");
  else if(visualQuality.passed!==true)issues.push(visualQuality.reason||"Visual quality review did not pass.");
 }
 const unitRequired=requiresUnitTests(requirements,files);
 if(unitRequired){
  if(!unitTests||unitTests.skipped)issues.push("Required verification tests were not executed.");
  else if(!unitTests.ok||unitTests.failed>0)issues.push("Verification tests failed.");
 }
 const evidence={
  build:built&&!dirty?"passed":"failed",
  browser:lastTest&&Array.isArray(lastTest.errors)&&!lastTest.errors.length&&lastTest.failed===0&&lastTest.steps>0?"passed":"failed",
  unit_tests:unitRequired?(unitTests&&unitTests.ok?"passed":"failed"):"not-required",
  saved_checks:checks?.skipped?"skipped":checks?.failed?.length?"failed":checks?.ran>0?"passed":"not-required",
  engineering_review:reviewRequired?(review&&(!review.blocking||!review.blocking.length)?"passed":"failed"):"not-required",
  visual_quality:visualRequired?(visualQuality?.passed===true?"passed":"failed"):"not-required",
  browser_interactions:lastTest?.steps||0,
  repairs:Number.isInteger(repairs)&&repairs>0?repairs:0
 };
 return{verified:issues.length===0,issues,evidence,unit_tests_required:unitRequired,visual_required:visualRequired};
}
function proofLines(result){
 const e=result?.evidence||{};
 const row=(label,value,detail="")=>"- "+label+": "+value+(detail?" · "+detail:"");
 return[
  row("Build",e.build||"failed"),
  row("Browser",e.browser||"failed",Number(e.browser_interactions)>0?e.browser_interactions+" interaction step(s)":"no interaction evidence"),
  row("Visual quality",e.visual_quality||"not-required"),
  row("Verification tests",e.unit_tests||"not-required"),
  row("Regression checks",e.saved_checks||"not-required"),
  row("Engineering review",e.engineering_review||"not-required"),
  row("Repair attempts",String(e.repairs||0)),
  row("Unresolved",result?.verified?"none":(result?.issues||[]).join(" "))
 ];
}
function resultMessage(message,result){
 const text=String(message||"").slice(0,2000);
 const proof="PROOF\n"+proofLines(result).join("\n");
 if(result.verified)return "VERIFIED BUILD\n\n"+proof+"\n\n"+text;
 return "UNVERIFIED DRAFT · NOT functionally verified.\n\n"+proof+"\n\nBuilder notes: "+text;
}
module.exports={evaluate,resultMessage,requiresUnitTests,proofLines};
