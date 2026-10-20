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
  {id:'database',label:'Accounts and app data in Postgres',ok:Boolean(env.DATABASE_URL)&&env.KAIROQ_POSTGRES!=='off',required:false,fix:'In Railway add a PostgreSQL database to the project, then in the Kairoq service Variables add DATABASE_URL with the value ${{Postgres.DATABASE_URL}} and redeploy. Existing data is copied across on the first start.'},
  {id:'ai',label:'AI building',ok:ai,required:true,fix:'Add OPENROUTER_API_KEY in Railway (service, Variables) with a key from openrouter.ai.'},
  // Free-first (the default) tries free models before the paid ones: slower builds, weaker
  // results, and no fast lane for small edits.
  experiential?{id:'paid',label:'Apps are written by Experiential Labs',ok:true,required:false,fix:''}:{id:'paid',label:'Fast, strong AI models for every build',ok:ai&&env.KAIROQ_BUILDER_PAID_APPROVED==='true'&&['paid-first','premium'].includes(String(env.KAIROQ_BUILDER_MODE||'free-first').toLowerCase()),required:true,fix:'In Railway (service, Variables) set KAIROQ_BUILDER_MODE=paid-first and KAIROQ_BUILDER_PAID_APPROVED=true. Without them builds try free models first: slower, weaker, and small edits do not use the fast lane.'},
  {id:'email',label:'Emails (password reset, sign-up)',ok:accounts.mailReady(),required:true,fix:'Add KAIROQ_RESEND_API_KEY (from resend.com) and KAIROQ_EMAIL_FROM (an address on your verified domain) in Railway (service, Variables).'},
  {id:'browser',label:'Kairoq tests every build in a browser',ok:require('./runtime-check').available(),required:true,fix:'Deploy with the Dockerfile in this repository, which installs Chromium.'},
  {id:'payments',label:'Customers can buy credits',ok:accounts.stripeReady(),required:false,fix:'Add KAIROQ_STRIPE_SECRET_KEY in Railway (service, Variables) to sell credits with Stripe.'},
  {id:'videos',label:'Launch and hero videos from your photos',ok:require('./video-gen').configured(env),required:false,fix:'Add FAL_KEY in Railway (service, Variables) with a key from fal.ai. Videos are made with Wan 2.2; each clip costs KAIROQ_VIDEO_CREDITS credits (10 unless you set it).'},
  {id:'google',label:'Sign in with Google',ok:require('./google-oauth').configured(),required:false,fix:'Add KAIROQ_GOOGLE_CLIENT_ID and KAIROQ_GOOGLE_CLIENT_SECRET in Railway (service, Variables).'},
 ];
 // Only when the owner chose OpenCode as the build engine: whether it is installed and has a model.
 if(String(env.KAIROQ_BUILD_ENGINE||'').toLowerCase()==='opencode')list.push({id:'engine',label:'OpenCode writes the apps',ok:require('./opencode-engine').enabled(),required:false,fix:'In Railway add the variable KAIROQ_OPENCODE=on (it installs OpenCode when the app is built) and redeploy; OpenCode uses the same AI key as the builder.'});
 // Only when the owner switched on the fast browser lane: whether Lightpanda got installed.
 if(String(env.KAIROQ_LIGHTPANDA||'').toLowerCase()==='on')list.push({id:'fastlane',label:'Fast browser checks (Lightpanda)',ok:require('./runtime-check').fastStats().installed,required:false,fix:'Keep the Railway variable KAIROQ_LIGHTPANDA=on and redeploy: the Dockerfile installs Lightpanda when the app is built.'});
 return{items:list,done:list.filter(i=>i.ok).length,total:list.length,missing_required:list.filter(i=>i.required&&!i.ok).length};
}
module.exports={items};
