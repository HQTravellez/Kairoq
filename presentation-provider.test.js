const test=require('node:test');const assert=require('node:assert/strict');const {PROVIDERS,selectPresentationProvider}=require('./presentation-provider');
test('recognizes presentation requests',()=>assert.equal(selectPresentationProvider('Build a 10-slide pitch deck').provider,'native'));
test('does not run unapproved Dashi',()=>{const r=selectPresentationProvider('Make PowerPoint',{provider:'dashi'});assert.equal(r.provider,'native');assert.match(r.reason,/disabled/);});
test('ignores unrelated requests',()=>assert.equal(selectPresentationProvider('Build booking API').kind,'not-presentation'));
test('requires approval before enabling Dashi',()=>assert.equal(PROVIDERS.dashi.enabled,false));
