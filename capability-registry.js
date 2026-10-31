"use strict";
// Capability OS: Kairoq's runtime-discoverable inventory plus trigger/evidence rules.
// Discoverability never authorizes execution; tool permissions still come from the active protocol.
const CAPABILITIES=Object.freeze([
  {id:"app_builder",label:"React app building and editing",group:"Build",status:"wired",entry:"react-agent.js",tools:["read_files","write_files","edit_files","build_and_test"]},
  {id:"browser",label:"Browser research and website interaction",group:"Research",status:"wired-in-agent-mode",entry:"react-agent.js",tools:["web_search","web_open","web_act","fetch_url"]},
  {id:"github_repository",label:"GitHub repository and API-source inspection",group:"Research",status:"wired-in-agent-mode",entry:"github-repository-intelligence.js",tools:["inspect_github_repo"]},
  {id:"headless_chromium",label:"Chromium browser rendering",group:"Research",status:"available-not-universal",entry:"browser-reader.js",tools:[]},
  {id:"api_docs",label:"OpenAPI, Swagger, Postman documentation extraction",group:"API",status:"separate-workflow",entry:"api-docs.js",tools:["inspect_api_docs"]},
  {id:"api_intelligence",label:"API documentation triage and multi-provider orchestration",group:"API",status:"opt-in",entry:"api-intelligence-pipeline.js",tools:[]},
  {id:"api_execution",label:"Approved API operation testing",group:"API",status:"allowlist-gated",entry:"api-adapter.js",tools:[]},
  {id:"learning",label:"Verified procedural learning",group:"Knowledge",status:"partially-wired",entry:"hermes-learning-loop.js",tools:[]},
  {id:"freellmapi_pool",label:"Internal FreeLLMAPI multi-provider inference pool",group:"AI",status:"configured-by-env",entry:"freellmapi.js",tools:["model_discovery","chat_completion","coding_completion"]},
  {id:"design_skills",label:"Design, accessibility, animation, dashboards",group:"Design",status:"skill-library",entry:"design-skills/",tools:[]},
  {id:"test_repair",label:"Browser QA, deterministic tests and repair",group:"Quality",status:"workflow-wired",entry:"react-agent.js",tools:["run_tests","test_ui","view_logs"]},
  {id:"app_database",label:"Application SQL inspection",group:"Build",status:"wired-in-agent-mode",entry:"react-agent.js",tools:["query_db"]},
  {id:"automation",label:"Application automation testing",group:"Build",status:"wired-in-agent-mode",entry:"react-agent.js",tools:["run_automation"]},
  {id:"mcp",label:"External MCP tool interface",group:"Integration",status:"exposed",entry:"kairoq-mcp.js",tools:[]},
  {id:"mem0",label:"Mem0 optional memory enrichment",group:"Knowledge",status:"disabled-by-default",entry:"integrations/agent-stack/mem0.js",tools:[]},
  {id:"ruflo",label:"Ruflo MCP capability discovery",group:"Agents",status:"experimental-discovery-only",entry:"integrations/agent-stack/ruflo.js",tools:[]},
  {id:"autoharness",label:"AutoHarness skill staging",group:"Agents",status:"review-candidates-only",entry:"integrations/agent-stack/autoharness.js",tools:[]},
  {id:"project_intelligence",label:"Graphify structural project intelligence and impact analysis",group:"Engineering",status:"configured-by-runtime",entry:"project-graph.js",tools:["project_graph"]},
  {id:"execution_discipline",label:"Superpowers planning, debugging, TDD, review and verification discipline",group:"Engineering",status:"wired",entry:"execution-discipline.js",tools:[]},
  {id:"engineering_intelligence",label:"Domain glossary, tracer-bullet task graph, deep-module guidance and two-axis engineering review",group:"Engineering",status:"wired",entry:"engineering-intelligence.js",tools:["project_knowledge","task_graph","engineering_review"]},
  {id:"understand",label:"Static code dependency graph export",group:"Engineering",status:"graph-export",entry:"integrations/agent-stack/understand.js",tools:[]},
  {id:"ecc",label:"Project context recall",group:"Knowledge",status:"concept-adaptation",entry:"ecc-context-recall.js",tools:[]},
  {id:"media",label:"AI media, 3D and Remotion workflows",group:"Creative",status:"feature-specific",entry:"hyperframes-video.js",tools:[]},
  {id:"sales",label:"Sales lead research and outreach drafting",group:"Business",status:"feature-specific",entry:"agent-brain.js",tools:[]},
  {id:"marketing",label:"Marketing content and approved publishing",group:"Business",status:"feature-specific",entry:"server.js",tools:[]}
]);

const RULES=Object.freeze({
 app_builder:{risk:"medium",auto:true,when:[/\b(build|create|implement|add|change|edit|refactor|fix|repair|remove|redesign)\b/i],
  requires:[],evidence:["static project checks","clean build","requested behavior"],fallback:"Save an UNVERIFIED draft only when execution is genuinely unavailable."},
 browser:{risk:"low",auto:true,when:[/https?:\/\//i,/\b(web|website|browser|browse|research|look up|public docs?|live page|pricing|competitor)\b/i],
  requires:[],evidence:["source URL","observed page content"],fallback:"State that live web evidence was unavailable; do not invent it."},
 github_repository:{risk:"low",auto:true,when:[/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\b/i,/\b(github repo|github repository|repository source|repo readme|inspect repo|clone repo|read repo)\b/i],
  requires:["browser"],evidence:["repository URL","default branch","sampled file tree","inspected source files","API spec candidates when present"],fallback:"Use ordinary public web inspection and state which repository files could not be read."},
 api_docs:{risk:"low",auto:true,when:[/\b(api docs?|openapi|swagger|postman|endpoint docs?|api reference|api specification|sdk docs?)\b/i],
  requires:["browser"],evidence:["documentation URL","parsed operations/auth","contract vs inference clearly marked"],fallback:"Request a spec/file only after URL inspection is unavailable or fails."},
 api_intelligence:{risk:"low",auto:false,when:[/\b(large api docs?|api corpus|api documentation triage|many endpoints|api intelligence)\b/i],
  requires:["api_docs"],evidence:["source provenance","triage output"],fallback:"Use ordinary api_docs inspection."},
 api_execution:{risk:"high",auto:false,when:[/\b(call|try|test|execute|send|post|create|update|delete)\b[^.\n]{0,60}\b(api|endpoint|request)\b/i,/\b(api|endpoint)\b[^.\n]{0,60}\b(call|try|test|execute)\b/i],
  requires:["api_docs"],evidence:["explicit operation approval","allowlisted host/operation","observed response"],fallback:"Generate integration code and mark live execution unverified."},
 freellmapi_pool:{risk:"low",auto:true,when:[/\b(free models?|free llm|cheap models?|model pool|provider fallback|free inference)\b/i],
  requires:[],evidence:["actual served model/provider metadata when available"],fallback:"Continue through Kairoq's existing model fallback chain."},
 test_repair:{risk:"low",auto:true,when:[/\b(test|verify|qa|regression|broken|bug|fix|repair|doesn.?t work|failing|validate)\b/i,/\b(?:not|isn.?t|aren.?t|won.?t|can.?t)\b[^.\n]{0,60}\b(?:persist(?:ing)?|sav(?:e|ing)|load(?:ing)?|work(?:ing)?|update|sync(?:ing)?)\b/i],
  requires:["app_builder"],evidence:["fresh test output","browser evidence when UI is involved","no known blocking failures"],fallback:"Mark UNVERIFIED; never convert missing evidence into success."},
 app_database:{risk:"medium",auto:true,when:[/\b(database|sql|table|query|record|persistence|persist|schema|migration)\b/i],
  requires:[],evidence:["observed query/schema result when inspecting"],fallback:"Inspect source/schema files if runtime DB access is unavailable."},
 automation:{risk:"medium",auto:true,when:[/\b(automation|scheduled|schedule|cron|reminder|triggered job|background job)\b/i],
  requires:["app_builder"],evidence:["automation run result","relevant logs"],fallback:"Verify configuration statically and mark runtime behavior unverified."},
 project_intelligence:{risk:"low",auto:true,when:[/\b(architecture|dependency|dependencies|impact|callers?|what uses|where is|multi[- ]file|codebase|project structure|refactor)\b/i],
  requires:[],evidence:["graph source","matched nodes/files/relationships"],fallback:"Use Kairoq's native import graph/search."},
 execution_discipline:{risk:"low",auto:true,when:[/\b(build|create|implement|feature|fix|bug|broken|debug|refactor|repair|failing|regression)\b/i],
  requires:[],evidence:["persistent execution ledger","fresh executor verification","request/spec coverage review"],fallback:"Use Kairoq's core build/test/verification loop; never skip evidence gates."},
 engineering_intelligence:{risk:"low",auto:true,when:[/\b(domain|glossary|architecture|design|task graph|tickets?|plan|implement|refactor|review|code quality|spec|scope|multi[- ]file|platform|system)\b/i],
  requires:["execution_discipline"],evidence:["task frontier for substantial work","project-owned glossary/ADR facts when used","independent Standards + Spec review when required"],fallback:"Use the execution discipline with project_graph and executor verification; do not invent domain terms or review evidence."},
 learning:{risk:"low",auto:false,when:[/\b(learn|remember this process|reuse next time|improve future|procedural memory)\b/i],
  requires:[],evidence:["verified successful procedure before persistence"],fallback:"Keep the lesson project-local and unverified."},
 design_skills:{risk:"low",auto:true,when:[/\b(ui|ux|design|layout|animation|accessibility|dashboard|landing page|visual|responsive)\b/i],
  requires:["app_builder"],evidence:["rendered/browser result"],fallback:"Use project design brief and base component system."},
 mcp:{risk:"medium",auto:false,when:[/\b(mcp|model context protocol|tool server|mcp server)\b/i],
  requires:[],evidence:["discovered tool/schema or connected server result"],fallback:"Use native Kairoq tool adapters."},
 ecc:{risk:"low",auto:true,when:[/\b(previous decision|project context|earlier requirement|remember the project|context recall)\b/i],
  requires:[],evidence:["project-owned context source"],fallback:"Use project-memory and current code."},
 media:{risk:"medium",auto:true,when:[/\b(image|video|3d|voice|audio|remotion|animation render|model viewer)\b/i],
  requires:[],evidence:["generated/loaded asset or renderer result"],fallback:"Use supported static assets and mark unavailable media generation explicitly."},
 sales:{risk:"medium",auto:false,when:[/\b(leads?|prospects?|outreach|sales research)\b/i],
  requires:["browser"],evidence:["public source evidence","approval before sending"],fallback:"Draft only; do not send."},
 marketing:{risk:"medium",auto:false,when:[/\b(marketing|campaign|social post|publish content|content calendar)\b/i],
  requires:[],evidence:["draft/review evidence","approval before publishing"],fallback:"Draft only; do not publish."}
});

function runtimeStatus(c){
 if(c.id==="freellmapi_pool")return require("./freellmapi").enabled()?"wired":"not-configured";
 if(c.id==="project_intelligence")return require("./project-graph").available()?"wired":"native-fallback";
 return c.status;
}
function enrich(c){
 const r=RULES[c.id]||{risk:"low",auto:false,when:[],requires:[],evidence:[],fallback:"Report the capability as unavailable."};
 return{...c,status:runtimeStatus(c),risk:r.risk,auto:r.auto,requires:[...r.requires],evidence:[...r.evidence],fallback:r.fallback};
}
function listCapabilities({group}={}){return CAPABILITIES.filter(c=>!group||c.group===group).map(enrich)}
function words(query){return new Set(String(query||"").toLowerCase().match(/[a-z0-9_]+/g)||[])}
function lexicalScore(c,queryWords){
 const hay=(c.id+" "+c.label+" "+c.group+" "+c.tools.join(" ")).toLowerCase();
 return [...queryWords].filter(w=>w.length>2&&hay.includes(w)).length;
}
function scoreCapability(c,request){
 const r=RULES[c.id],text=String(request||"");let score=lexicalScore(c,words(text)),reasons=[];
 for(const re of r?.when||[]){if(re.test(text)){score+=6;reasons.push("trigger")}}
 if(r?.auto&&score>0)score+=1;
 return{score,reasons};
}
function recommendCapabilities(request,limit=8){
 const ranked=CAPABILITIES.map(c=>({c,...scoreCapability(c,request)})).filter(x=>x.score>0)
  .sort((a,b)=>b.score-a.score||a.c.id.localeCompare(b.c.id));
 const picked=[],seen=new Set();
 function add(id,reason,score){
  if(seen.has(id))return;const base=CAPABILITIES.find(c=>c.id===id);if(!base)return;
  seen.add(id);const e=enrich(base);picked.push({...e,reason,score});
  for(const req of e.requires)add(req,"required by "+id,Math.max(1,score-1));
 }
 for(const row of ranked){add(row.c.id,row.reasons.length?"matched task trigger":"matched task vocabulary",row.score);if(picked.length>=limit)break}
 return picked.slice(0,limit);
}
function findCapabilities(query,limit=6){
 const rec=recommendCapabilities(query,limit);if(rec.length)return rec;
 const w=words(query);return listCapabilities().map(c=>({c,score:lexicalScore(c,w)})).filter(x=>x.score)
  .sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.c);
}
function agentCapabilityContext(){
 return listCapabilities().map(c=>c.label+" ["+c.status+"; "+c.entry+"; risk "+c.risk+"]").join("\n");
}
function taskContext(request){
 const rows=recommendCapabilities(request,8);if(!rows.length)return"";
 return"\n\nKAIROQ CAPABILITY ROUTER (task-specific; use only tools actually exposed in this agent protocol):\n"+
  rows.map(c=>"- "+c.id+" ["+c.status+"]: "+c.reason+"; evidence: "+(c.evidence.join(", ")||"task-specific evidence")+
    (c.requires.length?"; requires: "+c.requires.join(", "):"")+"; fallback: "+c.fallback).join("\n");
}
module.exports={listCapabilities,findCapabilities,recommendCapabilities,agentCapabilityContext,taskContext,RULES};
