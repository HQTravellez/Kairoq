'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-voice-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_DESIGN_BRIEF:'off',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'accounts.sqlite')});
const builder=require('../react-builder'),assets=require('../voice-assets'),tools=require('../builder-tools');
test('builder narration is stored and copied into actual app build assets',async()=>{
 const project=builder.create({name:'Heart narration',owner:'owner'}),wav=Buffer.from('RIFFtestWAVEaudio');
 const result=await assets.narrate(project.id,{text:'Hello'},{service:{speech:async()=>wav}});
 assert.match(result,/\.\/narration\/narration-[a-f0-9]{16}\.wav/);
 const dest=path.join(tmp,'public');assets.copyInto(project.id,dest);
 assert.deepEqual(fs.readFileSync(path.join(dest,'narration',assets.list(project.id)[0])),wav);
});
test('builder tool fails honestly without configured service',async()=>{
 const project=builder.create({name:'Voice',owner:'owner'});
 delete process.env.KAIROQ_VOICE_URL;delete process.env.KAIROQ_VOICE_KEY;
 await assert.rejects(tools.forProject(project.id).run('narrate',{text:'Hello'}),/not configured/);
 assert.equal(assets.list(project.id).length,0);
});
