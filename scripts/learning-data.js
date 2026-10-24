'use strict';
// Local operator interface. Produces procedural SFT candidates, never starts training.
async function main(args=process.argv.slice(2)){
 const [mode,id,digest,approval]=args;
 if(!['list','review','revoke','export'].includes(mode)||!id)throw Error('Usage: learning-data list|review|revoke|export PROJECT_ID [DIGEST --approve]');
 const meta=require('../react-builder').loadMeta(id),learning=require('../verified-learning');
 if(mode==='list')return JSON.stringify(await learning.entries(meta),null,2);
 if(mode==='review')return JSON.stringify(await learning.review({meta,digest,approved:approval==='--approve'}));
 if(mode==='revoke')return JSON.stringify(await learning.revoke({meta,digest}));
 return(await learning.trainingExamples(meta)).map(x=>JSON.stringify(x)).join('\n');
}
if(require.main===module)main().then(x=>{if(x)process.stdout.write(x+'\n')}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main};
