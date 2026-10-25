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
 if(t.length>80||t.split(/\s+/).length>10)return null;
 const lead=s=>s.replace(/^[\s,!.:-]+/,'');
 const afterHi=lead(t.replace(GREETING,'')),help=HELP.test(afterHi);
 const rest=lead(lead(afterHi.replace(THANKS,'')).replace(HELP,'')).trim();
 if(rest&&CHANGE.test(rest))return null;
 if(/\b(why|what|how|when|where|which|who)\b|\?/i.test(rest)&&!/\b(how are (you|things)|how'?s it going|how is (it|everything)|are you (there|around|ok|okay|well)|how have you been|what'?s up)\b/i.test(rest))return null;
 // "hi how are you doing today": a greeting followed by chit-chat is still a greeting.
 if(rest.split(/\s+/).filter(Boolean).length>(GREETING.test(t)?6:3))return null;
 if(help)return'help';
 if(GREETING.test(t))return'greeting';
 if(THANKS.test(t))return'thanks';
 return null;
}

// A question about the app that asks for no change ("Should bookings be confirmed instantly?").
// "Can you add…", "please…" and anything that names a change stay build requests.
function questionOnly(message){
 const t=String(message||'').trim();
 if(t.length>400)return false;
 // Asking for ideas or an explanation is never a build, with or without "?" or "can you":
 // "can you suggest what else", "any ideas", "what would you recommend", "explain the booking flow".
 // "Add something else to the footer" starts with a change: it builds.
 if(ASKING.test(t)&&!CHANGE_ASK.test(t)&&!/^\s*(please\s+)?(add|change|make|create|build|remove|update|fix|put|replace|move|use|rename|delete|turn|set|show|hide)\b/i.test(t))return true;
 if(!t.endsWith('?'))return false;
 if(/\b(can|could|would|will) you\b|\bplease\b|\bi want\b|\blet'?s\b/i.test(t))return false;
 // "why did the build fail?": the build, the update, the design are nouns here, not change requests.
 return!CHANGE.test(t.replace(/\b(the|this|that|my|your|last) (build|update|design|fix|change|style)s?\b/gi,''));
}
const ASKING=/\b(suggest(ions?)?|ideas?|recommend(ations?)?|advice|advise|explain|thoughts|opinion|what else|what next|what more|(any|some)\s*th\w*\s+(else|more)|else|what should (i|we)|tell me (about|why|how|what)|feedback)\b/i;
// "suggest a gallery and add it" still asks for a change.
const CHANGE_ASK=/\b(and|then) (add|build|make|create|change|put|implement)\b|\b(add|build|make|create|change|implement) (it|them|that|those|a|an|the)\b/i;

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

// Talking to the builder rather than asking for a change: "what happened", "why is it so
// slow", "are you there", "how are you". It starts like conversation and names no change, so it
// gets an answer (Discuss) instead of a build that would report "Updated the app." for nothing.
const CONVERSATION=/^(hi+|hello|hey+|yo|good (morning|afternoon|evening|day)|what|why|how|is|are|was|were|did|does|do|where|when|who|which|anyone|anybody|any ?one|still|so|hmm+|um+|uh+|ok so|and)\b/i;
function conversation(message){
 const t=String(message||'').trim();
 if(!t||t.length>300||/https?:\/\//i.test(t))return false;
 if(t.split(/\s+/).length>25)return false;
 // A short message with no change in it ("ok but why", "really?", "not sure") is conversation too.
 const shortTalk=t.split(/\s+/).length<=6&&(/\?$/.test(t)||/\b(why|what|how|really|sure|huh|hmm+|mean|meaning|confused|understand)\b/i.test(t));
 return(CONVERSATION.test(t)||shortTalk)&&!CHANGE.test(t);
}

module.exports={smallTalk,questionOnly,conversation,reply};
