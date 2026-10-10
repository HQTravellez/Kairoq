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
test('legacy and checkpoint plans regain authoritative scope without treating repair feedback as feature requirements',async()=>{
 const legacy={purpose:'Preserved identity',layout:'Suggested policy settings'};
 const brief='Provide trips, expenses and a workflow Controls screen';
 const restored=await pipeline.plan(()=>{throw Error('must reuse identity');},{previous:legacy,brief});
 assert.equal(restored.user_brief,brief);assert.equal(restored.layout,legacy.layout);assert.equal(legacy.user_brief,undefined);
 const builder=require('../app-builder'),previous={brief};
 assert.equal(builder.featureBrief({operation:'repair',brief:'Reviewer demands editable policy settings'},previous),brief);
 assert.match(builder.featureBrief({operation:'revise',brief:'Add editable travel policies'},previous),/Requested change: Add editable travel policies/);
 let request;await pipeline.review(async options=>{request=options;return{visual_review:{scores,findings:[],screen_reviews:[{screen:'Desktop Controls',scores,findings:[]}]}};},pipeline.restoreScope(legacy,brief),[{label:'Desktop Controls',bytes:Buffer.from('fixture')}]);
 assert.match(request.messages[0].content[0].text,/ORIGINAL USER BRIEF .*Provide trips, expenses and a workflow Controls screen/);
 assert.match(request.messages[0].content[0].text,/do not infer those editors from a navigation label/);
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
test('incomplete model reports get one bounded retry without lowering the gate',async()=>{
 let calls=0;const result=await pipeline.review(async()=>{calls++;return{visual_review:{scores,findings:[],...(calls===2?{screen_reviews:[{screen:'Saving',scores,findings:[]}]}:{})}};},{},[{label:'Saving',bytes:Buffer.from('image')}]);assert.equal(calls,2);assert.equal(result.passed,true);assert.equal(result.coverage.complete,true);
});
test('desktop states do not invent mobile scores, while real mobile failures remain blocking',async()=>{
 const report=await pipeline.review(async opts=>{const screen=opts.messages[0].content[1].text;return{visual_review:{scores:{...scores,mobile:null},findings:[],screen_reviews:[{screen,scores:{...scores,mobile:null},findings:[]}]}};},{},[{label:'Desktop editing · 1440px',bytes:Buffer.from('image')}]);assert.equal(report.passed,true);assert.equal(report.scores.mobile,null);assert.equal(report.screen_reviews[0].scores.mobile,null);
 assert.equal(pipeline.normalizeReview({scores:{...scores,mobile:2},findings:[]}).passed,false);
});

test('visual repair evidence records a failing screenshot then an improved screenshot without weakening thresholds',async()=>{
 const broken=Buffer.from('before-repair'),fixed=Buffer.from('after-repair');
 let calls=0;const model=async opts=>{calls++;const label=opts.messages[0].content[1].text;const good=calls===2;return{visual_review:{scores:good?scores:{...scores,spacing:2},findings:good?[]:[{severity:'major',issue:'Dashboard panels overlap',fix:'Use responsive columns'}],screen_reviews:[{screen:label,scores:good?scores:{...scores,spacing:2},findings:good?[]:[{severity:'major',issue:'Dashboard panels overlap',fix:'Use responsive columns'}]}]}};};
 const before=await pipeline.review(model,{},[{label:'Desktop dashboard · 1440px',bytes:broken}]);
 const after=await pipeline.review(model,{},[{label:'Desktop dashboard · 1440px',bytes:fixed}]);
 assert.equal(before.passed,false);assert.equal(after.passed,true);assert.notEqual(before.evidence[0].sha256,after.evidence[0].sha256);
 assert.match(pipeline.repairInstructions(before),/Dashboard panels overlap/);
 assert.equal(before.coverage.complete,true);assert.equal(after.coverage.complete,true);
});

test('mixed viewport review derives missing aggregate mobile score from actual mobile screenshot and refuses missing evidence',async()=>{
 const screens=[{label:'Desktop view · 1440px',bytes:Buffer.from('a')},{label:'Mobile view · 390px',bytes:Buffer.from('b')}];
 const result=await pipeline.review(async opts=>({visual_review:{scores:{...scores,mobile:null},findings:[],screen_reviews:opts.messages[0].content.filter(x=>x.type==='text').slice(1).map(x=>({screen:x.text,scores:{...scores,mobile:x.text.startsWith('Mobile')?4.2:null},findings:[]}))}}),{},screens);
 assert.equal(result.passed,true);assert.equal(result.scores.mobile,4.2);
 const fail=await pipeline.review(async opts=>({visual_review:{scores:{...scores,mobile:null},findings:[],screen_reviews:opts.messages[0].content.filter(x=>x.type==='text').slice(1).map(x=>({screen:x.text,scores:{...scores,mobile:x.text.startsWith('Mobile')?2:null},findings:[]}))}}),{},screens);
 assert.equal(fail.passed,false);
});

test('visual batch timeout aborts the provider request rather than leaving work queued',async()=>{
 let signal;
 await assert.rejects(pipeline.callVisualModel(async opts=>{signal=opts.signal;return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(opts.signal.reason),{once:true}));},{purpose:'design-review'},{timeoutMs:15}),/batch timed out/);
 assert.equal(signal.aborted,true);
});
test('visual request finishing inside its deadline remains usable and clears its timer',async()=>{
 let signal;const result=await pipeline.callVisualModel(async opts=>{signal=opts.signal;return{review:'complete'};},{purpose:'design-review'},{timeoutMs:15});
 assert.deepEqual(result,{review:'complete'});assert.equal(signal.aborted,false);
});

test('malformed mobile verdict retries only its batch and retains earlier screenshot coverage',async()=>{
 const shots=[...Array.from({length:5},(_,i)=>({label:'Desktop '+i+' · 1440px',bytes:Buffer.from('desktop '+i)})),{label:'Mobile pricing · 390px',bytes:Buffer.from('mobile')}];let calls=0;
 const report=await pipeline.review(async opts=>{calls++;const labels=opts.messages[0].content.filter(item=>item.type==='text').slice(1).map(item=>item.text);return{visual_review:{scores:{...scores,mobile:null},findings:[],screen_reviews:labels.map(screen=>({screen,scores:{...scores,mobile:screen.startsWith('Mobile')?(calls===2?null:4):null},findings:[]}))}};},{},shots);
 assert.equal(calls,3);assert.equal(report.passed,true);assert.equal(report.coverage.reviewed,6);assert.equal(report.coverage.mode,'ai-screenshot-review');assert.equal(report.scores.mobile,4);
});
test('persistent malformed mobile scores exhaust bounded retries without becoming passing evidence',async()=>{let calls=0;await assert.rejects(pipeline.review(async()=>{calls++;return{visual_review:{scores,findings:[],screen_reviews:[{screen:'Mobile · 390px',scores:{...scores,mobile:null},findings:[]}]}};},{},[{label:'Mobile · 390px',bytes:Buffer.from('image')}]),/invalid after 3 attempts: Invalid visual score: mobile/);assert.equal(calls,3);});
