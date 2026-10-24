"use strict";
// Crawl4AI (crawl4ai.js) and Stirling PDF (stirling-pdf.js) as optional connected services.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const crawl=require('../crawl4ai'),pdf=require('../stirling-pdf');

test('Crawl4AI is only used when connected, and returns the page as Markdown',async()=>{
 assert.equal(crawl.configured({}),false);
 await assert.rejects(()=>crawl.markdown('https://example.com',{env:{}}),/not connected/);
 let sent;
 const env={KAIROQ_CRAWL4AI_URL:'https://crawl.example.com/',KAIROQ_CRAWL4AI_TOKEN:'tok'};
 const md=await crawl.markdown('https://shop.example.com/',{env,fetchImpl:async(u,o)=>{sent={u,o,body:JSON.parse(o.body)};return new Response(JSON.stringify({success:true,markdown:'# Shop\n\nOpen 9 to 5'}))}});
 assert.equal(md,'# Shop\n\nOpen 9 to 5');
 assert.equal(sent.u,'https://crawl.example.com/md');
 assert.equal(sent.body.url,'https://shop.example.com/');
 assert.equal(sent.body.f,'fit');
 assert.equal(sent.o.headers.Authorization,'Bearer tok');
 await assert.rejects(()=>crawl.markdown('https://x.example',{env,fetchImpl:async()=>new Response('no',{status:500})}),/HTTP 500/);
});

test('the chat reader asks Crawl4AI before its own browser for thin pages',()=>{
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 const i=server.indexOf('crawl4ai.markdown(u.toString())'),j=server.indexOf('require("./browser-reader").renderPage(u.toString())');
 assert.ok(i>0&&j>i,'Crawl4AI comes first');
});

test('PDF tools send real PDFs to Stirling PDF and return the file',async()=>{
 const env={KAIROQ_STIRLING_URL:'https://pdf.example.com',KAIROQ_STIRLING_API_KEY:'k'};
 const a={name:'a.pdf',data:Buffer.from('%PDF-1.4 a').toString('base64')},b={name:'b.pdf',data:Buffer.from('%PDF-1.4 b').toString('base64')};
 await assert.rejects(()=>pdf.run('merge',[a],{},{env}),/two or more/);
 await assert.rejects(()=>pdf.run('merge',[a,{name:'x.pdf',data:Buffer.from('hello').toString('base64')}],{},{env}),/not a PDF/);
 await assert.rejects(()=>pdf.run('merge',[a,b],{},{env:{}}),/not connected/);
 await assert.rejects(()=>pdf.run('delete-everything',[a],{},{env}),/Unknown PDF tool/);
 let call;
 const out=await pdf.run('merge',[a,b],{},{env,fetchImpl:async(u,o)=>{call={u,o};return new Response(Buffer.from('%PDF-merged'),{headers:{'content-type':'application/pdf'}})}});
 assert.equal(call.u,'https://pdf.example.com/api/v1/general/merge-pdfs');
 assert.equal(call.o.headers['X-API-KEY'],'k');
 assert.equal(call.o.body.getAll('fileInput').length,2);
 assert.equal(out.name,'merged.pdf');
 assert.equal(out.bytes.toString(),'%PDF-merged');
 const split=await pdf.run('split',[a],{pages:'2,5; rm -rf'},{env,fetchImpl:async(u,o)=>{call={u,o};return new Response('zip',{headers:{'content-type':'application/zip'}})}});
 assert.match(call.o.body.get('pageNumbers'),/^[0-9,\-]+$/,'only page numbers reach the PDF server');
 assert.equal(split.name,'split.zip');
});

test('the Plugins page lists Supabase, Crawl4AI and Stirling PDF, and the + menu has PDF tools',()=>{
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
 for(const id of ['supabase','crawl4ai','stirling-pdf'])assert.match(server,new RegExp('id: "'+id+'"'));
 assert.match(html,/data-plus="pdf">PDF tools</);
});
