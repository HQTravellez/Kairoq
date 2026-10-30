"use strict";
const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const HOME=__dirname, PORT=Number(process.env.PORT||4177);
const DB=path.resolve(process.env.RESTAURANT_DB||path.join(HOME,".test-reservations.json"));
const slots=["17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"];
function read(){try{const v=JSON.parse(fs.readFileSync(DB,"utf8"));return Array.isArray(v)?v:[]}catch(e){if(e.code==="ENOENT")return[];throw e}}
function save(rows){fs.mkdirSync(path.dirname(DB),{recursive:true});const tmp=DB+"."+process.pid+"."+crypto.randomBytes(4).toString("hex")+".tmp";fs.writeFileSync(tmp,JSON.stringify(rows,null,2));fs.renameSync(tmp,DB)}
function isDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||""))return false;const [y,m,d]=v.split("-").map(Number);return new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===v}
function input(raw){const name=String(raw.name||"").trim(),email=String(raw.email||"").trim(),date=raw.date,time=raw.time,party=Number(raw.party);
 if(name.length<2||name.length>70||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!isDate(date)||!slots.includes(time)||!Number.isInteger(party)||party<1||party>8)throw Object.assign(Error("Enter a valid name, email, date, seating time and party size (1–8)."),{status:400});
 return {name,email,date,time,party}
}
function response(res,status,obj){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(obj))}
function tokenOk(req){const want=process.env.RESTAURANT_ADMIN_TOKEN;return Boolean(want)&&req.headers.authorization==="Bearer "+want}
function handler(req,res){
 const url=new URL(req.url,"http://localhost");if(req.method==="GET"&&url.pathname==="/health")return response(res,200,{ok:true,mode:"isolated-demo"});
 if(req.method==="GET"&&url.pathname==="/api/slots")return response(res,200,{slots});
 if(url.pathname==="/api/reservations"&&req.method==="GET"){if(!tokenOk(req))return response(res,401,{error:"Admin token required"});return response(res,200,{reservations:read()})}
 if(url.pathname==="/api/reservations"&&req.method==="POST"){let body="";req.on("data",c=>{body+=c;if(body.length>8192)req.destroy()});req.on("end",()=>{try{const d=input(JSON.parse(body)),rows=read();const occupied=rows.some(r=>r.date===d.date&&r.time===d.time);if(occupied)return response(res,409,{error:"That table time is already booked. Choose another."});const item={id:crypto.randomUUID(),...d,createdAt:new Date().toISOString()};rows.push(item);save(rows);return response(res,201,{reservation:item})}catch(e){return response(res,e.status||400,{error:e.message})}});return}
 if(req.method==="GET"&&(url.pathname==="/"||url.pathname==="/index.html")){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","X-Content-Type-Options":"nosniff"});return fs.createReadStream(path.join(HOME,"index.html")).pipe(res)}
 return response(res,404,{error:"Not found"});
}
if(require.main===module)http.createServer(handler).listen(PORT,()=>console.log("Restaurant proof on http://localhost:"+PORT));
module.exports={handler,input,read,slots};
