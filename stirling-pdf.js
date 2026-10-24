"use strict";
// Stirling PDF (github.com/Stirling-Tools/Stirling-PDF; MIT core) as Kairoq's PDF tools. When
// KAIROQ_STIRLING_URL points at a running Stirling PDF server, the chat's "+" menu offers PDF
// tools: merge, split, compress, read scanned pages (OCR) and turn pages into images. Files go
// to that server and back; nothing is stored. Only the free (MIT) features are used.
const MAX_FILES=10,MAX_BYTES=40*1024*1024;
// Each tool: the Stirling endpoint, whether it takes several files, its fields, and what comes back.
const TOOLS={
 merge:{path:'/api/v1/general/merge-pdfs',many:true,label:'Merge into one PDF',out:'merged.pdf',fields:()=>({sortType:'orderProvided'})},
 split:{path:'/api/v1/general/split-pages',label:'Split into parts',out:'split.zip',fields:o=>({pageNumbers:String(o.pages||'1').replace(/[^0-9,\-]/g,'').slice(0,200)||'1'})},
 compress:{path:'/api/v1/misc/compress-pdf',label:'Make it smaller',out:'smaller.pdf',fields:o=>({optimizeLevel:String(Math.min(9,Math.max(1,Number(o.level)||5)))})},
 ocr:{path:'/api/v1/misc/ocr-pdf',label:'Read scanned pages (OCR)',out:'searchable.pdf',fields:o=>({languages:(/^[a-z]{3}(\+[a-z]{3})*$/.test(String(o.languages||''))?String(o.languages):'eng').split('+'),ocrType:'skip-text',ocrRenderType:'sandwich'})},
 images:{path:'/api/v1/convert/pdf/img',label:'Pages to images',out:'pages.zip',fields:()=>({imageFormat:'png',singleOrMultiple:'multiple',dpi:'150',colorType:'color'})},
};
function base(env=process.env){return String(env.KAIROQ_STIRLING_URL||'').trim().replace(/\/+$/,'')}
function configured(env=process.env){return /^https?:\/\//.test(base(env))}
function fail(status,message){return Object.assign(Error(message),{status})}
function tools(){return Object.entries(TOOLS).map(([id,t])=>({id,label:t.label,many:Boolean(t.many)}))}

// files: [{name, data (base64)}]. Returns {name, type, bytes}.
async function run(tool,files,options={},{env=process.env,fetchImpl=fetch}={}){
 const t=TOOLS[tool];
 if(!t)throw fail(400,'Unknown PDF tool');
 if(!configured(env))throw fail(409,'PDF tools are not connected yet (Railway variable KAIROQ_STIRLING_URL).');
 const list=(Array.isArray(files)?files:[]).slice(0,MAX_FILES);
 if(!list.length)throw fail(400,'Add a PDF first');
 if(t.many&&list.length<2)throw fail(400,'Add two or more PDFs to merge');
 const form=new FormData();let total=0;
 for(const f of t.many?list:list.slice(0,1)){
  const buf=Buffer.from(String(f.data||''),'base64');total+=buf.length;
  if(total>MAX_BYTES)throw fail(413,'PDFs up to 40 MB in total');
  if(buf.subarray(0,5).toString('latin1')!=='%PDF-')throw fail(400,(f.name||'That file')+' is not a PDF');
  form.append('fileInput',new Blob([buf],{type:'application/pdf'}),String(f.name||'file.pdf').replace(/[^\w.\- ]+/g,'_').slice(0,100));
 }
 for(const [k,v] of Object.entries(t.fields(options||{})))for(const one of[].concat(v))form.append(k,one);
 const headers={};if(env.KAIROQ_STIRLING_API_KEY)headers['X-API-KEY']=env.KAIROQ_STIRLING_API_KEY;
 const r=await fetchImpl(base(env)+t.path,{method:'POST',body:form,headers,signal:AbortSignal.timeout(180000)});
 if(!r.ok){const msg=(await r.text().catch(()=>'')).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,200);throw fail(502,'The PDF tool could not do that'+(msg?': '+msg:'')+' (HTTP '+r.status+')')}
 const type=String(r.headers.get('content-type')||'application/octet-stream').split(';')[0];
 const bytes=Buffer.from(await r.arrayBuffer());
 const name=type==='application/zip'||/zip/.test(type)?t.out.replace(/\.pdf$/,'.zip'):type==='application/pdf'?t.out.replace(/\.zip$/,'.pdf'):t.out;
 return{name,type,bytes};
}
async function health({env=process.env,fetchImpl=fetch}={}){
 if(!configured(env))return{on:false,why:'Set KAIROQ_STIRLING_URL'};
 try{const r=await fetchImpl(base(env)+'/api/v1/info/status',{signal:AbortSignal.timeout(5000)});return r.ok?{on:true}:{on:false,why:'Stirling PDF answered HTTP '+r.status}}
 catch{return{on:false,why:'Stirling PDF did not answer'}}
}
module.exports={TOOLS,tools,configured,run,health,base};
