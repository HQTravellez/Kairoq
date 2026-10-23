// Runs Python server functions (functions/<name>.py) in Pyodide, Python compiled to
// WebAssembly. python-functions.js starts this file as a child process with no environment,
// as an unprivileged user, under Node's permission model (read access to Pyodide's files only,
// no writes, no child processes, no workers, no native addons) and with code generation from
// strings disabled. Here, before any function runs, everything that reaches past the sandbox is
// removed: fetch, sockets, built-in modules, signals to other processes. The function talks to
// the server only through __kq_host, which python-functions.js answers with the same limits as
// JavaScript functions (database, secrets, guarded fetch, AI, email).
import constants from 'node:constants';
// Pyodide reads file-system constants through process.binding, which the permission model refuses.
process.binding=n=>n==='constants'?{fs:constants,os:constants}:{};
const send=process.send.bind(process);
const {loadPyodide}=await import('pyodide');

const pending=new Map();let seq=0;
const host=(op,args)=>new Promise((resolve,reject)=>{const callId=++seq;pending.set(callId,{resolve,reject});send({type:'host',callId,op,args})});
let logs=[];
const py=await loadPyodide({
 jsglobals:{Object,Array,JSON,Promise,__kq_host:host,__kq_log:line=>{if(logs.length<50)logs.push(String(line).slice(0,1000))}},
 stdout:line=>{if(logs.length<50)logs.push(String(line).slice(0,1000))},
 stderr:line=>{if(logs.length<50)logs.push(String(line).slice(0,1000))},
});
for(const k of ['fetch','WebSocket','EventSource','navigator','XMLHttpRequest'])try{delete globalThis[k]}catch{}
for(const k of ['getBuiltinModule','kill','dlopen','_linkedBinding','chdir','setuid','setgid','seteuid','setegid','setgroups','initgroups','_debugProcess','_kill','abort','reallyExit'])try{Object.defineProperty(process,k,{value:undefined,configurable:false,writable:false})}catch{}

await py.runPythonAsync(`
import json as _json, hmac as _hmac, hashlib as _hashlib, uuid as _uuid, sys as _sys
import js as _js
_kq_log = getattr(_js, '__kq_log')
async def _kq_call(op, args):
    r = _json.loads(await _js.__kq_host(op, _json.dumps(args)))
    if 'error' in r:
        raise RuntimeError(r['error'])
    return r.get('value')
class _Collection:
    def __init__(self, name): self._n = name
    async def list(self, options=None): return await _kq_call('db.list', {'collection': self._n, **(options or {})})
    async def get(self, id): return await _kq_call('db.get', {'collection': self._n, 'id': id})
    async def create(self, data): return await _kq_call('db.create', {'collection': self._n, 'data': data})
    async def update(self, id, data): return await _kq_call('db.update', {'collection': self._n, 'id': id, 'data': data})
    async def remove(self, id): return await _kq_call('db.remove', {'collection': self._n, 'id': id})
class _Db:
    def collection(self, name): return _Collection(name)
    async def sql(self, query, params=None): return await _kq_call('sql', {'query': query, 'params': list(params or [])})
    async def batch(self, steps): return await _kq_call('sql.batch', {'steps': steps})
class _Secrets:
    async def get(self, name): return await _kq_call('secret', {'name': str(name)})
class _Ai:
    async def chat(self, **o): return await _kq_call('ai.chat', o)
    async def ask(self, question, **o): return await _kq_call('ai.ask', {**o, 'question': question})
    async def extract(self, **o): return await _kq_call('ai.extract', o)
class _Email:
    async def send(self, **o): return await _kq_call('email', o)
class _Response:
    def __init__(self, r): self.status = r['status']; self.headers = r['headers']; self.text = r['body']; self.ok = 200 <= self.status < 300
    def json(self): return _json.loads(self.text)
async def _fetch(url, method='GET', headers=None, body=None, json=None):
    if json is not None:
        body = _json.dumps(json); headers = {'Content-Type': 'application/json', **(headers or {})}
    return _Response(await _kq_call('fetch', {'url': str(url), 'method': method, 'headers': headers or {}, 'body': None if body is None else str(body)}))
class _Crypto:
    def hmac_sha256_hex(self, key, message): return _hmac.new(str(key).encode(), str(message).encode(), _hashlib.sha256).hexdigest()
    def sha256_hex(self, message): return _hashlib.sha256(str(message).encode()).hexdigest()
    def timing_safe_equal(self, a, b): return _hmac.compare_digest(str(a), str(b))
    def random_id(self): return str(_uuid.uuid4())
class _Ctx:
    def __init__(self, user):
        self.user = user; self.db = _Db(); self.secrets = _Secrets(); self.ai = _Ai(); self.email = _Email()
        self.fetch = _fetch; self.crypto = _Crypto(); self.log = lambda *a: _kq_log(' '.join(str(x) for x in a))
# The internals the function must not reach are taken out of the module table.
for _m in ('pyodide_js', 'pyodide_js._api', '_pyodide.jsbind'):
    _sys.modules.pop(_m, None)
async def _kq_run(source, payload):
    data = _json.loads(payload)
    ns = {'__name__': 'function'}
    exec(compile(source, 'function.py', 'exec'), ns)
    fn = ns.get('handler')
    if not callable(fn):
        raise RuntimeError('The file must define handler(request, ctx)')
    out = fn(data['request'], _Ctx(data['user']))
    if hasattr(out, '__await__'):
        out = await out
    return _json.dumps(out if out is not None else {})
`);
const run=py.globals.get('_kq_run');
// Pyodide's own API is not importable from a function (it could mount files or load packages).
try{py.unregisterJsModule('pyodide_js')}catch{}

process.on('message',async msg=>{
 if(msg.type==='hostReply'){const p=pending.get(msg.callId);if(!p)return;pending.delete(msg.callId);p.resolve(msg.text);return}
 if(msg.type!=='run')return;
 logs=[];
 try{const text=await run(msg.source,JSON.stringify({request:msg.request,user:msg.user}));send({type:'done',id:msg.id,ok:true,text,logs})}
 catch(e){send({type:'done',id:msg.id,ok:false,message:String(e.message||e).split('\n').filter(Boolean).slice(-3).join(' ').slice(0,600),logs})}
});
send({type:'ready'});
