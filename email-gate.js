"use strict";
// The last check before an email Kairoq writes for an owner leaves: rules in code, no AI, so a bad
// draft can never reach a person. A failure blocks the send and says why. Adapted from the
// pre-send gate of Harvey by Ethan Rogers (MIT), rewritten for Kairoq.
const BANNED=[
 'act now','buy now','click here','click below','limited time','limited offer','exclusive deal','special offer','risk-free','risk free',
 'no obligation','100% free','make money','double your','guaranteed results','winner','congratulations',
 'i hope this finds you well','hope this email finds you well','i hope this email finds you','picture this','what if i told you',
 "in today's fast-paced world",'game-changer','game changer','cutting-edge solution','revolutionize your','unlock your','supercharge your',
 'as an ai','as a language model',"i'm an ai",'i am an ai'
];
const MAX_SUBJECT=90,MAX_WORDS=220,MAX_LINKS=2;
const EMAIL=/^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
function validEmail(e){return EMAIL.test(String(e||'').trim())&&!/\.(png|jpe?g|gif|webp|svg)$/i.test(String(e))}
// Checks one email. footer: the lines a cold email must carry (who sends it, the postal address,
// how to opt out). Returns {ok, reasons:[...]}.
function check({to,subject,text},{expectedTo,suppressed=[],footer={}}={}){
 const reasons=[],s=String(subject||''),t=String(text||''),all=(s+'\n'+t).toLowerCase();
 if(!validEmail(to))reasons.push('The address "'+String(to||'').slice(0,80)+'" is not a valid email address.');
 if(expectedTo&&String(to).trim().toLowerCase()!==String(expectedTo).trim().toLowerCase())reasons.push('The address does not match the lead it was written for.');
 if(suppressed.map(x=>String(x).toLowerCase()).includes(String(to||'').trim().toLowerCase()))reasons.push('This address asked not to be emailed again, or bounced.');
 if(!s.trim())reasons.push('The subject is empty.');
 if(s.length>MAX_SUBJECT)reasons.push('The subject is longer than '+MAX_SUBJECT+' characters.');
 if(/^\s*(re|fw|fwd)\s*:/i.test(s))reasons.push('The subject pretends to be a reply or forward ("Re:" / "Fwd:").');
 const words=t.split(/\s+/).filter(Boolean).length;
 if(!words)reasons.push('The email is empty.');
 if(words>MAX_WORDS)reasons.push('The email is '+words+' words; keep it under '+MAX_WORDS+'.');
 if(/\{\{?\s*[\w.-]+\s*\}?\}|\[(first ?name|name|company|business|city|your name|sender)\]|<<\s*\w+\s*>>|%\w+%/i.test(s+'\n'+t))reasons.push('It still has an unfilled placeholder such as {name} or [Company].');
 if(/<\/?(p|div|br|a|span|table|img|html|body)\b[^>]*>/i.test(t))reasons.push('It contains HTML; cold emails are sent as plain text.');
 const links=(t.match(/https?:\/\/\S+/gi)||[]).length;
 if(links>MAX_LINKS)reasons.push('It has '+links+' links; at most '+MAX_LINKS+'.');
 for(const p of BANNED)if(all.includes(p)){reasons.push('It uses the phrase "'+p+'", which spam filters and readers distrust.');break}
 if(footer.address&&!t.includes(String(footer.address).trim().split('\n')[0].trim()))reasons.push('The sender\'s postal address is missing from the email.');
 if(!/\b(unsubscribe|opt out|not interested|stop|no longer|won't (email|contact) you again|will not (email|contact) you again)\b/i.test(t))reasons.push('There is no way to opt out (for example: reply "stop" and we will not email you again).');
 if(footer.sender&&!t.toLowerCase().includes(String(footer.sender).trim().toLowerCase()))reasons.push('The email does not say who sends it.');
 return{ok:!reasons.length,reasons};
}
module.exports={check,validEmail,BANNED,MAX_SUBJECT,MAX_WORDS,MAX_LINKS};
