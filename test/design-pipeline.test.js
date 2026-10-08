'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const pipeline=require('../design-pipeline'),system=require('../design-system');
const components=require('../app-components'),vm=require('node:vm');
test('trusted component runtime is injected once and presentation code survives revisions',()=>{
 const original={'app.js':'document.documentElement.dataset.presentation="custom";'};
 const once=components.inject(original),twice=components.inject(once);
 assert.equal(once['app.js'],twice['app.js']);
 assert.equal((twice['app.js'].match(/BEGIN KAIROQ COMPONENT RUNTIME/g)||[]).length,1);
 assert.ok(twice['app.js'].endsWith(original['app.js']));assert.deepEqual(components.source(twice),original);
 assert.doesNotThrow(()=>new vm.Script(twice['app.js']));
 assert.ok(!twice['app.js'].includes('innerHTML'));
});
const scores=Object.fromEntries(pipeline.axes.map(n=>[n,4.2]));
test('visual gate rejects weak dimensions, major findings and malformed scores',()=>{
 assert.equal(pipeline.normalizeReview({scores,findings:[]}).passed,true);
 assert.equal(pipeline.normalizeReview({scores:{...scores,mobile:3},findings:[]}).passed,false);
 assert.equal(pipeline.normalizeReview({scores,findings:[{severity:'major',issue:'Clipped navigation',fix:'Wrap the mobile navigation'}]}).passed,false);
 assert.throws(()=>pipeline.normalizeReview({scores:{...scores,identity:'5'},findings:[]}),/Invalid visual score/);
});
test('visual reviewer receives actual image payloads and DOM issues cannot be overridden',async()=>{
 let request;const bytes=Buffer.from('synthetic-test-image');const review=await pipeline.review(async opts=>{request=opts;return{visual_review:{scores,findings:[],screen_reviews:[{screen:'Mobile',scores,findings:[]}]}};},{purpose:'Test'},[{label:'Mobile',bytes}],[{severity:'major',screen:'Mobile',issue:'Contrast',fix:'Increase contrast'}]);
 assert.equal(request.purpose,'design-review');assert.equal(request.messages[0].content[2].image_url.url,'data:image/jpeg;base64,'+bytes.toString('base64'));assert.equal(review.passed,false);assert.equal(review.evidence[0].sha256.length,64);assert.ok(!JSON.stringify(review).includes(bytes.toString('base64')));
});
test('foundation is idempotent and previous design plans avoid another model call',async()=>{
 const files={'styles.css':'.custom{color:green}'};const once=system.apply(files,'luxury'),twice=system.apply(once,'luxury');assert.equal(once['styles.css'],twice['styles.css']);assert.deepEqual(system.source(twice),files);assert.match(once['styles.css'],/\.kq-button/);const previous={purpose:'Preserved identity'};assert.equal(await pipeline.plan(()=>{throw Error('unexpected model call');},{previous}),previous);
});

test('visual polish cannot replace the stored schema or project identity',()=>{
 const builder=require('../app-builder');
 const candidate={project_name:'Housing',summary:'Saved enquiries',schema:{collections:[{name:'enquiries',label:'Enquiries',fields:[{name:'contact',label:'Contact',type:'text',required:true}]}]},files:{'index.html':'<html>'+ 'a'.repeat(500)+'</html>','styles.css':'.page{color:black}'+ ' '.repeat(500),'app.js':''}};
 const result=builder.normalizePolish(candidate,{project_name:'Wrong',schema:{collections:[]},files:{...candidate.files,'app.js':'/* visual change */'}});
 assert.deepEqual(result.schema,candidate.schema);assert.equal(result.project_name,'Housing');assert.equal(result.files['app.js'],'/* visual change */');
 const partial=builder.normalizePolish(result,{files:{'styles.css':candidate.files['styles.css']+'\n/* polished */'}});assert.equal(partial.files['app.js'],result.files['app.js']);assert.equal(partial.files['index.html'],candidate.files['index.html']);
});

test('component compilation enforces readable explicit text sizes without flattening hierarchy',()=>{
 assert.equal(system.readableCss('.a{font-size:10px}.b{font-size:32px}.c{font:600 .6rem/1.3 system-ui}.d{font-size:1em}'),'.a{font-size:12px}.b{font-size:32px}.c{font:600 0.75rem/1.3 system-ui}.d{font-size:1em}');
});
test('every screenshot is reviewed and a weak final screen blocks the build',async()=>{
 const shots=Array.from({length:8},(_,i)=>({label:'State '+i,bytes:Buffer.from('image '+i)}));let calls=0;
 const report=await pipeline.review(async opts=>{calls++;const labels=opts.messages[0].content.filter(c=>c.type==='text').slice(1).map(c=>c.text);return{visual_review:{scores,findings:[],screen_reviews:labels.map(screen=>({screen,scores:screen==='State 7'?{...scores,mobile:2}:scores,findings:[]}))}};},{},shots);
 assert.equal(calls,2);assert.equal(report.evidence.length,8);assert.equal(report.coverage.reviewed,8);assert.equal(report.passed,false);assert.equal(report.scores.mobile,2);
});
test('missing screen verdicts cannot be published as a visual pass',async()=>{
 await assert.rejects(pipeline.review(async()=>({visual_review:{scores,findings:[]}}),{},[{label:'Editing',bytes:Buffer.from('image')}]),/omitted screen-level/);
});
