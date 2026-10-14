"use strict";
// Child process that runs app SQL. Runaway queries cannot be interrupted inside
// SQLite, so the parent kills this process when a query overruns its time limit.
const sql=require('./react-sql');
process.on('message',msg=>{
 let reply;
 try{
  const value=msg.op==='query'?sql.query(msg.dir,msg.sql,msg.params):msg.op==='batch'?sql.batch(msg.dir,msg.steps):msg.op==='migrate'?sql.migrate(msg.dir,msg.files):msg.op==='close'?(sql.close(msg.dir),null):(()=>{throw Error('Unknown SQL operation')})();
  reply={id:msg.id,ok:true,value};
 }catch(e){reply={id:msg.id,ok:false,status:e.status||500,message:String(e.message||e)}}
 process.send(reply);
});
process.on('disconnect',()=>process.exit(0));
