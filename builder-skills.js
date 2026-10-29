"use strict";
// The builder's skills menu (like skills in an agent): every playbook (builder-playbooks.js) and
// every reference-library topic (builder-references.js), each with one line saying when it
// helps. The builder reads the menu in its rules and opens the skills it decides it needs with
// the kairoq_skill tool, instead of Kairoq guessing from words in the request.
const P=require('./builder-playbooks'),R=require('./builder-references');
const ABOUT={'3d-character':'a 3D character or animal that moves, is tapped or coloured in','ar-coloring':'AR from a printed page or placing a model in the room','camera-colours':'reading colours from a photo or camera frame of a drawing','printable':'printable pages and worksheets'};
function list(){
 return[
  ...P.BOOKS.map(b=>({name:b.id,about:ABOUT[b.id]||b.id})),
  ...Object.entries(R.TOPICS).filter(([n])=>n!=='Uncategorized').map(([n,t])=>({name:n,about:(t.app?'':'(not inside a browser app) ')+t.text.split(/(?<=\.)\s/)[0].slice(0,140)})),
 ];
}
function menu(){return'\n\nSKILLS (open the ones this request needs with kairoq_skill before building; each gives tested know-how):\n'+list().map(s=>'- '+s.name+': '+s.about).join('\n')}
function open(name){
 const n=String(name||'').trim().toLowerCase();
 const book=P.BOOKS.find(b=>b.id===n);if(book)return'Skill '+book.id+':\n'+book.text;
 const topic=Object.keys(R.TOPICS).find(t=>t.toLowerCase()===n)||Object.keys(R.TOPICS).find(t=>t.toLowerCase().includes(n)&&n.length>2);
 if(topic)return'Skill '+topic+':\n'+R.lookup(topic);
 return'No skill called "'+String(name).slice(0,60)+'". Skills: '+list().map(s=>s.name).join(', ')+'.';
}
module.exports={list,menu,open};
