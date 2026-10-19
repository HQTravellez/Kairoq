"use strict";
// Invite a friend, built into every Kairoq app. Each signed-in user has a personal code; a
// visitor who opens the app with ?ref=CODE and then creates an account (email or Google) is
// counted for the inviter. The app shows it with referrals.mine() from the kairoq module; the
// owner sees the totals and the top inviters in the Grow panel. Rewards are the owner's choice
// (the app says what they are); Kairoq only keeps the count honest.
const crypto=require('crypto');
const CLAIM_WINDOW_MS=30*60000;
function migrate(db){
 db.exec(`CREATE TABLE IF NOT EXISTS referral_codes(user_id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS referral_joins(user_id TEXT PRIMARY KEY,referrer_id TEXT NOT NULL,at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS referral_joins_referrer ON referral_joins(referrer_id);`);
}
const ALPHABET='abcdefghjkmnpqrstuvwxyz23456789';
function newCode(){let s='';for(const b of crypto.randomBytes(8))s+=ALPHABET[b%ALPHABET.length];return s}
function codeFor(db,userId){
 migrate(db);
 const row=db.prepare('SELECT code FROM referral_codes WHERE user_id=?').get(userId);
 if(row)return row.code;
 for(let i=0;i<5;i++){const code=newCode();try{db.prepare('INSERT INTO referral_codes(user_id,code,created_at) VALUES(?,?,?)').run(userId,code,new Date().toISOString());return code}catch{}}
 throw Object.assign(Error('Could not create an invite code'),{status:500});
}
// Credits a new account to its inviter: once, never to yourself, and only for accounts made in
// the last 30 minutes (an existing user cannot be claimed later by someone's link).
function claim(db,userId,code){
 migrate(db);
 const c=String(code||'').trim().toLowerCase();
 if(!/^[a-z0-9]{6,16}$/.test(c))return false;
 const ref=db.prepare('SELECT user_id FROM referral_codes WHERE code=?').get(c);
 if(!ref||ref.user_id===userId)return false;
 const user=db.prepare('SELECT created_at FROM users WHERE id=?').get(userId);
 if(!user||Date.now()-Date.parse(user.created_at)>CLAIM_WINDOW_MS)return false;
 try{db.prepare('INSERT INTO referral_joins(user_id,referrer_id,at) VALUES(?,?,?)').run(userId,ref.user_id,new Date().toISOString());return true}catch{return false}
}
// For the signed-in user: their code, and who joined through it (first names only).
function mine(db,userId){
 const code=codeFor(db,userId);
 const joined=db.prepare('SELECT COUNT(*) n FROM referral_joins WHERE referrer_id=?').get(userId).n;
 const people=db.prepare('SELECT u.name,j.at FROM referral_joins j LEFT JOIN users u ON u.id=j.user_id WHERE j.referrer_id=? ORDER BY j.at DESC LIMIT 50').all(userId);
 return{code,joined,people:people.map(p=>({name:p.name?String(p.name).trim().split(/\s+/)[0].slice(0,40):'A friend',joined_at:p.at}))};
}
// For the owner: how many accounts came from invites, and the top inviters.
function stats(db){
 migrate(db);
 const joined=db.prepare('SELECT COUNT(*) n FROM referral_joins').get().n;
 const users=db.prepare('SELECT COUNT(*) n FROM users').get().n;
 const top=db.prepare('SELECT u.email,u.name,COUNT(*) n FROM referral_joins j JOIN users u ON u.id=j.referrer_id GROUP BY j.referrer_id ORDER BY n DESC LIMIT 5').all();
 return{joined,users,top:top.map(t=>({email:t.email,name:t.name||'',invited:t.n}))};
}
module.exports={migrate,codeFor,claim,mine,stats,CLAIM_WINDOW_MS};
