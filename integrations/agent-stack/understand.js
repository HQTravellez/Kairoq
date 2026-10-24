'use strict';
// Deterministic file/import graph interchange with Understand-Anything. No hooks or LLM.
const path = require('node:path');
const parser = require('@babel/parser');
function safePath(p) {
  return typeof p === 'string' && p.length <= 300 && !p.includes('\\') &&
    !path.posix.isAbsolute(p) && !p.split('/').some(s => !s || s === '..' || s === '.') &&
    !/(^|\/)(?:\.env(?:\..*)?|node_modules|\.git)(\/|$)/.test(p);
}
function graph(files, {name = 'Kairoq', commit, analyzedAt = new Date().toISOString()} = {}) {
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw Error('Exact source commit required');
  const names = Object.keys(files).filter(safePath).sort();
  if (names.length > 5000) throw Error('Graph file limit');
  const nodes = names.map(filePath => ({id:filePath, type:'file', name:path.posix.basename(filePath),
    filePath, summary:'Source file: '+filePath, tags:['static-analysis'], complexity:'moderate'}));
  const known = new Set(names), edges = [], unresolved = [];
  for (const file of names.filter(n => /\.[cm]?[jt]sx?$/.test(n))) {
    const text = files[file];
    if (typeof text !== 'string' || text.length > 2_000_000) throw Error('Invalid source size');
    const ast = parser.parse(text, {sourceType:'unambiguous', plugins:['jsx', ...(/\.tsx?$/.test(file)?['typescript']:[])]});
    const imports = new Set();
    function visit(n) {
      if (!n || typeof n !== 'object') return;
      if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type) && n.source) imports.add(n.source.value);
      if (n.type === 'CallExpression' && n.callee?.type === 'Identifier' && n.callee.name === 'require' && n.arguments[0]?.type === 'StringLiteral') imports.add(n.arguments[0].value);
      for (const [k,v] of Object.entries(n)) if (!['loc','start','end','comments','tokens'].includes(k)) {
        if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v);
      }
    }
    visit(ast.program);
    for (const spec of imports) {
      if (!spec.startsWith('.')) continue;
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));
      const target = [base,...['.js','.jsx','.ts','.tsx','.mjs','.cjs','.json','/index.js','/index.ts'].map(ext=>base+ext)].find(p=>known.has(p));
      if (target) edges.push({source:file,target,type:'imports',direction:'forward',weight:1});
      else unresolved.push({source:file,spec});
    }
  }
  return {version:'1.0.0',kind:'codebase',project:{name,languages:['JavaScript'],frameworks:['Node.js'],
    description:'Deterministic file/import graph only; no semantic analysis',analyzedAt,gitCommitHash:commit},
    nodes,edges,layers:[],tour:[],unresolved};
}
function impact(input, changed, {commit, files} = {}) {
  if (!input || input.project?.gitCommitHash !== commit || !/^[a-f0-9]{40}$/.test(commit || '')) throw Error('Stale graph or missing source commit');
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges) || input.nodes.length > 5000 || input.edges.length > 50000) throw Error('Invalid graph');
  const ids = new Set();
  for (const n of input.nodes) {
    if (!safePath(n.filePath) || !Object.hasOwn(files || {},n.filePath) || n.id !== n.filePath || ids.has(n.id)) throw Error('Invalid or unknown graph path');
    ids.add(n.id);
  }
  for (const e of input.edges) if (!ids.has(e.source) || !ids.has(e.target) || e.type !== 'imports' || e.direction !== 'forward') throw Error('Unsupported graph edge');
  if (!Array.isArray(changed) || changed.some(p=>!ids.has(p))) throw Error('Unknown changed path');
  const affected = new Set(changed);
  let grew = true;
  while (grew) {grew=false;for (const e of input.edges) if (affected.has(e.target) && !affected.has(e.source)) {affected.add(e.source);grew=true;}}
  return {status:'static-impact-only',affected:[...affected].sort(),tests:[...affected].filter(p=>/^test\/.*\.test\.js$/.test(p)).sort(),verified:false};
}
module.exports = {graph, impact, safePath};
