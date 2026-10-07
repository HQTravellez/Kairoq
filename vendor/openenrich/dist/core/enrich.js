import { normalizeRow, cacheKey } from "./normalize.js";
import { DomainMemory } from "./domains.js";
export async function enrichRow(input, providers, ctx = {}) {
    const row = normalizeRow(input);
    if (!row)
        return null;
    const { cache } = ctx;
    const domains = ctx.domains ?? cache?.domains ?? new DomainMemory();
    const budget = ctx.budget ?? { max: Infinity, spent: 0 };
    const key = cache ? cacheKey(row) : "";
    if (cache) {
        const hit = cache.get(key);
        if (hit)
            return { ...hit, cost: 0, method: "cache" };
    }
    const { result, spend } = await runWaterfall(row, providers, { domains }, budget);
    budget.spent += spend;
    if (result?.verified)
        domains.learnFromEmail(row, result.email, result.method);
    if (cache && result)
        cache.set(key, result);
    return result;
}
async function runWaterfall(row, providers, lookup, budget) {
    let best = null;
    let spend = 0;
    for (const provider of providers) {
        if (provider.cost > 0 && budget.spent + spend + provider.cost > budget.max)
            continue;
        const res = await provider.lookup(row, lookup);
        if (!res)
            continue;
        // Providers bill on an answer, not on a miss.
        spend += provider.cost;
        if (res.verified)
            return { result: { ...res, cost: spend }, spend };
        best ??= res;
    }
    return { result: best ? { ...best, cost: spend } : null, spend };
}
