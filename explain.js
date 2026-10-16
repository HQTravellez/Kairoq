"use strict";
// Plain-English explanations for people who do not read code: what is happening, where in the
// app (the element, and the file and line behind it), why, what it costs and the fix.
// The code lines shown always come from the project's real source; the model only says what
// each line means, and only for places Kairoq found (for synthetic customers, the exact
// elements visitors used or saw when they gave up, from the data-kq tags in every build).
const builder=require('./react-builder');

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function json(content){
 const t=String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
 try{return JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('The model did not answer with JSON');return JSON.parse(t.slice(a,b+1))}
}
// "src/App.jsx:42:6" → {file, line} if that line exists in the source.
function place(files,loc){
 const m=/^(src\/[\w./-]+\.(?:jsx|js|tsx|ts)):(\d+)/.exec(String(loc||''));
 if(!m||typeof files[m[1]]!=='string')return null;
 const line=Number(m[2]),lines=files[m[1]].split('\n');
 return line>=1&&line<=lines.length?{file:m[1],line}:null;
}
// The real source around a line: [{n, code}].
function snippet(files,file,line,radius=5){
 const lines=String(files[file]||'').split('\n'),from=Math.max(1,line-radius),to=Math.min(lines.length,line+radius);
 const out=[];for(let n=from;n<=to;n++)out.push({n,code:lines[n-1].slice(0,240)});
 return out;
}
function showSnippet(s){return s.map(x=>String(x.n).padStart(4)+'  '+x.code).join('\n')}
// Lines the model explained, kept only where they are inside the shown snippet.
function explainedLines(snip,list){
 const byN=new Map(snip.map(x=>[x.n,x.code]));
 return(Array.isArray(list)?list:[]).filter(x=>x&&byN.has(Number(x.n))).slice(0,8).map(x=>({n:Number(x.n),code:byN.get(Number(x.n)),meaning:clip(x.meaning,240)})).filter(x=>x.meaning);
}
function card(v,{where}={}){
 return{what:clip(v.what,300),where:clip(v.where,200),why:clip(v.why,600),impact:clip(v.impact,300),fix:clip(v.fix,500),...(where||{})};
}

// ---------- synthetic-customer issues ----------
const ISSUES_PROMPT=`You explain problems in a web app to a business owner who does not read code. Plain, friendly English, short sentences, no jargon (say "button", "form", "page", not "component", "state", "prop").
You get the problems found by a synthetic-customer test, the test numbers, and the places in the code (C1, C2, …) behind the buttons, links and fields visitors used or saw when they gave up, each with its real source lines.
For each problem write one card. Respond with ONLY JSON:
{"cards":[{"issue":<problem number>,"what":"what is happening, in one sentence with the numbers","where":"the place in plain words, e.g. the Book a class button on the booking form","place":"C3" or null if none of the places fits,"why":"why it happens, in plain words","impact":"what it costs the business, from the numbers","fix":"the change to make, in plain words","lines":[{"n":<line number from that place>,"meaning":"what this line does, in plain words"}]}]}
Only use a place whose code really is about the problem. Explain at most 6 lines per card, the ones that matter for the problem.`;
async function issues(id,report,{callModel,tier='standard',signal}){
 const s=report.summary;
 if(!s.issues.length)return[];
 const files=builder.loadFiles(id,report.version);
 // The places visitors who did not finish touched or saw, most frequent first.
 const counts=new Map();
 for(const v of report.visits)if(v.outcome!=='completed')for(const st of v.steps)for(const loc of [st.loc,...(st.screen||[])].filter(Boolean)){const p=place(files,loc);if(p){const k=p.file+':'+p.line;counts.set(k,(counts.get(k)||0)+(loc===st.loc?2:1))}}
 const places=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k],i)=>{const [file,line]=[k.slice(0,k.lastIndexOf(':')),Number(k.slice(k.lastIndexOf(':')+1))];return{id:'C'+(i+1),file,line,snippet:snippet(files,file,line)}});
 const n=report.numbers;
 const user='Goal: '+clip(report.test.goal,300)+'\nAudience: '+clip(report.test.audience,300)+'\nNumbers: '+n.completed+' of '+n.visitors+' reached the goal ('+n.completion_rate+'%), '+n.gave_up+' gave up, '+n.stuck+' ran out of steps. By device: '+JSON.stringify(n.by_device)+'. Where the others left: '+n.drop_off.map(d=>d.path+' ('+d.visitors+')').join(', ')+
  '\n\nProblems:\n'+s.issues.map((x,i)=>(i+1)+'. '+x.title+': '+x.why+(x.who?' ('+x.who+')':'')+(x.quote?' — a visitor said "'+x.quote+'"':'')).join('\n')+
  '\n\nPlaces in the code:\n'+(places.length?places.map(p=>p.id+' — '+p.file+' line '+p.line+'\n'+showSnippet(p.snippet)).join('\n\n'):'(none found)');
 const v=await callModel({messages:[{role:'system',content:ISSUES_PROMPT},{role:'user',content:user}],temperature:0.2,maxOutputTokens:4000,signal,tier},json);
 return(Array.isArray(v.cards)?v.cards:[]).slice(0,6).map(c=>{
  const p=places.find(x=>x.id===String(c.place||''));
  const issue=Math.round(Number(c.issue));
  return{issue:issue>=1&&issue<=s.issues.length?issue:null,...card(c,{where:p?{file:p.file,line:p.line,code:explainedLines(p.snippet,c.lines),snippet:p.snippet}:{}})};
 });
}

// ---------- errors and failed checks ----------
const ERROR_PROMPT=`You explain a technical problem in a web app to a business owner who does not read code. Plain, friendly English, short sentences, no jargon.
You get the problem (an error from the browser or a failed check) and the app's source files with line numbers.
Respond with ONLY JSON: {"what":"what the visitor experiences, one sentence","where":"the place in plain words","file":"src/… the file most likely responsible","line":<line number in that file>,"why":"why it happens, in plain words","impact":"what it means for visitors and the business","fix":"the change to make, in plain words","lines":[{"n":<line number>,"meaning":"what this line does, in plain words"}],"sure":true|false}
Set "sure" to false when the source does not clearly show the cause. Explain at most 6 lines.`;
function numbered(files,budget=50000){
 const parts=[];let used=0;
 for(const [f,code] of Object.entries(files)){
  if(!/^src\/.*\.(jsx|js|tsx|ts)$/.test(f)||/^src\/components\/ui\//.test(f))continue;
  const text='=== '+f+'\n'+String(code).split('\n').map((l,i)=>String(i+1).padStart(4)+'  '+l).join('\n');
  if(used+text.length>budget)continue;used+=text.length;parts.push(text);
 }
 return parts.join('\n\n');
}
async function problem(id,{kind,text},{callModel,tier='standard',signal}){
 const meta=builder.loadMeta(id),files=builder.loadFiles(id,meta.current_version);
 const v=await callModel({messages:[{role:'system',content:ERROR_PROMPT},{role:'user',content:'Problem ('+(kind==='check'?'a saved check failed':'an error in the browser')+'):\n'+clip(text,2000)+'\n\nSource:\n'+numbered(files)}],temperature:0.2,maxOutputTokens:2000,signal,tier},json);
 const p=place(files,String(v.file||'')+':'+Math.round(Number(v.line)));
 const snip=p?snippet(files,p.file,p.line):null;
 return{...card(v,{where:p?{file:p.file,line:p.line,code:explainedLines(snip,v.lines),snippet:snip}:{}}),sure:v.sure!==false&&Boolean(p),version:meta.current_version};
}

// ---------- a change the AI made ----------
const CHANGE_PROMPT=`You explain what changed in a web app to a business owner who does not read code. Plain, friendly English, no jargon, no file names unless needed.
You get the files that changed, before and after.
Respond with ONLY JSON: {"summary":"one or two sentences: what visitors will notice","changes":[{"what":"one change, as a visitor would see it","where":"page or part of the app","why_it_matters":"why it matters for visitors or the business"}],"watch":"anything to double-check by hand, or empty"}
At most 8 changes, most visible first.`;
async function change(id,version,{callModel,tier='standard',signal}){
 const meta=builder.loadMeta(id),n=Number(version)||meta.current_version;
 const ver=meta.versions.find(x=>x.n===n);if(!ver)throw Object.assign(Error('Unknown version'),{status:404});
 const prevN=Math.max(0,...meta.versions.filter(x=>x.n<n).map(x=>x.n));
 const after=builder.loadFiles(id,n),before=prevN?builder.loadFiles(id,prevN):{};
 let budget=60000;const parts=[];
 for(const f of (ver.changed&&ver.changed.length?ver.changed:Object.keys(after).filter(k=>before[k]!==after[k]))){
  const b=Object.hasOwn(before,f)?String(before[f]):'(new file)',a=Object.hasOwn(after,f)?String(after[f]):'(deleted)';
  if(b.length+a.length>budget){parts.push('=== '+f+' (too large to show)');continue}
  budget-=b.length+a.length;parts.push('=== '+f+'\n--- before\n'+b+'\n--- after\n'+a);
 }
 if(!parts.length)return{version:n,summary:'Nothing changed in this version.',changes:[],watch:''};
 const v=await callModel({messages:[{role:'system',content:CHANGE_PROMPT},{role:'user',content:'What the user asked: '+clip(ver.summary||'',400)+'\n\n'+parts.join('\n\n')}],temperature:0.2,maxOutputTokens:2000,signal,tier},json);
 return{version:n,summary:clip(v.summary,400),changes:(Array.isArray(v.changes)?v.changes:[]).slice(0,8).map(x=>({what:clip(x.what,240),where:clip(x.where,120),why_it_matters:clip(x.why_it_matters,240)})).filter(x=>x.what),watch:clip(v.watch,300)};
}
module.exports={issues,problem,change,place,snippet};
