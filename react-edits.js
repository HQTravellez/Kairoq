"use strict";
// Small changes as find/replace edits instead of whole files. Output tokens are the most
// expensive part of a model call, so a one-line change should not rewrite a 300-line file.
// Each edit's "find" must match exactly one place in the file. An exact match is tried first,
// then a match that ignores indentation and trailing spaces (models often get those wrong).
const MAX_FILES=30,MAX_EDITS=40,MAX_TEXT=60000;

// {"src/App.jsx":[{"find":"…","replace":"…"}]} → cleaned, or throws on a malformed shape.
function normalize(edits){
 if(edits===undefined||edits===null)return{};
 if(typeof edits!=='object'||Array.isArray(edits))throw Error('"edits" must be an object of file path → list of {"find","replace"}');
 const out={};let n=0;
 for(const [file,list] of Object.entries(edits).slice(0,MAX_FILES)){
  const arr=Array.isArray(list)?list:[list];
  out[file]=arr.filter(e=>e&&typeof e==='object').map(e=>{
   if(typeof e.find!=='string'||!e.find.trim())throw Error(file+': every edit needs a non-empty "find"');
   if(typeof e.replace!=='string')throw Error(file+': every edit needs a "replace" string (use "" to delete)');
   if(++n>MAX_EDITS)throw Error('Too many edits in one reply (max '+MAX_EDITS+'); send the whole file instead');
   return{find:e.find.slice(0,MAX_TEXT),replace:e.replace.slice(0,MAX_TEXT)};
  });
 }
 return out;
}
function count(text,find){let n=0,i=0;while((i=text.indexOf(find,i))>=0){n++;i+=find.length||1}return n}
// Lines compared without leading/trailing whitespace; returns the unique [start,end) line range or null/'many'.
function fuzzyRange(lines,findLines){
 const want=findLines.map(l=>l.trim());
 while(want.length&&!want[0])want.shift();
 while(want.length&&!want.at(-1))want.pop();
 if(!want.length)return null;
 let hit=null;
 for(let i=0;i+want.length<=lines.length;i++){
  let ok=true;for(let j=0;j<want.length;j++)if(lines[i+j].trim()!==want[j]){ok=false;break}
  if(ok){if(hit)return'many';hit=[i,i+want.length]}
 }
 return hit;
}
function applyOne(text,{find,replace}){
 const n=count(text,find);
 if(n===1){const i=text.indexOf(find);return{text:text.slice(0,i)+replace+text.slice(i+find.length)}}
 if(n>1)return{error:'matches '+n+' places; include more surrounding lines so it is unique'};
 const lines=text.split('\n'),r=fuzzyRange(lines,find.split('\n'));
 if(r==='many')return{error:'matches several places; include more surrounding lines so it is unique'};
 if(!r)return{error:'was not found; copy the text exactly from the current file, or send the whole file in "files"'};
 return{text:[...lines.slice(0,r[0]),replace,...lines.slice(r[1])].join('\n')};
}
// Applies edits to files (a copy is returned). Errors name the file and the edit.
function apply(files,edits){
 const next={...files},errors=[],changed=[];
 for(const [file,list] of Object.entries(edits||{})){
  if(!Object.hasOwn(next,file)){errors.push(file+': cannot edit a file that does not exist; send it in "files" instead');continue}
  let text=next[file],ok=true;
  list.forEach((e,i)=>{if(!ok)return;const r=applyOne(text,e);if(r.error){errors.push(file+': edit '+(i+1)+' (find "'+e.find.trim().split('\n')[0].slice(0,80)+'") '+r.error);ok=false}else text=r.text});
  if(ok&&text!==next[file]){next[file]=text;changed.push(file)}
 }
 return{files:next,errors,changed};
}
const PROMPT_NOTE=`
To change an existing file, prefer small edits over rewriting it: "edits":{"src/pages/Home.jsx":[{"find":"exact current text (a few whole lines, unique in the file)","replace":"new text"}]}. Copy "find" exactly from the current file and include enough lines to be unique; use "replace":"" to remove text. Use "files" with the complete content for new files, or when most of a file changes. A file can appear in "files" or "edits", not both.`;
module.exports={normalize,apply,applyOne,PROMPT_NOTE};
