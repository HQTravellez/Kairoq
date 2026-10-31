'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/create.js'),'utf8');
const flow=source.slice(source.indexOf('async function askThenBuild(prompt){'),source.indexOf('// A first request with'));
test('first prompt creates a project, opens its editor and starts the build without setup calls',async()=>{
 const calls=[];
 const context={shortName:()=> 'Coffee shop',api:async(path,options)=>{calls.push([path,options.body]);return {project:{id:'123'}}},openProject:async id=>calls.push(['open',id]),send:async(prompt,mode)=>calls.push(['send',prompt,mode])};
 vm.createContext(context);vm.runInContext(flow,context);
 await context.askThenBuild('Build my coffee shop');
 assert.deepEqual(calls.map(c=>c[0]),['/projects','open','send']);
 assert.equal(calls[2][1],'Build my coffee shop');assert.equal(calls[2][2],'build');
});
test('failed project creation does not submit a build to a stale project',async()=>{
 let sent=false;const context={shortName:()=> 'App',api:async()=>{throw Error('Quota reached')},openProject:async()=>{},send:()=>{sent=true}};
 vm.createContext(context);vm.runInContext(flow,context);
 await assert.rejects(context.askThenBuild('Build it'),/Quota reached/);assert.equal(sent,false);
});
