"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const gate=require('../engineering-completion-gate');
const clear={built:{n:2},dirty:false,inspect:()=>{},lastTest:{errors:[],failed:0,steps:3},checks:{ran:1,failed:[],featurePassed:true}};
test('passing build with actual interactive test can be verified',()=>assert.equal(gate.evaluate(clear).verified,true));
test('cannot claim completion from compiled site and login screenshot',()=>{
 const result=gate.evaluate({...clear,lastTest:{errors:[],failed:0,steps:0}});
 assert.equal(result.verified,false);
 assert.match(gate.resultMessage('Everything works!',result),/NOT functionally verified/);
});
test('missing inspector and skipped tests block completion',()=>{
 const result=gate.evaluate({...clear,inspect:null,lastTest:null,checks:{skipped:true}});
 assert.equal(result.verified,false);
 assert.match(result.issues.join(' '),/Browser verification is unavailable/);
});
test('Karpathy-style regression discipline: prior failed checks block verification',()=>assert.equal(gate.evaluate({...clear,checks:{ran:2,failed:[{name:'Add food'}],featurePassed:true}}).verified,false));
test('nutrition features need verified feature-specific workflows',()=>{
 const req=[{id:'calorie'},{id:'macro'}];
 assert.equal(gate.evaluate({...clear,checks:{ran:1,failed:[]},requirements:req}).verified,false);
 assert.equal(gate.evaluate({...clear,requirements:req}).verified,true);
});
