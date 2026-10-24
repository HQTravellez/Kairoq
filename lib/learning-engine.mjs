/**
 * Kairoq learning foundation: evidence-backed, project-scoped memory and skills.
 * Dependency free, storage-adapter based; nothing is executed from stored records.
 * Inspired by Hermes Agent's procedural memory; not model-weight training.
 */
import { createHash, randomUUID } from 'node:crypto';

const MAX_TEXT = 12000;
function clean(value, name, limit = MAX_TEXT) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new TypeError(name + ' must be a nonempty string (max ' + limit + ' characters)');
  }
  return value.trim();
}
function scope(value) {
  return clean(value, 'scope', 180);
}
function tokenize(value) {
  return new Set(value.toLowerCase().match(/[a-z0-9_]+/g) || []);
}
function safeCopy(value) { return structuredClone(value); }

/** Async adapter interface: read(scope) => array, write(scope, array) => void. */
export class InMemoryLearningStore {
  #scopes = new Map();
  async read(key) { return safeCopy(this.#scopes.get(scope(key)) || []); }
  async write(key, entries) { this.#scopes.set(scope(key), safeCopy(entries)); }
}

/**
 * Wire to existing authenticated user/project context. Never accept untrusted
 * client-supplied project IDs as authorization. Do not put secrets in records.
 */
export class LearningEngine {
  constructor({ store, now = () => new Date().toISOString() } = {}) {
    if (!store || typeof store.read !== 'function' || typeof store.write !== 'function') {
      throw new TypeError('A persistent read/write storage adapter is required');
    }
    this.store = store;
    this.now = now;
  }
  async remember({ tenantId, projectId, kind = 'observation', text, source, verified = false, evidence = [] }) {
    const key = scope(tenantId) + ':' + scope(projectId);
    if (!['observation', 'failure', 'decision', 'procedure'].includes(kind)) throw new TypeError('invalid memory kind');
    const body = clean(text, 'text');
    const origin = clean(source, 'source', 512);
    if (!Array.isArray(evidence) || evidence.length > 20 || evidence.some(x => typeof x !== 'string' || x.length > 1024)) {
      throw new TypeError('invalid evidence');
    }
    if (kind === 'procedure' && (!verified || evidence.length === 0)) {
      throw new Error('A reusable procedure requires verification and evidence');
    }
    const record = Object.freeze({
      id: randomUUID(), kind, text: body, source: origin, verified: Boolean(verified),
      evidence: safeCopy(evidence), createdAt: this.now(),
      fingerprint: createHash('sha256').update(kind + '\0' + body).digest('hex'),
      status: 'candidate', version: 1
    });
    const entries = await this.store.read(key);
    const matching = entries.find(x => x.fingerprint === record.fingerprint);
    if (matching) return safeCopy(matching);
    entries.push(record);
    await this.store.write(key, entries);
    return safeCopy(record);
  }
  async search({ tenantId, projectId, query, kind, limit = 8 }) {
    const key = scope(tenantId) + ':' + scope(projectId);
    const terms = tokenize(clean(query, 'query', 1000));
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new RangeError('invalid limit');
    return (await this.store.read(key))
      .filter(x => !kind || x.kind === kind)
      .map(x => {
        const words = tokenize(x.text);
        const matches = [...terms].filter(term => words.has(term)).length;
        return { record: x, matches };
      })
      .filter(x => x.matches > 0)
      .sort((a, b) => b.matches - a.matches || Number(b.record.verified) - Number(a.record.verified))
      .slice(0, limit).map(x => safeCopy(x.record));
  }
  async promote({ tenantId, projectId, recordId, verificationEvidence }) {
    const key = scope(tenantId) + ':' + scope(projectId);
    const id = clean(recordId, 'recordId', 100);
    const evidence = clean(verificationEvidence, 'verificationEvidence', 1024);
    const entries = await this.store.read(key);
    const index = entries.findIndex(x => x.id === id);
    if (index === -1) throw new Error('memory record not found');
    if (entries[index].kind !== 'procedure' || !entries[index].verified) throw new Error('Only verified procedures can become skills');
    entries[index] = { ...entries[index], status: 'active', version: entries[index].version + 1, evidence: [...entries[index].evidence, evidence] };
    await this.store.write(key, entries);
    return safeCopy(entries[index]);
  }
  async recordFailure({ tenantId, projectId, testName, errorSummary, evidence }) {
    return this.remember({ tenantId, projectId, kind: 'failure', text: clean(testName, 'testName', 200) + ': ' + clean(errorSummary, 'errorSummary'), source: 'test-run', evidence: [clean(evidence, 'evidence', 1024)], verified: true });
  }
}
