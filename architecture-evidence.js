"use strict";
// Archify-inspired evidence views over Kairoq's existing deterministic project graph.
// This module never infers runtime ownership, blast radius, deployment topology or safety.
// It only summarizes graph facts already extracted from source.
function degree(graph){
 const d=new Map((graph?.nodes||[]).map(n=>[n.id,0]));
 for(const e of graph?.edges||[]){d.set(e.source,(d.get(e.source)||0)+1);d.set(e.target,(d.get(e.target)||0)+1)}
 return d;
}
function source(n){
 return {file:n.file||"",...(n.line?{line:n.line}:{}),...(n.endLine?{endLine:n.endLine}:{})};
}
function map(graph,{limit=12}={}){
 const n=Math.max(4,Math.min(20,Number(limit)||12)),d=degree(graph);
 const ranked=[...(graph?.nodes||[])].sort((a,b)=>(d.get(b.id)||0)-(d.get(a.id)||0)||String(a.file).localeCompare(String(b.file))||String(a.label).localeCompare(String(b.label)));
 const picked=[],files=new Set();
 // Prefer a useful spread of core files before filling by graph degree.
 for(const node of ranked){if(picked.length>=n)break;if(node.file&&!files.has(node.file)){picked.push(node);files.add(node.file)}}
 for(const node of ranked){if(picked.length>=n)break;if(!picked.some(x=>x.id===node.id))picked.push(node)}
 const ids=new Set(picked.map(x=>x.id));
 const edges=(graph?.edges||[]).filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>({
  source:e.source,target:e.target,relation:e.relation,confidence:e.confidence,score:e.score
 }));
 return{
  kind:"source-backed-architecture",
  source:graph?.source||"unknown",
  fingerprint:graph?.fingerprint||"",
  notice:"This view summarizes extracted source relationships only. It does not claim runtime traffic, ownership, deployment topology, risk or merge safety.",
  nodes:picked.map(x=>({id:x.id,label:x.label,kind:x.kind,degree:d.get(x.id)||0,source:source(x)})),
  edges,
  stats:graph?.stats||{nodes:0,edges:0,files:0}
 };
}
function edgeKey(e){return [e.source,e.target,e.relation||""].join("\0")}
function delta(before,after){
 const bn=new Map((before?.nodes||[]).map(n=>[n.id,n])),an=new Map((after?.nodes||[]).map(n=>[n.id,n]));
 const be=new Map((before?.edges||[]).map(e=>[edgeKey(e),e])),ae=new Map((after?.edges||[]).map(e=>[edgeKey(e),e]));
 const addedNodes=[...an.keys()].filter(id=>!bn.has(id)).map(id=>an.get(id));
 const removedNodes=[...bn.keys()].filter(id=>!an.has(id)).map(id=>bn.get(id));
 const addedEdges=[...ae.keys()].filter(k=>!be.has(k)).map(k=>ae.get(k));
 const removedEdges=[...be.keys()].filter(k=>!ae.has(k)).map(k=>be.get(k));
 return{
  kind:"architecture-delta",
  beforeFingerprint:before?.fingerprint||"",
  afterFingerprint:after?.fingerprint||"",
  changed:Boolean(addedNodes.length||removedNodes.length||addedEdges.length||removedEdges.length),
  notice:"Structural source delta only. Added/removed relationships are not proof of runtime impact, risk or merge safety.",
  addedNodes:addedNodes.slice(0,80).map(n=>({id:n.id,label:n.label,kind:n.kind,source:source(n)})),
  removedNodes:removedNodes.slice(0,80).map(n=>({id:n.id,label:n.label,kind:n.kind,source:source(n)})),
  addedEdges:addedEdges.slice(0,120),
  removedEdges:removedEdges.slice(0,120)
 };
}
function path(graph,from,to,projectGraph){
 const r=projectGraph.shortestPath(graph,from,to,{maxDepth:10});
 return{
  kind:"source-backed-path",
  found:r.found,
  from:r.from?{id:r.from.id,label:r.from.label,source:source(r.from)}:null,
  to:r.to?{id:r.to.id,label:r.to.label,source:source(r.to)}:null,
  path:(r.path||[]).map(x=>({node:{id:x.node.id,label:x.node.label,kind:x.node.kind,source:source(x.node)},via:x.via?{direction:x.via.direction,relation:x.via.edge?.relation||"",confidence:x.via.edge?.confidence||""}:null})),
  notice:"This is a path in the extracted source graph, not a measured runtime trace."
 };
}
module.exports={map,delta,path,degree};
