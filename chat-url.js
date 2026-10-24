"use strict";
// Accept explicit public HTTPS links and pasted bare public domains in main chat.
// Never turn localhost, numeric addresses, credentials or arbitrary schemes into browser targets.
const IPV4=/^\d{1,3}(?:\.\d{1,3}){3}$/;
function extractWebsite(text){
 const input=String(text||"").replace(/\\\./g,".");
 if(/\bhttp:\/\//i.test(input))return null;
 const candidates=input.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[\w\-./?%=&+#]*)?/ig)||[];
 for(let value of candidates){
  value=value.replace(/[.,;!?)}\]]+$/,"");
  if(!/^https?:\/\//i.test(value))value="https://"+value;
  try{
   const url=new URL(value),host=url.hostname.toLowerCase();
   if(url.protocol!=="https:"||url.username||url.password||url.port&&url.port!=="443")continue;
   if(host==="localhost"||host.endsWith(".local")||host.endsWith(".internal")||IPV4.test(host)||host.includes(":"))continue;
   const tld=host.split(".").at(-1);
   if(!/^[a-z]{2,24}$/.test(tld))continue;
   return url.href;
  }catch{}
 }
 return null;
}
module.exports={extractWebsite};
