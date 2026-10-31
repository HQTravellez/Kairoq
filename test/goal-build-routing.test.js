"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const routing=require("../build-routing");

const existing={current_version:3,versions:[{n:3,summary:"Working app"}]};

test("short outcome goals enter Agent Mode automatically",()=>{
 const cases=[
  "Integrate Stripe and verify checkout",
  "Connect HubSpot API and sync customer records",
  "Fix the booking workflow and prove it works",
  "Make this GitHub repo production ready",
  "Migrate authentication without breaking users",
  "Automate this approval workflow end to end",
  "Build an internal CRM system",
  "Create a customer portal with authentication",
  "Build this design https://www.figma.com/design/AbC1234567890/Product?node-id=12-34"
 ];
 for(const message of cases){
  assert.equal(routing.goalLike(message),true,message);
  assert.equal(routing.executionMode({requestedMode:"build",meta:existing,message}),"agent",message);
 }
});

test("small local edits stay on the fast Build path",()=>{
 const cases=[
  "Change the button text to Continue",
  "Make the heading smaller",
  "Remove this paragraph",
  "Change the background to white",
  "Add one link to the footer"
 ];
 for(const message of cases){
  assert.equal(routing.goalLike(message),false,message);
  assert.equal(routing.executionMode({requestedMode:"build",meta:existing,message}),"build",message);
 }
});

test("starter projects still get the full Agent path",()=>{
 const starter={current_version:1,versions:[{n:1,summary:"Starter project"}]};
 assert.equal(routing.executionMode({requestedMode:"build",meta:starter,message:"Add one button"}),"agent");
});

test("Discuss and hook-owned workflows are not silently promoted here",()=>{
 assert.equal(routing.executionMode({requestedMode:"discuss",meta:existing,message:"Integrate Stripe"}),"discuss");
 assert.equal(routing.executionMode({requestedMode:"build",meta:existing,message:"Integrate Stripe",hooks:true}),"build");
});
