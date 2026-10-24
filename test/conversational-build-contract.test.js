"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const c=require('../conversational-build-contract');
test('preserves 3D resale constraints through a short correction',()=>{
 const a=c.merge([],'Build a 3D pop-out menu template to sell');
 assert.deepEqual(a.map(x=>x.id),['three_d','product_sale']);
 assert.deepEqual(c.merge(a,'Make the dishes animate when clicked').map(x=>x.id),['three_d','product_sale']);
 assert.equal(c.merge(a,'Remove 3D and make a flat menu').some(x=>x.id==='three_d'),false);
});
test('calorie product requirements survive follow-up without being marked done',()=>{
 const a=c.merge([],'Build calorie counter with food database search, macros and weight history');
 const b=c.merge(a,'The app looks basic. Make the interface more polished.');
 assert.deepEqual(b.map(x=>x.id),['calorie','food_search','macro','weight']);
 assert.match(c.prompt(b),/NOT verified/);
});
test('verification never means only login page opened',()=>{
 assert.deepEqual(c.evidence({browser:{passed:true}}),{browser:'passed',savedChecks:'unverified',features:'unverified'});
 assert.equal(c.evidence({browser:{passed:true},checks:{ran:1,failed:[]},features:[{passed:false}]}).features,'unverified');
});

test('actual React builder integrates and saves owner requirements per project',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../react-builder.js'),'utf8');
 assert.match(source,/buildContract\.merge\(meta\.owner_requirements\|\|\[\],text\)/);
 assert.match(source,/buildContract\.prompt\(ownerRequirements\)/);
 assert.match(source,/fresh\.owner_requirements=ownerRequirements/);
 assert.match(source,/feature_verification:featureVerification/);
});
