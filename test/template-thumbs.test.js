"use strict";
// Template pictures for the gallery: a link only once a picture exists, and a new link when
// the template changes.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-thumbs-'));
process.env.KAIROQ_TEMPLATE_THUMBS_DIR=tmp;
const thumbs=require('../template-thumbs'),templates=require('../create-templates');

test('a template has a picture link only after its picture is taken',()=>{
 const t=templates.get('restaurant');
 assert.equal(thumbs.url(t),null);assert.equal(thumbs.read('restaurant'),null);
 fs.writeFileSync(thumbs.file(t),Buffer.from([0xff,0xd8,0xff]));
 assert.equal(thumbs.url(t),'/api/create/templates/restaurant/thumb.jpg?v='+thumbs.key(t));
 assert.deepEqual([...thumbs.read('restaurant')],[0xff,0xd8,0xff]);
 assert.equal(thumbs.read('../../etc/passwd'),null);
 // A changed template needs a new picture.
 const changed={...t,files:{...t.files,'src/App.jsx':'export default()=>null'}};
 assert.notEqual(thumbs.key(changed),thumbs.key(t));assert.equal(thumbs.url(changed),null);
});
