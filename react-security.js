"use strict";
// Security scan for Create projects: checks the source and backend settings for common
// mistakes and explains each finding in plain language with a suggested fix.
const SECRET_PATTERNS=[
 [/\b(sk|rk)_(live|test)_[A-Za-z0-9]{10,}/,'a Stripe secret key'],
 [/\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/,'a GitHub token'],
 [/\bAKIA[0-9A-Z]{16}\b/,'an AWS access key'],
 [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,'a private key'],
 [/\bAIza[0-9A-Za-z_-]{35}\b/,'a Google API key'],
 [/\bxox[baprs]-[A-Za-z0-9-]{10,}/,'a Slack token'],
 [/\b(sk-[A-Za-z0-9]{20,}|sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,})/,'an AI provider API key'],
 [/\bre_[A-Za-z0-9]{20,}\b/,'a Resend API key'],
 [/(api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-+/=]{20,}['"]/i,'a hard-coded secret']
];
const PERSONAL=/(contact|booking|order|reservation|message|lead|customer|user|member|appointment|application|signup|waitlist|request|enquir|inquir|patient|guest|subscriber|registration|payment|invoice|address|phone)/i;
function lineOf(code,index){return code.slice(0,index).split('\n').length}
function scan(files,cfg){
 const findings=[];
 const add=(severity,title,detail,fix,file,line)=>findings.push({severity,title,detail,fix,...(file?{file}:{}),...(line?{line}:{})});
 for(const [file,code] of Object.entries(files)){
  if(typeof code!=='string')continue;
  require('./react-security-logic').scanFile(file,code,add);
  const client=file.startsWith('src/'),fn=file.startsWith('functions/');
  for(const [re,what] of SECRET_PATTERNS){
   const m=re.exec(code);if(!m)continue;
   if(client)add('high','Secret exposed in the app code','`'+file+'` contains what looks like '+what+'. Anything in src/ is sent to every visitor\'s browser.','Remove it from src/, add it in Settings → Server secrets, and use it from a server function with secrets.get().',file,lineOf(code,m.index));
   else if(fn)add('medium','Secret written into a server function','`'+file+'` contains what looks like '+what+'. It is stored in your code history and exports.','Add it in Settings → Server secrets and read it with secrets.get() instead.',file,lineOf(code,m.index));
   break;
  }
  if(client){
   let m;
   if((m=/dangerouslySetInnerHTML/.exec(code)))add('medium','Raw HTML is inserted into the page','`'+file+'` uses dangerouslySetInnerHTML. If that HTML includes anything a user typed, it can run scripts (XSS).','Render the text normally, or use react-markdown for formatted text.',file,lineOf(code,m.index));
   if((m=/\beval\s*\(|new\s+Function\s*\(/.exec(code)))add('medium','Code is built from strings','`'+file+'` uses eval or new Function, which can run attacker-controlled code.','Replace it with normal code or a lookup table.',file,lineOf(code,m.index));
   if((m=/target=["']_blank["'](?![^>]*rel=)/.exec(code)))add('low','Links open new tabs without rel="noopener"','`'+file+'` has target="_blank" links without rel="noopener noreferrer".','Add rel="noopener noreferrer" to those links.',file,lineOf(code,m.index));
   if((m=/['"`]http:\/\/(?!localhost|127\.0\.0\.1)[a-z0-9.-]+/i.exec(code)))add('low','Insecure http:// link or resource','`'+file+'` loads or links to an http:// address. Browsers block or warn about insecure content on HTTPS sites.','Use the https:// address.',file,lineOf(code,m.index));
   if((m=/localStorage\.setItem\(\s*['"`][^'"`]*(token|password|secret)/i.exec(code)))add('medium','Sensitive value saved in browser storage','`'+file+'` stores a token or password in localStorage, where any script on the page can read it.','Let the built-in auth handle sessions; do not store passwords at all.',file,lineOf(code,m.index));
   if((m=/\.(innerHTML|outerHTML)\s*=(?!=)|\.insertAdjacentHTML\s*\(|document\.write\s*\(/.exec(code)))add('medium','HTML is written into the page directly','`'+file+'` sets innerHTML (or uses insertAdjacentHTML / document.write). If any part of it comes from a visitor or the database, it can run scripts (XSS).','Let React render the values as text, or use react-markdown for formatted text.',file,lineOf(code,m.index));
   if((m=/(window\.)?location(\.href)?\s*=\s*[^=;\n]*(searchParams|URLSearchParams|params\.get|query\.|\.get\(\s*['"](next|redirect|url|return|returnTo|to)['"])/.exec(code)))add('medium','The page sends visitors to an address taken from the link','`'+file+'` redirects to an address read from the URL. Someone can send your customers a link to your site that forwards them to a fake one (open redirect).','Only allow paths on your own site (start with "/" and not "//"), or a fixed list of addresses.',file,lineOf(code,m.index));
   if((m=/addEventListener\(\s*['"]message['"]/.exec(code))&&!/\.origin\b/.test(code))add('medium','Messages from other sites are trusted','`'+file+'` listens for postMessage events without checking where they come from, so any site that opens yours can send it commands.','Check event.origin against your own address before using event.data.',file,lineOf(code,m.index));
   if((m=/(isAdmin|role\s*===?\s*['"](admin|staff|owner)['"])/.exec(code))&&!(cfg.collections&&Object.values(cfg.collections).some(c=>c&&c.access&&c.access!=='public'&&c.access!=='public-read')))add('low','Admin screens are only hidden in the browser','`'+file+'` decides who is an admin in the page itself. Hiding a screen does not protect the data behind it.','Protect the data too: give the collections "private", "shared" or team access, or check the user in a server function.',file,lineOf(code,m.index));
   if((m=/console\.(log|info|debug)\([^)]*\b(password|token|secret)\b/i.exec(code)))add('low','A password or token is written to the browser console','`'+file+'` logs a password or token, where browser extensions and anyone at the screen can see it.','Remove that log line.',file,lineOf(code,m.index));
  }
  if(fn){
   const writes=/\.(create|update|remove)\s*\(/.test(code)||/db\.(sql|batch)[\s\S]{0,80}\b(INSERT|UPDATE|DELETE)\b/i.test(code),checksUser=/\buser\b/.test(code.replace(/\{\s*user\s*[,}]/,''))||/\buser\s*\?|\bif\s*\(\s*!?\s*user\b/.test(code);
   if(writes&&!checksUser)add('medium','Server function changes data without checking the user','`'+file+'` creates, updates or deletes records but never checks who is signed in. Server functions have full database access, so anyone could call it.','Return 401 unless `user` is set, and check the user may change that record.',file);
   if(/hook|webhook|stripe/i.test(file)&&/rawBody|request\.body/.test(code)&&!/hmacSha256Hex|timingSafeEqual/.test(code))add('medium','Webhook does not verify its signature','`'+file+'` looks like a webhook receiver but never verifies a signature, so anyone can send fake events.','Verify the provider\'s signature with crypto.hmacSha256Hex over request.rawBody and crypto.timingSafeEqual.',file);
   if(/db\.sql\(\s*`[^`]*\$\{/.test(code)||/db\.sql\(\s*(['"])[^'"]*\1\s*\+/.test(code)||/db\.sql\(\s*[a-zA-Z_$][\w$]*\s*[,)]/.test(code)&&/(['"`])\s*(SELECT|INSERT|UPDATE|DELETE)\b[^'"`]*\1\s*\+/i.test(code))add('high','SQL built from strings','`'+file+'` puts values straight into SQL text. A visitor could change the query (SQL injection) and read or delete data.','Use db.sql`... ${value}` (tagged template) or db.sql(\'... ?\', [value]) so values are sent as parameters.',file);
   if(/fetch\s*\(\s*(request|req)\.(body|query)/.test(code))add('low','Function fetches a URL chosen by the visitor','`'+file+'` passes a visitor-supplied URL to fetch. Private addresses are blocked, but it can still be abused to call other sites.','Only allow known hosts, or build the URL yourself.',file);
   if(/f(['"])[^'"\n]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^'"\n]*\{/i.test(code)&&/\.sql\(/.test(code))add('high','SQL built from strings','`'+file+'` puts values into SQL text with an f-string. A visitor could change the query (SQL injection).','Pass values as parameters: await ctx.db.sql("... ?", [value]).',file);
   let k;
   if((k=/\.(create|update)\s*\(\s*(?:[^,()]+,\s*)?(request|req)\.body\s*\)|\.(create|update)\s*\(\s*(?:[^,()]+,\s*)?\{\s*\.\.\.(request|req)\.body/.exec(code)))add('medium','Function saves whatever the visitor sends','`'+file+'` passes the whole request body into the database, so a visitor can set fields you did not mean them to (a price, a role, someone else\'s id).','Copy only the fields you expect: { name: body.name, email: body.email }, and validate them.',file,lineOf(code,k.index));
   if((k=/Math\.random\(\)/.exec(code))&&/(token|code|otp|password|reset|invite|coupon|voucher)/i.test(code))add('medium','Codes or tokens are made with Math.random','`'+file+'` seems to make a code or token with Math.random(), which can be guessed.','Use crypto.randomId() (or crypto.random_id() in Python).',file,lineOf(code,k.index));
   if((k=/\b(sig|signature|token|secret|apiKey|api_key)\w*\s*[!=]==?\s*(?!null\b|undefined\b|true\b|false\b|\d)[A-Za-z_$][\w$.]*|[A-Za-z_$][\w$.]*\s*[!=]==?\s*\w*(signature|secret|apiKey|api_key)\b/i.exec(code))&&!/timingSafeEqual|timing_safe_equal|compare_digest/.test(code))add('low','A secret is compared with ===','`'+file+'` compares a signature, token or key with ===, which can leak it through timing.','Use crypto.timingSafeEqual(a, b).',file,lineOf(code,k.index));
   if((k=/\b(e|err|error)\.stack\b/.exec(code))&&/json|body|return/.test(code))add('low','Error details may be sent to visitors','`'+file+'` uses an error\'s stack trace, which can reveal how the app works if it is returned.','Return a short message to the visitor and log the details with ctx.log instead.',file,lineOf(code,k.index));
   if(/['"]Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"]/.test(code)&&/user|cookie|authorization/i.test(code))add('low','Any website may call this function','`'+file+'` allows every origin (CORS *) while it uses the signed-in user or credentials.','Remove the CORS header unless other sites must call it, or name the allowed site.',file);
  }
 }
 for(const [name,def] of Object.entries(cfg.collections||{})){
  if(def.access==='public'&&PERSONAL.test(name))add('high','Anyone can read "'+name+'"','The "'+name+'" collection uses "public" access, so every visitor can download every entry, including names and emails.','Change it to "submit-only" (only you see entries) or "private".','src/backend.json');
  else if(def.access==='public')add('low','Anyone can add to "'+name+'"','"'+name+'" accepts entries from anyone without signing in, which can attract spam.','Use "public-read" if only signed-in users should post.','src/backend.json');
  if(def.access==='public-read'&&PERSONAL.test(name))add('medium','Everyone can read "'+name+'"','"'+name+'" is readable by all visitors. Make sure it holds nothing private.','Use "shared" or "private" if entries are personal.','src/backend.json');
 }
 if(cfg.storage&&cfg.storage.access==='public')add('medium','Anyone can upload files','File storage uses "public" access, so anyone can upload files to your app.','Use "signed-in" unless anonymous uploads are needed.','src/backend.json');
 const order={high:0,medium:1,low:2};
 return findings.sort((a,b)=>order[a.severity]-order[b.severity]);
}
module.exports={scan};
