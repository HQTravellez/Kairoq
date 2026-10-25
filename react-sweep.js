"use strict";
// "Nothing of theirs left": before an app built from a reference goes live, its code and pages
// are searched for the reference's name, web address and brand colours, like Replica's sweep.py
// (github.com/Jakeschincariol/replica-skill, MIT). Names match without case and inside words
// (AcmeButton ships too); colours match in long and short form (#06f is #0066ff).
const builder=require('./react-builder');

function norm(hex){let h=String(hex||'').trim().toLowerCase().replace(/^#/,'');if(/^[0-9a-f]{3}$/.test(h))h=h.split('').map(c=>c+c).join('');return /^[0-9a-f]{6}$/.test(h)?'#'+h:null}
function short(hex){const h=hex.slice(1);return h[0]===h[1]&&h[2]===h[3]&&h[4]===h[5]?'#'+h[0]+h[2]+h[4]:null}
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
// Plain colours every site uses are never counted as the reference's brand.
const COMMON=new Set(['#000000','#ffffff','#111111','#222222','#333333','#f5f5f5','#fafafa','#eeeeee','#cccccc','#999999','#666666','#e5e7eb','#f3f4f6','#d1d5db','#9ca3af','#6b7280','#4b5563','#374151','#1f2937','#111827','#f9fafb']);
function rgbToHex(v){const m=/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(String(v||''));return m?'#'+[m[1],m[2],m[3]].map(n=>Math.max(0,Math.min(255,+n)).toString(16).padStart(2,'0')).join(''):norm(v)}
function saturated(hex){const n=parseInt(hex.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;return Math.max(r,g,b)-Math.min(r,g,b)>40}

// What to look for, from the reference analysis: names, domains and distinctive colours.
function avoidList(reference,{extraNames=[]}={}){
 const a=reference&&reference.analysis||{},names=new Set(),domains=new Set(),colors=new Set();
 const add=n=>{n=String(n||'').trim();if(n.length>=3&&!/^(home|welcome|login|sign in|untitled)$/i.test(n))names.add(n)};
 const pages=a.pages||[];
 if(pages[0]){add(pages[0].site_name);add(String(pages[0].title||'').split(/\s[|\-–—:·]\s/)[0])}
 if(reference&&reference.reviews&&reference.reviews.name)add(reference.reviews.name);
 for(const n of extraNames)add(n);
 try{const u=new URL(a.url||a.origin||'');const host=u.hostname.replace(/^www\./,'');if(host.includes('.'))domains.add(host)}catch{}
 const styles=(pages[0]&&pages[0].styles)||{};
 for(const v of [...(styles.buttons||[]),...(styles.backgrounds||[]),...(styles.text||[])]){const c=rgbToHex(Array.isArray(v)?v[0]:v&&v.value||v);if(c&&!COMMON.has(c)&&saturated(c))colors.add(c)}
 // The app's own (new) name must never be on the list, even if it shares a word.
 return{names:[...names].slice(0,6),domains:[...domains].slice(0,4),colors:[...colors].slice(0,4)};
}
function scan(files,{names=[],domains=[],colors=[]},{ownName=''}={}){
 const own=String(ownName||'').toLowerCase(),found=[];
 const pats=[
  ...names.filter(n=>!own||!own.includes(n.toLowerCase())).map(n=>({kind:'name',what:n,re:new RegExp(n.trim().split(/\s+/).map(esc).join('[\\s_-]?'),'gi')})),
  ...domains.map(d=>({kind:'web address',what:d,re:new RegExp(esc(d),'gi')})),
  ...colors.map(c=>{const s=short(c);return{kind:'brand colour',what:c,re:new RegExp(esc(c)+(s?'(?![0-9a-f])|'+esc(s)+'(?![0-9a-f])':'(?![0-9a-f])'),'gi')}})];
 for(const [file,code] of Object.entries(files||{})){
  if(typeof code!=='string'||file==='src/backend.json')continue;
  const lines=code.split('\n');
  for(const p of pats)for(let i=0;i<lines.length;i++){p.re.lastIndex=0;if(p.re.test(lines[i])){found.push({kind:p.kind,what:p.what,file,line:i+1,text:lines[i].trim().slice(0,140)});if(found.length>=40)return found}}
 }
 return found;
}
// The check for one version of a project built from a reference ([] when there is nothing to check).
function check(id,n){
 const meta=builder.loadMeta(id);if(!meta.reference||!meta.reference.analysis)return[];
 const avoid=avoidList(meta.reference);if(!avoid.names.length&&!avoid.domains.length&&!avoid.colors.length)return[];
 const files=builder.loadFiles(id,n||meta.current_version);
 return scan(files,avoid,{ownName:meta.name});
}
function message(found){
 const by=new Map();for(const f of found){const k=f.kind+': '+f.what;if(!by.has(k))by.set(k,[]);by.get(k).push(f.file+':'+f.line)}
 return[...by].map(([k,where])=>k+' in '+where.slice(0,3).join(', ')+(where.length>3?' and '+(where.length-3)+' more':'')).join('; ');
}
module.exports={avoidList,scan,check,message,norm};
