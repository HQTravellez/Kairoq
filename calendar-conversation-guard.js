"use strict";
/** Deterministic conversation repair for calendar-connection follow-ups.
 * Never claim an integration exists when no calendar connector is configured.
 */
function respond(message,history=[]){
 const text=String(message||'').trim();
 const previous=(Array.isArray(history)?history:[]).slice(-8).map(m=>String(m.text||'')).join(" ").toLowerCase();
 const calendarContext=/\b(calendar|meeting brief|scheduled meetings|google calendar|outlook)\b/.test(previous);
 const askingToConnect=/\b(connect|link|integrat|authoriz|give (you|kairoq) access|permission|sync)\b/i.test(text);
 if(calendarContext&&askingToConnect&&/\b(you|calendar|google|outlook|it|account|this)\b/i.test(text)){
  return "You mean connecting your calendar to Kairoq so I can check your meetings. Kairoq does not currently have a verified calendar-reading connection in this chat, so I cannot see tomorrow's events. A real integration needs a Google Calendar or Microsoft Outlook OAuth connection, your permission to read calendar events, and a working calendar-reading tool. I won't pretend that chatting here grants access. Until that integration is available, you can paste an agenda or event list and I'll prepare the brief.";
 }
 if(/\b(check|review|look at|what's on|brief).{0,60}\b(calendar|meetings|schedule)\b/i.test(text) && !/build|create (a|the) (calendar|app)/i.test(text)){
  return "I can prepare a meeting brief, but this Kairoq chat has no verified calendar-reading tool connected. I cannot access or infer your scheduled events. Connect a supported calendar integration with read permission when Kairoq offers one, or paste tomorrow's schedule here and I'll create the brief.";
 }
 return null;
}
module.exports={respond};
