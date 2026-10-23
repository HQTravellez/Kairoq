import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeStudio} from './knowledge-studio.js';
test('ingests and retrieves with provenance',()=>{
 const store=createKnowledgeStudio();
 const doc=store.ingest({name:'hotel.md',mimeType:'text/markdown',content:'Hotel reservation API uses OAuth token.',ownerId:'a'});
 const result=store.search({query:'hotel OAuth',ownerId:'a'});
 assert.equal(result[0].documentId,doc.id);
 assert.equal(result[0].sourceVersion,'1');
 assert.ok(result[0].excerpt.includes('OAuth'));
});
test('isolates owners',()=>{
 const store=createKnowledgeStudio();
 store.ingest({name:'private.txt',mimeType:'text/plain',content:'Secret corporate hotel inventory',ownerId:'a'});
 assert.equal(store.search({query:'corporate hotel',ownerId:'b'}).length,0);
 assert.equal(store.list('b').length,0);
});
test('rejects unsupported binary formats until extraction is sandboxed',()=>{
 const store=createKnowledgeStudio();
 assert.throws(()=>store.ingest({name:'manual.pdf',mimeType:'application/pdf',content:'x',ownerId:'a'}),/Unsupported/);
});
test('deletes only owner documents',()=>{
 const store=createKnowledgeStudio();
 const d=store.ingest({name:'a',mimeType:'text/plain',content:'Booking endpoints',ownerId:'a'});
 assert.equal(store.remove(d.id,'b'),false);
 assert.equal(store.remove(d.id,'a'),true);
 assert.equal(store.list('a').length,0);
});
