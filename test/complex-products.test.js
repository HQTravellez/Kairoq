"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const runtime=require("../app-runtime"),design=require("../design-system");
const scenarios=[
 {name:"travel operations",schema:{collections:[
  {name:"travelers",fields:[{name:"email",type:"email",required:true},{name:"name",type:"text",required:true}]},
  {name:"trips",fields:[{name:"traveler_id",type:"reference",collection:"travelers",required:true},{name:"status",type:"select",options:["requested","approved","booked"],default:"requested",required:true},{name:"departure",type:"date",required:true}]},
  {name:"expenses",fields:[{name:"trip_id",type:"reference",collection:"trips",required:true},{name:"amount",type:"number",required:true}]}
 ],actions:[{name:"approve_trip",collection:"trips",field:"status",from:["requested"],to:"approved"},{name:"book_trip",collection:"trips",field:"status",from:["approved"],to:"booked"}]}},
 {name:"inventory and procurement",schema:{collections:[
  {name:"suppliers",fields:[{name:"name",type:"text",required:true},{name:"email",type:"email"}]},
  {name:"products",fields:[{name:"sku",type:"text",required:true},{name:"supplier_id",type:"reference",collection:"suppliers",required:true},{name:"stock",type:"number",required:true}]},
  {name:"purchase_orders",fields:[{name:"product_id",type:"reference",collection:"products",required:true},{name:"quantity",type:"number",required:true},{name:"state",type:"select",options:["draft","approved","received"],default:"draft"}]}
 ],actions:[{name:"approve_po",collection:"purchase_orders",field:"state",from:["draft"],to:"approved"}]}},
 {name:"events and registration",schema:{collections:[
  {name:"events",fields:[{name:"title",type:"text",required:true},{name:"start_date",type:"date",required:true}]},
  {name:"attendees",fields:[{name:"email",type:"email",required:true},{name:"name",type:"text",required:true}]},
  {name:"registrations",fields:[{name:"event_id",type:"reference",collection:"events",required:true},{name:"attendee_id",type:"reference",collection:"attendees",required:true},{name:"status",type:"select",options:["pending","confirmed","cancelled"],default:"pending"}]}
 ],actions:[{name:"confirm_registration",collection:"registrations",field:"status",from:["pending"],to:"confirmed"}]}}
];
for(const scenario of scenarios)test("complex schema and revision: "+scenario.name,()=>{
 const schema=runtime.validateSchema(scenario.schema);assert.equal(schema.collections.length,3);
 const revised=structuredClone(schema);revised.collections[0].fields.push({name:"internal_note",type:"textarea",required:false});
 assert.equal(runtime.validateMigration(schema,revised),revised);
 const broken=structuredClone(revised);broken.collections[0].fields.shift();
 assert.throws(()=>runtime.validateMigration(schema,broken),/cannot remove/);
 for(const collection of schema.collections){
  const fields=new Set(collection.fields.map(f=>f.name));assert.equal(fields.size,collection.fields.length);
  for(const field of collection.fields)if(field.type==="reference")assert.ok(schema.collections.some(c=>c.name===field.collection));
 }
});
test("design foundation maintains consistent accessible responsive controls across five styles",()=>{
 for(const style of Object.keys(design.palettes)){
  const css=design.foundation(style);
  assert.match(css,/min-height:44px/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/min-width:601px/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/focus-visible/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  const out=design.apply({"styles.css":"h1{font-size:9px}","index.html":"<h1>Example</h1>"},style);
  assert.match(out["styles.css"],/font-size:12px/);
  assert.equal(design.source(out)["styles.css"],"h1{font-size:12px}");
 }
});

const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),http=require("node:http");
for(const scenario of scenarios)test("real multi-collection CRUD and guarded workflow: "+scenario.name,async()=>{
 const schema=runtime.validateSchema(scenario.schema),root=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-complex-")),id="complex-"+scenario.name.replace(/[^a-z]+/g,"-");
 const server=http.createServer((req,res)=>runtime.api(req,res,{root,id,route:req.url,schema}));
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));const base="http://127.0.0.1:"+server.address().port;
 const call=async(route,method="GET",body,cookie)=>{const response=await fetch(base+route,{method,headers:{"Content-Type":"application/json",...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json(),cookie:response.headers.get("set-cookie")?.split(";")[0]};};
 try{
  const a=await call("/auth/register","POST",{email:"a@qa.example",password:"complex-password-123"});assert.equal(a.status,200);const cookie=a.cookie,created={};
  for(const collection of schema.collections){
   const body={};for(const field of collection.fields){body[field.name]=field.type==="reference"?created[field.collection]:field.type==="number"?25:field.type==="date"?"2030-10-10":field.type==="email"?"traveler@qa.example":field.type==="select"?runtime.workflowInitial(schema,collection,field):field.type==="boolean"?true:"QA "+field.name;}
   const response=await call("/collections/"+collection.name,"POST",body,cookie);assert.equal(response.status,201,JSON.stringify(response.data));created[collection.name]=response.data.record.id;
  }
  const counts=await call("/dashboard","GET",null,cookie);assert.equal(counts.data.total,3);
  const action=schema.actions[0],rid=created[action.collection];
  const bypass=await call("/collections/"+action.collection+"/"+rid,"PATCH",{[action.field]:action.to},cookie);assert.equal(bypass.status,409);
  const changed=await call("/actions/"+action.name+"/"+rid,"POST",{},cookie);assert.equal(changed.status,200);assert.equal(changed.data.record.data[action.field],action.to);
  const other=await call("/auth/register","POST",{email:"b@qa.example",password:"complex-password-456"});assert.equal(other.status,200);
  assert.equal((await call("/dashboard","GET",null,other.cookie)).data.total,0);
  assert.equal((await call("/collections/"+action.collection+"/"+rid,"DELETE",{},other.cookie)).status,404);
  assert.equal((await call("/collections/"+action.collection,"GET",null,cookie)).data.records[0].data[action.field],action.to);
 }finally{await new Promise(resolve=>server.close(resolve));runtime.recordsDb(root,id).close();fs.rmSync(root,{recursive:true,force:true});}
});
