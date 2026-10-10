'use strict';
const fs=require('node:fs'),path=require('node:path'),api=require('./api-learning'),docs=require('./api-docs');
function generate(input){
 const plan=input?.operations?input:api.learn(input);
 if(!Array.isArray(plan.operations)||!plan.operations.length||plan.operations.length>150)throw Error('Import a documented API before generating a backend');
 if(plan.format==='unstructured')throw Error('A formal API contract is required to generate a backend');
 const base=docs.validUrl(plan.baseUrl);
 for(const op of plan.operations){if(!/^[\w.-]{1,100}$/.test(op.id)||!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(op.method)||!op.path.startsWith('/')||op.path.startsWith('//'))throw Error('Invalid API operation');}
 const source=`'use strict';
const http=require('node:http'),crypto=require('node:crypto'),adapter=require('./api-adapter');
const contract=require('./api-contract.json');
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function sanitize(value){if(Array.isArray(value))return value.map(sanitize);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,/token|secret|password|authorization|api.?key|credential/i.test(key)?"[redacted]":sanitize(item)]));return value;}
function authenticated(req){const expected=process.env.BACKEND_KEY||'',received=String(req.headers['x-backend-key']||'');return expected.length>=16&&received.length===expected.length&&crypto.timingSafeEqual(Buffer.from(received),Buffer.from(expected));}
async function read(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>50000)throw Error('Request too large');}return JSON.parse(raw||'{}');}
function validate(op,args){
 for(const p of op.requiredParameters||[]){const values=p.in==='path'?args.pathParams:p.in==='query'?args.query:null;if(values&&values[p.name]!==undefined)continue;if(['path','query'].includes(p.in))throw Error('Missing required '+p.in+' parameter: '+p.name);}
 for(const field of op.bodyFields||[]){const value=args.body?.[field.name];if(field.required&&(value===undefined||value===null))throw Error('Missing body field: '+field.name);if(value!==undefined&&value!==null){const valid=field.type==='array'?Array.isArray(value):field.type==='integer'?Number.isInteger(value):field.type==='object'?typeof value==='object'&&!Array.isArray(value):['string','boolean','number'].includes(field.type)?typeof value===field.type:true;if(!valid)throw Error('Invalid body field: '+field.name);}}
}
function createServer({execute=adapter.execute}={}){return http.createServer(async(req,res)=>{
 try{
  if(req.method==='GET'&&req.url==='/health')return reply(res,200,{ok:true,providerConfigured:!!process.env.KAIROQ_API_TOKEN_PROVIDER,liveEnabled:process.env.KAIROQ_API_LIVE_ENABLED==='true'});
  if(!authenticated(req))return reply(res,401,{error:'Backend authentication required'});
  if(req.method==='GET'&&req.url==='/api/contract')return reply(res,200,contract);
  const match=/^\\/api\\/operations\\/([\\w.-]+)$/.exec(req.url);
  if(req.method!=='POST'||!match)return reply(res,404,{error:'Unknown backend route'});
  const op=contract.operations.find(o=>o.id===match[1]);if(!op)return reply(res,404,{error:'Unknown API operation'});
  const args=await read(req);validate(op,args);
  // Credentials and target URLs are server-owned; browser overrides are never forwarded.
  const result=await execute({plan:contract,operationId:op.id,pathParams:args.pathParams||{},query:args.query||{},body:args.body,credentialName:'KAIROQ_API_TOKEN_PROVIDER',approved:true,approvedWrites:args.approvedWrites===true});
  return reply(res,result.status,sanitize(result.data));
 }catch(error){return reply(res,422,{error:error.message});}
});}
if(require.main===module){if((process.env.BACKEND_KEY||'').length<16)throw Error('Set BACKEND_KEY to a private server-side secret of at least 16 characters');createServer().listen(Number(process.env.PORT||3000));}
module.exports={createServer,validate,sanitize};
`;
 const keys=plan.operations.map(o=>base.hostname+':'+o.method+':'+o.path);
 const files={'server.js':source,'api-contract.json':JSON.stringify(plan,null,2),'package.json':JSON.stringify({name:'kairoq-api-backend',version:'1.0.0',private:true,scripts:{start:'node server.js'},engines:{node:'>=22'}},null,2),'.env.example':`BACKEND_KEY=replace-with-a-private-backend-secret\nKAIROQ_API_TOKEN_PROVIDER=\nKAIROQ_API_HOSTS=${base.hostname}\nKAIROQ_API_LIVE_ENABLED=false\nKAIROQ_API_WRITE_ENABLED=false\nKAIROQ_API_APPROVED_OPERATIONS=\nKAIROQ_API_APPROVED_WRITES=\nPORT=3000\n`,'README.md':`# ${plan.title} backend\n\nNode.js 22+; no npm dependencies needed. Load .env with node --env-file=.env server.js after configuring its values.\n\nPOST /api/operations/{operationId} accepts {pathParams,query,body,approvedWrites}. GET /api/contract lists operation IDs. Both require X-Backend-Key, which must be kept server-side behind your application login. GET /health is public.\n\nLive requests and writes are disabled by default. Set the provider token, allowlisted host, explicit approved operation keys, and enable live requests only after testing. POST provider operations require KAIROQ_API_WRITE_ENABLED, the matching approved write key, and approvedWrites:true. This includes TripNinja POST searches.\n\nAvailable policy keys:\n${keys.map(k=>'- '+k).join('\n')}\n\nValidation covers documented required top-level body fields and path/query parameters. Nested schemas, business rules, provider errors, tenant authorization, rate limits, retries, and production readiness still need integration review. OAuth connections are not included; this export uses the configured static provider credential. No live provider calls were made during generation.\n`};
 for(const name of ['api-adapter.js','api-docs.js','api-learning.js'])files[name]=fs.readFileSync(path.join(__dirname,name),'utf8');
 return{files,operations:plan.operations.length,filename:'kairoq-api-backend.zip'};
}
module.exports={generate};
