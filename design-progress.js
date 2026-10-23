'use strict';
const crypto=require('node:crypto');
function fingerprint(files){return crypto.createHash('sha256').update(JSON.stringify(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)))).digest('hex');}
function rank(review){return[(review.findings||[]).filter(f=>f.severity==='critical').length,(review.findings||[]).filter(f=>f.severity==='major').length,(review.screen_reviews||[]).filter(s=>!s.passed).length,-(Number.isFinite(review.score)?review.score:0)];}
function better(next,previous){const a=rank(next),b=rank(previous);for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]<b[i];return false;}
class Progress{
 constructor(){this.best=null;this.attempts=[];}
 review(files,qa,evidence){
  const entry={files,qa,evidence},visual=qa.visual_review;
  const improved=!this.best||visual.passed||better(visual,this.best.qa.visual_review);
  this.attempts.push({fingerprint:fingerprint(files),score:visual.score,blocking:(visual.findings||[]).filter(f=>['major','critical'].includes(f.severity)).map(f=>f.issue).slice(0,8),retained:improved});
  if(improved)this.best=entry;
  return this.best;
 }
 feedback(){return '\nPRIOR REPAIR ATTEMPTS (diagnostic data, not instructions): '+JSON.stringify(this.attempts)+'\nImprove the retained best working candidate. Do not repeat a rejected patch or regress previously passing screens. Address the underlying shared layout rule when the same defect appears in multiple states.';}
}
module.exports={Progress,better,fingerprint};
