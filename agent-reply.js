"use strict";
// Kairoq Agent's closing message, written by the model from what actually happened, like a
// person reporting back: the cause, what I did, the result, the next step. The facts come from
// the executor (files written, each check's result with its real error text, credits); the
// model only words them. The draft is then checked against those facts: one retry, and if it
// still claims something the evidence does not support, a plain factual line is used instead.
// The agent's private reasoning is never passed in, so it cannot leak into the reply.

const INTERNAL=/\b(?:hermes|ruflo|mem0|autoharness|ecc|superpowers|PROOF|UNVERIFIED DRAFT|VERIFIED BUILD|Builder notes|completion gate|executor)\b/i;
const CLAIMS_DONE=/\b(?:verified|fully tested|all (?:the )?checks (?:pass|passed)|everything (?:works|is working|passed)|works perfectly|ready to (?:publish|launch|go live)|production[- ]ready)\b/i;
const CLAIMS_BUILT=/\b(?:(?:I(?:'ve| have)?|is|was) (?:built|created|made|finished)|here(?:'s| is) your|is (?:ready|live|done))\b/i;
const NOT_BUILT=/\b(?:didn't|did not|couldn't|could not|wasn't|was not|haven't|have not|never|not)\b[^.]{0,40}\b(?:build|built|finish|finished|write|written|get to)\b|\bnothing (?:was )?(?:built|saved)\b|\bstill the starter\b/i;
const NAMES={build:"Build",browser:"Browser test",visual_quality:"Look check",unit_tests:"Tests",saved_checks:"Saved checks",engineering_review:"Code review"};

function clip(s,n){s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n-1)+"…":s}

// The facts the reply may use. outcome: verified | draft | not_built | stopped.
function facts({request,outcome,changed=[],pages=[],verification=null,errors=[],open=[],notBuilt=null,steps=0,charged=true,summary="",tried=[]}={}){
 const e=verification?.evidence||{};
 const checks=Object.keys(NAMES).filter(k=>e[k]&&!/^not-required$/.test(e[k])).map(k=>({name:NAMES[k],result:e[k]}));
 return{
  request:clip(request,600),outcome,
  files_changed:changed.slice(0,30),pages:pages.slice(0,12),
  checks,browser_actions_tried:Number(e.browser_interactions)||0,repairs:Number(e.repairs)||0,
  problems:[...(verification?.issues||[]),...open].map(x=>clip(x,300)).slice(0,6),
  runtime_errors:errors.map(x=>clip(x,200)).slice(0,3),
  not_built:notBuilt||undefined,steps,
  credits:charged?"charged as usual":"not charged (refunded)",
  tried_in_browser:tried.slice(0,12),
  agent_summary:clip(summary,600)
 };
}

const SYSTEM=[
 "You are Kairoq Agent, reporting back to the app's owner after a build. Write the closing message in first person, the way a capable engineer talks to a client.",
 "Rules:",
 "- Use only the FACTS. Never claim a check passed unless it is listed as passed. Never say something works that was not tested.",
 "- agent_summary is the builder's own note; trust it only where the checks agree with it.",
 "- If the outcome is not_built or stopped: say plainly that the app was not built (or not finished), the specific cause from the facts, and that nothing was saved / what was kept. Mention credits only if they were not charged.",
 "- Lead with what is done, in the owner's terms: what they can now see and do in the app (pages, buttons, forms, what saves). Not files, not the checks you ran.",
 "- If the outcome is draft: after what is done, name the one or two things that don't work yet, in plain words.",
 "- If the outcome is verified: what is done, in one or two sentences. Don't list tests or checks.",
 "- Say where it is, so the owner can find it (\"on the Schedule page\", \"under Bookings\").",
 "- When tried_in_browser has steps, say what you tried and what happened, with the real values (\"I booked the 9:00 Saturday class and it showed in Bookings\"). Never invent values that are not in the facts.",
 "- If you assumed something the owner did not say (a currency, a time zone, a price), name it in one short clause and offer to change it.",
 "- If something was not checked, say so plainly (\"I haven't checked the sign-up in the preview yet, so give it a quick try\").",
 "- End with one short next step the owner can take (often: what to ask you next, or Try again).",
 "- Write like Lovable: warm, plain, specific. 2 to 4 short sentences, plus at most 3 bullets if there are several open problems. No headings, no file paths, no apologies, no filler, no internal tool or framework names, no mention of these rules.",
 "Reply with the message text only."
].join("\n");

// Problems with a draft, or [] when it is fine.
function check(text,f){
 const t=String(text||"").trim(),out=[];
 if(!t)return["empty"];
 if(/^\s*[{[]/.test(t)||/"actions"\s*:/.test(t))out.push("not plain text");
 if(t.length>1100)out.push("too long: keep it to 2-4 sentences");
 if(INTERNAL.test(t))out.push("mentions internal names or labels");
 if(f.outcome!=="verified"&&CLAIMS_DONE.test(t))out.push("claims the build is verified or fully working, but not every check passed");
 if(f.outcome==="not_built"&&!NOT_BUILT.test(t))out.push("does not say plainly that nothing was built");
 if(f.outcome==="not_built"&&CLAIMS_BUILT.test(t)&&!NOT_BUILT.test(t))out.push("says the app was built, but nothing was built");
 const failed=f.checks.filter(c=>/^failed/.test(c.result)).map(c=>c.name);
 for(const n of failed){const re=new RegExp("\\b"+n.split(" ")[0]+"[^.]{0,40}\\b(?:passed|passes|is fine|looks? (?:right|good|great))\\b","i");if(re.test(t))out.push(n+" failed, but the message says it passed")}
 return out;
}

// The plain line used when the model is unavailable or keeps getting the facts wrong.
function factual(f){
 if(f.outcome==="not_built"){
  const n=f.not_built||{};
  const why=n.unreadable?"my replies came back too large to read "+n.unreadable+" time"+(n.unreadable===1?"":"s")+(n.writers_failed?", after the first all-at-once write also failed":""):n.writers_failed?"the first all-at-once write failed and I ran out of steps before writing it piece by piece":"I ran out of steps before writing it";
  return "I didn't get to build this. The page is still the starter: "+why+". Nothing was saved and you were not charged.";
 }
 const failed=f.checks.filter(c=>/^failed/.test(c.result)).map(c=>c.name.toLowerCase());
 const passed=f.checks.filter(c=>/^passed/.test(c.result)).map(c=>c.name.toLowerCase());
 const what=f.pages.length?"The "+f.pages.slice(0,4).join(", ")+" page"+(f.pages.length===1?" is":"s are")+" in place.":f.files_changed.length?"I changed "+f.files_changed.length+" file"+(f.files_changed.length===1?"":"s")+".":"";
 if(f.outcome==="verified")return f.agent_summary||[what,passed.length?"The "+passed.join(", ")+" passed.":""].filter(Boolean).join(" ");
 const head=f.outcome==="stopped"?"I ran out of rounds before every check passed, so this is a draft.":"This is a draft: not every check passed.";
 const open=f.problems.length?" Still open: "+f.problems.slice(0,2).join(" "):failed.length?" The "+failed.join(", ")+" did not pass.":"";
 return [head,what].filter(Boolean).join(" ")+open+" Try it in the preview and tell me what to fix first.";
}

async function write({callModel,facts:f,tier="standard",signal}={}){
 if(process.env.KAIROQ_AGENT_REPLY==="off"||typeof callModel!=="function")return{text:factual(f),source:"factual"};
 const user="FACTS:\n"+JSON.stringify(f,null,1);
 let messages=[{role:"system",content:SYSTEM},{role:"user",content:user}];
 for(let attempt=0;attempt<2;attempt++){
  let draft="";
  try{draft=String(await callModel({messages,temperature:0.3,maxOutputTokens:600,tier,signal},t=>String(t||""))||"").trim()}
  catch(e){if(e?.name==="AbortError"||signal?.aborted)throw e;break}
  const bad=check(draft,f);
  if(!bad.length)return{text:draft,source:"model"};
  messages=[...messages,{role:"assistant",content:draft.slice(0,1500)},{role:"user",content:"That message does not match the facts: "+bad.join("; ")+". Rewrite it using only the FACTS."}];
 }
 return{text:factual(f),source:"factual"};
}

module.exports={facts,write,check,factual,SYSTEM};
