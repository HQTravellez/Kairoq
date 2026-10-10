'use strict';
// Parse embedded specifications as data. Never execute downloaded JavaScript.
const acorn=require('acorn');
function compact(v){if(Array.isArray(v))return v.map(compact);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['description','example','examples','externalDocs','x-codeSamples'].includes(k)).map(([k,x])=>[k,compact(x)]));return v;}
function extract(source){
 if(Buffer.byteLength(source)>6000000)throw Error('Documentation bundle exceeds 6 MB');
 const names=[...source.matchAll(/([A-Za-z_$][\w$]*)=\{openapi:([^}]+)\}/g)].slice(0,30).map(m=>m[1]);if(!names.length)return[];
 const vars=new Map(),ast=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id.type==='Identifier')vars.set(n.id.name,n.init);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(ast);
 function data(n,seen=new Set(),depth=0){
  if(!n||depth>70)throw Error('Embedded specification exceeds nesting limit');const next=x=>data(x,seen,depth+1);
  if(n.type==='Literal')return n.value;
  if(n.type==='Identifier'){if(seen.has(n.name))throw Error('Circular specification');return data(vars.get(n.name),new Set([...seen,n.name]),depth+1);}
  if(n.type==='TemplateLiteral')return n.quasis.map((q,i)=>q.value.cooked+(i<n.expressions.length?String(next(n.expressions[i])):'')).join('');
  if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&!n.callee.computed&&n.callee.object.name==='JSON'&&n.callee.property.name==='parse'&&n.arguments.length===1)return JSON.parse(next(n.arguments[0]));
  if(n.type==='ObjectExpression'){const r=Object.create(null);for(const p of n.properties){if(p.type!=='Property'||p.computed||p.kind!=='init')throw Error('Executable specification property');r[p.key.type==='Identifier'?p.key.name:p.key.value]=next(p.value);}return r;}
  if(n.type==='ArrayExpression')return n.elements.map(next);
  if(n.type==='UnaryExpression'){const x=next(n.argument);if(n.operator==='!')return !x;if(n.operator==='-')return -x;}
  if(n.type==='BinaryExpression'&&n.operator==='+')return next(n.left)+next(n.right);
  throw Error('Executable specification expression refused');
 }
 const results=[];for(const name of names){try{const spec=compact(data(vars.get(name)));require('./api-learning').learn(spec);results.push(spec);}catch{}}
 return results;
}
function combine(specs,url){
 if(!specs.length)throw Error('No embedded OpenAPI specifications found');
 const learn=require('./api-learning').learn,plans=specs.map(learn),base=plans[0].baseUrl;if(plans.some(p=>p.baseUrl!==base))throw Error('Documentation includes incompatible API servers; import specifications separately');
 const operations=new Map();for(const p of plans)for(const o of p.operations)operations.set(o.method+' '+o.path,o);
 if(operations.size>150)throw Error('Documentation exceeds 150 operations');
 const auth=plans.flatMap(p=>p.auth);if(new URL(url).hostname==='devhub.tripninja.io'){auth.push({name:'tripninjaToken',type:'http',scheme:'token'});for(const o of operations.values())o.authenticationRequired=true;}
 return{title:plans[0].title,version:plans[0].version,format:'openapi-bundle',baseUrl:base,auth,operations:[...operations.values()],documentationUrl:url,limitations:['Specifications extracted without executing website code','Descriptions and examples omitted; operation schemas retained for import','Generated validation covers documented top-level fields; provider integration still requires verification','No live provider requests made']};
}
module.exports={extract,combine,compact};
