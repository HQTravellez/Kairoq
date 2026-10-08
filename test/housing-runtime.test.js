const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const housing=require('../housing-runtime');
test('housing app persists enquiries, isolates accounts, edits priority, and logs out',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'housing-'));
 const server=http.createServer((req,res)=>housing.handle(req,res,{root,id:'test-housing',route:req.url}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(url,method='GET',data,cookie)=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}: {})},body:data?JSON.stringify(data):undefined});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 try{
  assert.equal((await call('/enquiries')).status,401);
  const a=await call('/auth/register','POST',{email:'a@example.com',password:'long-test-password'});assert.equal(a.status,200);
  const b=await call('/auth/register','POST',{email:'b@example.com',password:'long-test-password'});
  const e=await call('/enquiries','POST',{name:'Test Guest',email:'guest@example.com',city:'Toronto',budget:3000},a.cookie);assert.equal(e.status,201);
  assert.equal((await call('/enquiries','GET',null,b.cookie)).data.enquiries.length,0);
  assert.equal((await call('/enquiries/'+e.data.enquiry.id,'PATCH',{priority:'urgent'},b.cookie)).status,404);
  assert.equal((await call('/enquiries/'+e.data.enquiry.id,'PATCH',{priority:'urgent'},a.cookie)).data.enquiry.priority,'urgent');
  assert.equal((await call('/dashboard','GET',null,a.cookie)).data.urgent,1);
  await call('/auth/logout','POST',{},a.cookie);assert.equal((await call('/enquiries','GET',null,a.cookie)).status,401);
  const login=await call('/auth/login','POST',{email:'a@example.com',password:'long-test-password'});assert.equal((await call('/enquiries','GET',null,login.cookie)).data.enquiries.length,1);
  const db=housing.database(root,'test-housing');db.close();const {DatabaseSync}=require('node:sqlite');const reopened=new DatabaseSync(path.join(root,'test-housing','housing.sqlite'));assert.equal(reopened.prepare('SELECT count(*) n FROM enquiries').get().n,1);reopened.close();
 }finally{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
