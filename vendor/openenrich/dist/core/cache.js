import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { DomainMemory } from "./domains.js";
/**
 * JSON file cache. Rows are keyed by name+domain and a hit costs $0. Domain facts
 * (email pattern, catch-all, MX) are keyed by domain and outlive any single row.
 */
export class Cache {
    path;
    rows = {};
    domains;
    constructor(path = ".openenrich-cache.json") {
        this.path = path;
        let file = {};
        if (existsSync(path)) {
            try {
                const parsed = JSON.parse(readFileSync(path, "utf8"));
                file = parsed?.version ? parsed : { rows: parsed };
            }
            catch {
                file = {};
            }
        }
        this.rows = file.rows ?? {};
        this.domains = new DomainMemory(file.domains ?? {});
    }
    get(key) {
        return this.rows[key];
    }
    set(key, result) {
        this.rows[key] = result;
    }
    flush() {
        const file = { version: 2, rows: this.rows, domains: this.domains.toJSON() };
        writeFileSync(this.path, JSON.stringify(file, null, 2));
    }
}
