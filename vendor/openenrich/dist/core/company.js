import { DomainMemory } from "./domains.js";
import { mailProvider, mxHosts } from "./mx.js";
import { scrapeDomain } from "../providers/scrape.js";
function toDomain(input) {
    return input
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .split("?")[0]
        .split(":")[0];
}
/** Free firmographics: everything the local engine already has to fetch anyway. */
export async function enrichCompany(input, domains = new DomainMemory(), opts = {}) {
    const domain = toDomain(input);
    const [findings, mx] = await Promise.all([
        scrapeDomain(domain, domains, opts),
        mxHosts(domain),
    ]);
    const fact = domains.get(domain);
    return {
        domain,
        title: findings.title,
        description: findings.description,
        socials: findings.socials,
        roleEmails: findings.roleEmails,
        mx,
        mailProvider: mailProvider(mx),
        pattern: fact.pattern,
        patternSource: fact.patternSource,
        catchAll: fact.catchAll,
        hasWebsite: findings.pages.length > 0,
    };
}
