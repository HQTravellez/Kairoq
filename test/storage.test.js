"use strict";
// Kairoq's data goes onto a persistent volume when one is attached, so a deploy cannot wipe
// accounts and projects; without one, the owner is warned.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const storage=require('../storage');

test('workspace moves onto the volume, keeps what was there, and is linked back',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-storage-'));
 const root=path.join(tmp,'app'),vol=path.join(tmp,'data');
 fs.mkdirSync(path.join(root,'workspace','react-projects'),{recursive:true});
 fs.writeFileSync(path.join(root,'workspace','builder-accounts.sqlite'),'local');
 fs.mkdirSync(path.join(vol,'workspace'),{recursive:true});
 fs.writeFileSync(path.join(vol,'workspace','builder-accounts.sqlite'),'on the volume');
 const r=storage.prepare({root,env:{RAILWAY_VOLUME_MOUNT_PATH:vol},log:()=>{}});
 assert.equal(r.persistent,true);
 assert.ok(fs.lstatSync(path.join(root,'workspace')).isSymbolicLink());
 // Data already on the volume wins; new folders from the container are copied over.
 assert.equal(fs.readFileSync(path.join(root,'workspace','builder-accounts.sqlite'),'utf8'),'on the volume');
 assert.ok(fs.existsSync(path.join(vol,'workspace','react-projects')));
 // A second start (a redeploy) finds it already in place.
 assert.equal(storage.prepare({root,env:{RAILWAY_VOLUME_MOUNT_PATH:vol},log:()=>{}}).persistent,true);
 assert.equal(storage.status({root,env:{NODE_ENV:'production'}}).persistent,true);
 fs.rmSync(tmp,{recursive:true,force:true});
});
test('without a volume a production server reports that its data is not safe',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-storage-'));
 fs.mkdirSync(path.join(root,'workspace'));
 assert.equal(storage.prepare({root,env:{},log:()=>{}}).persistent,false);
 assert.equal(storage.status({root,env:{NODE_ENV:'production'}}).persistent,false);
 assert.equal(storage.status({root,env:{NODE_ENV:'production',KAIROQ_REACT_PROJECTS_DIR:'/x',KAIROQ_BUILDER_ACCOUNTS_DB:'/y'}}).persistent,true);
 fs.rmSync(root,{recursive:true,force:true});
});
