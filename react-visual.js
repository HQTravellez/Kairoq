"use strict";
// Visual edits: builds tag each JSX element with data-kq="file:line:col", the
// preview reports the clicked element's tag, and applyEdit rewrites that
// element's text, className, src or alt directly in the source. No AI involved.
const path=require('path');

// Babel plugin used by the Vite build.
// Only real HTML and SVG elements are tagged: React Three Fiber's lowercase tags (<mesh>,
// <torusKnotGeometry>...) would read data-kq as a nested property and crash.
const HTML_TAGS=new Set('a abbr address area article aside audio b bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i iframe img input ins kbd label legend li main map mark menu meter nav noscript object ol optgroup option output p picture pre progress q rp rt ruby s samp search section select slot small source span strong sub summary sup table tbody td template textarea tfoot th thead time tr track u ul var video wbr'.split(' '));
const SVG_TAGS=new Set('svg g path circle ellipse polyline polygon rect text tspan defs stop use symbol mask pattern image marker filter'.split(' '));
function taggable(p,name){
 if(HTML_TAGS.has(name)||SVG_TAGS.has(name))return true;
 // <line> is also a three.js object: tag it only inside an <svg>.
 return name==='line'&&Boolean(p.findParent(x=>x.isJSXElement()&&x.node.openingElement.name.type==='JSXIdentifier'&&x.node.openingElement.name.name==='svg'));
}
function locatorPlugin(root){
 return function({types:t}){
  return{name:'kairoq-locator',visitor:{JSXOpeningElement(p,state){
   const name=p.node.name;
   if(name.type!=='JSXIdentifier'||!/^[a-z]/.test(name.name)||!p.node.loc||!taggable(p,name.name))return;
   if(p.node.attributes.some(a=>a.type==='JSXAttribute'&&a.name&&a.name.name==='data-kq'))return;
   const file=path.relative(root,state.filename||'').split(path.sep).join('/');
   if(!file.startsWith('src/'))return;
   p.node.attributes.push(t.jsxAttribute(t.jsxIdentifier('data-kq'),t.stringLiteral(file+':'+p.node.loc.start.line+':'+p.node.loc.start.column)));
  }}};
 };
}

function fail(message){return Object.assign(Error(message),{status:400})}
function parseLoc(loc){
 const m=/^(src\/[A-Za-z0-9_./-]+\.(?:jsx|js|tsx|ts)):(\d+):(\d+)$/.exec(String(loc||''));
 if(!m||m[1].includes('..'))throw fail('Pick an element in the preview first');
 return{file:m[1],line:Number(m[2]),column:Number(m[3])};
}
function findElement(code,line,column){
 const {parse}=require('@babel/parser');
 const ast=parse(code,{sourceType:'module',plugins:['jsx','typescript'],errorRecovery:false});
 let found=null;
 (function walk(node){
  if(found||!node||typeof node.type!=='string')return;
  if(node.type==='JSXElement'&&node.openingElement.loc.start.line===line&&node.openingElement.loc.start.column===column){found=node;return}
  for(const key of Object.keys(node)){
   if(key==='loc'||key==='start'||key==='end')continue;
   const v=node[key];
   if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'&&typeof v.type==='string')walk(v);
  }
 })(ast.program);
 if(!found)throw fail('That element has changed since the preview was built. Reload and try again.');
 return found;
}
function attr(el,name){return el.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name&&a.name.name===name)}
function jsxText(value){
 const text=String(value);
 // Characters JSX treats specially go in a string expression.
 return /[{}<>]/.test(text)||/^\s|\s$/.test(text)?'{'+JSON.stringify(text)+'}':text;
}
function attrValue(value){return JSON.stringify(String(value))}

// Describes what can be edited on an element (used to fill the edit panel).
function inspect(files,loc){
 const {file,line,column}=parseLoc(loc);
 if(!Object.hasOwn(files,file))throw fail('Unknown file');
 const el=findElement(files[file],line,column);
 const kids=el.children.filter(c=>!(c.type==='JSXText'&&!c.value.trim()));
 const textEditable=kids.length===1&&(kids[0].type==='JSXText'||(kids[0].type==='JSXExpressionContainer'&&kids[0].expression.type==='StringLiteral'));
 const text=textEditable?(kids[0].type==='JSXText'?kids[0].value.trim().replace(/\s+/g,' '):kids[0].expression.value):null;
 const literal=a=>!a?'':a.value&&a.value.type==='StringLiteral'?a.value.value:null;
 return{file,tag:el.openingElement.name.name,text,text_editable:textEditable||kids.length===0,class_name:literal(attr(el,'className')),src:literal(attr(el,'src')),alt:literal(attr(el,'alt'))};
}

// changes: {text?, className?, src?, alt?}. Returns {files, summary}.
function applyEdit(files,loc,changes){
 const {file,line,column}=parseLoc(loc);
 if(!Object.hasOwn(files,file))throw fail('Unknown file');
 const code=files[file],el=findElement(code,line,column);
 const edits=[];
 if(changes.text!==undefined){
  const text=String(changes.text).slice(0,5000);
  const kids=el.children.filter(c=>!(c.type==='JSXText'&&!c.value.trim()));
  if(kids.length>1||(kids.length===1&&!(kids[0].type==='JSXText'||(kids[0].type==='JSXExpressionContainer'&&kids[0].expression.type==='StringLiteral'))))throw fail('This text comes from code. Ask the AI to change it instead.');
  if(el.openingElement.selfClosing)throw fail('This element has no text');
  if(kids.length===1)edits.push([kids[0].start,kids[0].end,jsxText(text)]);
  else edits.push([el.openingElement.end,el.closingElement.start,jsxText(text)]);
 }
 for(const [key,name] of [['className','className'],['src','src'],['alt','alt']]){
  if(changes[key]===undefined)continue;
  const value=String(changes[key]).slice(0,2000);
  if(key==='src'&&value&&!/^(https:\/\/|\.\/uploads\/[a-z0-9-]+\.(png|jpg|jpeg|webp|gif|svg)$|data:image\/)/.test(value))throw fail('Image must be an https URL or one of your uploaded images');
  if((key==='src'||key==='alt')&&el.openingElement.name.name!=='img')throw fail('Only images have '+key);
  const a=attr(el,name);
  if(a){
   if(!a.value||a.value.type!=='StringLiteral')throw fail('This '+name+' is set by code. Ask the AI to change it instead.');
   edits.push([a.value.start,a.value.end,attrValue(value)]);
  }else{
   const nameNode=el.openingElement.name;
   edits.push([nameNode.end,nameNode.end,' '+name+'='+attrValue(value)]);
  }
 }
 if(!edits.length)throw fail('Nothing to change');
 edits.sort((a,b)=>b[0]-a[0]);
 let next=code;
 for(const [start,end,replacement] of edits)next=next.slice(0,start)+replacement+next.slice(end);
 const what=[changes.text!==undefined&&'text',changes.className!==undefined&&'style',changes.src!==undefined&&'image',changes.alt!==undefined&&'alt text'].filter(Boolean).join(', ');
 return{files:{...files,[file]:next},summary:'Visual edit: '+what+' of <'+el.openingElement.name.name+'> in '+file};
}

module.exports={locatorPlugin,inspect,applyEdit,parseLoc};
