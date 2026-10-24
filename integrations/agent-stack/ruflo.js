'use strict';
// Capability-only MCP handshake. Deliberately has no tools/call or hook/init API.
const cp=require('node:child_process'), fs=require('node:fs'), os=require('node:os'), path=require('node:path');
async function capabilities({enabled=false,command,args=[],timeoutMs=10000}={}) {
  if (!enabled) return {status:'disabled',tools:[]};
  if (!path.isAbsolute(command || '') || !fs.existsSync(command) || !Array.isArray(args) || args.some(a=>typeof a!=='string')) throw Error('Reviewed absolute MCP executable required');
  if (!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000) throw Error('Invalid timeout');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-ruflo-'));
  try {
    return await new Promise((resolve,reject)=>{
      let child,buffer='',bytes=0,done=false,phase=1;
      const finish=(err,value)=>{if(done)return;done=true;clearTimeout(timer);child?.kill('SIGKILL');err?reject(err):resolve(value);};
      const timer=setTimeout(()=>finish(Error('Ruflo MCP timeout')),timeoutMs);
      child=cp.spawn(command,args,{cwd:root,shell:false,env:{PATH:path.dirname(process.execPath)+':'+path.dirname(command)+':/usr/bin:/bin',HOME:root,TMPDIR:root,
        CI:'true',DO_NOT_TRACK:'1',RUFLO_TELEMETRY_DISABLED:'1'},stdio:['pipe','pipe','pipe']});
      child.on('error',e=>finish(e));child.on('close',()=>{if(!done)finish(Error('Ruflo MCP exited before capabilities'));});
      child.stdin.on('error',e=>finish(e));
      const send=v=>child.stdin.write(JSON.stringify(v)+'\n');
      child.stderr.on('data',chunk=>{bytes+=chunk.length;if(bytes>1_000_000)finish(Error('Ruflo MCP output limit'));});
      child.stdout.on('data',chunk=>{
        bytes+=chunk.length;if(bytes>1_000_000)return finish(Error('Ruflo MCP output limit'));
        buffer+=chunk.toString();let end;
        while((end=buffer.indexOf('\n'))>=0) {
          const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;
          let msg;try{msg=JSON.parse(line);}catch{return finish(Error('Non-JSON MCP stdout'));}
          if(msg.id===phase&&msg.error)return finish(Error('Ruflo MCP protocol error'));
          if(msg.id===1&&phase===1) {
            if(!msg.result?.capabilities?.tools) return finish(Error('MCP tools capability missing'));
            phase=2;send({jsonrpc:'2.0',method:'notifications/initialized'});send({jsonrpc:'2.0',id:2,method:'tools/list',params:{}});
          } else if(msg.id===2&&phase===2) {
            const list=msg.result?.tools;
            if(!Array.isArray(list)||list.length>2000||list.some(t=>typeof t.name!=='string'||t.name.length>200))return finish(Error('Invalid MCP tools list'));
            finish(null,{status:'capabilities-only',tools:list.map(t=>t.name).sort(),hasMore:Boolean(msg.result.nextCursor),canExecute:false});
          }
        }
      });
      send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'kairoq-capability-probe',version:'1.0.0'}}});
    });
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
module.exports={capabilities};
