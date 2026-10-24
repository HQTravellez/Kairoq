'use strict';
const readline=require('node:readline');
readline.createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line),reply=result=>console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result}));
 if(m.method==='initialize')reply({capabilities:{tools:{}},protocolVersion:'2024-11-05',serverInfo:{name:'fixture',version:'1'}});
 else if(m.method==='notifications/initialized')return;
 else if(m.method==='tools/list')reply({tools:[{name:'memory_search'},{name:'agent_spawn'}]});
 else process.exit(3);
});
