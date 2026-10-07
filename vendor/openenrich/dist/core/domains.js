import { inferPattern } from "../providers/patterns.js";
const STRENGTH = { scrape: 3, smtp: 3, api: 2, structural: 1 };
export class DomainMemory {
    data;
    constructor(data = {}) {
        this.data = data;
    }
    get(domain) {
        return this.data[domain] ?? {};
    }
    patch(domain, fact) {
        this.data[domain] = { ...this.get(domain), ...fact };
    }
    pattern(domain) {
        return this.get(domain).pattern;
    }
    learn(domain, pattern, source) {
        const current = this.get(domain);
        const better = (STRENGTH[source] ?? 0) > (STRENGTH[current.patternSource ?? ""] ?? 0);
        if (current.pattern && !better)
            return;
        this.patch(domain, { pattern, patternSource: source });
    }
    learnFromEmail(row, email, source) {
        const pattern = inferPattern(email, row.first, row.last);
        if (!pattern)
            return undefined;
        this.learn(row.domain, pattern, source);
        return pattern;
    }
    toJSON() {
        return this.data;
    }
    get known() {
        return Object.values(this.data).filter((f) => f.pattern).length;
    }
}
