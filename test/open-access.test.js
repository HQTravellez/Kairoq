'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
process.env.NODE_ENV='test';

test('the temporary open door: only with a date at most 14 days ahead, and it closes by itself',()=>{
 const srv=require('../server');
 const req={headers:{},socket:{remoteAddress:'203.0.113.9'}};
 const was=process.env.KAIROQ_OPEN_ACCESS_UNTIL;
 try{
  delete process.env.KAIROQ_OPEN_ACCESS_UNTIL;assert.equal(srv.openAccessUntil(),0);
  process.env.KAIROQ_OPEN_ACCESS_UNTIL=new Date(Date.now()+3*86400000).toISOString();
  assert.ok(srv.openAccessUntil());assert.equal(srv.isAuthenticated(req),true);
  assert.ok(require('../setup-status').items().items.some(i=>i.id==='open'));
  process.env.KAIROQ_OPEN_ACCESS_UNTIL=new Date(Date.now()-60000).toISOString();assert.equal(srv.openAccessUntil(),0,'past: closed');
  process.env.KAIROQ_OPEN_ACCESS_UNTIL=new Date(Date.now()+30*86400000).toISOString();assert.equal(srv.openAccessUntil(),0,'too far ahead: ignored');
  process.env.KAIROQ_OPEN_ACCESS_UNTIL='soon';assert.equal(srv.openAccessUntil(),0);
 }finally{if(was===undefined)delete process.env.KAIROQ_OPEN_ACCESS_UNTIL;else process.env.KAIROQ_OPEN_ACCESS_UNTIL=was}
});
