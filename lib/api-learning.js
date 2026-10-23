// Evidence-first API learning foundation. No outbound requests are performed here.
import { createHash } from 'node:crypto';

export function normalizeApiSpec(spec) {
  if (!spec || typeof spec !== 'object' || !spec.paths || typeof spec.paths !== 'object') throw new TypeError('OpenAPI paths required');
  const endpoints = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods || {})) {
      if (!['get','post','put','patch','delete','head','options','trace'].includes(method.toLowerCase())) continue;
      endpoints.push({ method: method.toUpperCase(), path, operationId: operation?.operationId || null, responses: Object.keys(operation?.responses || {}) });
    }
  }
  return endpoints.sort((a,b) => (a.path+a.method).localeCompare(b.path+b.method));
}

export function compareApiResponse({ expectedStatus, actualStatus, expectedBody, actualBody }) {
  const statusMatched = Number(expectedStatus) === Number(actualStatus);
  const mismatches = [];
  if (expectedBody !== undefined) {
    const walk = (expected, actual, path) => {
      if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
        if (!actual || typeof actual !== 'object' || Array.isArray(actual)) { mismatches.push(path || '$'); return; }
        for (const key of Object.keys(expected)) walk(expected[key], actual[key], path ? path+'.'+key : key);
      } else if (Array.isArray(expected)) {
        if (!Array.isArray(actual)) mismatches.push(path || '$');
        else expected.forEach((v,i) => walk(v, actual[i], path+'['+i+']'));
      } else if (expected !== actual) mismatches.push(path || '$');
    };
    walk(expectedBody, actualBody, '');
  }
  return { passed: statusMatched && mismatches.length === 0, statusMatched, mismatches };
}

export function createEvidenceRecord({ endpoint, request, response, comparison, verifiedAt = new Date().toISOString() }) {
  if (!comparison || typeof comparison.passed !== 'boolean') throw new TypeError('Comparison required');
  // Only retain a digest of request/response; never persist tokens or sensitive payloads.
  const digest = createHash('sha256').update(JSON.stringify({request,response})).digest('hex');
  return { endpoint, verifiedAt, passed: comparison.passed, statusMatched: comparison.statusMatched, mismatches: comparison.mismatches, evidenceDigest: digest };
}

export function proposeSkillRevision({ skillId, priorVersion = 0, evidence }) {
  if (!skillId || !Array.isArray(evidence) || evidence.length === 0) throw new TypeError('Skill ID and evidence required');
  const passed = evidence.filter(e => e.passed).length;
  return { skillId, version: priorVersion + 1, status: 'candidate', evidenceCount: evidence.length, passedCount: passed, eligibleForPromotion: passed === evidence.length, requiresIndependentBenchmark: true };
}
