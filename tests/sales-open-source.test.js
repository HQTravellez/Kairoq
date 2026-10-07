const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {parseLeadExport,leadKey,selectableEmail,enrichContact,safeUrl,publicIPv4}=require('../sales-open-source');
test('OpenOutFind CSV preserves prospect evidence without importing qualification or drafts',async()=>{
 const leads=await parseLeadExport('company,website,full_name,title,email,reason\n"Acme, Inc",acme.com,Jane Smith,Finance Director,jane@acme.com,"Travel operations fit"');
 assert.equal(leads[0].company,'Acme, Inc');assert.equal(leads[0].contact_name,'Jane Smith');assert.equal(leads[0].status,'new');assert.equal(leads[0].score,0);assert.equal(leads[0].enrichment.imported.email_status,'unverified');assert.equal(leads[0].outreach,undefined);
});
test('JSONL profile evidence survives and identity dedupes a URL against its domain',async()=>{
 const [row]=await parseLeadExport(JSON.stringify({company:'Acme',website:'https://acme.com',full_name:'Jane Smith',profile_text:'Engineering consultancy',status:'won',outreach:{email:'send me'}}));
 assert.equal(row.evidence[0].summary,'Engineering consultancy');assert.equal(row.status,'new');assert.equal(leadKey(row),leadKey({domain:'acme.com',contact_name:'JANE SMITH'}));
});
test('invalid and oversized imports fail before persistence',async()=>{
 for(const input of ['{broken','company,email\nAcme,bad-address','company,website\nAcme,https://127.0.0.1','company\n','x'.repeat(1000001)])await assert.rejects(parseLeadExport(input));
 await assert.rejects(parseLeadExport(JSON.stringify(Array.from({length:501},()=>({company:'Acme'})))));
});
test('private network requests and unsafe schemes are blocked',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1'])assert.equal(publicIPv4(ip),false);
 assert.equal(publicIPv4('8.8.8.8'),true);
 for(const url of ['http://acme.com','https://127.0.0.1','https://[::1]','https://user:pass@acme.com','https://acme.com:8080'])assert.throws(()=>safeUrl(url));
});
test('unverified patterns and catch-all addresses are never selected',()=>{
 assert.equal(selectableEmail({verified:false,method:'pattern-only'}),false);
 assert.equal(selectableEmail({verified:true,method:'smtp',unverifiable:true}),false);
 assert.equal(selectableEmail({verified:true,method:'scrape'}),true);
});
test('real OpenEnrich engine resolves a published fixture contact at zero cost',async()=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-enrich-'));
 try{
 const result=await enrichContact({contact_name:'Jane Smith',domain:'acme.com'},workspace,{fetchText:async url=>url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':'<html><title>Acme</title><a href="mailto:jane.smith@acme.com">Jane Smith</a></html>'});
 assert.equal(result.email,'jane.smith@acme.com');assert.equal(result.cost,0);assert.equal(result.status,'published');assert.equal(result.selectable,true);assert.ok(fs.existsSync(path.join(workspace,'.openenrich-cache.json')));
 }finally{fs.rmSync(workspace,{recursive:true,force:true})}
});
