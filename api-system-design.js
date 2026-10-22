"use strict";
// System architecture recommendations inspired by the CC BY 4.0 System Design
// Primer. Short, independently written suggestions; no source prose or code
// copied. Advice is *not* a verified deployment or assumed requirement.
const SHA="ae9bbd7b02d90b9866215de185217d33f39ab733";
const SOURCE="https://github.com/donnemartin/system-design-primer/tree/"+SHA;
const RULES=Object.freeze([
 {id:"requirements",signals:/./,principle:"Clarify functionality, nonfunctional constraints, cost and expected traffic before choosing infrastructure",
  suggested:"Start with a minimal deployable architecture; record load, reliability and compliance assumptions",
  tradeoff:"Adding distributed components before verified demand increases cost and failure modes"},
 {id:"persistence",signals:/account|login|record|save|book|payment|trip|claim|inventory|database|reservation|transaction/i,
  principle:"Design durable data models and access controls before selecting a storage implementation",
  suggested:"Define entities, access policy, migrations, backups, idempotency and retention rules",
  tradeoff:"Managed relational data often fits early transactional products better than many specialized data stores"},
 {id:"cache",signals:/many users|high traffic|millions|frequent read|popular|search results|cache|real.time/i,
  principle:"Use caches when measured access patterns and latency demands justify them",
  suggested:"Measure response latency and hit rates first; then define cache invalidation and sensitive-data boundaries",
  tradeoff:"Caches add staleness, invalidation complexity and privacy risks"},
 {id:"queue",signals:/batch|background|render|long.running|webhook|retri|asynchronous|document processing|email|video|sync|queue|queued|queues|job/i,
  principle:"Move lengthy work into bounded queues when synchronous user requests would time out",
  suggested:"Use an explicit job state machine, idempotency key, retry budget, dead-letter handling and observability",
  tradeoff:"Queues require monitoring, scheduling, failure recovery and eventual-consistency UX"},
 {id:"availability",signals:/24\/7|always on|critical|downtime|high availability|sla|production|failover/i,
  principle:"Set a measurable availability target and recovery process",
  suggested:"Define SLO, backups and restoration tests; consider replication only with a measured requirement",
  tradeoff:"Multi-region failover can be expensive and adds data consistency decisions"},
 {id:"integration",signals:/api|connector|oauth|third.party|supplier|gds|flight|insurance|import/i,
  principle:"Treat external APIs as unreliable dependencies with contracts and least-privilege credentials",
  suggested:"Pin vendor schema versions, use timeouts, retries with jitter, circuit breakers and request correlation",
  tradeoff:"Unbounded retries can duplicate writes and amplify external outages"},
 {id:"security",signals:/personal|health|insurance|payment|private|customer|credentials|auth|financial|patient/i,
  principle:"Minimize access to sensitive data and audit critical decisions",
  suggested:"Keep secrets server-side, enforce tenant isolation, least privilege, retention and audit events",
  tradeoff:"Compliance and security work may require specialist review and additional infrastructure"}
]);
function recommend(brief,{max=7}={}){
 if(typeof brief!=="string"||brief.trim().length<12||brief.length>6000)throw Error("Product brief must be 12–6000 characters");
 if(!Number.isInteger(max)||max<1||max>7)throw Error("Invalid architecture recommendation limit");
 const selected=RULES.filter(r=>r.id==="requirements"||r.signals.test(brief)).slice(0,max);
 return{source:"donnemartin/system-design-primer",sourceRevision:SHA,sourceUrl:SOURCE,
  license:"CC BY 4.0",status:"architecture-guidance-only",recommendations:selected.map(({id,principle,suggested,tradeoff})=>({id,principle,suggested,tradeoff})),
  notice:"These are proposed design checks, not claims the product is implemented, scaled, secured or certified"};
}
module.exports={SHA,SOURCE,RULES,recommend};
