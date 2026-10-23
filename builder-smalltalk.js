'use strict';
// Conversation in the builder chat. "hi", "thanks" or "what can you do" is not a change request:
// it gets a short, free reply instead of a build (no design pick, no credits). A question about
// the app that asks for no change gets an answer (Discuss) instead of a build.

const GREETING=/^(hi+|hello|hey+|hiya|yo|howdy|hola|namaste|good (morning|afternoon|evening|day)|hi there|hello there|hey there)\b/i;
const THANKS=/^(thanks|thank you|thx|ty|cheers|great|awesome|nice|cool|perfect|love it|looks good|wow|ok|okay|k|yes|yep|sure|alright|fine)\b/i;
const HELP=/^(help|what can you do|what do you do|who are you|how does this work|how do i (start|use this)|what is this)\b/i;
const CHANGE=/\b(add|change|make|create|build|remove|update|fix|put|replace|move|use|rename|delete|turn|set|show|hide|let|allow|connect|design|redesign|style|translate|generate|write|publish)\b/i;

// 'greeting' | 'thanks' | 'help' | null. Only short messages with nothing else to do count.
function smallTalk(message){
 const t=String(message||'').trim().replace(/[\s!.?,:)😊🙂👋🙏]+$/u,'');
 if(!t)return null;
 if(t.length>60||t.split(/\s+/).length>8)return null;
 const rest=t.replace(GREETING,'').replace(THANKS,'').replace(HELP,'').trim();
 if(rest&&CHANGE.test(rest))return null;
 if(rest.split(/\s+/).filter(Boolean).length>3)return null;
 if(HELP.test(t))return'help';
 if(GREETING.test(t))return'greeting';
 if(THANKS.test(t))return'thanks';
 return null;
}

// A question about the app that asks for no change ("Should bookings be confirmed instantly?").
// "Can you add…", "please…" and anything that names a change stay build requests.
function questionOnly(message){
 const t=String(message||'').trim();
 if(!t.endsWith('?')||t.length>400)return false;
 if(/\b(can|could|would|will) you\b|\bplease\b|\bi want\b|\blet'?s\b/i.test(t))return false;
 return!CHANGE.test(t);
}

function reply(kind,meta){
 const name=meta&&meta.name||'your app';
 const fresh=!meta||!(meta.current_version>1);
 if(kind==='thanks')return'You\'re welcome! Tell me the next thing you want to change in '+name+', and I\'ll build it.';
 const examples=fresh
  ?['Who it is for and what it should do','The pages you need (for example home, rooms, booking, contact)','What people can do on it: book, sign up, send a request']
  :['"Add a gallery page with our photos"','"Make the booking form ask for the number of guests"','"Change the colours to match our logo"'];
 const lead=kind==='help'
  ?'I build and change '+name+' for you: pages, forms, sign-in, saved data and the design. Every change is tested in a real browser before you pay for it.'
  :'Hi! I\'m ready to work on '+name+'.';
 return lead+'\n\n'+(fresh?'Tell me about the app:':'Tell me what to change, for example:')+'\n'+examples.map(e=>'- '+e).join('\n');
}

module.exports={smallTalk,questionOnly,reply};
