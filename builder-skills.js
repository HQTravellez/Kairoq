"use strict";
// The builder's skills menu (like skills in an agent): every playbook (builder-playbooks.js) and
// every reference-library topic (builder-references.js), each with one line saying when it
// helps. The builder reads the menu in its rules and opens the skills it decides it needs with
// the kairoq_skill tool, instead of Kairoq guessing from words in the request.
const P=require('./builder-playbooks'),R=require('./builder-references'),S=require('./specialist-skill-packs'),T=require('./teardown-skill-pack');
const ABOUT={'3d-character':'a 3D character or animal that moves, is tapped or coloured in','ar-coloring':'AR from a printed page or placing a model in the room','camera-colours':'reading colours from a photo or camera frame of a drawing','printable':'printable pages and worksheets','game-design':'designing a small game: the core loop, controls, tuning values, game states','game-feel':'making a game feel good: feedback, impact, easing, sound','game-qa':'testing a game: first-time play, automatic checks, balance','game-accessibility':'games everyone can play: text, controls, pause, sound'};
function list(){
 return[
  ...P.BOOKS.map(b=>({name:b.id,about:ABOUT[b.id]||b.id})),
  ...Object.entries(R.TOPICS).filter(([n])=>n!=='Uncategorized').map(([n,t])=>({name:n,about:(t.app?'':'(not inside a browser app) ')+t.text.split(/(?<=\.)\s/)[0].slice(0,140)})),
 ];
}
function menu(request=''){
 const rows=[...list(),...S.list(request),...T.list(request)];
 return'\n\nSKILLS (open the ones this request needs with kairoq_skill before building; each gives tested know-how):\n'+rows.map(s=>'- '+s.name+': '+s.about).join('\n');
}
function open(name){
 const n=String(name||'').trim().toLowerCase();
 const book=P.BOOKS.find(b=>b.id===n);if(book)return'Skill '+book.id+':\n'+book.text;
 const topic=Object.keys(R.TOPICS).find(t=>t.toLowerCase()===n)||Object.keys(R.TOPICS).find(t=>t.toLowerCase().includes(n)&&n.length>2);
 if(topic)return'Skill '+topic+':\n'+R.lookup(topic);
 return'No skill called "'+String(name).slice(0,60)+'". Skills: '+list().map(s=>s.name).join(', ')+'.';
}
async function openAsync(name,options={}){
 const local=open(name);
 if(!/^No skill called /.test(local))return local;
 const specialist=await S.open(name,options);if(specialist)return specialist;
 const teardown=await T.open(name,options);if(teardown)return teardown;
 return local;
}
module.exports={list,menu,open,openAsync};
