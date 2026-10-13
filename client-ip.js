"use strict";
// The client's address as seen by our proxy. Railway (and most proxies) append the
// real address to X-Forwarded-For, so the last entry is trustworthy; earlier entries
// are whatever the client sent and must not be used for rate limits.
function clientIp(req){
 const parts=String(req.headers['x-forwarded-for']||'').split(',').map(s=>s.trim()).filter(Boolean);
 return parts.at(-1)||req.socket?.remoteAddress||'local';
}
module.exports={clientIp};
