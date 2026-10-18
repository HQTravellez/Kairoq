"use strict";
// Kairoq gets better at each person's work, the way a good assistant does:
//
// - Recipes from experience: when a hard feature finally works (it needed retries, or many agent
//   steps), Kairoq writes down how it built it and what to watch for. A later request for something
//   similar, in any of that person's projects, starts from the recipe. A recipe that still needs
//   retries is improved with what went wrong; one that keeps failing is switched off by itself.
// - Memory of the person: lasting preferences said in chat ("never purple", "prices in euros",
//   "keep it simple") are remembered and applied to all their projects.
// - Recall: "like the hotel site I did last month" finds that project and shows its main files.
//
// Everything is private to the account that owns the project (meta.owner). The Kairoq owner can
// share their own recipes with every account. The person sees and edits all of it under Memory.
// KAIROQ_MEMORY=off turns it all off; each account can turn its own memory off.
const fs=require('fs'),path=require('path'),crypto=require('crypto');

function on(){return String(process.env.KAIROQ_MEMORY||'on').toLowerCase()!=='off'}
function dir(){return process.env.KAIROQ_MEMORY_DIR||path.join(path.dirname(require('./react-builder').ROOT()),'memory')}
function key(owner){return crypto.createHash('sha1').update('kq-memory:'+String(owner||'')).digest('hex').slice(0,20)}
function file(owner){return path.join(dir(),key(owner)+'.json')}
function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function err(m,s){return Object.assign(Error(m),{status:s})}
const MAX_PREFS=20,MAX_RECIPES=40;

function load(owner){
 try{const m=JSON.parse(fs.readFileSync(file(owner),'utf8'));return{enabled:m.enabled!==false,preferences:m.preferences||[],recipes:m.recipes||[]}}
 catch{return{enabled:true,preferences:[],recipes:[]}}
}
function save(owner,m){fs.mkdirSync(dir(),{recursive:true});fs.writeFileSync(file(owner),JSON.stringify(m,null,1))}
function active(owner){return on()&&owner&&load(owner).enabled}
function newId(){return crypto.randomBytes(5).toString('hex')}

// ---------- words, for matching without embeddings ----------
const STOP=new Set('the and for with that this from your have want make need like into add build create page site website app apps please some more also just them they then than what when where which will would should could there their about over under very much really thing things show list using used use new my our a an to of in on is it be as at by or we i you me can do get'.split(' '));
function words(t){return [...new Set(String(t||'').toLowerCase().replace(/[^a-z0-9à-ÿ\s-]/g,' ').split(/[\s-]+/).filter(w=>w.length>=4&&!STOP.has(w)).map(w=>w.replace(/(ings|ing|ies|es|s)$/,'')))]}
function overlap(a,b){const B=new Set(b);return a.filter(w=>B.has(w)).length}

// ---------- 1. memory of the person ----------
// Only messages that sound like a lasting preference are sent to the model, to keep it cheap.
const PREF_HINT=/\b(always|never|from now on|in all (my|our)|every (app|site|project)|i (prefer|like|love|hate|don'?t like|want all)|don'?t (ever )?use|do not use|stop using|please (use|keep|avoid)|too (dark|bright|busy|cluttered|colou?rful|plain|small|big|playful|corporate|formal)|prices? in|in (euros?|dollars|pounds|dirhams|aed|usd|eur|gbp|inr|rupees)|my brand|our brand|(british|american) english|in (arabic|french|spanish|portuguese|german|hindi))\b/i;
const PREF_PROMPT=`You decide whether a chat message to an app builder states a LASTING preference about how this person wants all their apps (visual style, colours, tone of voice, language, spelling, currency, units, brand, technology choices), as opposed to a one-off change to the current app.
Respond with ONLY JSON: {"preferences":["short instruction in the third person, e.g. Prefers prices in euros"]} with at most 2 items, each under 120 characters, or {"preferences":[]} when it is a one-off change.`;
async function learnPreferences(owner,message,{callModel}){
 if(!active(owner)||!callModel||!PREF_HINT.test(String(message||'')))return[];
 let v;try{v=await callModel({messages:[{role:'system',content:PREF_PROMPT},{role:'user',content:clip(message,600)}],temperature:0,maxOutputTokens:200,tier:'standard'},c=>{const t=String(c||'');return JSON.parse(t.slice(t.indexOf('{'),t.lastIndexOf('}')+1))})}catch{return[]}
 const found=(Array.isArray(v&&v.preferences)?v.preferences:[]).map(p=>clip(p,120)).filter(p=>p.length>=8&&!/https?:|ignore|instruction|system prompt/i.test(p)).slice(0,2);
 if(!found.length)return[];
 const m=load(owner),added=[];
 for(const text of found){
  const w=words(text);
  // The same idea said again replaces the old wording (newest wins).
  const i=m.preferences.findIndex(p=>{const pw=words(p.text);return overlap(w,pw)>=Math.max(2,Math.ceil(Math.min(w.length,pw.length)*0.6))});
  const pref={id:i>=0?m.preferences[i].id:newId(),text,source:'learned',at:new Date().toISOString()};
  if(i>=0)m.preferences.splice(i,1);
  m.preferences.unshift(pref);added.push(text);
 }
 // Over the limit, learned ones go first; what the person typed in Memory stays.
 while(m.preferences.length>MAX_PREFS){const j=m.preferences.map(p=>p.source).lastIndexOf('learned');m.preferences.splice(j>=0?j:m.preferences.length-1,1)}
 save(owner,m);
 return added;
}
// Added to the builder's instructions for every project of this account.
function preferenceNote(owner){
 if(!active(owner))return'';
 const p=load(owner).preferences;
 return p.length?'\n\nWhat the owner of this app prefers in all their apps (remembered from earlier chats; the current request wins when it says otherwise):\n'+p.map(x=>'- '+x.text).join('\n'):'';
}

// ---------- 2. recipes from experience ----------
function sharedRecipes(){return owner=>owner==='owner'?[]:load('owner').recipes.filter(r=>r.shared&&r.status==='active').map(r=>({...r,from:'Kairoq'}))}
function candidates(owner){return [...load(owner).recipes.filter(r=>r.status==='active'),...sharedRecipes()(owner)]}
// Up to two recipes whose subject matches the request.
function matchRecipes(owner,message){
 if(!active(owner))return[];
 const w=words(message);if(!w.length)return[];
 return candidates(owner).map(r=>{const t=words(r.title),all=words(r.title+' '+r.when);const n=overlap(w,all),tn=overlap(w,t);return{r,score:n+tn,ok:n>=2||(t.length>0&&tn===t.length)}}).filter(x=>x.ok).sort((a,b)=>b.score-a.score).slice(0,2).map(x=>x.r);
}
function recipeNote(list){
 if(!list.length)return'';
 return'Recipes from earlier work that went well (follow them where they fit this app; adapt names, data and design to this project):\n'+list.map(r=>'## '+r.title+'\nApplies to: '+r.when+'\nSteps:\n'+r.steps.map((s,i)=>(i+1)+'. '+s).join('\n')+(r.pitfalls.length?'\nWatch for:\n'+r.pitfalls.map(p=>'- '+p).join('\n'):'')).join('\n\n');
}
const RECIPE_PROMPT=`You write reusable recipes for an AI that builds React + Vite + Tailwind apps (with an optional backend described in src/backend.json and server functions in functions/).
You get a request that was just completed successfully after some difficulty, the files it changed, and the problems that had to be fixed on the way.
Write a recipe so that a SIMILAR request in a different project goes right on the first try: general steps (which files, which data collections, which checks), and the pitfalls that caused the retries. No names, texts or details specific to this project.
Respond with ONLY JSON: {"title":"short feature name, e.g. Room booking with availability","when":"what kind of request this applies to, one sentence","steps":["at most 6 steps, each under 160 characters"],"pitfalls":["at most 4, each under 160 characters"]}
If the work was too specific to this one project to be reusable, respond {"skip":true}.`;
const REFINE_PROMPT=`You maintain a reusable recipe for an AI app builder. It was just used and the build still needed retries because of the problems listed. Update the recipe so the next build avoids them: adjust steps or add pitfalls; keep it general (no project-specific names), at most 6 steps and 4 pitfalls, each under 160 characters.
Respond with ONLY JSON: {"steps":[...],"pitfalls":[...]}`;
function cleanList(a,n){return(Array.isArray(a)?a:[]).map(x=>clip(x,160)).filter(x=>x.length>=6&&!/https?:|ignore (all|previous)|system prompt/i.test(x)).slice(0,n)}
function hard(result,mode){return Boolean(result)&&!(result.runtime_errors||[]).length&&(result.changed||[]).length>=2&&((result.attempts||1)>=2||(mode==='agent'&&(typeof result.steps==='number'?result.steps:(result.steps||[]).length)>=5))}
async function writeRecipe(owner,{message,result,mode,projectId},{callModel}){
 if(!active(owner)||!callModel||!hard(result,mode))return null;
 const problems=require('./build-lessons').fromResult(result).map(p=>p.stage+': '+p.shape).slice(0,6);
 let v;try{v=await callModel({messages:[{role:'system',content:RECIPE_PROMPT},{role:'user',content:'Request: '+clip(message,600)+'\nWhat was built: '+clip(result.message,600)+'\nFiles changed: '+(result.changed||[]).slice(0,20).join(', ')+'\nProblems fixed on the way:\n'+(problems.join('\n')||'(retries without recorded errors)')}],temperature:0.2,maxOutputTokens:900,tier:'standard'},c=>{const t=String(c||'');return JSON.parse(t.slice(t.indexOf('{'),t.lastIndexOf('}')+1))})}catch{return null}
 if(!v||v.skip)return null;
 const title=clip(v.title,80),when=clip(v.when,200),steps=cleanList(v.steps,6),pitfalls=cleanList(v.pitfalls,4);
 if(title.length<4||steps.length<2)return null;
 const m=load(owner);
 // A recipe for the same thing replaces the older one.
 const tw=words(title),old=m.recipes.findIndex(r=>overlap(tw,words(r.title))>=Math.max(1,Math.ceil(tw.length*0.7)));
 const recipe={id:old>=0?m.recipes[old].id:newId(),title,when,steps,pitfalls,status:'active',uses:0,successes:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),from_project:projectId||null,...(old>=0&&m.recipes[old].shared?{shared:true}:{})};
 if(old>=0)m.recipes.splice(old,1);
 m.recipes.unshift(recipe);
 while(m.recipes.length>MAX_RECIPES){const i=m.recipes.map(r=>r.status).lastIndexOf('off');m.recipes.splice(i>=0?i:m.recipes.length-1,1)}
 save(owner,m);
 return recipe;
}
// After a build that used recipes: count it, improve the recipe when it still needed retries,
// switch it off when it keeps failing (5 uses, under 40% first time right).
async function useRecipes(owner,ids,result,{callModel}){
 if(!ids||!ids.length||!active(owner))return;
 const shared=load('owner'),own=load(owner),firstTime=Boolean(result)&&(result.attempts||1)===1&&!(result.runtime_errors||[]).length;
 const problems=result?require('./build-lessons').fromResult(result).map(p=>p.stage+': '+p.shape).slice(0,6):[];
 for(const id of ids){
  const m=own.recipes.some(r=>r.id===id)?own:shared,r=m.recipes.find(x=>x.id===id);if(!r)continue;
  r.uses=(r.uses||0)+1;if(firstTime)r.successes=(r.successes||0)+1;r.last_used=new Date().toISOString();
  if(!firstTime&&callModel&&problems.length){
   try{const v=await callModel({messages:[{role:'system',content:REFINE_PROMPT},{role:'user',content:'Recipe: '+r.title+'\nApplies to: '+r.when+'\nSteps:\n'+r.steps.join('\n')+'\nPitfalls:\n'+r.pitfalls.join('\n')+'\n\nProblems this time:\n'+problems.join('\n')}],temperature:0.2,maxOutputTokens:700,tier:'standard'},c=>{const t=String(c||'');return JSON.parse(t.slice(t.indexOf('{'),t.lastIndexOf('}')+1))});
    const steps=cleanList(v.steps,6),pitfalls=cleanList(v.pitfalls,4);if(steps.length>=2){r.steps=steps;r.pitfalls=pitfalls;r.updated_at=new Date().toISOString();r.improved=(r.improved||0)+1}}catch{}
  }
  if(r.uses>=5&&r.successes/r.uses<0.4){r.status='off';r.reason='Switched off: only '+r.successes+' of '+r.uses+' builds that used it worked first time.'}
 }
 save(owner,own);if(owner!=='owner'&&ids.some(id=>shared.recipes.some(r=>r.id===id)))save('owner',shared);
}

// ---------- 3. recall ----------
const RECALL_HINT=/\b(like|same as|similar to|based on|copy|reuse|re-use|as (i|we) did|from)\b[^.]{0,60}\b(my|our|the|last|earlier|previous|other)\b|\b(my|our) (other|earlier|previous|last)\b/i;
const GENERIC=new Set(['site','website','app','project','page','store','shop','last','month','week','earlier','previous','other','that','made','did','built','mine']);
// Another project of the same owner that the message refers to, with its main files as context.
function recall(owner,projectId,message){
 if(!active(owner)||!RECALL_HINT.test(String(message||'')))return null;
 const builder=require('./react-builder'),w=words(message).filter(x=>!GENERIC.has(x));
 let best=null;
 for(const p of builder.list()){
  if(p.owner!==owner||p.id===projectId)continue;
  let meta;try{meta=builder.loadMeta(p.id)}catch{continue}
  if(!meta.current_version)continue;
  const first=(meta.messages||[]).find(m=>m.role==='user');
  const nameW=words(meta.name).filter(x=>!GENERIC.has(x)),descW=words(first?first.text:'').filter(x=>!GENERIC.has(x));
  const score=overlap(w,nameW)*2+overlap(w,descW);
  if(score>=2&&(!best||score>best.score||(score===best.score&&Date.parse(meta.updated_at||0)>Date.parse(best.meta.updated_at||0))))best={meta,score};
 }
 if(!best)return null;
 const files=builder.loadFiles(best.meta.id,best.meta.current_version);
 const order=['src/App.jsx','src/backend.json',...Object.keys(files).filter(f=>/^src\/(pages|components)\/.+\.jsx$/.test(f))];
 let budget=12000,out='';
 for(const f of [...new Set(order)]){if(!files[f]||budget<=0)continue;const body=String(files[f]).slice(0,budget);out+='\n--- '+f+' ---\n'+body+'\n';budget-=body.length}
 return{id:best.meta.id,name:best.meta.name,note:'The person refers to their earlier project "'+best.meta.name+'". Its main files are below for reference: reuse its structure, features and patterns where the request asks for it, but keep this project\'s own name, content and design unless they ask to copy those too.\n'+out};
}

// ---------- what the person sees and edits ----------
function view(owner){
 const m=load(owner);
 return{enabled:m.enabled,on:on(),preferences:m.preferences,recipes:m.recipes.map(r=>({...r,success_rate:r.uses?Math.round(r.successes/r.uses*100):null})),shared:owner==='owner'?[]:sharedRecipes()(owner).map(r=>({id:r.id,title:r.title,when:r.when}))};
}
function edit(owner,b,{isOwner=false}={}){
 const m=load(owner),find=id=>{const r=m.recipes.find(x=>x.id===id);if(!r)throw err('Unknown recipe',404);return r};
 switch(b.action){
  case'enabled':m.enabled=Boolean(b.enabled);break;
  case'add_preference':{const t=clip(b.text,120);if(t.length<3)throw err('Write the preference in a few words',400);m.preferences.unshift({id:newId(),text:t,source:'you',at:new Date().toISOString()});m.preferences=m.preferences.slice(0,MAX_PREFS);break}
  case'delete_preference':m.preferences=m.preferences.filter(p=>p.id!==b.id);break;
  case'recipe_status':{const r=find(b.id);r.status=b.status==='off'?'off':'active';if(r.status==='active'){delete r.reason;r.uses=0;r.successes=0}break}
  case'delete_recipe':find(b.id);m.recipes=m.recipes.filter(r=>r.id!==b.id);break;
  case'share':{if(!isOwner)throw err('Only the Kairoq owner can share recipes with every account',403);find(b.id).shared=Boolean(b.shared);break}
  default:throw err('Unknown action',400);
 }
 save(owner,m);return view(owner);
}
// Recipes and their improvements are written after the build has finished, without holding it up.
const pending=new Set();
function track(p){pending.add(p);p.catch(()=>{}).finally(()=>pending.delete(p));return p}
async function settled(){while(pending.size)await Promise.allSettled([...pending])}
module.exports={track,settled,on,load,learnPreferences,preferenceNote,matchRecipes,recipeNote,writeRecipe,useRecipes,recall,view,edit,hard,words,PREF_HINT,RECALL_HINT};
