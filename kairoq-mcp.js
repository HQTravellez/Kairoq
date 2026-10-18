"use strict";
// Kairoq's MCP server (Model Context Protocol, Streamable HTTP with JSON responses) at /mcp.
// AI assistants (Claude, ChatGPT, Cursor, …) and agent platforms (Paperclip and others that
// connect an MCP server) use an account's API key to create projects, build and publish apps,
// run synthetic-customer tests and read the reports, all with the account's own access
// rights and credits.
const accounts=require('./builder-accounts');
const VERSIONS=['2025-06-18','2025-03-26','2024-11-05'];
const MAX_BODY=1024*1024;

const TOOLS=[
 {name:'create_project',title:'Create a project',description:'Creates a new Kairoq app. Give a prompt to have it built right away (returns a job_id to follow with get_job), and/or a template id from list_templates to start from a working app. Building costs credits.',
  inputSchema:{type:'object',properties:{name:{type:'string',description:'Project name (optional)'},prompt:{type:'string',description:'What to build, e.g. "A booking site for my yoga studio with class times and online payment"'},template:{type:'string',description:'Template id from list_templates'},tier:{type:'string',enum:['standard','pro','max'],description:'Model tier (default standard)'}},additionalProperties:false}},
 {name:'build',title:'Build or change the app',description:'Asks Kairoq to change a project: a build request (one change, tested in a real browser before it is saved) or an agent task (mode "agent": bigger work in steps with tests, logs and web research). Returns a job_id; follow it with get_job. Costs credits; if the change leaves errors, the next fix of that problem is free.',
  inputSchema:{type:'object',properties:{project_id:{type:'string'},message:{type:'string',description:'The change or task, in plain English. Paste links to copy from or read.'},mode:{type:'string',enum:['build','agent'],description:'build (default) or agent'},tier:{type:'string',enum:['standard','pro','max']},fix:{type:'boolean',description:'True when this message fixes a problem Kairoq reported (the first fix of a problem is free)'}},required:['project_id','message'],additionalProperties:false}},
 {name:'get_job',title:'Get a build job',description:'Progress of a build or agent job by job_id, and when it is complete: what changed, the new version, the preview URL, any browser errors or failing checks, and the sources it read.',
  inputSchema:{type:'object',properties:{job_id:{type:'string'}},required:['job_id'],additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'get_project',title:'Get a project',description:'A project\'s state: name, your role, current version, preview URL, published URLs, files, saved checks, automations and the last messages.',
  inputSchema:{type:'object',properties:{project_id:{type:'string'}},required:['project_id'],additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'publish',title:'Publish the app',description:'Puts the current version live on a Kairoq URL (and the project\'s custom domains). Live hosting costs credits every 30 days, charged on the first publish. Saved checks are re-run first; a failing check blocks publishing unless force is true.',
  inputSchema:{type:'object',properties:{project_id:{type:'string'},slug:{type:'string',description:'Site name for the URL (optional)'},force:{type:'boolean',description:'Publish even if a saved check fails'}},required:['project_id'],additionalProperties:false}},
 {name:'list_templates',title:'List templates',description:'Working apps to start from (id, name, category, description).',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'list_projects',title:'List projects',description:'Lists the Kairoq projects this account can open, with their id, name and your role.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'run_synthetic_test',title:'Test with synthetic customers',description:'Sends AI personas through the current version of a Kairoq app in a real browser (on a test copy of its data). Each persona tries to reach the goal and thinks out loud. Costs credits per visitor. Returns a job id: call get_synthetic_test with it until the status is complete.',
  inputSchema:{type:'object',properties:{project_id:{type:'string',description:'Project id from list_projects'},audience:{type:'string',description:'Who the customers are, e.g. "busy parents booking swimming lessons, mostly on phones"'},goal:{type:'string',description:'What they come to do, e.g. "book a trial lesson for Saturday"'},visitors:{type:'integer',minimum:1,maximum:100,description:'How many personas (default 10)'},start_path:{type:'string',description:'Optional page to start on, e.g. #/pricing'},tier:{type:'string',enum:['standard','pro','max'],description:'Model tier (default standard)'},site:{type:'string',description:'Optional https link to test another public website instead of the app'},compare_with:{type:'string',description:'Optional https link of another website (e.g. the same app built elsewhere): the same customers visit both and you get both scores'},permission:{type:'boolean',description:'Required with site or compare_with: the user owns that website or has permission to test it'}},required:['project_id','audience','goal'],additionalProperties:false}},
 {name:'get_synthetic_test',title:'Get a synthetic test',description:'Status of a running test (by job_id), or a finished report (by project_id and report_id): completion rate, where visitors dropped off, the main issues with quotes, suggested fixes.',
  inputSchema:{type:'object',properties:{job_id:{type:'string'},project_id:{type:'string'},report_id:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'fix_and_retest',title:'Fix and retest',description:'Takes a finished synthetic test, sends the problems it confirmed (by replaying the visitors\' exact steps) to the Kairoq builder, replays the same steps on the new version, and repeats for up to `rounds` rounds. Fixed problems are saved as checks so they cannot come back. With rerun, the same customers then use the new version for a before-and-after. Costs a chat edit per round, plus the test price for a rerun. Returns a job id for get_synthetic_test.',
  inputSchema:{type:'object',properties:{project_id:{type:'string'},report_id:{type:'string'},rounds:{type:'integer',minimum:1,maximum:5,description:'Fix rounds at most (default 2)'},rerun:{type:'boolean',description:'Rerun the same customers afterwards (default false)'},tier:{type:'string',enum:['standard','pro','max']}},required:['project_id','report_id'],additionalProperties:false}},
 {name:'list_synthetic_reports',title:'List synthetic test reports',description:'The synthetic-customer reports kept for a project, newest first.',inputSchema:{type:'object',properties:{project_id:{type:'string'}},required:['project_id'],additionalProperties:false},annotations:{readOnlyHint:true}}
];

function fail(message,code=-32602){return Object.assign(Error(message),{rpc:code})}
function text(value,summary){return{content:[{type:'text',text:summary||JSON.stringify(value,null,2)}],structuredContent:value}}
function reportText(r){
 const n=r.numbers,s=r.summary;
 return[(s.headline?s.headline+'\n\n':'')+n.completed+' of '+n.visitors+' visitors reached the goal ('+n.completion_rate+'%); '+n.gave_up+' gave up, '+n.stuck+' ran out of steps.',
  n.drop_off.length?'Where the others left: '+n.drop_off.map(d=>d.path+' ('+d.visitors+')').join(', '):'',
  (r.problems||[]).length?'Checked by replaying the visitors\' steps:\n'+r.problems.map(p=>'- '+p.title+': '+({confirmed:'confirmed',not_reproduced:'could not be reproduced',experience:'visitor experience (not replayable)',not_checked:'not checked'}[p.status]||p.status)+' ('+p.visitors.join(', ')+')').join('\n'):'',
  s.issues.length?'Issues:\n'+s.issues.map((x,i)=>(i+1)+'. '+x.title+(x.why?': '+x.why:'')+(x.quote?' — "'+x.quote+'"':'')).join('\n'):'',
  s.fixes.length?'Suggested fixes:\n'+s.fixes.map(f=>'- '+f).join('\n'):'',
  (r.explanations||[]).length?'In plain English:\n'+r.explanations.map(c=>'- '+c.what+(c.where?' Where: '+c.where+(c.file?' ('+c.file+' line '+c.line+')':'')+'.':'')+(c.why?' Why: '+c.why:'')+(c.fix?' Fix: '+c.fix:'')).join('\n'):''].filter(Boolean).join('\n\n');
}
function compareText(c){
 return'Same customers on both sites:\n'+c.sites.map(x=>'- '+x.label+': '+x.numbers.completed+' of '+x.numbers.visitors+' reached the goal ('+x.numbers.completion_rate+'%), report '+x.report_id).join('\n')+(c.fair?'':'\nNote: this app was tested on a test copy of its data, the other site with sends answered locally, so conditions differ slightly. For the fairest comparison, test two published links.');
}
function repairText(r){
 if(r.nothing)return'The test found nothing to fix.';
 const word={fixed:'fixed',still:'still there',changed:'could not replay the same steps (judge it by the rerun)',confirmed:'not retested',not_reproduced:'not reproduced, left alone',experience:'visitor experience',not_checked:'not checked'};
 return[r.rounds.length+' fix round'+(r.rounds.length===1?'':'s')+', '+r.credits+' credits.',
  r.problems.length?'Problems:\n'+r.problems.map(p=>'- '+p.title+': '+(word[p.after]||p.after)).join('\n'):'',
  r.checks.length?'Saved as checks: '+r.checks.join('; '):'',
  r.rerun?'Rerun: '+r.rerun.before.completed+' of '+r.rerun.before.visitors+' → '+r.rerun.after.completed+' of '+r.rerun.after.visitors+' reached the goal ('+(r.rerun.change>=0?'+':'')+r.rerun.change+' points). Report id: '+r.rerun.report_id:'',
  r.rerun_error?'The rerun did not finish: '+r.rerun_error:'',r.stopped||''].filter(Boolean).join('\n\n');
}
function jobText(job){
 if(job.status==='failed')return{status:'failed',error:job.error,text:'The job failed: '+job.error};
 if(job.status!=='complete')return{status:job.status,progress:job.progress||null,step:job.agent?job.agent.step:undefined,text:'Still running: '+(job.progress||job.status)+(job.agent&&job.agent.step?' (step '+job.agent.step+')':'')+'.'};
 const r=job.result||{};
 const out={status:'complete',project_id:job.projectId,mode:job.mode,version:r.version||null,message:r.message||'',changed:r.changed||[],preview_url:r.preview_url||null,runtime_errors:r.runtime_errors||[],check_failures:(r.check_failures||[]).map(c=>c.name),sources:r.sources||[],credits:job.refunded||job.on_us?0:job.credits,...(job.fix_on_us?{fix_on_us:true}:{}),...(job.free?{free:job.free}:{}),...(job.loop?{loop:job.loop}:{})};
 const lines=[r.message||'Done.',r.version?'Version '+r.version+(out.changed.length?' · changed '+out.changed.join(', '):''):'',out.preview_url?'Preview: '+out.preview_url:'',
  out.runtime_errors.length?'Errors in the browser:\n'+out.runtime_errors.map(e=>'- '+e).join('\n'):'',out.check_failures.length?'Failing saved checks: '+out.check_failures.join(', '):'',
  job.fix_on_us?'The fix is on us: send the next build with fix: true and it costs nothing.':'',job.free?job.free:'',out.sources.length?'Sources: '+out.sources.map(s=>s.url).join(', '):'','Cost: '+out.credits+' credit'+(out.credits===1?'':'s')+'.'].filter(Boolean);
 return{...out,text:lines.join('\n')};
}
async function callTool(name,args,v,deps){
 const api=require('./create-api'),synthetic=require('./synthetic-customers'),builder=require('./react-builder');
 const project=(id,need)=>{if(!/^[a-f0-9]{12}$/.test(String(id||'')))throw fail('Unknown project');try{return api.ownedProject(v,String(id),need)}catch(e){throw fail(e.message)}};
 if(name==='list_templates'){const templates=require('./create-templates').list().map(t=>({id:t.id,name:t.name,category:t.category,description:t.description}));return text({templates},templates.map(t=>t.id+'  '+t.name+' ('+t.category+'): '+t.description).join('\n'))}
 if(name==='create_project'){
  if(!String(args.prompt||'').trim()&&!args.template)throw fail('Give a prompt, a template id, or both');
  let made;try{made=await api.createProject(v,{name:args.name,prompt:args.prompt,template:args.template,tier:args.tier||'standard'},deps)}catch(e){throw fail(e.message)}
  const meta=builder.loadMeta(made.meta.id);
  const out={project_id:meta.id,name:meta.name,preview_url:builder.previewUrl(meta),...(made.job?{job_id:made.job.id,credits:made.job.credits}:{})};
  return text(out,'Created project '+meta.id+' ("'+meta.name+'").'+(made.job?' Building it now ('+made.job.credits+' credits): follow job '+made.job.id+' with get_job.':' Preview: '+out.preview_url));
 }
 if(name==='build'){
  project(args.project_id,'editor');
  const message=String(args.message||'').trim();if(!message)throw fail('Give a message');
  let job;try{job=api.startJob(v,String(args.project_id),{message,mode:args.mode==='agent'?'agent':'build',tier:args.tier||'standard',fix:Boolean(args.fix)},deps)}catch(e){throw fail(e.message)}
  return text({job_id:job.id,status:job.status,credits:job.credits,...(job.on_us?{on_us:true}:{})},'Started '+(job.mode==='agent'?'an agent task':'a build')+(job.on_us?' (on us, 0 credits)':' ('+job.credits+' credit'+(job.credits===1?'':'s')+')')+'. Job id: '+job.id+'. Call get_job with it until it is complete.');
 }
 if(name==='get_job'){
  const job=api.jobs.get(String(args.job_id||''));
  if(!job||!['build','agent','polish'].includes(job.mode))throw fail('Unknown or expired job');
  project(job.projectId,'viewer');
  const j=jobText(job);const {text:t,...rest}=j;return text(rest,t);
 }
 if(name==='get_project'){
  const {meta,role}=project(args.project_id,'viewer');
  const hosting=require('./react-hosting'),d=builder.detail(meta.id);
  const out={project_id:meta.id,name:meta.name,role,current_version:meta.current_version,versions:meta.versions.length,preview_url:builder.previewUrl(meta),published:meta.published?{version:meta.published.version,urls:hosting.siteUrls(meta)}:null,files:d.files,checks:require('./react-checks').list(meta).map(c=>({name:c.name,enabled:c.enabled!==false,last_ok:c.last?c.last.ok:null})),automations:require('./react-automations').status(meta.id).map(a=>({name:a.name,what:a.text,last_result:a.last_result,ok:a.ok})),messages:d.messages.slice(-6).map(m=>({role:m.role,text:String(m.text||'').slice(0,400),version:m.version}))};
  return text(out,[meta.name+' ('+role+'), version '+(meta.current_version||0)+' of '+meta.versions.length+'.','Preview: '+(out.preview_url||'(nothing built yet)'),out.published?'Live: '+(out.published.urls.domains[0]||out.published.urls.subdomain||out.published.urls.path):'Not published.',out.checks.length?'Checks: '+out.checks.map(c=>c.name+(c.last_ok===false?' (failing)':'')).join(', '):'',out.automations.length?'Automations: '+out.automations.map(a=>a.what).join('; '):'','Files: '+out.files.join(', ')].filter(Boolean).join('\n'));
 }
 if(name==='publish'){
  const {meta}=project(args.project_id,'editor');
  let r;try{r=await api.publishProject(meta.id,{slug:args.slug,force:Boolean(args.force)},{inspect:deps.inspect,screenshot:deps.screenshot})}catch(e){throw fail(e.message)}
  const urls=r.urls||{};
  return text({project_id:meta.id,version:r.published.version,urls},'Published version '+r.published.version+'. Live at '+(urls.domains&&urls.domains[0]||urls.subdomain||urls.path));
 }
 if(name==='list_projects'){const projects=api.listFor(v).map(p=>({id:p.id,name:p.name,role:p.role,updated_at:p.updated_at}));return text({projects},projects.length?projects.map(p=>p.id+'  '+p.name+' ('+p.role+')').join('\n'):'No projects yet.')}
 if(name==='run_synthetic_test'){
  project(args.project_id,'editor');
  let job;try{job=await api.startSynthetic(v,args.project_id,{audience:args.audience,goal:args.goal,count:args.visitors,path:args.start_path,tier:args.tier||'standard',site:args.site,compare:args.compare_with,permission:args.permission},deps)}catch(e){throw fail(e.message)}
  return text({job_id:job.id,status:job.status,credits:job.credits},'Started a test with '+(Number(args.visitors)||10)+' synthetic visitors ('+job.credits+' credits). Job id: '+job.id+'. Call get_synthetic_test with this job_id until it is complete; it usually takes a few minutes.');
 }
 if(name==='fix_and_retest'){
  project(args.project_id,'editor');
  let job;try{job=api.startRepair(v,String(args.project_id),{report:args.report_id,rounds:args.rounds,rerun:args.rerun,tier:args.tier||'standard'},deps)}catch(e){throw fail(e.message)}
  return text({job_id:job.id,status:job.status,max_credits:job.credits},'Started fix and retest (at most '+job.credits+' credits). Job id: '+job.id+'. Call get_synthetic_test with this job_id until it is complete.');
 }
 if(name==='get_synthetic_test'){
  if(args.job_id){
   const job=api.jobs.get(String(args.job_id));
   if(!job||!['synthetic','repair'].includes(job.mode))throw fail('Unknown or expired job; use project_id and report_id for finished tests');
   project(job.projectId,'viewer');
   if(job.mode==='repair'){
    if(job.status==='failed')return text({status:'failed',error:job.error},'Fix and retest failed: '+job.error);
    if(job.status!=='complete')return text({status:job.status,progress:job.progress||null},'Still running: '+(job.progress||job.status)+'.');
    return text({status:'complete',project_id:job.projectId,repair:job.result.repair},repairText(job.result.repair));
   }
   if(job.status==='complete'){const report=synthetic.load(job.projectId,job.result.synthetic.id);const c=job.result.comparison;return text({status:'complete',project_id:job.projectId,report_id:report.id,numbers:report.numbers,summary:report.summary,explanations:report.explanations||[],fix_message:synthetic.fixMessage(report),...(c?{comparison:c}:{})},(c?compareText(c)+'\n\n':'')+reportText(report))}
   if(job.status==='failed')return text({status:'failed',error:job.error},'The test failed: '+job.error);
   return text({status:job.status,progress:job.progress||null},'Still running: '+(job.progress||job.status)+'.');
  }
  project(args.project_id,'viewer');
  let report;try{report=synthetic.load(String(args.project_id),String(args.report_id||''))}catch(e){throw fail(e.message)}
  return text({status:'complete',project_id:args.project_id,report_id:report.id,numbers:report.numbers,summary:report.summary,explanations:report.explanations||[],fix_message:synthetic.fixMessage(report)},reportText(report));
 }
 if(name==='list_synthetic_reports'){project(args.project_id,'viewer');const reports=synthetic.list(String(args.project_id));return text({reports},reports.length?reports.map(r=>r.id+'  '+r.at.slice(0,16)+'  '+r.completion_rate+'% of '+r.visitors+' — '+r.goal).join('\n'):'No reports yet.')}
 throw fail('Unknown tool: '+String(name).slice(0,60));
}
async function dispatch(msg,v,deps){
 if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')return{jsonrpc:'2.0',id:msg&&msg.id!==undefined?msg.id:null,error:{code:-32600,message:'Invalid request'}};
 const notification=msg.id===undefined;
 try{
  let result;
  if(msg.method==='initialize'){const asked=msg.params&&msg.params.protocolVersion;result={protocolVersion:VERSIONS.includes(asked)?asked:VERSIONS[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'kairoq',title:'Kairoq',version:'1.0.0'},instructions:'Kairoq builds, tests and publishes web apps from plain English. create_project (with a prompt or a template) and build start work and return a job_id; poll get_job until it is complete, then get_project for the preview URL and publish to go live. Every change is tested in a real browser; if get_job reports errors or failing checks, send build with fix: true (the first fix is free). Use list_projects to find a project, then run_synthetic_test to send AI customers through it, get_synthetic_test to read the report, and fix_and_retest to fix what it confirmed and test again.'}}
  else if(msg.method==='ping')result={};
  else if(msg.method==='tools/list')result={tools:TOOLS};
  else if(msg.method==='tools/call'){
   const p=msg.params||{};
   try{result=await callTool(String(p.name||''),p.arguments&&typeof p.arguments==='object'?p.arguments:{},v,deps)}
   catch(e){if(e.rpc===-32602&&/^Unknown tool/.test(e.message))throw e;result={content:[{type:'text',text:String(e.message||e).slice(0,500)}],isError:true}}
  }
  else if(msg.method.startsWith('notifications/'))return null;
  else throw fail('Method not found: '+msg.method.slice(0,60),-32601);
  return notification?null:{jsonrpc:'2.0',id:msg.id,result};
 }catch(e){return notification?null:{jsonrpc:'2.0',id:msg.id,error:{code:e.rpc||-32603,message:String(e.message||e).slice(0,500)}}}
}
function reply(res,status,body,extra={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...extra});res.end(body===undefined?undefined:JSON.stringify(body))}
// deps: {callModel, browse} as for the editor API.
async function handle(req,res,deps){
 if(req.method!=='POST'){reply(res,405,{error:'Use POST with JSON-RPC messages'},{Allow:'POST'});return true}
 const key=(/^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization||''))||[])[1];
 const v=key&&accounts.viewerForApiKey(key);
 if(!v){reply(res,401,{error:'Use an API key from Kairoq (Account → API keys): Authorization: Bearer kq_…'},{'WWW-Authenticate':'Bearer realm="kairoq"'});return true}
 const chunks=[];let size=0;
 for await(const c of req){size+=c.length;if(size>MAX_BODY){reply(res,413,{error:'Request too large'});return true}chunks.push(c)}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{reply(res,400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});return true}
 const batch=Array.isArray(body);
 const out=(await Promise.all((batch?body.slice(0,20):[body]).map(m=>dispatch(m,v,deps)))).filter(Boolean);
 if(!out.length){res.writeHead(202);res.end();return true}
 reply(res,200,batch?out:out[0]);
 return true;
}
module.exports={handle,TOOLS};
