'use strict';
// "Look before replying": after a change about layout or looks, Kairoq takes screenshots of the
// page (desktop and phone) and an AI that can see compares them with what the owner asked: is the
// new thing where they said, the right size, and does it fit the design? If not, the builder
// fixes it once, free, before the owner sees the result. Browser checks prove the app works;
// this proves it looks the way it was asked for.

// Requests about placement, size or appearance. Data and logic changes are not looked at.
const VISUAL=/\b(move|place|put|position|align|center|centre|left|right|top|bottom|beside|next to|above|below|under|over|header|footer|hero|section|banner|sidebar|layout|spacing|padding|margin|gap|size|bigger|smaller|larger|wider|narrower|taller|shorter|colou?r|font|bold|style|look|looks|design|redesign|animation|animate|3d|icon|logo|image|photo|picture|background|button|card|grid|column|row|dark mode|light mode|theme|gradient|shadow|rounded|border)\b/i;
function isVisual(message){return VISUAL.test(String(message||''))&&String(message||'').length<=2000}

// avoid: things to avoid for this kind of business (the design brief's page playbook).
function prompt(request,avoid=[]){
 const extra=(avoid||[]).filter(Boolean).slice(0,6);
 return`You review an app the owner is building. The owner asked for this change:\n"${String(request).slice(0,1500)}"\n\nThe screenshots show the app after the change (desktop first, then phone). Judge only what the owner asked for:\n- Is it there, and where they said (the section, side and order they named)?\n- Is it a sensible size, fully visible, not overlapping or covering other content, and does it work on the phone?\n- Does it fit the rest of the design (colours, spacing, style), so it looks intended rather than stuck on?\n- If it is 3D: does it look crafted (real materials like metal, ceramic or wood, good light), not plain grey boxes and cylinders, and does it fill its box without empty bands?\n${extra.length?'- Also flag it, as one problem, if the screenshots clearly show something to avoid for this kind of business: '+extra.join('; ')+'.\n':''}Be strict about placement and overlap; do not ask for unrelated improvements.\nReply with ONLY JSON: {"ok":true} or {"ok":false,"problems":["short, specific problem with where it is and where it should be", ...]} (at most 4 problems).`;
}

// The reviewer's reply as {ok, problems}; anything unreadable counts as no verdict (null).
function verdict(text){
 const s=String(text||''),a=s.indexOf('{'),b=s.lastIndexOf('}');
 if(a<0||b<=a)return null;
 try{
  const v=JSON.parse(s.slice(a,b+1));
  const problems=(Array.isArray(v.problems)?v.problems:[]).map(p=>String(p||'').replace(/\s+/g,' ').trim().slice(0,300)).filter(Boolean).slice(0,4);
  if(v.ok===true||(v.ok!==false&&!problems.length))return{ok:true,problems:[]};
  return problems.length?{ok:false,problems}:null;
 }catch{return null}
}

// What the builder is asked to do when the result does not match.
function fixMessage(request,problems){
 return'Screenshots of the app after your last change show it does not yet match what the owner asked for.\nThe owner asked: "'+String(request).slice(0,1500)+'"\nWhat is wrong:\n'+problems.map(p=>'- '+p).join('\n')+'\nFix only these points. Keep everything else exactly as it is.';
}

module.exports={isVisual,prompt,verdict,fixMessage};
