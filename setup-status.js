"use strict";
// The owner's setup checklist on the home screen: what this server has, and for anything
// missing, where to fix it. Values are never shown; settings are added in Railway (service,
// Variables), never pasted into a chat.
function items({env=process.env}={}){
 const accounts=require('./builder-accounts');
 const experiential=Boolean(env.EXPLABS_API_KEY||env.EXPlabs_API_Key)&&String(env.KAIROQ_BUILDER_PROVIDER||'').toLowerCase()!=='openrouter';
 const ai=Boolean(env.OPENROUTER_API_KEY)||experiential;
 const list=[
  {id:'storage',label:'Data survives deploys',ok:require('./storage').status({env}).persistent,required:true,fix:'In Railway open the service, Settings, Volumes, Add volume with mount path /data, then redeploy.'},
  {id:'ai',label:'AI building',ok:ai,required:true,fix:'Add OPENROUTER_API_KEY in Railway (service, Variables) with a key from openrouter.ai.'},
  // Free-first (the default) tries free models before the paid ones: slower builds, weaker
  // results, and no fast lane for small edits.
  experiential?{id:'paid',label:'Apps are written by Experiential Labs',ok:true,required:false,fix:''}:{id:'paid',label:'Fast, strong AI models for every build',ok:ai&&env.KAIROQ_BUILDER_PAID_APPROVED==='true'&&['paid-first','premium'].includes(String(env.KAIROQ_BUILDER_MODE||'free-first').toLowerCase()),required:true,fix:'In Railway (service, Variables) set KAIROQ_BUILDER_MODE=paid-first and KAIROQ_BUILDER_PAID_APPROVED=true. Without them builds try free models first: slower, weaker, and small edits do not use the fast lane.'},
  {id:'email',label:'Emails (password reset, sign-up)',ok:accounts.mailReady(),required:true,fix:'Add KAIROQ_RESEND_API_KEY (from resend.com) and KAIROQ_EMAIL_FROM (an address on your verified domain) in Railway (service, Variables).'},
  {id:'browser',label:'Kairoq tests every build in a browser',ok:require('./runtime-check').available(),required:true,fix:'Deploy with the Dockerfile in this repository, which installs Chromium.'},
  {id:'payments',label:'Customers can buy credits',ok:accounts.stripeReady(),required:false,fix:'Add KAIROQ_STRIPE_SECRET_KEY in Railway (service, Variables) to sell credits with Stripe.'},
  {id:'google',label:'Sign in with Google',ok:require('./google-oauth').configured(),required:false,fix:'Add KAIROQ_GOOGLE_CLIENT_ID and KAIROQ_GOOGLE_CLIENT_SECRET in Railway (service, Variables).'},
 ];
 return{items:list,done:list.filter(i=>i.ok).length,total:list.length,missing_required:list.filter(i=>i.required&&!i.ok).length};
}
module.exports={items};
