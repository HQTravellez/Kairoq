"use strict";
// Two design reviewers instead of one (the polish pass on Pro and Max). Two different models
// look at the screenshots on their own, then each judges the other's findings: UPHOLD or
// REJECT. Only problems both agree on go to the fix, so the app is not redesigned around one
// model's taste and fewer polish rounds are wasted.
const REVIEW=`You review screenshots of a web app as a demanding senior product designer. The first images are desktop (1280 px), then phone (390 px).
List only real problems a visitor would notice: unreadable or low-contrast text, broken or overflowing layout, cramped or uneven spacing, weak hierarchy, inconsistent buttons, tiny tap targets, misaligned elements, images that look broken.
Also list the generic "made by AI" template look when you see it:
${require('./design-slop').list()}
Do not list brand or colour preferences, copy tone, missing features or things you cannot see.
Respond with ONLY JSON: {"findings":[{"id":"%P1","severity":"major"|"minor","screen":"desktop"|"phone"|"both","issue":"what is wrong and where","fix":"the concrete change"}]} (at most 8, most important first; [] when the design is fine).`;
const CROSS=`Another design reviewer looked at the same screenshots and listed the problems below. For each one, look at the screenshots yourself. UPHOLD it if it is a real, visible problem worth fixing; REJECT it if it is wrong, a matter of taste, or not visible.
Respond with ONLY JSON: {"verdicts":[{"id":"…","verdict":"UPHOLD"|"REJECT","why":"short reason"}]}`;
function json(t){const s=String(t||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');try{return JSON.parse(s)}catch{const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<=a)throw Error('not JSON');return JSON.parse(s.slice(a,b+1))}}
function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function content(text,pictures){return[{type:'text',text},...pictures.slice(0,6).map(p=>({type:'image_url',image_url:{url:'data:'+(p.mime||'image/jpeg')+';base64,'+p.data}}))]}
async function findings(callModel,tier,prefix,pictures,signal){
 const v=await callModel({tier,messages:[{role:'user',content:content(REVIEW.replace('%P',prefix),pictures)}],temperature:0.2,maxOutputTokens:1800,signal},json);
 if(!Array.isArray(v.findings))throw Error('The reviewer did not return findings');
 return v.findings.slice(0,8).map((f,i)=>({id:prefix+(i+1),severity:f.severity==='major'?'major':'minor',screen:['desktop','phone','both'].includes(f.screen)?f.screen:'both',issue:clip(f.issue,300),fix:clip(f.fix,300)})).filter(f=>f.issue);
}
async function judge(callModel,tier,list,pictures,signal){
 if(!list.length)return new Map();
 const v=await callModel({tier,messages:[{role:'user',content:content(CROSS+'\n\n'+list.map(f=>f.id+' ('+f.severity+', '+f.screen+'): '+f.issue).join('\n'),pictures)}],temperature:0,maxOutputTokens:1200,signal},json);
 if(!Array.isArray(v.verdicts))throw Error('The reviewer did not return verdicts');
 return new Map(v.verdicts.map(x=>[String(x.id),String(x.verdict).toUpperCase()==='UPHOLD']));
}
// pictures: [{name,mime,data(base64)}]. Returns {agreed, rejected, reviewers} or throws when a
// reviewer is unavailable (the caller then falls back to the single-reviewer polish).
async function review({pictures,callModel,signal,tiers=['vision','pro']}){
 const [a,b]=await Promise.all([findings(callModel,tiers[0],'A',pictures,signal),findings(callModel,tiers[1],'B',pictures,signal)]);
 const [bOnA,aOnB]=await Promise.all([judge(callModel,tiers[1],a,pictures,signal),judge(callModel,tiers[0],b,pictures,signal)]);
 const agreed=[...a.filter(f=>bOnA.get(f.id)===true),...b.filter(f=>aOnB.get(f.id)===true)];
 const rejected=[...a.filter(f=>bOnA.get(f.id)!==true),...b.filter(f=>aOnB.get(f.id)!==true)];
 return{agreed:agreed.sort((x,y)=>(y.severity==='major')-(x.severity==='major')).slice(0,10),rejected,reviewers:2};
}
function note(agreed){return'\n\nTwo independent design reviewers agreed on these problems. Fix exactly these, and keep everything else as it is:\n'+agreed.map(f=>'- ['+f.severity+', '+f.screen+'] '+f.issue+' → '+f.fix).join('\n')}
module.exports={review,note};
