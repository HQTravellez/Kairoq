'use strict';
// Explicit, read-only live-provider smoke test. Never runs in normal CI.
const fs=require('node:fs');
const api=require('../api-learning');
const adapter=require('../api-adapter');
async function main(){
 if(process.env.KAIROQ_SANDBOX_CONFIRM!=='READ_ONLY_SANDBOX')throw Error('Set KAIROQ_SANDBOX_CONFIRM=READ_ONLY_SANDBOX explicitly');
 const specFile=process.env.KAIROQ_SANDBOX_SPEC_FILE;
 const operationId=process.env.KAIROQ_SANDBOX_OPERATION_ID;
 if(!specFile||!operationId)throw Error('Set KAIROQ_SANDBOX_SPEC_FILE and KAIROQ_SANDBOX_OPERATION_ID');
 const contract=api.learn(fs.readFileSync(specFile,'utf8'));
 const op=contract.operations.find(o=>o.id===operationId);
 if(!op||!['GET','HEAD'].includes(op.method))throw Error('Only documented read-only GET/HEAD operations are supported');
 if(!contract.baseUrl)throw Error('A single HTTPS sandbox base URL is required');
 const host=new URL(contract.baseUrl).hostname;
 if(!/sandbox|test|staging|mock/i.test(host)&&process.env.KAIROQ_SANDBOX_HOST_CONFIRM!==host)throw Error('Explicit sandbox host confirmation required');
 const credentialName=process.env.KAIROQ_SANDBOX_CREDENTIAL_NAME;
 if(credentialName&&!/^KAIROQ_API_TOKEN_[A-Z0-9_]{1,64}$/.test(credentialName))throw Error('Use a dedicated server-side credential');
 const args={plan:contract,operationId,approved:true,credentialName,
  pathParams:JSON.parse(process.env.KAIROQ_SANDBOX_PATH_PARAMS||'{}'),
  query:JSON.parse(process.env.KAIROQ_SANDBOX_QUERY||'{}')};
 // This process alone opts in to the exact host and operation. No provider writes.
 process.env.KAIROQ_API_LIVE_ENABLED='true';
 process.env.KAIROQ_API_HOSTS=host;
 process.env.KAIROQ_API_APPROVED_OPERATIONS=host+':'+op.method+':'+op.path;
 process.env.KAIROQ_API_WRITE_ENABLED='false';
 process.env.KAIROQ_API_APPROVED_WRITES='';
 const result=await adapter.execute(args);
 if(!result.ok)throw Error('Provider returned HTTP '+result.status);
 const schema=op.responseSchemas?.[String(result.status)];
 if(schema&&Object.keys(schema).length)require('../api-validation').validate(schema,result.data,'sandbox.response');
 console.log(JSON.stringify({kind:'live-read-only-provider-smoke',provider:contract.title,host,operationId,
  status:result.status,responseSchemaValidated:!!schema&&Object.keys(schema).length>0,
  note:'Actual provider call completed; this does not verify booking, OAuth, persistence or deployed routing.'}));
}
if(require.main===module)main().catch(e=>{console.error('SANDBOX SMOKE FAILED: '+e.message);process.exitCode=1;});
module.exports={main};
