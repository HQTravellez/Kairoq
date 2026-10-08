'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {client}=require('../supabase-builder');
const config={url:'https://example.supabase.co',publicKey:'publishable-test',adminToken:'scoped-test',encryption:'long-local-test-encryption-key'};
test('Supabase sessions reject tampering and cross-app cookies, use HttpOnly secure cookies',()=>{
 const provider=client(config);const session={access_token:'access-test',refresh_token:'refresh-test',expires_at:9999999999};const sealed=provider.seal('app-alpha',session);
 assert.equal(provider.unseal('app-alpha',sealed).access_token,session.access_token);assert.equal(provider.unseal('app-other',sealed),null);assert.equal(provider.unseal('app-alpha',sealed.slice(0,10)+'!'+sealed.slice(11)),null);
 let header;provider.cookie({headers:{'x-forwarded-proto':'https'},socket:{}},{setHeader:(_,value)=>header=value},'app-alpha',session);assert.match(header,/HttpOnly; SameSite=Strict; Path=\/apps\/app-alpha\//);assert.match(header,/; Secure$/);assert.ok(!header.includes(session.access_token));
});
test('expired Supabase sessions share refresh requests and data requests use user JWT',async()=>{
 let refreshCalls=0;const calls=[];const fresh={access_token:'fresh-access',refresh_token:'fresh-refresh',expires_in:3600};
 const provider=client(config,async(url,opts)=>{calls.push({url,opts});if(url.includes('grant_type=refresh_token')){refreshCalls++;await new Promise(r=>setTimeout(r,15));return new Response(JSON.stringify(fresh));}if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'user-one',email:'qa@example.com'}));return new Response('[]');});
 const sealed=provider.seal('app-alpha',{access_token:'expired-access',refresh_token:'expired-refresh',expires_at:1});const req={headers:{cookie:'kairoq_sb_app-alpha='+sealed},socket:{}},res={setHeader(){}};
 const sessions=await Promise.all([provider.session(req,res,'app-alpha'),provider.session(req,res,'app-alpha')]);assert.equal(refreshCalls,1);assert.equal(sessions[0].user.id,'user-one');await provider.records('app-alpha',sessions[0],'items');
 const data=calls.find(c=>c.url.includes('/rest/v1/kairoq_app_records'));assert.equal(data.opts.headers.Authorization,'Bearer fresh-access');assert.equal(data.opts.headers.apikey,config.publicKey);assert.ok(!data.opts.body?.includes(config.adminToken));
});
