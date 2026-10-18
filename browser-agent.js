"use strict";
// The browser agent: an AI that uses a website in a real browser, step by step, until a goal is
// reached. It drives a runtime-check.session() (guarded: public sites only, nothing is ever
// really sent, apps run on a test copy of their data).
//
// The design follows the ideas behind browser-use (MIT), written here for Kairoq:
// - every step the model reports how its last action went, keeps its own short memory and
//   names its next goal, then takes up to 3 actions; the rest of a batch is skipped as soon as
//   the page changes, so it never acts on a stale screen;
// - repeated actions on a screen that does not change, and failures in a row, are noticed and
//   the model is told to try another way; too many failures end the run;
// - a screenshot is added when words are not enough (an action that changed nothing, a
//   failure, every few steps), on a model that can see images;
// - "done" is not taken at its word: a second, sceptical model checks the final screen;
// - bot walls (captchas, "access denied") end the run as "blocked", not as a failure.
// Two modes: "persona" (a customer role-play, see synthetic-customers.js) and "task" (do or
// find something on a site for the owner and answer, see web-tasks.js).
const crypto=require('crypto');

const TARGETED=new Set(['click','fill','select','hover']);
const ACTIONS=new Set(['click','fill','select','scroll','back','key','hover','wait','find_text','go_to','read','done','give_up']);
const FEELINGS=new Set(['confident','unsure','frustrated']);
const BLOCKED=/captcha|verify (that )?you(?:'| a)re (a )?human|are you a robot|unusual traffic|access denied|attention required|checking your browser|request (was )?blocked|bot protection|cf-chl|ddos protection/i;

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function json(content){
 const t=String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
 try{return JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('The model did not answer with JSON');return JSON.parse(t.slice(a,b+1))}
}
function fingerprint(o){return crypto.createHash('sha1').update(o.path+'\n'+o.elements.map(e=>e.kind+':'+e.label+(e.value?'='+e.value:'')).join('|')+'\n'+String(o.text||'').slice(0,800)).digest('hex').slice(0,16)}
function blockedPage(o,status){return BLOCKED.test((o.title||'')+'\n'+String(o.text||'').slice(0,1500))||([401,403,429,503].includes(status)&&o.elements.length<6)}

// What the model sees: where it is, how far down, the text, and the numbered elements
// (*[n] = appeared since the last step).
function describe(o){
 const sc=o.scroll,lines=[];
 if(o.sent)lines.push('(A form was just sent. This is a test, so nothing was really sent or saved: no emails, bookings or payments. Judge by what the screen shows.)');
 lines.push('Page: '+(o.title||'(no title)')+' — '+o.path);
 if(sc&&sc.height>sc.view+40){const below=Math.max(0,sc.height-sc.y-sc.view),above=sc.y;lines.push('Scroll: '+(above>20?'about '+(above/sc.view).toFixed(1)+' screens above':'at the top')+', '+(below>20?'about '+(below/sc.view).toFixed(1)+' screens more below':'at the bottom'))}
 if(o.dialog)lines.push('A dialog or popup is open.');
 lines.push('Visible text:',String(o.text||'').slice(0,2500),'','Interactive elements:');
 if(!o.elements.length)lines.push('(none)');
 for(const e of o.elements)lines.push((e.new?'*':'')+'['+e.id+'] '+e.kind+': '+(e.label||'(no label)')+(e.ph&&e.ph!==e.label?' (placeholder: '+e.ph+')':'')+(e.options?' options: '+e.options.join(' | '):'')+(e.value?' (current: '+e.value+')':'')+(e.checked!==undefined?(e.checked?' (checked)':' (not checked)'):'')+(e.expanded!==undefined?(e.expanded?' (open)':' (closed)'):'')+(e.disabled?' (disabled)':'')+(e.where?' ('+e.where+')':''));
 if(o.errors&&o.errors.length)lines.push('','Errors on the page: '+o.errors.slice(0,2).join('; '));
 return lines.join('\n');
}

const SCHEMA=`Respond with ONLY JSON:
{"evaluation":"did your last action work? ok, failed or nothing happened, and why (empty on the first step)","memory":"1-3 sentences to remember: progress so far and facts found (names, prices, dates)","next_goal":"what you do now","thought":"%THOUGHT%",%FEELING%"actions":[{"action":"click"|"fill"|"select"|"scroll"|"back"|"key"|"hover"|"wait"|"find_text"|"go_to"%READ%|"done"|"give_up","target":<element number>,"value":"..."}]}
Actions: click [n]; fill [n] with value (add "submit":true to press Enter after); select [n] value = option text; scroll value "down"/"up", or target [n] to bring it into view; back; key value Enter/Escape/Tab/ArrowDown/PageDown (target optional); hover [n]; wait (value = ms); find_text value = text to scroll to; go_to value = a path or link on this same site%READHELP%; done value = %DONEVALUE%; give_up value = why.
Up to 3 actions per step, in order (e.g. fill name, fill email, click Send). Only use element numbers from the current list. Elements marked *[n] just appeared. Elements marked (below) are further down: scroll or act on them directly.`;
const PERSONA=`You are role-playing a real person using a website, not a tester. Stay in character: your age, patience, tech comfort and device decide what you notice, what you skip and when you give up. You only know what is on the screen.
Each step you see the page (text and numbered interactive elements) and choose your next actions.
Use "done" only when your goal is truly complete on screen. Use "give_up" when a real person like you would leave (confusing, too slow, asks too much, cannot find it). Type realistic details; use test-<name>@example.com for emails and never real card numbers or real passwords.
`;
const TASK=`You are a careful assistant using a website in a browser for a small-business owner. Do the task step by step. You only know what is on the screen; never invent facts.
This browser is read-only: forms can be filled but nothing is really sent, booked or paid, so do not try to buy, book or sign in for real. If the task needs that, stop with done and say what you found and what the owner must do.
Close cookie banners and popups that are in the way. When the facts you need are on the page, use "read" to get the full page text if the visible text is cut. Finish with done and a complete, precise answer (exact prices, dates, names, with where you found them). If the site blocks you or the task is impossible, use give_up and say why.
`;
function systemPrompt(mode){
 const persona=mode==='persona';
 return(persona?PERSONA:TASK)+SCHEMA
  .replace('%THOUGHT%',persona?'what you think right now, first person, one or two short sentences':'short reasoning')
  .replace('%FEELING%',persona?'"feeling":"confident"|"unsure"|"frustrated",':'')
  .replace('%READ%',persona?'':'|"read"')
  .replace('%READHELP%',persona?'':'; read = get the full text of the page (for long lists, prices, details)')
  .replace('%DONEVALUE%',persona?'what you achieved':'the full answer for the owner');
}

// The model's reply as a list of valid actions (also accepts the older one-action reply).
function plan(reply,o,mode){
 const raw=Array.isArray(reply.actions)&&reply.actions.length?reply.actions:reply.action?[{action:reply.action,target:reply.target,value:reply.value,submit:reply.submit}]:[];
 const out=[],notes=[];
 for(const a of raw.slice(0,3)){
  const action=String(a&&a.action||'');
  if(!ACTIONS.has(action)||(action==='read'&&mode==='persona')){notes.push('"'+clip(action,20)+'" is not an action');continue}
  const target=Number(a.target);
  if(TARGETED.has(action)&&!o.elements.some(e=>e.id===target)){notes.push(action+' ['+clip(a.target,6)+']: there is no element with that number');continue}
  if((action==='scroll'||action==='key')&&a.target!==undefined&&a.target!==null&&a.target!==''&&!o.elements.some(e=>e.id===target)){notes.push(action+': no element ['+clip(a.target,6)+']');continue}
  out.push({action,...(a.target!==undefined&&a.target!==null&&a.target!==''?{target}:{}),value:String(a.value??'').slice(0,action==='done'||action==='give_up'?4000:300),...(a.submit===true?{submit:true}:{})});
  if(action==='done'||action==='give_up')break;
 }
 return{actions:out,notes};
}

const JUDGE=`You check whether a browser agent really finished its goal. Be sceptical: agents often claim success too early (a form filled but not sent, a page that only looks right, an answer not actually on the page).
Judge only from the final screen%SHOT% and the steps. In this test browser nothing is really sent: when the right form was filled and sent, that counts as done even if the site then shows nothing or an error.
Respond with ONLY JSON: {"verdict":true|false,"reason":"one sentence","blocked":true|false}
blocked = a captcha, bot check, "access denied" or a required login stopped the agent.`;
async function judge({goal,claim,steps,o,shot,mode,callModel,tier,signal}){
 const text='Goal: '+clip(goal,500)+'\nThe agent says: '+clip(claim,1500)+'\n\nSteps:\n'+steps.slice(-15).map(s=>s.n+'. '+s.path+': '+s.action+(s.label?' "'+s.label+'"':'')+(s.value&&s.action!=='done'?' "'+clip(s.value,60)+'"':'')+(s.error?' (failed)':'')+(s.sent?' (sent)':'')).join('\n')+'\n\nFinal screen:\n'+describe(o).slice(0,4000);
 const sys=JUDGE.replace('%SHOT%',shot?' (screenshot attached)':'');
 const content=shot?[{type:'text',text},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+shot}}]:text;
 try{
  const v=await callModel({messages:[{role:'system',content:sys},{role:'user',content}],temperature:0,maxOutputTokens:300,signal,tier:shot?'vision':tier},json);
  if(typeof v.verdict!=='boolean')throw Error('no verdict');
  return{ok:v.verdict,reason:clip(v.reason,300),blocked:v.blocked===true,checked:true};
 }catch(e){
  if(shot&&!(signal&&signal.aborted))return judge({goal,claim,steps,o,shot:null,mode,callModel,tier,signal});
  // Without a judge the agent's word stands, marked as unchecked.
  return{ok:true,reason:'',blocked:false,checked:false};
 }
}

// opts: {session, goal, mode:'persona'|'task', persona (text), callModel, tier, maxSteps,
// signal, vision:'auto'|'off', judge:true, onStep}
// Returns {outcome:'completed'|'gave_up'|'stuck'|'blocked'|'error', steps, answer, memory, verdict, error}.
async function run({session:s,goal,mode='task',persona='',callModel,tier='standard',maxSteps=12,signal,vision='auto',judge:useJudge=process.env.KAIROQ_BROWSER_JUDGE!=='off',onStep=()=>{}}){
 const steps=[];let memory='',outcome='stuck',answer='',verdict=null,error=null,failures=0,nudge='',extra='',visionOn=vision!=='off';
 const seen=new Map();
 let o=await s.observe();
 try{
  for(let turn=0;turn<maxSteps;turn++){
   if(signal&&signal.aborted)throw Error('Stopped.');
   if(o.sent&&steps.length)steps.at(-1).sent=true;
   if(blockedPage(o,s.status?s.status():0)){outcome='blocked';answer='The site showed a bot check or blocked access.';break}
   const last=steps.at(-1);
   const wantShot=visionOn&&s.screenshot&&turn>0&&(last&&(last.no_change||last.error)||turn%4===3);
   const shot=wantShot?await s.screenshot():null;
   const history=steps.slice(-8).map(x=>'- on '+x.path+': '+x.action+(x.label?' "'+x.label+'"':'')+(x.value&&x.action!=='done'?' "'+clip(x.value,60)+'"':'')+(x.error?' (did not work: '+x.error+')':'')+(x.no_change?' (nothing changed)':'')+(x.sent?' (sent)':'')).join('\n');
   const text=(mode==='persona'?'You are: '+persona+'\nYour goal: ':'Task: ')+clip(goal,1200)+'\nStep '+(turn+1)+' of at most '+maxSteps+'.'+(memory?'\nYour notes: '+memory:'')+(history?'\nWhat you did so far:\n'+history:'')+(nudge?'\n\nNote: '+nudge:'')+(extra?'\n\nFull page text (from read):\n'+extra:'')+'\n\n'+describe(o);
   nudge='';extra='';
   const messages=[{role:'system',content:systemPrompt(mode)},{role:'user',content:shot?[{type:'text',text},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+shot}}]:text}];
   let reply;
   try{reply=await callModel({messages,temperature:mode==='persona'?0.7:0.2,maxOutputTokens:700,signal,tier:shot?'vision':tier},json)}
   catch(e){
    if(!shot||(signal&&signal.aborted))throw e;
    // No model that sees images: carry on with words only.
    visionOn=false;messages[1].content=text;
    reply=await callModel({messages,temperature:mode==='persona'?0.7:0.2,maxOutputTokens:700,signal,tier},json);
   }
   memory=clip(reply.memory,500)||memory;
   const thought=clip(reply.thought||reply.next_goal,300),feeling=FEELINGS.has(reply.feeling)?reply.feeling:'unsure';
   const {actions,notes}=plan(reply,o,mode);
   if(!actions.length){
    failures++;nudge='Your last reply had no usable action'+(notes.length?' ('+notes.join('; ')+')':'')+'. Choose actions from the list.';
    if(mode==='persona'){steps.push({n:steps.length+1,path:o.path,thought:thought||'I could not find what I was looking for.',feeling:'frustrated',action:'give_up'});outcome='gave_up';break}
    if(failures>=5)break;
    continue;
   }
   if(notes.length)nudge='Skipped: '+notes.join('; ')+'.';
   let finished=false;
   for(let i=0;i<actions.length;i++){
    const a=actions[i],el=o.elements.find(e=>e.id===a.target);
    const step={n:steps.length+1,path:o.path,thought,...(mode==='persona'?{feeling}:{}),action:a.action,...(el?{label:el.label,kind:el.kind,...(el.ph?{ph:el.ph}:{}),...(el.loc?{loc:el.loc}:{})}:{}),...(a.value&&a.action!=='click'?{value:a.value}:{})};
    if(i===0&&reply.evaluation)step.evaluation=clip(reply.evaluation,200);
    // Where a visitor gave up or got frustrated: the code behind what was on screen.
    if(a.action==='give_up'||feeling==='frustrated'&&mode==='persona')step.screen=[...new Set(o.elements.map(e=>e.loc).filter(Boolean))].slice(0,12);
    steps.push(step);onStep(step);
    if(a.action==='done'){
     answer=a.value;
     verdict=useJudge?await judge({goal,claim:a.value||thought,steps,o,shot:visionOn&&s.screenshot?await s.screenshot():null,mode,callModel,tier,signal}):null;
     outcome=!verdict||verdict.ok?'completed':verdict.blocked?'blocked':'stuck';
     if(verdict&&!verdict.ok)step.judged=verdict.reason;
     finished=true;break;
    }
    if(a.action==='give_up'){answer=a.value;outcome='gave_up';finished=true;break}
    if(a.action==='read'){extra=String(s.read?await s.read(12000):o.text).slice(0,12000);continue}
    const before=fingerprint(o),layout=o.path+'|'+o.elements.map(e=>e.id).join(',');
    try{await s.act(a);failures=0}
    catch(e){step.error=clip(String(e.message||e).split('\n')[0],160);failures++}
    o=await s.observe();
    if(o.sent)step.sent=true;
    const after=fingerprint(o);
    if(!step.error&&after===before&&['click','key','select','hover','go_to'].includes(a.action))step.no_change=true;
    const key=before+'|'+a.action+'|'+(a.target??'')+'|'+a.value;
    seen.set(key,(seen.get(key)||0)+1);
    if(seen.get(key)>=3)nudge='You have done "'+a.action+(el?' '+el.label:'')+'" three times on this same screen and nothing changed. Try a different way'+(mode==='persona'?', or give up if a real person would.':', or give up.');
    // A new page, or elements appeared or went away: the rest of the batch was planned for the
    // old screen. (Typing into a field changes only its value; the batch goes on.)
    if(step.error||o.path+'|'+o.elements.map(e=>e.id).join(',')!==layout)break;
   }
   if(finished)break;
   if(failures>=3&&!nudge)nudge='Your last '+failures+' actions failed. Step back and try another approach.';
   if(failures>=5){error='Too many failed actions';break}
  }
  if(!answer&&outcome==='stuck'&&mode==='task')answer=memory;
 }catch(e){outcome='error';error=clip(e.message||e,300)}
 const end=await s.observe().catch(()=>null);
 if(!error&&end&&end.errors&&end.errors.length)error=end.errors[0];
 return{outcome,steps,answer,memory,...(verdict?{verdict}:{}),...(error?{error}:{})};
}
module.exports={run,describe,plan,judge,fingerprint,blockedPage,systemPrompt};
