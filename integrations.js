"use strict";
// Kairoq's integrations library: 744 services and their actions and triggers, read from the
// community integrations of Activepieces (github.com/activepieces/activepieces,
// packages/pieces/community, MIT; never its "ee" folders). data/integrations.json holds the facts
// (how each service signs in, what each action does and needs); scripts/build-integrations.js
// rebuilds it. When an app needs a service, the builder looks it up (kairoq_integration) and
// reads the real code of the action it needs once from the pinned commit; Kairoq keeps that
// code (integration-code/ next to the projects) so it is never fetched again.
const fs=require('fs'),path=require('path');

const DATA=path.join(__dirname,'data','integrations.json');
let cache=null;
function data(){if(!cache)cache=JSON.parse(fs.readFileSync(DATA,'utf8'));return cache}
function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'')}

// The secret names the owner adds in Settings → Secrets for a service.
function secretBase(p){return(p.id||'service').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')}
function connection(p){
 const base=secretBase(p),a=p.auth||{type:'None'};
 if(a.type==='SecretText')return{kind:'key',secrets:[base+'_API_KEY'],how:(a.displayName||'API key')+(a.description?': '+clip(a.description,160):'')};
 if(a.type==='BasicAuth')return{kind:'key',secrets:[base+'_USERNAME',base+'_PASSWORD'],how:'Username and password (or key and secret)'};
 if(a.type==='CustomAuth')return{kind:'key',secrets:(a.fields&&a.fields.length?a.fields:[{key:'api_key'}]).map(f=>base+'_'+String(f.key).toUpperCase().replace(/[^A-Z0-9]+/g,'_')),how:(a.fields||[]).map(f=>f.label).join(', ')||'Its keys'};
 if(a.type==='OAuth2')return{kind:'oauth',secrets:[],how:'Sign in with '+p.displayName+' (OAuth)'};
 return{kind:'none',secrets:[],how:'No sign-in needed'};
}
// Search by name, description, category or action.
function search(q,{limit=24}={}){
 const words=String(q||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>1);
 const rows=data().pieces.map(p=>{
  const name=p.displayName.toLowerCase(),id=p.id;
  let score=0;
  for(const w of words){if(id===w||norm(name)===w)score+=100;else if(name.includes(w)||id.includes(w))score+=30;else if((p.categories||[]).some(c=>c.toLowerCase().includes(w)))score+=8;else if(p.description.toLowerCase().includes(w))score+=5;else if(p.actions.some(a=>a.displayName.toLowerCase().includes(w)))score+=3}
  return{p,score:words.length?score:1};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.p.displayName.localeCompare(b.p.displayName));
 return{total:data().pieces.length,results:rows.slice(0,Math.max(1,Math.min(100,limit))).map(({p})=>summary(p))};
}
function summary(p){const c=connection(p);return{id:p.id,name:p.displayName,description:p.description,categories:p.categories,connect:c.kind,actions:p.actions.length,triggers:p.triggers.length}}
function find(service){const s=norm(service);return data().pieces.find(p=>p.id===String(service)||norm(p.id)===s||norm(p.displayName)===s)||null}
function details(id){
 const p=find(id);if(!p)return null;const c=connection(p);
 return{...summary(p),how:c.how,secrets:c.secrets,api:p.api,actions:p.actions.map(a=>({name:a.name,label:a.displayName,description:a.description,props:a.props||[]})),triggers:p.triggers.map(t=>({name:t.name,label:t.displayName,description:t.description,strategy:t.strategy||null}))};
}

// ---------- the real code of an action, read once and kept ----------
function codeDir(){const d=path.join(path.dirname(require('./react-builder').ROOT()),'integration-code');fs.mkdirSync(d,{recursive:true});return d}
const SAFE=/^[a-z0-9][a-z0-9-]*$/,FILE=/^src\/[\w./-]+\.ts$/;
async function code(p,file,{remote}){
 if(!SAFE.test(p.id)||!FILE.test(file)||file.includes('..'))throw Object.assign(Error('Unknown integration file'),{status:400});
 const local=path.join(codeDir(),p.id,file);
 if(fs.existsSync(local))return fs.readFileSync(local,'utf8');
 const url='https://raw.githubusercontent.com/activepieces/activepieces/'+(data().commit||'main')+'/packages/pieces/community/'+p.id+'/'+file;
 const r=await remote(url,{limit:400000});const text=r.bytes.toString('utf8');
 fs.mkdirSync(path.dirname(local),{recursive:true});fs.writeFileSync(local,text);
 return text;
}
// The shared helpers of a service (its base URL, headers, auth), next to its actions.
function commonFiles(p){return(p.common||[]).slice(0,4)}

// What the builder's kairoq_integration tool answers.
async function lookup(service,action,{remote=(u,o)=>require('./builder-assets').remote(u,o)}={}){
 const p=find(service);
 if(!p){const s=search(service,{limit:6}).results;return'No integration called "'+clip(service,60)+'".'+(s.length?' Closest: '+s.map(x=>x.name+' ('+x.id+')').join(', ')+'.':'')}
 const c=connection(p);
 const head='Integration: '+p.displayName+' ('+p.id+'). '+p.description+'\nConnect: '+c.how+'. '
  +(c.kind==='key'?'In the app, read the keys in a server function with await secrets.get(name) for: '+c.secrets.join(', ')+'. Tell the owner in "message" to add them in Settings → Secrets (never put keys in the code).':c.kind==='oauth'?'This service signs in with OAuth, which Kairoq apps cannot do yet. If it also offers an API key or personal access token, use that as a secret instead; otherwise say so plainly in "Not done yet:".':'')
  +(p.api.length?'\nAPI addresses seen in its code: '+p.api.join(', '):'');
 if(!action){
  return head+'\n\nActions (call kairoq_integration again with the action name to read its real code):\n'+p.actions.map(a=>'- '+a.name+': '+a.displayName+(a.description?' — '+a.description:'')+(a.props?' ('+a.props.map(x=>x.key+(x.required?'*':'')).join(', ')+')':'')).join('\n')
   +(p.triggers.length?'\n\nTriggers (in a Kairoq app: a webhook is a server function the service calls; polling is an automation on a schedule):\n'+p.triggers.map(t=>'- '+t.name+': '+t.displayName+(t.strategy?' ['+t.strategy.toLowerCase()+']':'')).join('\n'):'');
 }
 const a=[...p.actions,...p.triggers].find(x=>x.name===action||norm(x.displayName)===norm(action));
 if(!a)return head+'\n\nNo action "'+clip(action,60)+'". Actions: '+p.actions.map(x=>x.name).join(', ');
 let body='',common='';
 try{body=await code(p,a.file,{remote})}catch(e){body='(Could not read the code: '+clip(e.message,120)+')'}
 for(const f of commonFiles(p))try{common+='\n// '+f+'\n'+(await code(p,f,{remote})).slice(0,6000)}catch{}
 return head+'\n\nHow Activepieces does "'+a.displayName+'" (MIT, Activepieces Inc.). Adapt it to a Kairoq server function: request.body for the inputs, await secrets.get(...) for keys, await fetch(url,{method,headers,body}) for the call; do not import @activepieces packages.\n// '+a.file+'\n'+body.slice(0,12000)+(common?'\n'+common:'');
}
module.exports={data,search,find,details,connection,lookup,code,secretBase};
