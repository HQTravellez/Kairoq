"use strict";
// Parallel writers for a first build: one lead call plans the page as files (the shared App.jsx
// that imports every section, plus small shared modules), then one writer per section writes its
// file at the same time. The agent then builds, tests and fixes as usual. On the live Pulse build
// one agent spent 4 min 13 s writing the whole page in a single reply; split, the writing takes
// about as long as the longest section.
// Every writer gets the same rules, design, kit API, skills and the lead's plan, so the sections
// share one look. If the plan fails, the agent writes the page itself as before; a section that
// fails is named to the agent so it writes that one file.

const MAX_SECTIONS=8,SECTION_FILE=/^src\/(components|pages|sections)\/[\w/-]+\.jsx$/,SHARED_FILE=/^src\/(App\.jsx|lib\/[\w/-]+\.(js|jsx)|data\/[\w/-]+\.(js|json))$/;

// Off by default: like Emergent and Lovable, the agent builds a first version in small steps
// (2-3 files, build, test, next part) instead of writing the whole app at once. On the live Pulse
// build the all-at-once write failed and the agent never recovered. KAIROQ_PARALLEL_WRITERS=on
// turns this back on.
function enabled(){return process.env.KAIROQ_PARALLEL_WRITERS==='on'}

function parseJson(content){
 const t=String(typeof content==='string'?content:JSON.stringify(content||'')).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
 try{return JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('not JSON');return JSON.parse(t.slice(a,b+1))}
}

const LEAD=`You are the lead engineer and designer of this app. Plan the FIRST version as files so several writers can write the sections at the same time.
Reply with ONLY a JSON object:
{"thought":"one sentence","shared":{"src/App.jsx":"full code","src/lib/motion.js":"full code (optional)","src/data/content.js":"full code (optional)"},"sections":[{"file":"src/components/Hero.jsx","name":"Hero","brief":"exactly what this section shows: real copy, layout, components from the UI kit, motion, data it imports"}]}
Rules:
- 2 to ${MAX_SECTIONS} sections, in page order. Each section is ONE file under src/components/ (or src/pages/ for separate pages) with a default export named like the file.
- src/App.jsx imports every section's default export from its file and renders them (with the router if there are pages). Keep App.jsx short: layout, header/footer only if they are their own sections.
- Put everything two sections share in shared files (src/lib/*.js for helpers such as GSAP plugin registration, src/data/*.js for content lists). Write them in full now.
- Briefs are specific: the words to show, the kit components to use, the motion, what is interactive. Writers see only your plan, the rules and the shared files.`;

const WRITER=file=>`You write ONE file of this app: ${file}. Other writers are writing the other sections at the same time from the same plan, so follow the plan, the design and the shared files exactly; import shared helpers and data instead of redefining them; do not write any other file.
Reply with ONLY a JSON object: {"file":"${file}","content":"the full file"}`;

function textOf(content){return Array.isArray(content)?content.filter(p=>p&&p.type==='text').map(p=>p.text).join('\n'):String(content||'')}

// write({system, intro, callModel, tier, signal, onNote}) -> {files, sections, failed, ms} or null.
async function write({system,intro,callModel,tier='standard',signal,onNote=()=>{}}={}){
 if(!callModel)return null;
 const started=Date.now();
 const introText=textOf(intro);
 let plan;
 try{
  plan=await callModel({messages:[{role:'system',content:system+'\n\n'+LEAD},{role:'user',content:introText}],temperature:0.2,maxOutputTokens:12000,signal,tier,purpose:'plan-files'},parseJson);
 }catch(e){if(signal?.aborted)throw e;return null}
 const shared={};
 for(const [name,code] of Object.entries(plan&&plan.shared||{}))if(SHARED_FILE.test(name)&&typeof code==='string'&&code.trim())shared[name]=code;
 const sections=(Array.isArray(plan&&plan.sections)?plan.sections:[]).filter(s=>s&&SECTION_FILE.test(String(s.file||''))&&String(s.brief||'').trim()).slice(0,MAX_SECTIONS);
 const seen=new Set(),unique=sections.filter(s=>!seen.has(s.file)&&seen.add(s.file));
 if(!shared['src/App.jsx']||unique.length<2)return null;
 onNote('Planned '+unique.length+' sections: '+unique.map(s=>s.name||s.file.split('/').pop().replace('.jsx','')).join(', '));
 const planText='THE PLAN (from the lead):\n'+unique.map((s,i)=>(i+1)+'. '+s.file+' — '+String(s.brief).slice(0,1200)).join('\n')+'\n\nSHARED FILES (already written; import from them):\n'+Object.entries(shared).map(([n,c])=>'--- '+n+' ---\n'+c).join('\n\n');
 const results=await Promise.all(unique.map(async s=>{
  try{
   const out=await callModel({messages:[{role:'system',content:system+'\n\n'+WRITER(s.file)},{role:'user',content:introText+'\n\n'+planText+'\n\nWrite '+s.file+' now.'}],temperature:0.2,maxOutputTokens:16000,signal,tier,purpose:'section-writer'},parseJson);
   const content=out&&typeof out.content==='string'?out.content:'';
   return content.trim()?{file:s.file,content}:{file:s.file,error:'empty reply'};
  }catch(e){if(signal?.aborted)throw e;return{file:s.file,error:String(e.message||e).slice(0,160)}}
 }));
 const files={...shared},failed=[];
 for(const r of results)r.content?files[r.file]=r.content:failed.push(r.file);
 const ms=Date.now()-started;
 onNote('Wrote '+(results.length-failed.length)+' sections in parallel in '+Math.round(ms/1000)+' s'+(failed.length?' ('+failed.length+' left for the agent)':''));
 return{files,sections:unique.map(s=>s.file),failed,ms};
}

module.exports={enabled,write,parseJson,LEAD,WRITER,MAX_SECTIONS};
