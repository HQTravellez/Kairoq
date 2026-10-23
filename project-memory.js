"use strict";
// Project memory: what the AI always knows about a project, however long the chat. The chat
// itself only carries the last 10 messages, so older decisions were forgotten. This adds, to
// every request, a short brief Kairoq keeps without any AI call:
//  - facts read from the current code: pages, data (collections and their access, SQL tables),
//    server functions, sign-in, payments, email, AI, mobile;
//  - every request the owner made, oldest first (older ones clipped), so earlier decisions
//    ("prices in €", "staff sign in, customers do not") are never lost.
// It cannot drift from the app: the facts come from the files of the current version.
const MAX_REQUESTS=60,MAX_NOTE=6000;

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function uniq(a){return[...new Set(a)]}

// What the current files show, as plain facts.
function facts(files){
 const src=Object.entries(files||{}).filter(([n,c])=>typeof c==='string');
 const code=src.filter(([n])=>/^src\/.*\.(jsx?|tsx?)$/.test(n)).map(([,c])=>c).join('\n');
 const out={};
 let backend={};try{backend=JSON.parse(files['src/backend.json']||'{}')||{}}catch{}
 const collections=Object.entries(backend.collections||{}).map(([name,c])=>name+' ('+((c&&c.access)||'private')+')');
 if(collections.length)out.collections=collections;
 const tables=uniq(src.filter(([n])=>/^sql\//.test(n)).flatMap(([,c])=>[...c.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([a-z_][a-z0-9_]*)/gi)].map(m=>m[1])));
 if(tables.length)out.sql_tables=tables;
 const fns=src.filter(([n])=>/^functions\/[a-z0-9-]+\.js$/.test(n)).map(([n])=>n.slice(10,-3));
 if(fns.length)out.server_functions=fns;
 const pages=uniq([...src.filter(([n])=>/^src\/pages\//.test(n)).map(([n])=>n.replace(/^src\/pages\//,'').replace(/\.(jsx?|tsx?)$/,'')),...[...code.matchAll(/<Route\b[^>]*\bpath=["']([^"']+)["']/g)].map(m=>m[1])]).slice(0,30);
 if(pages.length)out.pages=pages;
 const uses=[];
 if(/\bauth\.(signUp|signIn|user)\b/.test(code))uses.push('sign-in');
 if(/signInWithGoogle/.test(code))uses.push('Google sign-in');
 if(/\bpayments\./.test(code)||backend.payments)uses.push('payments');
 if(/\bemail\.send\b/.test(code)||backend.email)uses.push('email');
 if(/\bai\.(ask|chat|extract|complete)\b/.test(code)||backend.ai)uses.push('AI');
 if(/\breferrals\./.test(code))uses.push('invite a friend');
 if(/\bstorage\.upload\b/.test(code))uses.push('file uploads');
 if(/\.subscribe\(/.test(code))uses.push('live updates');
 if(backend.schedules&&Object.keys(backend.schedules).length)uses.push('scheduled jobs');
 if(uses.length)out.uses=uses;
 out.files=src.length;
 return out;
}
// The owner's requests, oldest first: the first ones (what the app is) and the latest 10 in
// full, the ones in between shortened to `middle` characters.
function requests(meta,middle=160){
 const list=(meta.messages||[]).filter(m=>m.role==='user'&&m.text&&m.mode!=='discuss').map(m=>clip(m.text,600));
 const keep=(t,i)=>i<3||i>=list.length-10?t:t.slice(0,middle);
 if(list.length<=MAX_REQUESTS)return list.map((t,i)=>({n:i+1,text:keep(t,i)}));
 const skipped=list.length-MAX_REQUESTS,from=list.length-(MAX_REQUESTS-5);
 return[...list.slice(0,5).map((t,i)=>({n:i+1,text:keep(t,i)})),{n:0,text:'… '+skipped+' earlier requests left out …'},...list.slice(from).map((t,i)=>({n:from+i+1,text:keep(t,from+i)}))];
}
function render(meta,f,reqs){
 const lines=['','','Project memory (kept by Kairoq from the current code and the owner\'s requests; follow it unless the new request changes it):','App: '+clip(meta.name,80)];
 if(f.pages)lines.push('Pages: '+f.pages.join(', '));
 if(f.collections)lines.push('Data collections (src/backend.json): '+f.collections.join(', '));
 if(f.sql_tables)lines.push('SQL tables: '+f.sql_tables.join(', '));
 if(f.server_functions)lines.push('Server functions: '+f.server_functions.join(', '));
 if(f.uses)lines.push('Uses: '+f.uses.join(', '));
 if(reqs.length){lines.push('Owner\'s requests so far, oldest first (decisions in them still apply):');for(const r of reqs)lines.push(r.n?r.n+'. '+r.text:r.text)}
 return lines.join('\n');
}
// The note added to the system prompt; empty for a new project. When it is too long the
// requests in the middle are shortened further; the first and the latest stay whole.
function note(meta,files){
 const f=facts(files);
 if(!requests(meta).length&&!f.collections&&!f.pages)return'';
 let out='';
 for(const middle of [160,80,40,0]){out=render(meta,f,requests(meta,middle));if(out.length<=MAX_NOTE)return out}
 return out.slice(0,MAX_NOTE-30)+'\n… (memory shortened)';
}
module.exports={facts,requests,note};
