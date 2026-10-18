"use strict";
// Design skills: instructions (a SKILL.md with name and description) that the AI follows
// when it designs an app. Kairoq ships built-in skills in design-skills/<id>/SKILL.md;
// accounts add their own from a GitHub repository or by pasting text. A skill is on for a
// project when the project enables it or the account turned it on for all projects.
const fs=require('fs'),path=require('path'),crypto=require('crypto');

const BUILTIN_DIR=path.join(__dirname,'design-skills');
const MAX_BODY=20000,MAX_PROMPT=26000,MAX_CUSTOM=30;

function parse(text){
 let body=String(text||'').replace(/\r\n/g,'\n').trim(),meta={};
 const fm=/^---\n([\s\S]*?)\n---\n?/.exec(body);
 if(fm){for(const line of fm[1].split('\n')){const m=/^([a-zA-Z_-]+)\s*:\s*(.*)$/.exec(line);if(m)meta[m[1].toLowerCase()]=m[2].trim().replace(/^["']|["']$/g,'')}body=body.slice(fm[0].length).trim()}
 const heading=(/^#\s+(.+)$/m.exec(body)||[])[1];
 const firstPara=body.split(/\n\s*\n/).map(p=>p.trim()).find(p=>p&&!p.startsWith('#'))||'';
 return{...(meta.default==='on'?{defaultOn:true}:{}),name:String(meta.name||heading||'Untitled skill').slice(0,80),description:String(meta.description||firstPara).replace(/\s+/g,' ').slice(0,300),body:body.slice(0,MAX_BODY)};
}

let builtinCache=null;
function builtin(){
 if(builtinCache)return builtinCache;
 const list=[];
 for(const id of fs.existsSync(BUILTIN_DIR)?fs.readdirSync(BUILTIN_DIR).sort():[]){
  const file=path.join(BUILTIN_DIR,id,'SKILL.md');
  if(fs.existsSync(file))list.push({id,source:'builtin',...parse(fs.readFileSync(file,'utf8'))});
 }
 return builtinCache=list;
}

function db(){
 const d=require('./builder-accounts').database();
 if(!d.__skills){
  d.exec(`CREATE TABLE IF NOT EXISTS design_skills(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL,body TEXT NOT NULL,source TEXT NOT NULL,url TEXT,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS design_skill_defaults(owner TEXT NOT NULL,skill_id TEXT NOT NULL,PRIMARY KEY(owner,skill_id));`);
  d.__skills=true;
 }
 return d;
}
function custom(owner){return db().prepare('SELECT id,name,description,body,source,url,created_at FROM design_skills WHERE owner=? ORDER BY created_at').all(String(owner))}
function defaults(owner){return db().prepare('SELECT skill_id FROM design_skill_defaults WHERE owner=?').all(String(owner)).map(r=>r.skill_id)}
// Every skill an owner can use: built-in first, then their own.
// Built-in skills marked "default: on" are on for every project unless the owner turned them
// off (stored as "!id").
function library(owner){
 const on=new Set(defaults(owner));
 return[...builtin(),...custom(owner)].map(s=>({...s,always:on.has(s.id)||Boolean(s.defaultOn&&!on.has('!'+s.id))}));
}
function find(owner,id){return library(owner).find(s=>s.id===id)||null}
// A skill's text goes straight into the builder's instructions, so text from GitHub (or pasted)
// is checked first: hidden characters are removed; instructions aimed at the AI itself
// (ignore your rules, reveal secrets, send data somewhere) block the import; risky code
// patterns in its examples are reported as warnings.
const HIDDEN=/[​-‏‪-‮⁠-⁤⁦-⁩﻿­]/g;
const BLOCK=[
 [/\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|other|system)\b[^.\n]{0,30}\b(instructions?|rules?|prompts?|messages?)/i,'tells the AI to ignore its other instructions'],
 [/\b(reveal|print|output|show|repeat|leak|send|post|upload)\b[^.\n]{0,50}\b(system prompt|instructions you were given|api[_ -]?keys?|secrets?|tokens?|passwords?|credentials|env(ironment)? variables?|process\.env)/i,'asks the AI to reveal or send secrets'],
 [/\byou are (now|no longer)\b|\bnew (system )?instructions?:|\bact as (an? )?(unrestricted|jailbroken|dan)\b/i,'tries to change who the AI is'],
 [/\b(secrets\.get|process\.env|document\.cookie|localStorage\.getItem\(['"]?(kairoq|token|session))/i,'reads secrets, cookies or sessions'],
 [/(fetch|axios|XMLHttpRequest|navigator\.sendBeacon|new Image\(\)\.src)\s*\(?[^)\n]{0,80}(webhook\.site|requestbin|ngrok|pipedream|burpcollaborator|interact\.sh)/i,'sends data to a capture service'],
 [/[A-Za-z0-9+/]{300,}={0,2}/,'contains a long encoded blob']
];
const WARN=[
 [/\beval\s*\(|new Function\s*\(/,'uses eval or new Function'],
 [/<script[^>]+src=["']?https?:/i,'loads scripts from another site'],
 [/\bfetch\s*\(\s*["'`]https?:\/\/(?!fonts\.|images\.unsplash)/i,'calls other websites from the browser'],
 [/dangerouslySetInnerHTML/,'injects raw HTML']
];
function scan(text){
 const t=String(text||'');
 const hidden=(t.match(HIDDEN)||[]).length;
 const clean=t.replace(HIDDEN,'');
 return{clean,hidden,blocked:BLOCK.filter(([re])=>re.test(clean)).map(([,why])=>why),warnings:WARN.filter(([re])=>re.test(clean)).map(([,why])=>why)};
}
function add(owner,{name,description,body,source='custom',url=null}){
 const check=scan(body);
 if(check.blocked.length)throw Object.assign(Error('This skill was not added because it '+check.blocked.join(' and ')+'. Skills should only describe design rules.'),{status:422,blocked:check.blocked});
 body=check.clean;
 const parsed=parse(body);
 const skill={id:'u-'+crypto.randomBytes(5).toString('hex'),name:String(name||parsed.name).trim().slice(0,80)||'Untitled skill',description:String(description||parsed.description).trim().slice(0,300),body:parsed.body,source,url};
 if(skill.body.length<40)throw Object.assign(Error('The skill text is too short. Describe the design rules the AI should follow.'),{status:400});
 if(custom(owner).length>=MAX_CUSTOM)throw Object.assign(Error('You can keep up to '+MAX_CUSTOM+' skills. Remove one first.'),{status:400});
 db().prepare('INSERT INTO design_skills(id,owner,name,description,body,source,url,created_at) VALUES(?,?,?,?,?,?,?,?)').run(skill.id,String(owner),skill.name,skill.description||skill.name,skill.body,source,url,new Date().toISOString());
 return{...skill,always:false,...(check.warnings.length||check.hidden?{warnings:[...check.warnings,...(check.hidden?['had '+check.hidden+' hidden characters (removed)']:[])]}:{})};
}
function remove(owner,id){
 const r=db().prepare('DELETE FROM design_skills WHERE owner=? AND id=?').run(String(owner),String(id));
 if(!r.changes)throw Object.assign(Error('Unknown skill'),{status:404});
 db().prepare('DELETE FROM design_skill_defaults WHERE owner=? AND skill_id=?').run(String(owner),String(id));
 return{removed:id};
}
// Turns a skill on or off for all of an owner's projects.
function setDefault(owner,id,on){
 if(!find(owner,id))throw Object.assign(Error('Unknown skill'),{status:404});
 const del=db().prepare('DELETE FROM design_skill_defaults WHERE owner=? AND skill_id=?'),ins=db().prepare('INSERT OR IGNORE INTO design_skill_defaults(owner,skill_id) VALUES(?,?)');
 if(find(owner,id).defaultOn){if(on)del.run(String(owner),'!'+id);else ins.run(String(owner),'!'+id);return library(owner)}
 if(on)ins.run(String(owner),String(id));else del.run(String(owner),String(id));
 return library(owner);
}

// Skills active in a project: the project's own choice plus the owner's always-on skills.
function active(meta){
 try{
  const lib=library(meta.owner||'owner');
  const ids=new Set([...(Array.isArray(meta.skills)?meta.skills:[]),...lib.filter(s=>s.always).map(s=>s.id)]);
  return lib.filter(s=>ids.has(s.id));
 }catch{return[]}
}
function setProject(meta,ids){
 const lib=library(meta.owner||'owner');
 const list=[...new Set((Array.isArray(ids)?ids:[]).map(String))];
 for(const id of list)if(!lib.some(s=>s.id===id))throw Object.assign(Error('Unknown skill: '+id),{status:400});
 return list.slice(0,6);
}
function promptNote(meta){
 const list=active(meta);
 if(!list.length)return'';
 let budget=MAX_PROMPT,out='\n\nDESIGN SKILLS for this project. Follow them (the project knowledge and the user\'s requests win if they conflict):';
 for(const s of list){
  const text='\n\n### Skill: '+s.name+'\n'+s.body;
  if(text.length>budget){out+='\n\n### Skill: '+s.name+'\n'+s.body.slice(0,Math.max(0,budget-100))+'\n…(shortened)';break}
  out+=text;budget-=text.length;
 }
 return out;
}

// ---------- import from GitHub ----------
// Accepts github.com/<owner>/<repo>[/tree|blob/<ref>/<path>] and raw.githubusercontent.com links.
function parseGithubUrl(input){
 let u;try{u=new URL(String(input||'').trim())}catch{throw Object.assign(Error('Paste a GitHub link, for example https://github.com/owner/repo/tree/main/skills/my-skill'),{status:400})}
 const parts=u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
 const ok=s=>/^[A-Za-z0-9_.-]+$/.test(s);
 if(u.protocol!=='https:')throw Object.assign(Error('Use an https GitHub link'),{status:400});
 if(u.hostname==='raw.githubusercontent.com'&&parts.length>=4&&ok(parts[0])&&ok(parts[1]))return{owner:parts[0],repo:parts[1],ref:parts[2],path:parts.slice(3).join('/'),file:true};
 if(u.hostname!=='github.com'&&u.hostname!=='www.github.com')throw Object.assign(Error('Only github.com links are supported'),{status:400});
 if(parts.length<2||!ok(parts[0])||!ok(parts[1]))throw Object.assign(Error('That link does not point to a GitHub repository'),{status:400});
 const repo=parts[1].replace(/\.git$/,'');
 if(parts.length>=4&&(parts[2]==='tree'||parts[2]==='blob'))return{owner:parts[0],repo,ref:parts[3],path:parts.slice(4).join('/'),file:parts[2]==='blob'};
 return{owner:parts[0],repo,ref:'HEAD',path:'',file:false};
}
function safePath(p){if(String(p).split('/').some(s=>s==='..'||s.startsWith('.')&&s!=='.'))throw Object.assign(Error('Bad path in the link'),{status:400});return p}
async function getText(fetchImpl,url,{json=false}={}){
 const r=await fetchImpl(url,{headers:{'User-Agent':'Kairoq-Create','Accept':json?'application/vnd.github+json':'text/plain'},signal:AbortSignal.timeout(10000),redirect:'follow'});
 if(r.status===404)return null;
 if(!r.ok)throw Object.assign(Error('GitHub answered '+r.status+(r.status===403?' (rate limit; try again in a few minutes)':'')),{status:502});
 const text=await r.text();
 if(text.length>400000)throw Object.assign(Error('That file is too large to be a skill'),{status:400});
 return json?JSON.parse(text):text;
}
const raw=(g,p)=>'https://raw.githubusercontent.com/'+g.owner+'/'+g.repo+'/'+encodeURIComponent(g.ref)+'/'+p.split('/').map(encodeURIComponent).join('/');
// Returns {skill} when one skill was found, or {choices:[{path,url}]} when the repo has several.
async function importFromGithub(owner,input,{fetchImpl=fetch,choose}={}){
 const g=parseGithubUrl(input);
 const base=safePath(g.path.replace(/\/+$/,''));
 const pick=choose?safePath(String(choose)):null;
 const save=(text,file)=>add(owner,{body:text,source:'github',url:'https://github.com/'+g.owner+'/'+g.repo+'/blob/'+g.ref+'/'+file});
 if(pick){const text=await getText(fetchImpl,raw(g,pick));if(!text)throw Object.assign(Error('Could not read '+pick),{status:404});return{skill:save(text,pick)}}
 if(g.file||/\.md$/i.test(base)){
  const text=await getText(fetchImpl,raw(g,base));
  if(!text)throw Object.assign(Error('That file was not found. Is the repository public?'),{status:404});
  return{skill:save(text,base)};
 }
 const direct=base?base+'/SKILL.md':'SKILL.md';
 const text=await getText(fetchImpl,raw(g,direct));
 if(text)return{skill:save(text,direct)};
 // No SKILL.md at that path: look through the repository for skills below it.
 const tree=await getText(fetchImpl,'https://api.github.com/repos/'+g.owner+'/'+g.repo+'/git/trees/'+encodeURIComponent(g.ref)+'?recursive=1',{json:true});
 if(!tree)throw Object.assign(Error('Repository not found. Only public repositories can be imported.'),{status:404});
 const found=(tree.tree||[]).filter(e=>e.type==='blob'&&/(^|\/)SKILL\.md$/i.test(e.path)&&(!base||e.path.startsWith(base+'/'))).map(e=>e.path).slice(0,60);
 if(!found.length)throw Object.assign(Error('No SKILL.md found in that repository. Link to a folder with a SKILL.md or to a Markdown file.'),{status:404});
 if(found.length===1){const t=await getText(fetchImpl,raw(g,found[0]));return{skill:save(t||'',found[0])}}
 return{choices:found.map(p=>({path:p,name:p.split('/').slice(-2,-1)[0]||p}))};
}

module.exports={scan,parse,builtin,library,find,add,remove,setDefault,active,setProject,promptNote,parseGithubUrl,importFromGithub,MAX_BODY};
