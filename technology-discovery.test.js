const test=require('node:test'),assert=require('node:assert/strict');const {recommendTechnology}=require('./technology-discovery');
test('matches capabilities without inventing pricing',()=>{const r=recommendTechnology('authentication database',[{name:'Example',capabilities:['authentication'],sourceUrl:'https://example.com'}]);assert.equal(r[0].pricing,'unverified');assert.equal(r[0].requiresReview,true);});
test('ranks verified providers higher at same match',()=>{const c=[{name:'B',capabilities:['database']},{name:'A',capabilities:['database'],freeTierVerified:true}];assert.equal(recommendTechnology('database',c)[0].name,'A');});
test('does not claim providers from an empty catalog',()=>assert.deepEqual(recommendTechnology('database',[]),[]));
