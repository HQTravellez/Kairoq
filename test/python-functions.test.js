"use strict";
// Python server functions (python-functions.js): the ctx helpers work, and the function cannot
// reach the server: no files, no environment, no network of its own, no JavaScript eval, and a
// function that runs too long is stopped.
const test=require('node:test'),assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.KAIROQ_FUNCTION_TIMEOUT_MS='3000';
const py=require('../python-functions'),functions=require('../react-functions');
const calls=[];
const host={
 secret:async n=>n==='SHOP_KEY'?'shh-123456':null,
 db:async(op,a,user)=>{calls.push({op,a,user});return op==='list'?[{id:'r1',item:'tea'},{id:'r2',item:'cake'}]:{id:'new',...a.data}},
 ai:async()=>({text:'hello'}),email:async()=>({sent:false,saved:true}),
};
const run=(source,{request={method:'POST',body:{}},user=null,key='app1'}={})=>py.invoke({key,source,request,user,host});
test.after(()=>py.shutdown());

test('Python files are checked like the other server functions',()=>{
 assert.deepEqual(functions.validate({'functions/report.py':'async def handler(request, ctx):\n    return {"json": 1}\n'}),[]);
 assert.match(functions.validate({'functions/report.py':'def main():\n    pass\n'}).join(),/handler/);
 assert.match(functions.validate({'functions/report.py':'import js\nasync def handler(request, ctx):\n    pass\n'}).join(),/cannot import js/);
 assert.match(functions.validate({'functions/report.py':'async def handler(r, c):\n    return __import__("os")\n'}).join(),/plain "import"/);
 assert.match(functions.validate({'functions/report.py':'async def handler(r,c):\n    pass\n','functions/report.js':'export default async function(){}'}).join(),/same function/);
 assert.equal(functions.functionFile({'functions/report.py':'x'},'report'),'functions/report.py');
});

test('a Python function uses the database, secrets, the signed-in user and logs',async()=>{
 const out=await run(`import statistics
async def handler(request, ctx):
    rows = await ctx.db.collection('orders').list({'limit': 5})
    key = await ctx.secrets.get('SHOP_KEY')
    created = await ctx.db.collection('orders').create({'item': request['body']['item']})
    ctx.log('rows', len(rows))
    return {'status': 201, 'json': {'n': len(rows), 'key': key[:4], 'user': ctx.user['email'], 'id': created['id'], 'mean': statistics.mean([1, 2, 3])}}
`,{request:{method:'POST',body:{item:'pie'}},user:{id:'u1',email:'ana@x.co'}});
 assert.deepEqual(out.result,{status:201,json:{n:2,key:'shh-',user:'ana@x.co',id:'new',mean:2}});
 assert.deepEqual(out.logs,['rows 2']);
 assert.equal(calls.find(c=>c.op==='create').a.data.item,'pie');
 assert.equal(calls.find(c=>c.op==='create').user.id,'u1','calls carry the user');
});

test('a Python function cannot reach the server',async()=>{
 const tryIt=async src=>{try{return (await run(src)).result.json}catch(e){return 'error: '+e.message}};
 const env=await tryIt('import os\ndef handler(r, c):\n    return {"json": dict(os.environ)}');
 assert.ok(!Object.keys(env).some(k=>/DATABASE|KEY|SECRET|TOKEN|RAILWAY/.test(k)),'no server environment');
 assert.match(await tryIt('def handler(r, c):\n    return {"json": open("/etc/hostname").read()}'),/No such file/);
 assert.match(await tryIt('import socket\ndef handler(r, c):\n    socket.create_connection(("example.com", 80), timeout=3)\n    return {"json": "connected"}'),/unreachable|error/i);
 assert.match(await tryIt('def handler(r, c):\n    m = __builtins__["__import__"]("js")\n    return {"json": str(m.Object.constructor("return process")())}'),/Code generation from strings disallowed/);
 assert.match(await tryIt('def handler(r, c):\n    m = __builtins__["__import__"]("pyodide_js")\n    return {"json": str(m)}'),/No module named/);
 assert.match(await tryIt('async def handler(r, c):\n    x = await c.fetch("http://127.0.0.1:5432/")\n    return {"json": x.status}'),/private network/);
});

test('a Python function that runs too long is stopped, and the next call works',async()=>{
 const started=Date.now();
 await assert.rejects(run('def handler(r, c):\n    while True:\n        pass\n'),/timed out/);
 assert.ok(Date.now()-started<8000);
 assert.equal((await run('def handler(r, c):\n    return {"json": "ok"}')).result.json,'ok');
});

test('apps never share a Python process',async()=>{
 await run('import builtins\nbuiltins.kairoq_marker = "app1"\ndef handler(r, c):\n    return {"json": 1}',{key:'app1'});
 const other=await run('import builtins\ndef handler(r, c):\n    return {"json": getattr(builtins, "kairoq_marker", None)}',{key:'app2'});
 assert.equal(other.result.json,null);
});
