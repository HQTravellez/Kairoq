const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {save}=require('../housing-builder'),{starter}=require('../developer-starter');
test('housing builder accepts both nested and direct model file objects without discarding HTML',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'housing-output-'));const p=starter('Corporate housing enquiry tracker','Housing','editorial');
 try{for(const result of [p,p.files]){save(result,null,dir);assert.equal(fs.readFileSync(path.join(dir,'index.html'),'utf8'),p.files['index.html']);}assert.throws(()=>save({files:{'index.html':'incomplete'}},null,dir),/Missing|Incomplete/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
