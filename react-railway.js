"use strict";
// Registers customer domains on this Kairoq service through Railway's public
// GraphQL API so Railway routes them and issues HTTPS certificates.
// Needs RAILWAY_API_TOKEN (account or team token) or RAILWAY_PROJECT_TOKEN, plus the
// RAILWAY_PROJECT_ID / RAILWAY_ENVIRONMENT_ID / RAILWAY_SERVICE_ID that Railway sets automatically.
const ENDPOINT=()=>process.env.RAILWAY_API_URL||'https://backboard.railway.com/graphql/v2';
function configured(env=process.env){return Boolean((env.RAILWAY_API_TOKEN||env.RAILWAY_PROJECT_TOKEN)&&env.RAILWAY_ENVIRONMENT_ID&&env.RAILWAY_SERVICE_ID)}
async function gql(query,variables,env=process.env){
 const headers={'Content-Type':'application/json'};
 if(env.RAILWAY_API_TOKEN)headers.Authorization='Bearer '+env.RAILWAY_API_TOKEN;else headers['Project-Access-Token']=env.RAILWAY_PROJECT_TOKEN;
 const r=await fetch(ENDPOINT(),{method:'POST',headers,body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||data.errors?.length)throw Error('Railway: '+(data.errors?.[0]?.message||'HTTP '+r.status));
 return data.data;
}
const DOMAIN_FIELDS='id domain status { dnsRecords { hostlabel requiredValue currentValue status recordType zone } certificateStatus }';
function records(d){return(d?.status?.dnsRecords||[]).map(r=>({type:r.recordType?String(r.recordType).replace(/^DNS_RECORD_TYPE_/,''):'CNAME',name:[r.hostlabel,r.zone].filter(Boolean).join('.')||d.domain,value:r.requiredValue,current:r.currentValue||null,status:r.status||null}))}
async function addDomain(domain,env=process.env){
 const data=await gql(`mutation($input: CustomDomainCreateInput!){ customDomainCreate(input: $input){ ${DOMAIN_FIELDS} } }`,{input:{domain,projectId:env.RAILWAY_PROJECT_ID,environmentId:env.RAILWAY_ENVIRONMENT_ID,serviceId:env.RAILWAY_SERVICE_ID}},env);
 const d=data.customDomainCreate;
 return{id:d.id,dns:records(d),certificate:d.status?.certificateStatus||null};
}
async function removeDomain(id,env=process.env){await gql('mutation($id: String!){ customDomainDelete(id: $id) }',{id},env);return{removed:id}}
module.exports={configured,addDomain,removeDomain,records};
