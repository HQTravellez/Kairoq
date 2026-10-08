const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const runtime=require('../app-runtime');
const schema=runtime.validateSchema({collections:[{name:'products',fields:[{name:'name',type:'text',required:true},{name:'quantity',type:'number',required:true},{name:'category',type:'select',options:['Tools','Other']}]}]});
test('schema rejects destructive revisions and invalid record values',()=>{
 assert.throws(()=>runtime.validateSchema({collections:[{name:'../escape',fields:[]}]}));
 assert.throws(()=>runtime.recordValues(schema.collections[0],{name:'  ',quantity:3}));
 assert.throws(()=>runtime.recordValues(schema.collections[0],{name:'Tool',quantity:Infinity}));
 assert.throws(()=>runtime.recordValues(schema.collections[0],{name:'Tool',quantity:3,category:'Unknown'}));
 assert.throws(()=>runtime.validateMigration(schema,{collections:[]}));
 const changed=structuredClone(schema);changed.collections[0].fields[1].type='text';assert.throws(()=>runtime.validateMigration(schema,changed));
 const added=structuredClone(schema);added.collections[0].fields.push({name:'price',type:'number',required:true});assert.throws(()=>runtime.validateMigration(schema,added));added.collections[0].fields.at(-1).default=0;assert.equal(runtime.validateMigration(schema,added),added);
});
test('custom apps persist records, isolate users, handle CRUD and preserve data through additive revision',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-crud-'));let current=schema;
 const server=http.createServer((req,res)=>runtime.api(req,res,{root,id:'test-custom',route:req.url,schema:current}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(url,method='GET',data,cookie,origin)=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(origin?{origin}:{})},body:data?JSON.stringify(data):undefined});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 try{
 assert.equal((await call('/collections/products')).status,401);
 const a=await call('/auth/register','POST',{email:'a@example.com',password:'long-test-password'});const b=await call('/auth/register','POST',{email:'b@example.com',password:'long-test-password'});assert.equal(a.status,200);
 assert.equal((await call('/collections/products','POST',{name:'Tool',quantity:3},a.cookie,'https://evil.example')).status,403);
 const saved=await call('/collections/products','POST',{name:'Tool',quantity:3,category:'Tools'},a.cookie);assert.equal(saved.status,201);const id=saved.data.record.id;
 assert.deepEqual((await call('/collections/products','GET',null,b.cookie)).data.records,[]);assert.equal((await call('/collections/products/'+id,'PATCH',{quantity:9},b.cookie)).status,404);assert.equal((await call('/collections/products/'+id,'DELETE',{},b.cookie)).status,404);
 assert.equal((await call('/collections/products/'+id,'PATCH',{quantity:8},a.cookie)).data.record.data.quantity,8);
 current=structuredClone(schema);current.collections[0].fields.push({name:'price',type:'number',required:true,default:0});runtime.validateMigration(schema,current);
 const revised=(await call('/collections/products','GET',null,a.cookie)).data.records[0];assert.equal(revised.id,id);assert.equal(revised.data.quantity,8);assert.equal(revised.data.price,0);
 assert.equal((await call('/dashboard','GET',null,a.cookie)).data.total,1);
 await call('/auth/logout','POST',{},a.cookie);assert.equal((await call('/schema','GET',null,a.cookie)).status,401);const login=await call('/auth/login','POST',{email:'a@example.com',password:'long-test-password'});
 assert.equal((await call('/collections/products','GET',null,login.cookie)).data.records.length,1);
 const {DatabaseSync}=require('node:sqlite');const persisted=new DatabaseSync(path.join(root,'test-custom','housing.sqlite'));assert.equal(persisted.prepare('SELECT count(*) n FROM app_records').get().n,1);persisted.close();
 await call('/collections/products/'+id,'DELETE',{},login.cookie);assert.equal((await call('/dashboard','GET',null,login.cookie)).data.total,0);
 }finally{await new Promise(r=>server.close(r));runtime.recordsDb(root,'test-custom').close();fs.rmSync(root,{recursive:true,force:true});}
});
