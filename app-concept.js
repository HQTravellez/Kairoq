'use strict';
// Derive intent from durable owner history; never treat an intention as shipped behavior.
function note(meta) {
 const messages=(meta.messages||[]).filter(m=>m.role==='user'&&typeof m.text==='string');
 const first=messages.find(m=>m.mode!=='discuss')||messages[0];
 if(!first)return '';
 return '\nAPP CONCEPT (owner intent, not implementation evidence): '+JSON.stringify({name:meta.name,
  originalBrief:first.text.slice(0,1800),recentDirections:messages.slice(-3).map(m=>m.text.slice(0,350))})+
  '\nUnderstand the target users and main journey from this brief. Use it to choose sensible details within the requested scope. Offer up to three useful, specific next-step suggestions when relevant, explain their benefit, and label them as proposals. Verify implementation against current source and browser tests. Do not invent business facts or claim suggested features exist.';
}
module.exports={note};
