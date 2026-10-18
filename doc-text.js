"use strict";
// Plain text from PDF and Word (.docx) files, for the AI assistant's documents.
// PDFs are read with pdf.js (no script evaluation, no fonts) in a worker thread with a time
// limit, so a heavy or hostile file cannot stall the server. Word files are zip archives of
// XML: paragraphs, headings, list items and table cells become Markdown-like text.
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
function fail(status,message){return Object.assign(Error(message),{status})}

const MAX_PAGES=300,TIMEOUT_MS=Number(process.env.KAIROQ_DOC_TEXT_TIMEOUT_MS||20000);

async function extractPdf(buf){
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const doc=await pdfjs.getDocument({data:new Uint8Array(buf),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,stopAtErrors:false,verbosity:0}).promise;
 const pages=[];
 for(let n=1;n<=Math.min(doc.numPages,MAX_PAGES);n++){
  const page=await doc.getPage(n),content=await page.getTextContent();
  let out='',lastY=null,lastH=0;
  for(const it of content.items){
   if(typeof it.str!=='string')continue;
   const y=it.transform?it.transform[5]:null,h=Math.abs(it.height||lastH||10);
   // A large gap between lines starts a new paragraph.
   if(lastY!==null&&y!==null&&out&&!out.endsWith('\n')&&Math.abs(lastY-y)>h*0.5)out+=Math.abs(lastY-y)>h*1.8?'\n\n':'\n';
   else if(lastY!==null&&y!==null&&out.endsWith('\n')&&Math.abs(lastY-y)>h*1.8&&!out.endsWith('\n\n'))out+='\n';
   out+=it.str;if(it.hasEOL)out+='\n';
   if(y!==null)lastY=y;lastH=h;
  }
  pages.push(out.trim());
  page.cleanup();
 }
 await doc.destroy();
 return{text:pages.filter(Boolean).join('\n\n'),pages:doc.numPages};
}

const XML_ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
function xmlDecode(s){return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1))):XML_ENT[e]??m)}
function docxText(buf){
 const entries=require('./react-reference').readZip(buf,{maxFiles:2000,maxBytes:40*1024*1024});
 const main=entries.find(e=>e.name==='word/document.xml');
 if(!main)throw fail(415,'This is not a Word (.docx) document.');
 const xml=main.data.toString('utf8'),out=[];
 const runs=p=>{let t='';for(const m of p.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br[^>]*\/>/g))t+=m[1]!==undefined?xmlDecode(m[1]):m[0].startsWith('<w:tab')?' ':'\n';return t.trim()};
 for(const m of xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)){
  const block=m[0];
  // Tables: one line per row, cells separated by |.
  if(block.startsWith('<w:tbl>')){
   const rows=[...block.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map(r=>[...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map(c=>[...c[0].matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(x=>runs(x[0])).filter(Boolean).join(' ')).join(' | ')).filter(r=>r.replace(/[| ]/g,''));
   if(rows.length)out.push(rows.join('\n'));
   continue;
  }
  const text=runs(block);if(!text)continue;
  const style=(/<w:pStyle w:val="([^"]+)"/.exec(block)||[])[1]||'';
  const level=/^Title$/i.test(style)?1:Number((/^Heading(\d)$/i.exec(style)||[])[1])||0;
  out.push(level?'#'.repeat(Math.min(level,6))+' '+text:/<w:numPr>/.test(block)?'- '+text:text);
 }
 return{text:out.join('\n\n')};
}

// Runs the extraction in a worker thread and stops it after TIMEOUT_MS.
function inWorker(kind,buf){
 return new Promise((resolve,reject)=>{
  const w=new Worker(__filename,{workerData:{kind,buf},resourceLimits:{maxOldGenerationSizeMb:256}});
  const timer=setTimeout(()=>{w.terminate();reject(fail(422,'This file took too long to read. Paste its text instead.'))},TIMEOUT_MS);
  w.once('message',m=>{clearTimeout(timer);w.terminate();m.error?reject(fail(m.status||422,m.error)):resolve(m.result)});
  w.once('error',e=>{clearTimeout(timer);reject(fail(422,'This file could not be read ('+String(e.message||e).slice(0,120)+'). Paste its text instead.'))});
 });
}
async function extract(kind,buf){
 if(kind==='pdf'){
  if(buf.subarray(0,1024).indexOf('%PDF-')<0)throw fail(415,'This is not a PDF file.');
  const r=await inWorker('pdf',buf);
  if(r.text.replace(/\s/g,'').length<20)throw fail(422,'This PDF has no readable text: it is probably scanned pages (pictures). Paste the text instead, or export it from the original document.');
  return r;
 }
 if(kind==='docx'){
  if(buf.readUInt32LE(0)!==0x04034b50)throw fail(415,'This is not a Word (.docx) document. Older .doc files: open them in Word and save as .docx.');
  return inWorker('docx',buf);
 }
 throw fail(415,'Unsupported file');
}

if(!isMainThread&&workerData&&workerData.kind){
 (async()=>{
  try{
   const buf=Buffer.from(workerData.buf);
   const result=workerData.kind==='pdf'?await extractPdf(buf):docxText(buf);
   parentPort.postMessage({result});
  }catch(e){parentPort.postMessage({error:/password/i.test(String(e.message))?'This PDF is password-protected. Remove the password and try again.':e.status?e.message:'This file could not be read ('+String(e.message||e).slice(0,120)+'). Paste its text instead.',status:e.status||422})}
 })();
}
module.exports={extract,docxText};
