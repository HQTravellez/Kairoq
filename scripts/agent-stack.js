'use strict';
// Operator-only offline interchange CLI. No production routes or hook installation.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
async function main(args=process.argv.slice(2)) {
  const [mode,...rest]=args;
  if(mode==='status')return {ecc:'local-inspired-recall',understand:'static-graph-interchange',mem0:'experimental-opt-in-local-REST',ruflo:'experimental-capabilities-only',autoharness:'inert-review-candidates',hooksInstalled:false};
  if(mode==='graph') {
    if(rest.length)throw Error('graph takes no arguments; redirect stdout to save');
    const root=path.resolve(__dirname,'..');
    const git=a=>cp.execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
    const names=git(['ls-files','-z']).split('\0').filter(n=>require('../integrations/agent-stack/understand').safePath(n)&&/\.(?:[cm]?[jt]sx?|json|md|ya?ml)$/.test(n));
    const files=Object.fromEntries(names.filter(n=>!fs.lstatSync(path.join(root,n)).isSymbolicLink()).map(n=>[n,fs.readFileSync(path.join(root,n),'utf8')]));
    // Label dirty sources honestly: a commit hash is not proof that worktree contents match.
    if(git(['status','--porcelain']))throw Error('Graph export requires a clean committed checkout');
    return require('../integrations/agent-stack/understand').graph(files,{commit:git(['rev-parse','HEAD'])});
  }
  if(mode==='stage-autoharness') {
    if(rest.length!==3)throw Error('Usage: stage-autoharness OWNER_ID PROJECT_ID INTENT_JSON');
    const raw=fs.readFileSync(rest[2]);if(raw.length>6500)throw Error('Intent size limit');
    return require('../integrations/agent-stack/autoharness').stage({ownerId:rest[0],projectId:rest[1],intent:JSON.parse(raw)});
  }
  if(mode==='ruflo-capabilities') {
    if(rest.length!==1)throw Error('Usage: ruflo-capabilities ABSOLUTE_REVIEWED_RUFLO_BIN');
    return require('../integrations/agent-stack/ruflo').capabilities({enabled:true,command:rest[0],args:['mcp','start']});
  }
  throw Error('Use status, graph, stage-autoharness, or ruflo-capabilities');
}
if(require.main===module)main().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main};
