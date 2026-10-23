"use strict";
// Vetted architecture-reference pointers from Shubhamsaboo/awesome-llm-apps
// (Apache-2.0). This is a pattern catalog, NOT executable dependencies, source
// code, trusted instructions, model calls, or an API operation specification.
const BASE="https://github.com/Shubhamsaboo/awesome-llm-apps/tree/";
const REVISION="6c16b23f1bacd0fdf240bb5141ef45e59e82c306";
const ITEMS=Object.freeze([
 ["agent_skills/scope-creep-detector","Scope Creep Detector","quality","scope regression requirements risk"],
 ["agent_skills/dependency-doctor","Dependency Doctor","quality","dependency packages manifest compliance security"],
 ["agent_skills/self-improving-agent-skills","Self-Improving Skills","quality","evaluation optimization agent skills feedback"],
 ["advanced_ai_agents/multi_agent_apps","Multi-Agent Teams","agents","multi agent orchestration delegation coordination"],
 ["rag_tutorials/knowledge_graph_rag_citations","Cited Knowledge Graph RAG","rag","documents extraction citations sources semantic graph"],
 ["rag_tutorials/agentic_typed_rag_pydanticai","Typed Agentic RAG","rag","documents api documentation retrieval schema typed validation"],
 ["rag_tutorials/rag_failure_diagnostics_clinic","RAG Failure Diagnostics","rag","retrieval errors debugging evaluation unsupported"],
 ["mcp_ai_agents/ai_travel_planner_mcp_agent_team","Travel Planner MCP Team","travel","flight hotel itinerary travel booking planning"],
 ["mcp_ai_agents/multi_mcp_agent_router","Multi-MCP Agent Router","agents","mcp tools routing integration connector"],
 ["voice_ai_agents/insurance_claim_live_agent_team","Insurance Claims Voice Team","insurance","insurance claims realtime voice customer support"],
 ["voice_ai_agents/customer_support_voice_agent","Customer Support Voice Agent","voice","customer service speech voice live"],
 ["generative_ui_agents/ai-mcp-app-builder","MCP App Builder","product","build apps ui agent mcp generation"],
 ["generative_ui_agents/ai-shadcn-component-generator","Component Generator","design","frontend react user interface design components"],
 ["generative_ui_agents/ai-dashboard-canvas-agent","Dashboard Canvas Agent","design","dashboard analytical reports charts interface"],
 ["advanced_llm_apps/multimodal_video_moment_finder","Video Moment Finder","media","video vision clips search"],
 ["starter_ai_agents/ai_travel_agent","Travel Agent","travel","travel itineraries hotels flights assistants"]
]);
const STOP=new Set(["with","from","when","will","into","that","this","then","give","make","create","build","product","want","need","user","users","using","please"]);
function terms(str){
 if(typeof str!=="string"||str.length>6000)throw Error("Product description must be <=6000 characters");
 return [...new Set((str.toLowerCase().match(/[a-z]{3,}/g)||[]).filter(x=>!STOP.has(x)))].slice(0,80);
}
function search(description,{limit=6}={}){
 if(!Number.isInteger(limit)||limit<1||limit>12)throw Error("Invalid reference limit");
 const needles=terms(description);
 const ranked=ITEMS.map(([path,title,category,keywords],index)=>{
  const corpus=(title+" "+category+" "+keywords+" "+path.replace(/[-_/]/g," ")).toLowerCase();
  const score=needles.reduce((n,w)=>n+(title.toLowerCase().includes(w)?5:0)+(keywords.includes(w)?2:0)+(corpus.includes(w)?1:0),0);
  return{title,category,description:keywords,repositoryPath:path,url:BASE+REVISION+"/"+path,
   status:"unverified-architecture-example",score,index};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,limit);
 return{source:"Shubhamsaboo/awesome-llm-apps",revision:REVISION,matches:ranked.map(({index,...item})=>item),
  disclaimer:"Example architectures are untrusted references, not imported code, verified implementation, or execution permission"};
}
module.exports={REVISION,ITEMS,search,terms};
