"use strict";
// Kairoq's MCP server (Model Context Protocol, Streamable HTTP with JSON responses) at /mcp.
// AI assistants (Claude, ChatGPT, Cursor, …) connect with an account's API key and can list
// projects, run synthetic-customer tests and read the reports, all with the account's own
// access rights and credits.
const accounts=require('./builder-accounts');
const VERSIONS=['2025-06-18','2025-03-26','2024-11-05'];
const MAX_BODY=1024*1024;

const TOOLS=[
 {name:'list_projects',title:'List projects',description:'Lists the Kairoq projects this account can open, with their id, name and your role.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'run_synthetic_test',title:'Test with synthetic customers',description:'Sends AI personas through the current version of a Kairoq app in a real browser (on a test copy of its data). Each persona tries to reach the goal and thinks out loud. Costs credits per visitor. Returns a job id: call get_synthetic_test with it until the status is complete.',
  inputSchema:{type:'object',properties:{project_id:{type:'string',description:'Project id from list_projects'},audience:{type:'string',description:'Who the customers are, e.g. "busy parents booking swimming lessons, mostly on phones"'},goal:{type:'string',description:'What they come to do, e.g. "book a trial lesson for Saturday"'},visitors:{type:'integer',minimum:1,maximum:100,description:'How many personas (default 10)'},start_path:{type:'string',description:'Optional page to start on, e.g. #/pricing'},tier:{type:'string',enum:['standard','pro','max'],description:'Model tier (default standard)'}},required:['project_id','audience','goal'],additionalProperties:false}},
 {name:'get_synthetic_test',title:'Get a synthetic test',description:'Status of a running test (by job_id), or a finished report (by project_id and report_id): completion rate, where visitors dropped off, the main issues with quotes, suggested fixes.',
  inputSchema:{type:'object',properties:{job_id:{type:'string'},project_id:{type:'string'},report_id:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'list_synthetic_reports',title:'List synthetic test reports',description:'The synthetic-customer reports kept for a project, newest first.',inputSchema:{type:'object',properties:{project_id:{type:'string'}},required:['project_id'],additionalProperties:false},annotations:{readOnlyHint:true}}
];

function fail(message,code=-32602){return Object.assign(Error(message),{rpc:code})}
function text(value,summary){return{content:[{type:'text',text:summary||JSON.stringify(value,null,2)}],structuredContent:value}}
function reportText(r){
 const n=r.numbers,s=r.summary;
 return[(s.headline?s.headline+'\n\n':'')+n.completed+' of '+n.visitors+' visitors reached the goal ('+n.completion_rate+'%); '+n.gave_up+' gave up, '+n.stuck+' ran out of steps.',
  n.drop_off.length?'Where the others left: '+n.drop_off.map(d=>d.path+' ('+d.visitors+')').join(', '):'',
  s.issues.length?'Issues:\n'+s.issues.map((x,i)=>(i+1)+'. '+x.title+(x.why?': '+x.why:'')+(x.quote?' — "'+x.quote+'"':'')).join('\n'):'',
  s.fixes.length?'Suggested fixes:\n'+s.fixes.map(f=>'- '+f).join('\n'):''].filter(Boolean).join('\n\n');
}
async function callTool(name,args,v,deps){
 const api=require('./create-api'),synthetic=require('./synthetic-customers');
 const project=(id,need)=>{if(!/^[a-f0-9]{12}$/.test(String(id||'')))throw fail('Unknown project');try{return api.ownedProject(v,String(id),need)}catch(e){throw fail(e.message)}};
 if(name==='list_projects'){const projects=api.listFor(v).map(p=>({id:p.id,name:p.name,role:p.role,updated_at:p.updated_at}));return text({projects},projects.length?projects.map(p=>p.id+'  '+p.name+' ('+p.role+')').join('\n'):'No projects yet.')}
 if(name==='run_synthetic_test'){
  project(args.project_id,'editor');
  let job;try{job=api.startSynthetic(v,args.project_id,{audience:args.audience,goal:args.goal,count:args.visitors,path:args.start_path,tier:args.tier||'standard'},deps)}catch(e){throw fail(e.message)}
  return text({job_id:job.id,status:job.status,credits:job.credits},'Started a test with '+(Number(args.visitors)||10)+' synthetic visitors ('+job.credits+' credits). Job id: '+job.id+'. Call get_synthetic_test with this job_id until it is complete; it usually takes a few minutes.');
 }
 if(name==='get_synthetic_test'){
  if(args.job_id){
   const job=api.jobs.get(String(args.job_id));
   if(!job||job.mode!=='synthetic')throw fail('Unknown or expired job; use project_id and report_id for finished tests');
   project(job.projectId,'viewer');
   if(job.status==='complete'){const report=synthetic.load(job.projectId,job.result.synthetic.id);return text({status:'complete',project_id:job.projectId,report_id:report.id,numbers:report.numbers,summary:report.summary,fix_message:synthetic.fixMessage(report)},reportText(report))}
   if(job.status==='failed')return text({status:'failed',error:job.error},'The test failed: '+job.error);
   return text({status:job.status,progress:job.progress||null},'Still running: '+(job.progress||job.status)+'.');
  }
  project(args.project_id,'viewer');
  let report;try{report=synthetic.load(String(args.project_id),String(args.report_id||''))}catch(e){throw fail(e.message)}
  return text({status:'complete',project_id:args.project_id,report_id:report.id,numbers:report.numbers,summary:report.summary,fix_message:synthetic.fixMessage(report)},reportText(report));
 }
 if(name==='list_synthetic_reports'){project(args.project_id,'viewer');const reports=synthetic.list(String(args.project_id));return text({reports},reports.length?reports.map(r=>r.id+'  '+r.at.slice(0,16)+'  '+r.completion_rate+'% of '+r.visitors+' — '+r.goal).join('\n'):'No reports yet.')}
 throw fail('Unknown tool: '+String(name).slice(0,60));
}
async function dispatch(msg,v,deps){
 if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')return{jsonrpc:'2.0',id:msg&&msg.id!==undefined?msg.id:null,error:{code:-32600,message:'Invalid request'}};
 const notification=msg.id===undefined;
 try{
  let result;
  if(msg.method==='initialize'){const asked=msg.params&&msg.params.protocolVersion;result={protocolVersion:VERSIONS.includes(asked)?asked:VERSIONS[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'kairoq',title:'Kairoq',version:'1.0.0'},instructions:'Kairoq builds and tests web apps. Use list_projects to find a project, then run_synthetic_test to send AI customers through it, and get_synthetic_test to read the report.'}}
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
