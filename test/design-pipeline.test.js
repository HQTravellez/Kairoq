'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const pipeline=require('../design-pipeline'),system=require('../design-system');
const scores=Object.fromEntries(pipeline.axes.map(n=>[n,4.2]));
test('visual gate rejects weak dimensions, major findings and malformed scores',()=>{
 assert.equal(pipeline.normalizeReview({scores,findings:[]}).passed,true);
 assert.equal(pipeline.normalizeReview({scores:{...scores,mobile:3},findings:[]}).passed,false);
 assert.equal(pipeline.normalizeReview({scores,findings:[{severity:'major',issue:'Clipped navigation',fix:'Wrap the mobile navigation'}]}).passed,false);
 assert.throws(()=>pipeline.normalizeReview({scores:{...scores,identity:'5'},findings:[]}),/Invalid visual score/);
});
test('visual reviewer receives actual image payloads and DOM issues cannot be overridden',async()=>{
 let request;const bytes=Buffer.from('synthetic-test-image');const review=await pipeline.review(async opts=>{request=opts;return{visual_review:{scores,findings:[]}};},{purpose:'Test'},[{label:'Mobile',bytes}],[{severity:'major',screen:'Mobile',issue:'Contrast',fix:'Increase contrast'}]);
 assert.equal(request.purpose,'design-review');assert.equal(request.messages[0].content[2].image_url.url,'data:image/jpeg;base64,'+bytes.toString('base64'));assert.equal(review.passed,false);assert.equal(review.evidence[0].sha256.length,64);assert.ok(!JSON.stringify(review).includes(bytes.toString('base64')));
});
test('foundation is idempotent and previous design plans avoid another model call',async()=>{
 const files={'styles.css':'.custom{color:green}'};const once=system.apply(files,'luxury'),twice=system.apply(once,'luxury');assert.equal(once['styles.css'],twice['styles.css']);assert.match(once['styles.css'],/\.kq-button/);const previous={purpose:'Preserved identity'};assert.equal(await pipeline.plan(()=>{throw Error('unexpected model call');},{previous}),previous);
});
