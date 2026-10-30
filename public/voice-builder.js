'use strict';
document.getElementById('voice-insert').addEventListener('click',()=>{
 const input=document.getElementById('chat-input');
 try{
  const draft=JSON.parse(localStorage.getItem('kairoq-voice-draft')||'null');
  if(!draft||typeof draft.text!=='string'||!draft.text.trim()||draft.text.length>12000||Date.now()-draft.at>3600000){document.getElementById('chat-error').textContent='Transcribe a recording in Voice studio and send it to the builder first.';return;}
  input.value=[input.value.trim(),draft.text.trim()].filter(Boolean).join('\n\n');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();document.getElementById('menu-plus').open=false;localStorage.removeItem('kairoq-voice-draft');
 }catch{document.getElementById('chat-error').textContent='Could not insert the transcript. Please copy it from Voice studio.';}
});
