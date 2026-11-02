"use strict";
// Teams for Create apps (B2B SaaS workspaces): a customer creates a team, invites colleagues with
// a link, and everyone in the team shares the records of "team" collections.
// Roles: owner (everything, the only one who makes admins), admin (invites and manages members),
// member (reads and writes team records), viewer (reads only).
// Invites are single-use links that expire after 7 days. App sign-up does not prove that someone
// owns an email address, so membership is never granted by email address alone.
// The app sends the team it is working in as the X-Kairoq-Team header (teams.use(id) in the client).
const crypto=require("crypto");

const ROLES=["owner","admin","member","viewer"],WRITERS=["owner","admin","member"],MANAGERS=["owner","admin"];
const INVITE_DAYS=7,MAX_TEAMS_PER_USER=20,MAX_MEMBERS=200;
function fail(status,message){return Object.assign(Error(message),{status})}
function hash(t){return crypto.createHash("sha256").update(String(t)).digest("hex")}
const ID=/^[a-f0-9-]{36}$/;

function migrate(db){
 db.exec(`CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS team_members(team_id TEXT NOT NULL,user_id TEXT NOT NULL,role TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(team_id,user_id));
  CREATE INDEX IF NOT EXISTS team_members_user ON team_members(user_id);
  CREATE TABLE IF NOT EXISTS team_invites(code_hash TEXT PRIMARY KEY,team_id TEXT NOT NULL,role TEXT NOT NULL,created_by TEXT NOT NULL,expires_at INTEGER NOT NULL);`);
 // Records of "team" collections belong to a team.
 try{db.exec("ALTER TABLE records ADD COLUMN team_id TEXT")}catch{}
 try{db.exec("CREATE INDEX IF NOT EXISTS records_team ON records(collection,team_id)")}catch{}
}

function membership(db,teamId,userId){return db.prepare("SELECT role FROM team_members WHERE team_id=? AND user_id=?").get(String(teamId),String(userId))}
// The team a request works in, checked against the signed-in user's memberships.
function context(db,req,user){
 if(!user)throw fail(401,"Sign in first");
 const team=String(req.headers["x-kairoq-team"]||"");
 if(!team)throw fail(409,"Choose a team first");
 const m=ID.test(team)&&membership(db,team,user.id);
 if(!m)throw fail(404,"Team not found");
 return{team,role:m.role};
}
function canWrite(ctx){return WRITERS.includes(ctx.role)}
function needWrite(ctx){if(!canWrite(ctx))throw fail(403,"Viewers can look but not change anything in this team")}

function cleanName(v){const n=String(v||"").trim();if(!n||n.length>80)throw fail(400,"Give the team a name (up to 80 characters)");return n}
function teamOf(db,id,user,need=ROLES){
 if(!ID.test(String(id)))throw fail(404,"Team not found");
 const m=membership(db,id,user.id);
 if(!m)throw fail(404,"Team not found");
 if(!need.includes(m.role))throw fail(403,"Only the team's owner or admins can do that");
 return m.role;
}
function owners(db,team){return Number(db.prepare("SELECT COUNT(*) n FROM team_members WHERE team_id=? AND role='owner'").get(team).n)}

// /teams routes. Returns the response body, or undefined when the route is not a team route.
function route(db,user,route,method,body={}){
 if(!route.startsWith("/teams"))return undefined;
 if(!user)throw fail(401,"Sign in first");
 if(route==="/teams"&&method==="GET")
  return{teams:db.prepare("SELECT t.id,t.name,t.created_at,m.role FROM teams t JOIN team_members m ON m.team_id=t.id WHERE m.user_id=? ORDER BY t.created_at").all(user.id)};
 if(route==="/teams"&&method==="POST"){
  const name=cleanName(body.name);
  if(Number(db.prepare("SELECT COUNT(*) n FROM team_members WHERE user_id=?").get(user.id).n)>=MAX_TEAMS_PER_USER)throw fail(403,"You are in the most teams allowed");
  const id=crypto.randomUUID(),at=new Date().toISOString();
  db.prepare("INSERT INTO teams(id,name,created_at) VALUES(?,?,?)").run(id,name,at);
  db.prepare("INSERT INTO team_members(team_id,user_id,role,created_at) VALUES(?,?,?,?)").run(id,user.id,"owner",at);
  return{team:{id,name,created_at:at,role:"owner"}};
 }
 if(route==="/teams/join"&&method==="POST"){
  const inv=db.prepare("SELECT * FROM team_invites WHERE code_hash=?").get(hash(String(body.code||"")));
  if(!inv||inv.expires_at<Date.now())throw fail(400,"This invite link has expired or was already used. Ask for a new one.");
  db.prepare("DELETE FROM team_invites WHERE code_hash=?").run(inv.code_hash);
  const team=db.prepare("SELECT id,name,created_at FROM teams WHERE id=?").get(inv.team_id);
  if(!team)throw fail(404,"Team not found");
  const had=membership(db,team.id,user.id);
  if(!had){
   if(Number(db.prepare("SELECT COUNT(*) n FROM team_members WHERE team_id=?").get(team.id).n)>=MAX_MEMBERS)throw fail(403,"This team is full");
   db.prepare("INSERT INTO team_members(team_id,user_id,role,created_at) VALUES(?,?,?,?)").run(team.id,user.id,inv.role,new Date().toISOString());
  }
  return{team:{...team,role:had?had.role:inv.role}};
 }
 const m=/^\/teams\/([a-f0-9-]{36})(?:\/(members|invites)(?:\/([a-f0-9-]{36}))?)?$/.exec(route);
 if(!m)throw fail(404,"Unknown team route");
 const [,team,part,target]=m;
 if(!part&&method==="PATCH"){teamOf(db,team,user,MANAGERS);db.prepare("UPDATE teams SET name=? WHERE id=?").run(cleanName(body.name),team);return{ok:true}}
 if(!part&&method==="DELETE"){teamOf(db,team,user,["owner"]);
  db.prepare("DELETE FROM records WHERE team_id=?").run(team);db.prepare("DELETE FROM team_invites WHERE team_id=?").run(team);
  db.prepare("DELETE FROM team_members WHERE team_id=?").run(team);db.prepare("DELETE FROM teams WHERE id=?").run(team);return{deleted:team}}
 if(part==="members"&&!target&&method==="GET"){
  teamOf(db,team,user);
  return{members:db.prepare("SELECT m.user_id,m.role,m.created_at,u.email,u.name FROM team_members m JOIN users u ON u.id=m.user_id WHERE m.team_id=? ORDER BY m.created_at").all(team)};
 }
 if(part==="invites"&&!target&&method==="POST"){
  const mine=teamOf(db,team,user,MANAGERS),role=body.role||"member";
  if(!["admin","member","viewer"].includes(role))throw fail(400,"Invite as admin, member or viewer");
  if(role==="admin"&&mine!=="owner")throw fail(403,"Only the team's owner can invite admins");
  const code=crypto.randomBytes(18).toString("base64url");
  db.prepare("INSERT INTO team_invites(code_hash,team_id,role,created_by,expires_at) VALUES(?,?,?,?,?)").run(hash(code),team,role,user.id,Date.now()+INVITE_DAYS*86400000);
  return{code,role,expires_in_days:INVITE_DAYS};
 }
 if(part==="members"&&target){
  const mine=teamOf(db,team,user),old=membership(db,team,target);
  if(!old)throw fail(404,"Member not found");
  if(method==="DELETE"){
   const self=target===user.id;
   if(!self&&!MANAGERS.includes(mine))throw fail(403,"Only the team's owner or admins can remove people");
   if(!self&&(old.role==="owner"||(mine==="admin"&&old.role==="admin")))throw fail(403,"Only the owner can remove an admin, and nobody can remove the owner");
   if(old.role==="owner"&&owners(db,team)<=1)throw fail(409,"Make someone else the owner before leaving, or delete the team");
   db.prepare("DELETE FROM team_members WHERE team_id=? AND user_id=?").run(team,target);return{removed:target};
  }
  if(method==="PATCH"){
   const role=String(body.role||"");
   if(!ROLES.includes(role))throw fail(400,"Role must be owner, admin, member or viewer");
   if(mine!=="owner"&&(role==="owner"||role==="admin"||old.role==="admin"||old.role==="owner"))throw fail(403,"Only the team's owner can change owners and admins");
   if(!MANAGERS.includes(mine))throw fail(403,"Only the team's owner or admins can change roles");
   if(old.role==="owner"&&role!=="owner"&&owners(db,team)<=1)throw fail(409,"A team needs at least one owner");
   db.prepare("UPDATE team_members SET role=? WHERE team_id=? AND user_id=?").run(role,team,target);return{user_id:target,role};
  }
 }
 throw fail(405,"Method not allowed");
}

module.exports={ROLES,WRITERS,migrate,context,canWrite,needWrite,membership,route};
