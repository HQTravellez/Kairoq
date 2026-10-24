'use strict';
// Optional real upstream compatibility checks. No downloads, model calls or hook init.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const pins=require('../integrations/agent-stack/upstreams.json');
async function main() {
 const root=process.env.KAIROQ_UPSTREAM_CHECKOUTS;
 if(!root)throw Error('KAIROQ_UPSTREAM_CHECKOUTS required; clone exact commits from upstreams.json first');
 for(const [name,pin] of Object.entries(pins))assert.equal(cp.execFileSync('git',['-C',path.join(root,name),'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin.commit,'Upstream pin mismatch: '+name);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-upstream-proof-'));
 try{
  // Compile only the published schema source, never execute upstream install/skill scripts.
  const ts=require('typescript'),Module=require('node:module');
  const src=fs.readFileSync(path.join(root,'understand-anything/understand-anything-plugin/packages/core/src/schema.ts'),'utf8');
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const mod=new Module(path.resolve(__dirname,'../.agent-stack-schema.cjs'),module);mod.filename=mod.id;mod.paths=module.paths;mod._compile(js,mod.filename);
  const graph=require('../integrations/agent-stack/understand').graph({'a.js':"require('./b')",'b.js':'module.exports=1'},{commit:'a'.repeat(40)});
  mod.exports.KnowledgeGraphSchema.parse(graph);
  // Actual Python stage() -> durable upstream queue -> JS review candidate -> durable Kairoq log.
  const python=process.env.KAIROQ_PYTHON || 'python3';
  const intent={action:'create',level:'project',name:'check-form',body:'---\nname: check-form\ndescription: Use when checking form validation\n---\nInspect required fields and test a rejected submission.',reason:'Validation failure',evidence:'A synthetic test form rejected a missing field'};
  const result=cp.spawnSync(python,['-c',`import json,sys\nfrom autoharness.stage_skill.server import stage\nfrom autoharness.lib.intent_queue import read\nr=stage(json.loads(sys.stdin.read()),run_id='kairoq-test',root=sys.argv[1])\nassert r['ok'],r\nassert len(read('kairoq-test',sys.argv[1]))==1\nprint(json.dumps(r['intent']))`,tmp],{
   input:JSON.stringify(intent),encoding:'utf8',timeout:10000,
   env:{PATH:process.env.PATH,HOME:tmp,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:path.join(root,'autoharness/src'),AUTOHARNESS_DISABLE_GLOBAL:'1'}});
  assert.equal(result.status,0,result.stderr || result.stdout);
  process.env.KAIROQ_AUTONOMY_DIR=path.join(tmp,'kairoq-events');
  const staged=await require('../integrations/agent-stack/autoharness').stage({ownerId:'synthetic-owner',projectId:'test-project',intent:JSON.parse(result.stdout)});
  assert.equal(staged.status,'pending-review');assert.equal(fs.existsSync(path.join(tmp,'skills')),false);
  const stored=fs.readdirSync(process.env.KAIROQ_AUTONOMY_DIR);assert.equal(stored.length,1);
  const events=fs.readFileSync(path.join(process.env.KAIROQ_AUTONOMY_DIR,stored[0]),'utf8');assert.equal(JSON.parse(events).verified,false);
  let ruflo={status:'not-run'};
  if(process.env.KAIROQ_RUFLO_BIN)ruflo=await require('../integrations/agent-stack/ruflo').capabilities({enabled:true,command:process.env.KAIROQ_RUFLO_BIN,args:['mcp','start']});
  console.log(JSON.stringify({understand:'actual upstream schema passed',autoharness:'actual stage/queue to durable inert candidate passed',ruflo,
   mem0:'HTTP contract tested separately; actual server/model/vector persistence unverified',pins},null,2));
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
