"use strict";
// Side-effect guard: after a change, Kairoq compares what the edit touched with what was asked.
// When a request about looks or text ("make the button blue") also changed saved data and
// bookings, payments or sign-in, the reply says so, so the owner can undo it before it costs
// them bookings. It only reports; nothing is blocked.
const AREAS=[
 {name:'saved data and bookings',files:/^(src\/backend\.json|sql\/|functions\/)/,code:/\b(collection\(|db\.sql|db\.collection|functions\.invoke|\.create\(|\.update\(|\.remove\()/,asked:/\b(book|reserv|order|form|save|stor|data|database|backend|collection|table|sql|function|automat|schedul|email|enquir|contact|submit|record|field|stock|inventor|ai\b|chat|assistant|menu item|import)/i},
 {name:'payments',files:/^src\/backend\.json$/,code:/\bpayments\.|\bcheckout\s*\(|\bstripe\.|\bStripe\b|\bprice_[A-Za-z0-9]{6,}/,asked:/\b(pay|checkout|stripe|price|pricing|subscri|purchase|buy|shop|cart|plan|deposit|refund)/i},
 {name:'sign-in',files:/(login|signin|sign-in|signup|auth)/i,code:/\b(auth\.|signIn|signUp|signOut|resetPassword|password)\b/,asked:/\b(log ?in|sign|account|password|auth|user|member|google)/i}
];
function changedLines(a='',b=''){
 const before=new Set(String(a).split('\n')),after=new Set(String(b).split('\n'));
 return[...String(b).split('\n').filter(l=>!before.has(l)),...String(a).split('\n').filter(l=>!after.has(l))].join('\n');
}
// message: what was asked. before/after: the app's files. Returns [{area, files}] for areas the
// change touched that the request did not mention.
// Code that only moved (cut from one file and pasted into another, or re-indented) is not a change:
// splitting OwnerMenuPanel into smaller files must not read as "changed sign-in".
function movedAway(files,before,after){
 const lines=t=>String(t||'').split('\n').map(l=>l.trim()).filter(Boolean);
 const added=new Set(),removed=new Set();
 for(const f of files){const a=new Set(lines(before[f])),b=new Set(lines(after[f]));for(const l of b)if(!a.has(l))added.add(l);for(const l of a)if(!b.has(l))removed.add(l)}
 // What is left of a file's change once moved lines are taken out.
 return f=>{const a=new Set(lines(before[f])),b=new Set(lines(after[f]));return[...[...b].filter(l=>!a.has(l)&&!removed.has(l)),...[...a].filter(l=>!b.has(l)&&!added.has(l))].join('\n')};
}
function check(message,before={},after={}){
 const files=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(f=>before[f]!==after[f]);
 if(!files.length)return[];
 const netChange=movedAway(files,before,after);
 const out=[];
 for(const a of AREAS){
  if(a.asked.test(String(message||'')))continue;
  const hit=files.filter(f=>{
   const diff=netChange(f);
   if(!diff.trim())return false;
   if(a.name==='payments'&&f==='src/backend.json')return/"payments"|price_/.test(diff);
   if(a.name==='saved data and bookings'&&f==='src/backend.json')return!/"payments"|price_/.test(diff)||/"collections"|"access"|"automations"|"schedules"/.test(diff);
   // Stylesheets and other non-code files only count by name: CSS "stripes" are not Stripe.
   // App code (src/) counts only when the changed lines themselves do sign-in, payments or saving;
   // a new file merely named "OwnerSignInForm" that holds moved code does not. Backend files
   // (functions/, sql/, backend.json) count by name.
   if(/^src\/.*\.(jsx?|tsx?|mjs|cjs)$/.test(f))return a.code.test(diff);
   return a.files.test(f)||(/\.(jsx?|tsx?|mjs|cjs|sql)$/.test(f)&&a.code.test(diff));
  });
  if(hit.length)out.push({area:a.name,files:hit.slice(0,5)});
 }
 return out;
}
const PLAIN={'saved data and bookings':'how the app saves information (like enquiries or bookings)','payments':'payments','sign-in':'a sign-in'};
function note(found){return found.length?'I also changed '+found.map(f=>PLAIN[f.area]||f.area).join(' and ')+', which you didn\'t ask for. If you don\'t want that, undo this change.':''}
module.exports={check,note,changedLines};
