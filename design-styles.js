"use strict";
// Ready style systems (colour, type, spacing, components, do's and don'ts) from open-design by
// nexu-io (Apache License 2.0; design-library/LICENSE-open-design). Only the generic styles are
// bundled (cafe, editorial, retro, luxury, brutalism...), not the ones copying real brands.
// The owner can name one ("make it retro", "cafe style"), and the design brief may pick one that
// fits; its rules then guide every build (designNote in react-design.js).
const fs=require('fs'),path=require('path');
const DIR=path.join(__dirname,'design-library','styles');
const INDEX=require('./design-library/styles/index.json');
// Styles that are themselves "AI look" tells (design-slop.js): offered only when the owner names them.
const ONLY_WHEN_NAMED=new Set(['glassmorphism','gradient','neon','claymorphism','neumorphism','warm-editorial','colorful','application','dashboard']);
const STOP=new Set('and the for with that this from into your our are its web app site page design style look feel modern clean'.split(' '));
function words(t){return(String(t||'').toLowerCase().match(/[a-z]+/g)||[]).filter(w=>w.length>2&&!STOP.has(w))}
function list(){return INDEX.map(({id,name,category,description})=>({id,name,category,description}))}
function valid(id){return INDEX.some(s=>s.id===id)}
// Styles the owner named in the request (by id or name).
function named(text){
 const t=' '+String(text||'').toLowerCase().replace(/[^a-z]+/g,' ')+' ';
 return INDEX.filter(s=>t.includes(' '+s.id.replace(/-/g,' ')+' ')||t.includes(' '+s.name.toLowerCase().replace(/[^a-z]+/g,' ').trim()+' '));
}
// Up to n options for the brief: the named ones first, then the closest by their description.
function options(text,n=3){
 const out=named(text);
 const want=new Set(words(text));
 const scored=INDEX.filter(s=>!out.includes(s)&&!ONLY_WHEN_NAMED.has(s.id)).map(s=>({s,n:words(s.name+' '+s.description+' '+s.category).filter(w=>want.has(w)).length})).filter(x=>x.n>=2).sort((a,b)=>b.n-a.n);
 for(const x of scored)if(out.length<n)out.push(x.s);
 return out.slice(0,n);
}
function note(opts){
 if(!opts||!opts.length)return'';
 return'\n\nREADY STYLE SYSTEMS (optional): if one suits this business, set "style" to its id and take its colours, type and component rules as the starting point:\n'+opts.map(o=>'- '+o.id+': '+o.name+'. '+o.description).join('\n');
}
// The style's rules for the build instructions, trimmed to a budget.
function text(id,{budget=4500}={}){
 if(!valid(id))return'';
 let t;try{t=fs.readFileSync(path.join(DIR,id+'.md'),'utf8')}catch{return''}
 t=t.replace(/<!--[\s\S]*?-->/g,'').replace(/\n{3,}/g,'\n\n').trim();
 if(t.length>budget)t=t.slice(0,budget).replace(/\n[^\n]*$/,'')+'\n…';
 return'\nSTYLE SYSTEM "'+(INDEX.find(s=>s.id===id).name)+'" (adapt it to this business; the design brief, the owner\'s wishes and readable contrast win):\n'+t;
}
module.exports={list,valid,named,options,note,text,ONLY_WHEN_NAMED};
