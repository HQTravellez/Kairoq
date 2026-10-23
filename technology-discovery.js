// Curated provider discovery: explicit records only, no upstream list redistribution.
// Pricing and licensing must be verified against provider sources before production use.
const SOURCES=Object.freeze({
 freeTier:'https://github.com/ripienaar/free-for-dev',
 oss:'https://github.com/RunaCapital/awesome-oss-alternatives'
});
function recommendTechnology(requirements,candidates=[]){
 const q=String(requirements||'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2);
 return candidates.filter(x=>x&&typeof x.name==='string'&&Array.isArray(x.capabilities)).map(x=>{
  const tags=x.capabilities.map(v=>String(v).toLowerCase());
  const matches=q.filter(w=>tags.some(t=>t.includes(w))).length;
  const score=matches*10+(x.selfHosted===true?2:0)+(x.freeTierVerified===true?2:0);
  return {name:x.name,score,license:x.license||'unverified',pricing:x.pricing||'unverified',
    freeTierVerified:x.freeTierVerified===true,sourceUrl:x.sourceUrl||null,
    requiresReview:!x.licenseVerified||!x.pricingVerified,
    capabilities:x.capabilities};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
}
module.exports={SOURCES,recommendTechnology};
