"use strict";
// Central, honest capability inventory. Discoverability does not authorize execution.
// Bind operations to existing authenticated handlers, never invoke arbitrary exports.
const CAPABILITIES = Object.freeze([
  {id:"app_builder",label:"React app building and editing",group:"Build",status:"wired",entry:"react-agent.js",tools:["read_files","write_files","edit_files","build_and_test"]},
  {id:"browser",label:"Browser research and website interaction",group:"Research",status:"wired-in-agent-mode",entry:"react-agent.js",tools:["web_search","web_open","web_act","fetch_url"]},
  {id:"headless_chromium",label:"Chromium browser rendering",group:"Research",status:"available-not-universal",entry:"browser-reader.js",tools:[]},
  {id:"api_docs",label:"OpenAPI, Swagger, Postman documentation extraction",group:"API",status:"separate-workflow",entry:"api-docs.js",tools:[]},
  {id:"api_intelligence",label:"Jev + ScaleDown API documentation triage and multi-provider orchestration",group:"API",status:"opt-in",entry:"api-intelligence-pipeline.js",tools:[]},
  {id:"api_execution",label:"Approved API operation testing",group:"API",status:"allowlist-gated",entry:"api-adapter.js",tools:[]},
  {id:"learning",label:"Verified procedural learning",group:"Knowledge",status:"partially-wired",entry:"hermes-learning-loop.js",tools:[]},
  {id:"design_skills",label:"Design, accessibility, animation, dashboards",group:"Design",status:"skill-library",entry:"design-skills/",tools:[]},
  {id:"test_repair",label:"Browser QA, synthetic customers and repair",group:"Quality",status:"workflow-wired",entry:"react-agent.js",tools:["test_ui","view_logs"]},
  {id:"app_database",label:"Application SQL inspection",group:"Build",status:"wired-in-agent-mode",entry:"react-agent.js",tools:["query_db"]},
  {id:"automation",label:"Application automation testing",group:"Build",status:"wired-in-agent-mode",entry:"react-agent.js",tools:["run_automation"]},
  {id:"mcp",label:"External MCP tool interface",group:"Integration",status:"exposed",entry:"kairoq-mcp.js",tools:[]},
  {id:"mem0",label:"Mem0 optional memory enrichment",group:"Knowledge",status:"disabled-by-default",entry:"integrations/agent-stack/mem0.js",tools:[]},
  {id:"ruflo",label:"Ruflo MCP capability discovery",group:"Agents",status:"experimental-discovery-only",entry:"integrations/agent-stack/ruflo.js",tools:[]},
  {id:"autoharness",label:"AutoHarness skill staging",group:"Agents",status:"review-candidates-only",entry:"integrations/agent-stack/autoharness.js",tools:[]},
  {id:"understand",label:"Static code dependency graph",group:"Engineering",status:"graph-export",entry:"integrations/agent-stack/understand.js",tools:[]},
  {id:"ecc",label:"Project context recall",group:"Knowledge",status:"concept-adaptation",entry:"ecc-context-recall.js",tools:[]},
  {id:"media",label:"AI media and Remotion workflows",group:"Creative",status:"feature-specific",entry:"hyperframes-video.js",tools:[]},
  {id:"sales",label:"Sales lead research and outreach drafting",group:"Business",status:"feature-specific",entry:"agent-brain.js",tools:[]},
  {id:"marketing",label:"Marketing content and approved publishing",group:"Business",status:"feature-specific",entry:"server.js",tools:[]}
]);
function listCapabilities({group}={}){return CAPABILITIES.filter(c=>!group||c.group===group).map(c=>({...c,tools:[...c.tools]}));}
function findCapabilities(query,limit=6){
  const words=new Set(String(query||"").toLowerCase().match(/[a-z0-9_]+/g)||[]);
  if(!words.size)return listCapabilities().slice(0,limit);
  return listCapabilities().map(c=>({c,score:[...words].filter(w=>(c.id+" "+c.label+" "+c.group+" "+c.tools.join(" ")).toLowerCase().includes(w)).length})).filter(x=>x.score).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.c);
}
function agentCapabilityContext(){
  return CAPABILITIES.map(c=>c.label+" ["+c.status+"; "+c.entry+"]").join("\n");
}
module.exports={listCapabilities,findCapabilities,agentCapabilityContext};
