"use strict";
// APIJSON is a JSON-query/ORM protocol, not an OpenAPI specification.
// Recognize prose, model its capabilities, and require a *separate* reviewed
// server manifest before generating even a read-only OpenAPI contract.
// No Java runtime, arbitrary SQL, or endpoint probing is installed/executed.
// Source: APIJSON/APIJSON Document.md, Apache 2.0, revision Sep 13 2026.
const {validUrl}=require("./api-docs");
const {learn}=require("./api-learning");
const SOURCE="https://github.com/APIJSON/APIJSON/blob/main/Document.md";
const PROTOCOL=["/get","/gets","/head","/heads","/post","/put","/delete"];
function detect(text){
 if(typeof text!=="string"||Buffer.byteLength(text)>2000000)return false;
 const sample=text.slice(0,200000).toLowerCase();
 return sample.includes("apijson") && (sample.includes('"/get"')||sample.includes("base_url/get/")||sample.includes("get a user"))
  &&(sample.includes("@column")||sample.includes("table name")||sample.includes("tablename"));
}
function describe(text){
 if(!detect(text))throw Error("No recognizable APIJSON protocol documentation");
 return {
  title:"APIJSON JSON-query protocol",format:"apijson-protocol",
  documentationUrl:SOURCE,operations:[],auth:[],baseUrl:"",
  capabilityPatterns:PROTOCOL.map((path)=>({verb:"POST",path,kind:["/post","/put","/delete"].includes(path)?"mutation":"read",verified:false})),
  requiredEvidence:["Provider-specific HTTPS base URL","Actual backend tables and queryable fields","Authentication and role grants","Server-side request validation and read limits","Approved sandbox fixture responses"],
  limitations:["Generic APIJSON docs do not reveal an individual server schema or permissions","Protocol patterns are templates, not verified runnable operations","No live requests, schema discovery or Java code executed"],
  sourceExcerpt:String(text).replace(/<[^>]*>/g," ").replace(/\s+/g," ").slice(0,1200)
 };
}
const NAME=/^[A-Za-z][A-Za-z0-9_]{0,62}$/;
function tableSpec(t){
 if(!t||!NAME.test(t.name)||!Array.isArray(t.fields)||t.fields.length<1||t.fields.length>50)throw Error("APIJSON table needs 1-50 reviewed fields");
 const fields=[],seen=new Set();
 for(const f of t.fields){
  if(!f||!NAME.test(f.name)||seen.has(f.name)||!["string","integer","number","boolean"].includes(f.type))throw Error("Invalid APIJSON field manifest");
  seen.add(f.name);fields.push({name:f.name,type:f.type});
 }
 if(!seen.has("id"))throw Error("APIJSON table must identify a reviewed id field");
 return{name:t.name,fields,allowWrites:t.allowWrites===true};
}
function normalized(manifest){
 if(!manifest||typeof manifest!=="object"||!Array.isArray(manifest.tables)||manifest.tables.length>15||!manifest.tables.length)
  throw Error("An explicitly reviewed APIJSON table manifest is required (1-15 tables)");
 const base=validUrl(manifest.baseUrl); // validation only; no network request
 if(base.search||base.hash||base.pathname!=="/"&&!/^\/[A-Za-z0-9/_-]+\/$/.test(base.pathname))throw Error("Invalid APIJSON base URL");
 const tables=manifest.tables.map(tableSpec),unique=new Set(tables.map(x=>x.name));
 if(unique.size!==tables.length)throw Error("Duplicate APIJSON table name");
 const permissionConfirmed=manifest.permissionConfirmed===true,schemaVerified=manifest.schemaVerified===true;
 const enableMutations=manifest.enableMutations===true&&permissionConfirmed&&schemaVerified&&tables.some(t=>t.allowWrites);
 if(manifest.enableMutations===true&&!enableMutations)throw Error("APIJSON writes require explicitly reviewed schema, permissions and permitted tables");
 return{baseUrl:base.href,tables,permissionConfirmed,schemaVerified,enableMutations,authKind:manifest.authKind||"unknown"};
}
function tableCondition(t){
 return{type:"object",additionalProperties:false,properties:Object.fromEntries([
  ...t.fields.map(f=>[f.name,{type:f.type}]),
  ["@column",{type:"string",description:"Request only fields authorized by backend; verify server-side whitelist"}]
 ])};
}
function oneTableBody(tables,array=false){
 const cases=tables.map(t=>{
  const obj=tableCondition(t);
  if(!array)return{type:"object",required:[t.name],properties:{[t.name]:obj},additionalProperties:false};
  return{type:"object",required:["[]"],properties:{"[]":{type:"object",required:[t.name],
   properties:{count:{type:"integer",minimum:1,maximum:100},page:{type:"integer",minimum:0},[t.name]:obj},
   additionalProperties:false}},additionalProperties:false};
 });
 return cases.length===1?cases[0]:{oneOf:cases};
}
function fromManifest(manifest){
 const m=normalized(manifest);
 if(!["unknown","bearer","basic"].includes(m.authKind))throw Error("Unsupported APIJSON authentication mode");
 const security=m.authKind==="unknown"?undefined:{providerAuth:{type:"http",scheme:m.authKind}};
 const paths={},mk=(method,route,id,body,summary)=>{
  paths[route]={[method]:{operationId:id,summary,
   ...(security?{security:[{providerAuth:[]}]}:{}),
   requestBody:{required:true,content:{"application/json":{schema:body}}},
   responses:{"200":{description:"Server-specific response; validate against approved sandbox fixture",
    content:{"application/json":{schema:{type:"object"}}}}}}};
 };
 mk("post","/get","apijson_get",oneTableBody(m.tables),"APIJSON single-record read from an explicitly reviewed table schema");
 mk("post","/gets","apijson_gets",oneTableBody(m.tables,true),"APIJSON restricted list read from an explicitly reviewed table schema");
 if(m.enableMutations){
  const writable=m.tables.filter(x=>x.allowWrites);
  for(const [path,id] of [["/post","apijson_insert"],["/put","apijson_update"],["/delete","apijson_delete"]])
   mk("post",path,id,oneTableBody(writable),"APIJSON mutation REQUIRES independent write approval and sandbox certification");
 }
 const contract=learn({openapi:"3.0.3",info:{title:"Reviewed APIJSON backend",version:"manifest-reviewed"},
  servers:[{url:m.baseUrl.replace(/\/$/,"")}],...(security?{components:{securitySchemes:security}}:{}),paths});
 return {...contract,protocol:"APIJSON",manifestReadiness: m.permissionConfirmed&&m.schemaVerified?"reviewed-not-sandbox-tested":"schema-or-grants-unverified",
  sampleBodies:{get:Object.fromEntries([[m.tables[0].name,{id:1}]]),
   gets:{"[]":{count:10,page:0,[m.tables[0].name]:{"@column":m.tables[0].fields.map(f=>f.name).join(",")}}}},
  warnings:["APIJSON generic documented paths are not evidence of actual server support or grants","No API operation was executed or authorized",...(m.authKind==="unknown"?["Authentication mechanism has not been reviewed"]:[])],
  integrationReadiness:"awaiting-sandbox-and-auth-verification"};
}
module.exports={SOURCE,PROTOCOL,detect,describe,normalized,fromManifest};
