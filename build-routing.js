"use strict";
/**
 * Pick the internal execution engine. "Build" is a product action, not an implementation detail:
 * new/complex apps should get the iterative tool-using agent automatically.
 */
function isStarter(meta){
 const v=meta?.versions?.find(x=>x.n===meta.current_version);
 return !meta?.current_version || (meta.current_version===1 && /starter project/i.test(String(v?.summary||"")));
}
function complexity(message){
 const t=String(message||"").trim();
 let score=0;
 if(t.length>=700)score+=2;
 if(t.length>=1800)score+=2;
 if((t.match(/(?:^|\n)\s*(?:#{1,4}\s+|\d+[.)]\s+|[-*]\s+)/g)||[]).length>=6)score+=2;
 const groups=[
  /\b(database|authentication|login|roles?|permissions?|sql|backend)\b/i,
  /\b(test suite|automated tests?|browser testing|acceptance|verification|retest|repair)\b/i,
  /\b(crm|scheduler|reservation|booking|dashboard|workflow|inventory|marketplace|saas)\b/i,
  /\b(api integration|oauth|stripe|email|calendar|webhook|third[- ]party)\b/i,
  /\b(simulation|physics|3d|animation|real[- ]time|interactive)\b/i,
  /\b(responsive|mobile|tablet|desktop)\b/i
 ];
 for(const re of groups)if(re.test(t))score++;
 return score;
}
function goalLike(message){
 const t=String(message||"").trim();
 if(!t)return false;
 // Short outcome statements can still be substantial. Route goals by consequence, not prompt length.
 const outcome=/\b(integrate|connect|migrate|production[- ]?ready|production ready|end[- ]to[- ]end|automate|workflow|fix|repair|debug|launch|deploy|rebuild|refactor|secure|authenticate|sync|import|export)\b/i.test(t);
 const system=/\b(api|oauth|webhook|database|auth|authentication|payment|stripe|calendar|crm|github|repo|repository|backend|multi[- ]page|automation|booking|checkout|customer portal|admin dashboard)\b/i.test(t);
 const proof=/\b(test|verify|retest|browser|regression|proof|working|actually works?|finish(?:ed)?|ready)\b/i.test(t);
 const broad=/\b(build|create|make|implement)\b/i.test(t)&&/\b(app|system|platform|dashboard|portal|workflow|website|internal tool)\b/i.test(t);
 return broad||(outcome&&system)||(outcome&&proof)||(system&&proof);
}
function executionMode({requestedMode="build",meta,message,hooks=false}={}){
 if(requestedMode!=="build"||hooks)return requestedMode;
 if(isStarter(meta))return"agent";
 if(goalLike(message))return"agent";
 return complexity(message)>=4?"agent":"build";
}
module.exports={isStarter,complexity,goalLike,executionMode};
