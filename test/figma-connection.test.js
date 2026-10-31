"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-figma-oauth-"));
Object.assign(process.env,{
 NODE_ENV:"test",
 APP_ENCRYPTION_KEY:"test-encryption-key-123456",
 KAIROQ_PUBLIC_URL:"https://kairoq.example",
 KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,"projects"),
 KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,"accounts.sqlite"),
 KAIROQ_HOSTING_REGISTRY:path.join(tmp,"hosting.json"),
 KAIROQ_OAUTH_FIGMA_CLIENT_ID:"figma-client",
 KAIROQ_OAUTH_FIGMA_CLIENT_SECRET:"figma-secret"
});
const builder=require("../react-builder"),O=require("../oauth-connect"),F=require("../figma-connection"),secrets=require("../project-secrets"),native=require("../native-connections");
let meta;

test.before(async()=>{meta=builder.create({name:"Figma OAuth",owner:"owner"});await builder.initialize(meta)});
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

test("native Figma connection requests only the scopes Kairoq currently uses",()=>{
 const p=native.find("figma");
 assert.deepEqual(p.auth.scope,["current_user:read","file_content:read","file_metadata:read","library_content:read"]);
 assert.equal(p.auth.authUrl,"https://www.figma.com/oauth");
 assert.equal(p.auth.tokenUrl,"https://api.figma.com/v1/oauth/token");
 assert.equal(p.auth.refreshUrl,"https://api.figma.com/v1/oauth/refresh");
 assert.equal(p.auth.pkce,true);
});

test("Figma OAuth start uses PKCE, the registered callback, and granular scopes",()=>{
 const start=O.start(meta.id,"figma",{who:"owner"});
 const u=new URL(start.url);
 assert.equal(u.origin+u.pathname,"https://www.figma.com/oauth");
 assert.equal(u.searchParams.get("client_id"),"figma-client");
 assert.equal(u.searchParams.get("redirect_uri"),"https://kairoq.example/api/create/oauth/callback");
 assert.match(u.searchParams.get("scope"),/file_content:read/);
 assert.match(u.searchParams.get("scope"),/file_metadata:read/);
 assert.match(u.searchParams.get("scope"),/library_content:read/);
 assert.equal(u.searchParams.get("code_challenge_method"),"S256");
 assert.ok(u.searchParams.get("code_challenge"));
});

test("Figma code exchange uses Basic auth and stores tokens encrypted",async()=>{
 const start=O.start(meta.id,"figma",{who:"owner"}),state=new URL(start.url).searchParams.get("state");
 let seen=null;
 const fetchImpl=async(url,o)=>{
  seen={url,headers:o.headers,body:Object.fromEntries(new URLSearchParams(o.body))};
  return{ok:true,status:200,text:async()=>JSON.stringify({access_token:"oauth-token-12345678901234567890",refresh_token:"refresh-token-12345678901234567890",expires_in:3600,token_type:"bearer"})};
 };
 const out=await O.finish({state,code:"code-1"},{fetchImpl,who:"owner"});
 assert.equal(out.service,"figma");
 assert.equal(seen.url,"https://api.figma.com/v1/oauth/token");
 assert.match(seen.headers.Authorization,/^Basic /);
 assert.equal(seen.body.grant_type,"authorization_code");
 assert.ok(seen.body.code_verifier);
 assert.equal(O.status(meta.id,"figma").connected,true);
 assert.doesNotMatch(fs.readFileSync(path.join(builder.projectDir(meta.id),"secrets.json"),"utf8"),/oauth-token|refresh-token/);
});

test("Figma refresh uses its dedicated refresh endpoint without a grant_type",async()=>{
 const saved=JSON.parse(secrets.get(meta.id,"oauth_figma"));saved.expires_at=Date.now()+500;secrets.set(meta.id,"oauth_figma",JSON.stringify(saved));
 let seen=null;
 const token=await O.token(meta.id,"figma",{fetchImpl:async(url,o)=>{
  seen={url,body:Object.fromEntries(new URLSearchParams(o.body)),headers:o.headers};
  return{ok:true,status:200,text:async()=>JSON.stringify({access_token:"oauth-token-refreshed-123456789012345",expires_in:3600,token_type:"bearer"})};
 }});
 assert.equal(token.access_token,"oauth-token-refreshed-123456789012345");
 assert.equal(seen.url,"https://api.figma.com/v1/oauth/refresh");
 assert.equal(seen.body.refresh_token,"refresh-token-12345678901234567890");
 assert.equal(seen.body.grant_type,undefined);
 assert.match(seen.headers.Authorization,/^Basic /);
});

test("connected Figma imports frames with Bearer auth and preserves components/styles",async()=>{
 const calls=[];
 const fetchImpl=async(url,o={})=>{
  calls.push({url,headers:o.headers||{}});
  if(url.includes("/files/AbC1234567890/nodes?")){
   return{ok:true,status:200,json:async()=>({nodes:{"12:34":{
    document:{id:"12:34",type:"FRAME",name:"Checkout",absoluteBoundingBox:{width:1440,height:900},children:[]},
    components:{a:{name:"Primary Button",description:"Main CTA",key:"comp-key"}},
    componentSets:{b:{name:"Button states",description:"Variants",key:"set-key"}},
    styles:{c:{name:"Brand / Blue",description:"Primary fill",styleType:"FILL",key:"style-key"}}
   }}})};
  }
  if(url.includes("/images/AbC1234567890?"))return{ok:true,status:200,json:async()=>({images:{}})};
  throw Error("unexpected fetch "+url);
 };
 const frame=await F.importFrame(meta.id,"https://www.figma.com/design/AbC1234567890/My-file?node-id=12-34",{fetchImpl});
 assert.equal(frame.name,"Checkout");
 assert.equal(frame.components[0].name,"Primary Button");
 assert.equal(frame.componentSets[0].name,"Button states");
 assert.equal(frame.styles[0].name,"Brand / Blue");
 const apiCall=calls.find(x=>x.url.includes("/files/"));
 assert.equal(apiCall.headers.Authorization,"Bearer oauth-token-refreshed-123456789012345");
});

test("Figma UI is OAuth-first and no longer asks customers for a personal token",()=>{
 const html=fs.readFileSync(path.join(__dirname,"..","public","create.html"),"utf8");
 const js=fs.readFileSync(path.join(__dirname,"..","public","create.js"),"utf8");
 assert.match(html,/id="figma-connect"/);
 assert.match(html,/id="figma-disconnect"/);
 assert.doesNotMatch(html,/id="figma-token"/);
 assert.doesNotMatch(html,/Personal access token/);
 assert.match(js,/service:'figma'/);
 assert.match(js,/renderFigmaConnection/);
});
