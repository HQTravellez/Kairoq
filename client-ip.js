"use strict";
// The client's address as seen by our proxy. Railway (and most proxies) append the
// real address to X-Forwarded-For, so the last entry is trustworthy; earlier entries
// are whatever the client sent and must not be used for rate limits.
// X-Forwarded-For is only trusted when the connection comes from a proxy on a private or
// loopback address (Railway's edge, a local reverse proxy); direct clients can't spoof it.
function privateHop(ip){const a=String(ip||'').replace(/^::ffff:/,'');return a==='::1'||/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.)/.test(a)||/^f[cd]/i.test(a)}
function clientIp(req){
 const peer=req.socket?.remoteAddress||'';
 if(process.env.KAIROQ_TRUST_PROXY!=='false'&&(privateHop(peer)||process.env.KAIROQ_TRUST_PROXY==='true')){
  const parts=String(req.headers['x-forwarded-for']||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(parts.length)return parts.at(-1);
 }
 return peer||'local';
}
module.exports={clientIp};
