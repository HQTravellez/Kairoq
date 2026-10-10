'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),source=require('./website-source');
const ROOT=path.join(__dirname,'workspace','website-inbox');
const safeId=id=>/^[a-z0-9-]{5,85}$/.test(String(id)),safeVersion=value=>/^[a-f0-9]{16}$/.test(String(value));
function attributes(tag){const out={};for(const match of tag.matchAll(/(?:^|\s)([a-z][a-z0-9_-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi))out[match[1].toLowerCase()]=match[2]??match[3]??match[4]??'';return out;}
const attr=(tag,name)=>attributes(tag)[name];
function schemas(files){
 const forms={};
 for(const[name,html]of Object.entries(files)){if(!name.endsWith('.html'))continue;
  for(const match of source.expand(html,files).matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)){
   const form=attr(match[1],'data-kairoq-form');if(!form)continue;
   if(!/^(contact|demo)$/.test(form))throw Error('Connected form must be contact or demo');
   const fields={};
   for(const field of match[2].matchAll(/<(input|select|textarea)\b([^>]*)>/gi)){
    const key=attr(field[2],'name'),type=(attr(field[2],'type')||'text').toLowerCase();
    if(!key||['submit','button','reset'].includes(type))continue;
    if(!/^[a-z][a-z0-9_]{0,39}$/.test(key)||/password|card_number|passport|credit_card|ssn/i.test(key)||['password','file'].includes(type))throw Error('Unsupported enquiry field');
    fields[key]={required:Object.hasOwn(attributes(field[2]),'required'),type};
   }
   if(!Object.keys(fields).length||Object.keys(fields).length>20)throw Error('Connected form needs 1–20 named fields');
   if(forms[form]&&JSON.stringify(forms[form])!==JSON.stringify(fields))throw Error('Repeated connected forms must use the same fields');
   forms[form]=fields;
  }
 }return forms;
}
function location(id,version,root=ROOT){if(!safeId(id)||!safeVersion(version))throw Error('Invalid website release');return path.join(root,id,'releases',version+'.json');}
function prepare(id,version,files,{root=ROOT,origin}={}){
 const forms=schemas(files);if(!Object.keys(forms).length)return null;
 const parsed=new URL(origin);if(!['https:','http:'].includes(parsed.protocol)||parsed.origin!==origin)throw Error('Invalid website origin');
 const file=location(id,version,root);if(fs.existsSync(file)){const config=JSON.parse(fs.readFileSync(file,'utf8'));if(JSON.stringify(config.forms)!==JSON.stringify(forms))throw Error('Website form configuration mismatch');return{...config,file,created:false};}
 const config={id,version,forms,token:crypto.randomBytes(24).toString('hex'),active:false,endpoint:origin+'/api/website-forms/'+id+'/'+version};
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(config),{flag:'wx'});return{...config,file,created:true};
}
function activate(config){if(!config)return;const stored=JSON.parse(fs.readFileSync(config.file,'utf8'));fs.writeFileSync(config.file,JSON.stringify({...stored,active:true}));}
function discard(config){if(config?.created)fs.rmSync(config.file,{force:true});}
const limits=new Map();
function submit(id,version,body,{root=ROOT,ip='unknown',now=Date.now()}={}){
 const config=JSON.parse(fs.readFileSync(location(id,version,root),'utf8'));
 if(!config.active||typeof body?.token!=='string'||body.token.length!==config.token.length||!crypto.timingSafeEqual(Buffer.from(body.token),Buffer.from(config.token)))throw Error('Website form is unavailable');
 const schema=Object.hasOwn(config.forms,body.form)?config.forms[body.form]:null;if(!schema)throw Error('Unknown enquiry form');
 if(body.website)return{ok:true}; // Runtime honeypot: discard bots without storing their content.
 const fields=body.fields;if(!fields||Array.isArray(fields)||typeof fields!=='object')throw Error('Invalid enquiry fields');
 const clean={};for(const[key,rule]of Object.entries(schema)){
  const raw=fields[key];if(raw!==undefined&&typeof raw!=='string')throw Error('Invalid field: '+key);
  const value=String(raw??'').trim();if(value.length>2000||rule.required&&!value||rule.type==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('Check field: '+key);
  if(rule.type==='checkbox'&&value&&!['on','true'].includes(value))throw Error('Check field: '+key);
  if(rule.type==='number'&&value&&!Number.isFinite(Number(value)))throw Error('Check field: '+key);
  clean[key]=value;
 }
 if(Object.keys(fields).some(key=>!Object.hasOwn(schema,key)))throw Error('Unknown enquiry field');
 for(const[key,value]of limits)if(now-value.at>3600000)limits.delete(key);
 const keys=[id+'|'+ip,id+'|total'];
 for(const key of keys){const count=limits.get(key);if(count&&count.count>=(key.endsWith('|total')?200:20))throw Error('Too many enquiries; try again later');}
 if(limits.size>10000)throw Error('Enquiry service busy; try again later');
 const folder=path.join(root,id,'entries');fs.mkdirSync(folder,{recursive:true});if(fs.readdirSync(folder).length>=10000)throw Error('Enquiry inbox is full');
 const entry={id:crypto.randomUUID(),website_id:id,version,form:body.form,fields:clean,created_at:new Date(now).toISOString()};
 fs.writeFileSync(path.join(folder,entry.id+'.json'),JSON.stringify(entry),{flag:'wx'});
 for(const key of keys){const count=limits.get(key)||{count:0,at:now};count.count++;limits.set(key,count);}
 return{ok:true,id:entry.id};
}
function inbox(id,{root=ROOT}={}){if(!safeId(id))throw Error('Invalid website ID');const folder=path.join(root,id,'entries');if(!fs.existsSync(folder))return[];return fs.readdirSync(folder).filter(n=>/^[a-f0-9-]+\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(folder,n),'utf8'))).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,200);}
function runtime(config){return `\n/* Trusted Kairoq enquiry capture */\n(()=>{document.addEventListener('submit',async event=>{const form=event.target;if(!form.matches('form[data-kairoq-form]'))return;event.preventDefault();event.stopImmediatePropagation();if(form.dataset.kairoqPending)return;if(!form.reportValidity())return;let note=form.querySelector('[data-kairoq-status]');if(!note){note=document.createElement('p');note.dataset.kairoqStatus='';note.setAttribute('role','status');form.append(note);}const config=${JSON.stringify(config?{endpoint:config.endpoint,token:config.token}:null)};if(!config){note.textContent='Publish this website to enable enquiry submission.';return;}const fields={};for(const[key,value]of new FormData(form)){if(typeof value==='string')fields[key]=value;}const buttons=[...form.querySelectorAll('[type="submit"],button:not([type])')],previous=buttons.map(b=>b.disabled);form.dataset.kairoqPending='true';buttons.forEach(b=>b.disabled=true);note.textContent='Sending your enquiry…';try{const response=await fetch(config.endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:config.token,form:form.dataset.kairoqForm,fields,website:form.querySelector('[data-kairoq-honeypot]')?.value||''}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Submission failed');note.textContent='Thank you. Your enquiry has been received.';form.reset();}catch(error){note.textContent='Could not send your enquiry. '+error.message+' Please try again.';}finally{delete form.dataset.kairoqPending;buttons.forEach((b,i)=>b.disabled=previous[i]);}},true);for(const form of document.querySelectorAll('form[data-kairoq-form]')){const trap=document.createElement('input');trap.type='text';trap.dataset.kairoqHoneypot='';trap.tabIndex=-1;trap.autocomplete='off';trap.setAttribute('aria-hidden','true');trap.style.display='none';form.append(trap);}})();\n`;}
async function handle(req,res,{authenticated,readBody,root=ROOT}={}){
 const pathname=new URL(req.url,'http://localhost').pathname,publicMatch=/^\/api\/website-forms\/([a-z0-9-]+)\/([a-f0-9]{16})$/.exec(pathname),ownerMatch=/^\/api\/developer\/inbox\/([a-z0-9-]+)$/.exec(pathname);
 if(!publicMatch&&!ownerMatch)return false;
 const send=(status,data,cors=false)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(cors?{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}:{})});res.end(JSON.stringify(data));};
 if(ownerMatch){if(!authenticated(req)){send(401,{error:'Authentication required'});return true;}if(req.method!=='GET'){send(405,{error:'Method not allowed'});return true;}try{send(200,{entries:inbox(ownerMatch[1],{root})});}catch{send(404,{error:'Inbox not found'});}return true;}
 if(req.method==='OPTIONS'){send(204,{},true);return true;}if(req.method!=='POST'){send(405,{error:'Method not allowed'},true);return true;}
 try{send(200,submit(publicMatch[1],publicMatch[2],await readBody(req,32000),{root,ip:req.socket.remoteAddress}),true);}catch(error){send(422,{error:safeId(publicMatch[1])&&fs.existsSync(location(publicMatch[1],publicMatch[2],root))?error.message:'Website form is unavailable'},true);}return true;
}
module.exports={schemas,prepare,activate,discard,submit,inbox,runtime,handle};
