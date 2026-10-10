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
