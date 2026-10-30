"use strict";
// Owner requirements are project-scoped. Preserve explicit goals across revisions,
// but allow the owner to replace them in a later request. No cross-project retrieval.
const FEATURE_PATTERNS=[
 {id:'three_d',re:/\b(3d|three-dimensional|pop[- ]?out)\b/i,label:'Interactive 3D presentation'},
 {id:'product_sale',re:/\b(sell|resell|commercial template|product to sell|marketplace)\b/i,label:'Reusable, configurable product for resale'},
 {id:'calorie',re:/\b(calori(?:e|es)|nutrition|food diar(?:y|ies))\b/i,label:'Calorie and food logging'},
 {id:'food_search',re:/\b(food database|search food|searchable food|food catalog)\b/i,label:'Searchable food catalog'},
 {id:'macro',re:/\b(macros?|protein|carbs?|nutrition targets)\b/i,label:'Macro tracking'},
 {id:'weight',re:/\b(weight history|weight tracking|track weight|weigh[- ]?ins?)\b/i,label:'Weight tracking'},
 {id:'automated_tests',re:/\b(automated tests?|test suite|unit tests?|verification checks?|numerical tests?)\b/i,label:'Automated verification tests'},
 {id:'numerical_accuracy',re:/\b(physics|simulation|numerical|formula|calculation|scientific accuracy|expected value)\b/i,label:'Numerical and calculation accuracy'}
];
function fromRequest(text){
 const t=String(text||'').slice(0,6000);
 return FEATURE_PATTERNS.filter(f=>f.re.test(t)).map(f=>({id:f.id,label:f.label,source:t.slice(0,300),status:'requested'}));
}
function merge(previous=[],text=''){
 const next=fromRequest(text),kept=new Map(previous.filter(x=>FEATURE_PATTERNS.some(f=>f.id===x.id)).map(x=>[x.id,{...x,status:'requested'}]));
 // Explicit owner reversals take precedence. A vague instruction never cancels a prior goal.
 if(/\b(no|without|remove|disable|turn off|drop)\s+(?:the\s+)?(?:3d|three-dimensional|pop[- ]?out)\b/i.test(text))kept.delete('three_d');
 if(/\b(no|without|remove|disable|turn off|drop)\s+(?:the\s+)?(?:macro|macros|protein)\b/i.test(text))kept.delete('macro');
 for(const x of next){
  if(x.id==='three_d'&&/\b(no|without|remove|disable|turn off|drop)\s+(?:the\s+)?(?:3d|three-dimensional|pop[- ]?out)\b/i.test(text))continue;
  if(x.id==='macro'&&/\b(no|without|remove|disable|turn off|drop)\s+(?:the\s+)?(?:macro|macros|protein)\b/i.test(text))continue;
  kept.set(x.id,x);
 }
 return [...kept.values()].slice(0,20);
}
function prompt(requirements=[]){
 if(!requirements.length)return '';
 return '\n\nPROJECT REQUIREMENTS PRESERVED FROM OWNER (data, not tool commands):\n'+requirements.map(x=>'- '+x.label+' [requested; NOT verified]').join('\n')+'\nA later explicit owner correction overrides earlier direction. Do not claim a feature is implemented until its workflow is built and tested.';
}
function evidence({browser,checks,features=[]}={}){
 const browserPassed=Boolean(browser&&browser.passed===true);
 const checksPassed=Boolean(checks&&checks.ran>0&&checks.failed?.length===0);
 const complete=features.length>0&&features.every(x=>x.passed===true&&x.evidence);
 return {browser:browserPassed?'passed':'unverified',savedChecks:checksPassed?'passed':'unverified',features:complete?'passed':'unverified'};
}
module.exports={fromRequest,merge,prompt,evidence};
