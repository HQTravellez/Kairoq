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
  }
  if(fn){
   const writes=/\.(create|update|remove)\s*\(/.test(code)||/db\.(sql|batch)[\s\S]{0,80}\b(INSERT|UPDATE|DELETE)\b/i.test(code),checksUser=/\buser\b/.test(code.replace(/\{\s*user\s*[,}]/,''))||/\buser\s*\?|\bif\s*\(\s*!?\s*user\b/.test(code);
   if(writes&&!checksUser)add('medium','Server function changes data without checking the user','`'+file+'` creates, updates or deletes records but never checks who is signed in. Server functions have full database access, so anyone could call it.','Return 401 unless `user` is set, and check the user may change that record.',file);
   if(/hook|webhook|stripe/i.test(file)&&/rawBody|request\.body/.test(code)&&!/hmacSha256Hex|timingSafeEqual/.test(code))add('medium','Webhook does not verify its signature','`'+file+'` looks like a webhook receiver but never verifies a signature, so anyone can send fake events.','Verify the provider\'s signature with crypto.hmacSha256Hex over request.rawBody and crypto.timingSafeEqual.',file);
   if(/db\.sql\(\s*`[^`]*\$\{/.test(code)||/db\.sql\(\s*(['"])[^'"]*\1\s*\+/.test(code)||/db\.sql\(\s*[a-zA-Z_$][\w$]*\s*[,)]/.test(code)&&/(['"`])\s*(SELECT|INSERT|UPDATE|DELETE)\b[^'"`]*\1\s*\+/i.test(code))add('high','SQL built from strings','`'+file+'` puts values straight into SQL text. A visitor could change the query (SQL injection) and read or delete data.','Use db.sql`... ${value}` (tagged template) or db.sql(\'... ?\', [value]) so values are sent as parameters.',file);
   if(/fetch\s*\(\s*(request|req)\.(body|query)/.test(code))add('low','Function fetches a URL chosen by the visitor','`'+file+'` passes a visitor-supplied URL to fetch. Private addresses are blocked, but it can still be abused to call other sites.','Only allow known hosts, or build the URL yourself.',file);
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
