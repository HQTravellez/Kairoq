"use strict";
// Credits for an app's own customers, so a SaaS built in Kairoq can charge for AI use.
// Turned on in src/backend.json:
//   "credits": { "free": 20, "ai_cost": 1 }
//   "payments": { "products": {
//     "credits_100": { "price": "price_...", "mode": "payment", "credits": 100 },        one-time pack
//     "pro":         { "price": "price_...", "mode": "subscription", "credits": 500 } } } every month
// New customers get "free" credits once. Each AI request a signed-in customer makes (ai.chat,
// ai.ask, ai.extract, and AI used by a server function they call) costs "ai_cost" credits; a
// failed request is refunded. A paid checkout adds its product's credits once, and each paid
// subscription renewal (Stripe invoice.paid) adds them again.
// The ledger is append-only: every change is a row with a unique ref, so a replayed Stripe
// webhook or a double click can never add or take credits twice. The balance is the sum.
const crypto=require("crypto");

const MAX_FREE=100000,MAX_COST=1000,MAX_PACK=1000000,HISTORY=20;
function fail(status,message){return Object.assign(Error(message),{status})}
function whole(v,min,max){return Number.isInteger(v)&&v>=min&&v<=max}

function normalize(raw){
 if(raw===undefined)return undefined;
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error('"credits" must be an object like {"free":20,"ai_cost":1}.');
 const free=raw.free===undefined?0:raw.free,cost=raw.ai_cost===undefined?1:raw.ai_cost;
 if(!whole(free,0,MAX_FREE))throw Error('"credits.free" must be a whole number from 0 to '+MAX_FREE+'.');
 if(!whole(cost,1,MAX_COST))throw Error('"credits.ai_cost" must be a whole number from 1 to '+MAX_COST+'.');
 return{free,ai_cost:cost};
}
// A payments product may add credits: {"price":"price_...","credits":100}.
function productCredits(p,name){
 if(p.credits===undefined)return undefined;
 if(!whole(p.credits,1,MAX_PACK))throw Error('Payment product "'+name+'" credits must be a whole number from 1 to '+MAX_PACK+'.');
 return p.credits;
}
function check(cfg){
 const packs=Object.entries(cfg.payments?.products||{}).filter(([,p])=>p.credits);
 if(packs.length&&!cfg.credits)throw Error('Payment products with "credits" need "credits": {"free":0,"ai_cost":1} in src/backend.json.');
}

function migrate(db){
 db.exec(`CREATE TABLE IF NOT EXISTS app_credits(ref TEXT PRIMARY KEY,user_id TEXT NOT NULL,delta INTEGER NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS app_credits_user ON app_credits(user_id,created_at);`);
}
// Adds one ledger row; false when that ref was already recorded.
function add(db,userId,delta,ref,reason){
 return db.prepare("INSERT OR IGNORE INTO app_credits(ref,user_id,delta,reason,created_at) VALUES(?,?,?,?,?)")
  .run(String(ref),String(userId),delta,String(reason).slice(0,200),new Date().toISOString()).changes>0;
}
function sum(db,userId){return Number(db.prepare("SELECT COALESCE(SUM(delta),0) n FROM app_credits WHERE user_id=?").get(String(userId)).n)||0}
// The free credits are added the first time the balance is needed, once per customer.
function balance(db,cfg,userId){
 if(cfg.credits?.free)add(db,userId,cfg.credits.free,"free:"+userId,"Welcome credits");
 return sum(db,userId);
}
function grant(db,userId,amount,ref,reason){
 if(!whole(amount,1,MAX_PACK))throw fail(400,"Credits must be a whole number from 1 to "+MAX_PACK);
 return add(db,userId,amount,ref,reason);
}
// Takes credits before the work runs. Returns a receipt for refund() if the work fails.
function spend(db,cfg,user,amount,reason){
 if(!user)throw fail(401,"Sign in to use this");
 if(balance(db,cfg,user.id)<amount)throw fail(402,"You are out of credits. Buy more to keep going.");
 const ref="use:"+crypto.randomUUID();
 add(db,user.id,-amount,ref,reason);
 return{ref,user_id:user.id,amount};
}
function refund(db,receipt){if(receipt)add(db,receipt.user_id,receipt.amount,"refund:"+receipt.ref,"Refund: the request failed")}
// Runs work that costs credits, refunding them when it throws.
async function charged(db,cfg,user,reason,work){
 if(!cfg.credits)return work();
 const receipt=spend(db,cfg,user,cfg.credits.ai_cost,reason);
 try{return await work()}catch(e){refund(db,receipt);throw e}
}

// What the signed-in customer sees: balance, the cost of an AI request, what they can buy, recent history.
function mine(db,cfg,user){
 if(!cfg.credits)throw fail(404,'Credits are not enabled. Add "credits" to src/backend.json.');
 if(!user)throw fail(401,"Sign in to see your credits");
 const bal=balance(db,cfg,user.id);
 const packs=Object.entries(cfg.payments?.products||{}).filter(([,p])=>p.credits).map(([product,p])=>({product,credits:p.credits,mode:p.mode}));
 const history=db.prepare("SELECT delta,reason,created_at FROM app_credits WHERE user_id=? ORDER BY created_at DESC LIMIT ?").all(user.id,HISTORY).map(r=>({change:Number(r.delta),reason:r.reason,at:r.created_at}));
 return{balance:bal,ai_cost:cfg.credits.ai_cost,packs,history};
}

// Stripe: a paid checkout adds the product's credits once (ref = the checkout session).
function fromCheckout(db,cfg,session){
 const p=cfg.payments?.products?.[session.metadata?.product];
 if(!cfg.credits||!p?.credits||!session.metadata?.user_id)return false;
 return add(db,session.metadata.user_id,p.credits,"stripe:"+session.id,(session.metadata.product)+" purchase");
}
// Stripe: each renewal invoice of a subscription adds its credits again (ref = the invoice).
// The first invoice is skipped: its checkout already added them.
function fromInvoice(db,cfg,invoice){
 if(!cfg.credits||invoice.billing_reason!=="subscription_cycle"||invoice.status!=="paid")return false;
 const sub=typeof invoice.subscription==="string"?invoice.subscription:invoice.subscription?.id||invoice.parent?.subscription_details?.subscription;
 if(!sub)return false;
 const row=db.prepare("SELECT user_id,product FROM payments WHERE subscription_id=? AND status='active'").get(String(sub));
 const p=row&&cfg.payments?.products?.[row.product];
 if(!p?.credits)return false;
 return add(db,row.user_id,p.credits,"stripe:"+invoice.id,row.product+" renewal");
}

module.exports={normalize,productCredits,check,migrate,balance,grant,spend,refund,charged,mine,fromCheckout,fromInvoice};
