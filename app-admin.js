"use strict";
// The app owner's admin view inside their own app (for its managers, react-backend.js isManager):
// who signed up, who pays, credits left and used, and a way to give a customer credits.
const crypto=require("crypto");
const credits=require("./app-credits");

const MAX_USERS=200,DAY=86400000;
function fail(status,message){return Object.assign(Error(message),{status})}
function since(days){return new Date(Date.now()-days*DAY).toISOString()}
function count(db,sql,...args){return Number(db.prepare(sql).get(...args).n)||0}

function overview(db,cfg,{q}={}){
 const search=String(q||"").trim().toLowerCase().slice(0,100);
 const users=db.prepare("SELECT id,email,name,created_at FROM users"+(search?" WHERE LOWER(email) LIKE ? OR LOWER(COALESCE(name,'')) LIKE ?":"")+" ORDER BY created_at DESC LIMIT ?")
  .all(...(search?["%"+search+"%","%"+search+"%"]:[]),MAX_USERS);
 const plans=new Map();
 for(const p of db.prepare("SELECT user_id,product FROM payments WHERE mode='subscription' AND status='active'").all()){
  if(!plans.has(p.user_id))plans.set(p.user_id,[]);
  if(!plans.get(p.user_id).includes(p.product))plans.get(p.user_id).push(p.product);
 }
 const teams=new Map(db.prepare("SELECT user_id,COUNT(*) n FROM team_members GROUP BY user_id").all().map(r=>[r.user_id,Number(r.n)]));
 const people=users.map(u=>({id:u.id,email:u.email,name:u.name||null,joined:u.created_at,plans:plans.get(u.id)||[],teams:teams.get(u.id)||0,
  ...(cfg.credits?{credits:credits.balance(db,cfg,u.id)}:{})}));
 const month=since(30);
 const stats={
  users:count(db,"SELECT COUNT(*) n FROM users"),
  new_this_month:count(db,"SELECT COUNT(*) n FROM users WHERE created_at>=?",month),
  paying:count(db,"SELECT COUNT(DISTINCT user_id) n FROM payments WHERE status='active'"),
  subscriptions:count(db,"SELECT COUNT(*) n FROM payments WHERE mode='subscription' AND status='active'"),
  teams:count(db,"SELECT COUNT(*) n FROM teams")
 };
 if(cfg.credits){
  // Credits used: spends minus the refunds of failed requests.
  const used=-count(db,"SELECT COALESCE(SUM(delta),0) n FROM app_credits WHERE ref LIKE 'use:%' AND created_at>=?",month)
   -count(db,"SELECT COALESCE(SUM(delta),0) n FROM app_credits WHERE ref LIKE 'refund:%' AND created_at>=?",month);
  stats.credits_used_this_month=Math.max(0,used);
  stats.ai_requests_this_month=Math.max(0,count(db,"SELECT COUNT(*) n FROM app_credits WHERE ref LIKE 'use:%' AND created_at>=?",month)-count(db,"SELECT COUNT(*) n FROM app_credits WHERE ref LIKE 'refund:%' AND created_at>=?",month));
 }
 const payments=db.prepare("SELECT p.product,p.mode,p.status,p.amount,p.currency,p.created_at,u.email FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 20").all()
  .map(p=>({...p,amount:p.amount==null?null:Number(p.amount)}));
 return{stats,users:people,payments,credits_on:Boolean(cfg.credits),more:users.length>=MAX_USERS};
}

// A manager gives a customer credits (a refund, a goodwill gesture, a trial extension).
function giveCredits(db,cfg,manager,body){
 if(!cfg.credits)throw fail(404,'Credits are not enabled. Add "credits" to src/backend.json.');
 const user=db.prepare("SELECT id,email FROM users WHERE id=?").get(String(body.user_id||""));
 if(!user)throw fail(404,"Customer not found");
 const amount=Number(body.amount);
 const note=String(body.note||"").trim().slice(0,120);
 credits.grant(db,user.id,amount,"admin:"+crypto.randomUUID(),"Given by "+manager.email+(note?": "+note:""));
 return{user_id:user.id,balance:credits.balance(db,cfg,user.id)};
}

module.exports={overview,giveCredits};
