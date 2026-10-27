"use strict";
// Hoppscotch-style extras for outside APIs: checks on answers (api-rules.js), a pasted cURL command
// and Hoppscotch collections (api-import.js), a test address, GraphQL; plus the photo finder's time
// budget and simpler searches.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-apichecks-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.APP_ENCRYPTION_KEY='test-encryption-key-1234567890';
const builder=require('../react-builder'),samples=require('../api-samples'),tryout=require('../api-tryout'),rules=require('../api-rules'),imp=require('../api-import'),secrets=require('../project-secrets');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

const SHOP={openapi:'3.0.3',info:{title:'Shop',version:'1'},servers:[{url:'https://api.shop.test/v1'}],paths:{
 '/orders':{get:{operationId:'listOrders',summary:'List orders',parameters:[{name:'limit',in:'query',schema:{type:'integer'},example:5}],responses:{200:{description:'ok',content:{'application/json':{schema:{type:'object',required:['data'],properties:{data:{type:'array',items:{type:'object',properties:{price:{type:'number'}}}},total:{type:'integer'}}}}}}}},post:{operationId:'createOrder',requestBody:{content:{'application/json':{schema:{type:'object',properties:{item:{type:'string'}}}}}},responses:{201:{description:'ok'}}}},
 '/orders/{orderId}':{get:{operationId:'getOrder',parameters:[{name:'orderId',in:'path',required:true,schema:{type:'string'}}],responses:{200:{description:'ok'}}}}}};
function project(){const m=builder.create({name:'Checks',owner:'owner'});samples.add(m.id,{spec:SHOP});return m.id}

test('checks on an answer, in plain words; Hoppscotch and Postman test lines become checks without running them',()=>{
 const reply={status:200,ms:180,body:JSON.stringify({data:[{price:120,currency:'EUR'},{price:80}],total:2}),headers:{'Content-Type':'application/json'}};
 const r=rules.evaluate([{kind:'status',value:'2xx'},{kind:'time',value:100},{kind:'field',path:'data[0].price',op:'gt',value:100},{kind:'field',path:'data[0].currency',op:'eq',value:'EUR'},{kind:'field',path:'data',op:'length',value:2},{kind:'field',path:'missing.x',op:'exists'},{kind:'header',name:'content-type',op:'contains',value:'json'}],reply);
 assert.deepEqual(r.map(c=>[c.label,c.pass]),[['Status is 2XX',true],['Answers within 100 ms',false],['data[0].price is more than 100',true],['data[0].currency is EUR',true],['data has 2 items',true],['missing.x exists',false],['Header content-type contains json',true]]);
 assert.equal(r[1].actual,'180 ms');
 const parsed=rules.fromScript(`pw.test("ok", () => { pw.expect(pw.response.status).toBe(200); pw.expect(pw.response.body.data[0].price).toBeType("number"); });
pm.test("x", function () { pm.expect(pm.response.json().total).to.eql(2); pm.expect(pm.response.responseTime).to.be.below(500); });
pw.env.set("token", "x");`);
 assert.deepEqual(parsed.rules,[{kind:'status',value:'200'},{kind:'field',path:'data[0].price',op:'type',value:'number'},{kind:'field',path:'total',op:'eq',value:2},{kind:'time',value:500}]);
 assert.deepEqual(parsed.skipped,['pw.env.set("token", "x");']);
 const op=samples.apis(project())[0].operations.find(o=>o.id==='listOrders');
 assert.deepEqual(rules.suggest(op).map(rules.label),['Status is 200','Answers within 3 s','data exists','total exists']);
 assert.equal(rules.clean({kind:'field',path:'a;process.exit()',op:'exists'}),null,'only plain field paths');
});

test('a pasted cURL command opens the matching endpoint with its inputs; keys in it are never kept',async()=>{
 const id=project();
 const c=imp.parseCurl(`curl 'https://api.shop.test/v1/orders/A-17?expand=items&api_key=SECRET1' \\
  -H 'Accept: application/json' -H "Authorization: Bearer SECRET2" -H 'X-Api-Key: SECRET3'`);
 assert.equal(c.method,'GET');assert.equal(c.url,'https://api.shop.test/v1/orders/A-17?expand=items');
 assert.deepEqual(c.secrets.sort(),['Authorization','X-Api-Key','api_key']);assert.doesNotMatch(JSON.stringify(c),/SECRET/);
 const m=tryout.fromCurl(id,{curl:`curl https://api.shop.test/v1/orders/A-17?expand=items -H 'Authorization: Bearer SECRET2'`});
 assert.deepEqual(m.match,{slug:'shop',op:'getOrder',values:{expand:'items',orderId:'A-17'},body:null});
 assert.match(m.note,/had a key in it \(Authorization\)\. Kairoq did not keep it/);
 const post=tryout.fromCurl(id,{curl:`curl --json '{"item":"latte"}' https://api.shop.test/v1/orders`});
 assert.equal(post.match.op,'createOrder');assert.equal(post.match.body,'{\n  "item": "latte"\n}');
 // Not an added API: it is offered, then added with that one endpoint and a key name, not the key.
 const other=`curl 'https://api.weather.test/v1/forecast?city=Lisbon' -H 'X-Api-Key: SECRET9'`;
 assert.equal(tryout.fromCurl(id,{curl:other}).match,null);
 const added=tryout.fromCurl(id,{curl:other,add:true});
 assert.equal(added.added.title,'weather.test');assert.equal(added.added.secret,'WEATHER_KEY');assert.equal(added.added.key_added,false);
 assert.deepEqual(added.match.values,{city:'Lisbon'});
 assert.doesNotMatch(fs.readFileSync(path.join(builder.projectDir(id),'apis.json'),'utf8'),/SECRET/);
 assert.throws(()=>imp.parseCurl('wget https://x.test'),/should start with curl/);
 assert.throws(()=>imp.parseCurl('curl http://plain.test/x'),/Only https/);
});

test('a Hoppscotch collection is imported; its tests become checks; its keys are left out',()=>{
 const m=builder.create({name:'Hop',owner:'owner'});
 const col={v:3,name:'Shop API',folders:[{v:3,name:'Orders',folders:[],requests:[{v:'6',name:'List orders',method:'GET',endpoint:'<<baseUrl>>/orders',params:[{key:'limit',value:'5',active:true}],headers:[{key:'Authorization',value:'Bearer LEAKED',active:true},{key:'Accept',value:'application/json',active:true}],auth:{authType:'bearer',token:'LEAKED'},body:{contentType:null,body:null},testScript:'pw.test("ok",()=>{ pw.expect(pw.response.status).toBe(200); pw.expect(pw.response.body.total).toBeType("number"); });',preRequestScript:''}]}],requests:[]};
 const api=samples.add(m.id,{spec:JSON.stringify(col),baseUrl:'https://api.shop.test/v1'});
 assert.equal(api.title,'Shop API');assert.equal(api.base_url,'https://api.shop.test/v1');
 const saved=samples.apis(m.id)[0],op=saved.operations[0];
 assert.equal(op.path,'/orders');
 assert.deepEqual(saved.rules[op.id],[{kind:'status',value:'200'},{kind:'field',path:'total',op:'type',value:'number'}]);
 assert.doesNotMatch(fs.readFileSync(path.join(builder.projectDir(m.id),'apis.json'),'utf8'),/LEAKED/);
});

test('Send and Check all report the checks; GraphQL errors fail; a test address with its own key',async()=>{
 const id=project();const seen=[];
 const fetchUrl=async req=>{seen.push(req);if(/graphql/.test(req.url))return{status:200,headers:{},body:'{"errors":[{"message":"Cannot query field \\"x\\""}]}'};return{status:200,headers:{'content-type':'application/json'},body:'{"data":[],"total":0}'}};
 samples.setRules(id,'shop','listOrders',[{kind:'status',value:'200'},{kind:'field',path:'data.length',op:'gt',value:0}]);
 const r=await tryout.send(id,{slug:'shop',op:'listOrders',values:{limit:'5'}},{fetchUrl});
 assert.equal(r.ok,false);assert.deepEqual(r.checks.map(c=>c.pass),[true,false]);
 assert.match(r.reason,/^Failed checks: data\.length is more than 0 \(got 0\)\.$/);
 const all=await tryout.check(id,{slug:'shop'},{fetchUrl});
 assert.equal(all.results.find(x=>x.id==='listOrders').result,'fail');
 // The test address: Try and Check all use it, with the test key; the app keeps the live one.
 samples.setTest(id,'shop',{baseUrl:'https://test.shop.test/v1',secret:'SHOP_TEST_KEY',use:true});
 const view=samples.list(id)[0];assert.deepEqual(view.test,{base_url:'https://test.shop.test/v1',secret:'SHOP_TEST_KEY',use:true,key_added:false});
 const t=await tryout.send(id,{slug:'shop',op:'getOrder',values:{orderId:'A1'}},{fetchUrl});
 assert.equal(t.sample,true,'no test key yet: a sample');assert.match(t.why,/add the SHOP_TEST_KEY key/);
 secrets.set(id,'app_shop_test_key','tk-1');
 const t2=await tryout.send(id,{slug:'shop',op:'getOrder',values:{orderId:'A1'}},{fetchUrl});
 assert.equal(seen.at(-1).url,'https://test.shop.test/v1/orders/A1');assert.equal(seen.at(-1).headers.Authorization,'Bearer tk-1');
 assert.match(t2.why,/\(test address\)/);assert.equal(t2.testing,true);
 const live=await samples.fetchFor(id,{url:'https://api.shop.test/v1/orders',method:'GET'},{mode:'live',real:async a=>({status:200,headers:{},body:'{}',url:a.url})});
 assert.equal(live.status,200,'the app still calls the live address');
 samples.setTest(id,'shop',{baseUrl:null});assert.equal(samples.list(id)[0].test,undefined);
 // GraphQL: added from its address; errors in a 200 answer fail the check.
 const g=await samples.addByName(id,{name:'https://countries.graphql.test/graphql'});
 assert.equal(g.title,'countries.graphql.test GraphQL');
 const ep=tryout.endpoints(samples.apis(id).find(a=>a.slug===g.slug))[0];
 assert.equal(ep.method,'POST');assert.match(ep.body,/"query": "\{ __typename \}"/);
 const gr=await tryout.send(id,{slug:g.slug,op:'graphql_query',body:'{"query":"{ x }"}',confirm:true},{fetchUrl});
 assert.equal(gr.ok,false);assert.match(gr.reason,/No GraphQL errors \(got Cannot query field "x"\)/);
});

test('the editor routes: checks, cURL and test address need edit access',async()=>{
 const createApi=require('../create-api'),id=project();
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=(url,body)=>new Promise((resolve,reject)=>{const p=Buffer.from(JSON.stringify(body));const q=http.request({host:'127.0.0.1',port:server.address().port,method:'POST',path:'/api/create/projects/'+id+url,headers:{'Content-Type':'application/json','Content-Length':p.length}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>resolve({status:res.statusCode,json:JSON.parse(Buffer.concat(c).toString()||'{}')}))});q.on('error',reject);q.write(p);q.end()});
 try{
  assert.deepEqual((await call('/apirules',{slug:'shop',op:'listOrders',rules:[{kind:'status',value:'200'},{kind:'bogus'}]})).json.rules,[{kind:'status',value:'200'}]);
  assert.equal((await call('/apicurl',{curl:'curl https://api.shop.test/v1/orders?limit=2'})).json.match.op,'listOrders');
  assert.equal((await call('/apitest',{slug:'shop',base_url:'http://insecure.test'})).status,400);
 }finally{server.close()}
 const src=fs.readFileSync(path.join(__dirname,'..','create-api.js'),'utf8');
 for(const r of ['apirules','apicurl','apitest'])assert.ok(src.includes("'POST:/"+r+"':'editor'"),r);
});

test('photos: simpler searches, and a slow photo service never holds up the build',async()=>{
 const finder=require('../photo-finder');
 assert.deepEqual(finder.variants('barista pouring espresso in Ottawa neighbourhood cafe'),['barista pouring espresso in Ottawa neighbourhood cafe','barista pouring espresso neighbourhood cafe','barista pouring espresso']);
 const t0=Date.now();
 const out=await finder.find(['a','barista pouring espresso','croissants on a counter'],{env:{},read:()=>new Promise(()=>{}),budgetMs:1500});
 assert.deepEqual(out,[]);assert.ok(Date.now()-t0<4000,'gave up within the budget');
 assert.equal(require('../craft-norms').typeOf('The marketing website home page for Travellez, corporate travel software'),'travel','"marketing website" describes the page, not the business');
});
