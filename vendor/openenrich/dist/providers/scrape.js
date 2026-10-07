import { applyPattern, inferPattern, structuralPattern } from "./patterns.js";
const UA = "openenrich/0.1 (+https://openenrich.dev)";
const MAX_BYTES = 2_000_000;
const LINK_HINT = /(about|team|contact|people|staff|leader|management|founder|impressum|kontakt|our-story|company)/i;
const SOCIAL_HINT = /^https?:\/\/(www\.)?(linkedin\.com\/company|twitter\.com|x\.com|facebook\.com|instagram\.com)\/[^"'\s]+/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g;
const ASSET_RE = /\.(png|jpe?g|gif|svg|webp|css|js|mjs|woff2?|ttf|ico|pdf)$/i;
export const ROLE_LOCALS = new Set([
    "info", "contact", "hello", "hi", "support", "sales", "admin", "office", "team",
    "press", "media", "careers", "jobs", "help", "privacy", "legal", "security",
    "billing", "accounts", "noreply", "no-reply", "donotreply", "webmaster",
    "postmaster", "abuse", "marketing", "enquiries", "inquiries", "mail", "kontakt",
]);
/**
 * Findings hold third-party emails, so they stay in memory for the run only.
 * ponytail: process-lifetime memo, no eviction. A long-lived server should swap in an LRU.
 */
const memo = new Map();
function defaultFetcher(timeoutMs) {
    return async (url) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                signal: ctrl.signal,
                redirect: "follow",
                headers: { "user-agent": UA, accept: "text/html,text/plain,*/*" },
            });
            if (!res.ok)
                return null;
            if (!/text\/(html|plain)/i.test(res.headers.get("content-type") ?? ""))
                return null;
            if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES)
                return null;
            return (await res.text()).slice(0, MAX_BYTES);
        }
        catch {
            return null;
        }
        finally {
            clearTimeout(timer);
        }
    };
}
function sameDomain(email, domain) {
    const host = email.split("@")[1]?.toLowerCase() ?? "";
    return host === domain || host.endsWith(`.${domain}`);
}
function junk(email) {
    const [local, host] = email.split("@");
    if (!local || !host)
        return true;
    if (ASSET_RE.test(email))
        return true;
    if (local.length > 40)
        return true;
    if (/^[0-9a-f]{16,}$/i.test(local))
        return true;
    return /(example|yourname|your-email|sentry|wixpress|domain)\./.test(host);
}
function extractEmails(html, domain) {
    const found = new Set();
    for (const m of html.matchAll(EMAIL_RE))
        found.add(m[0].toLowerCase());
    for (const m of html.matchAll(/mailto:([^"'>\s?]+)/gi)) {
        try {
            found.add(decodeURIComponent(m[1]).toLowerCase());
        }
        catch {
            found.add(m[1].toLowerCase());
        }
    }
    const emails = [];
    const roleEmails = [];
    for (const email of found) {
        if (!sameDomain(email, domain) || junk(email))
            continue;
        const local = email.split("@")[0];
        (ROLE_LOCALS.has(local) ? roleEmails : emails).push(email);
    }
    return { emails, roleEmails };
}
function hintedLinks(html, base, limit) {
    const out = [];
    const seen = new Set();
    const host = new URL(base).host;
    for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
        if (out.length >= limit)
            break;
        let url;
        try {
            url = new URL(m[1], base);
        }
        catch {
            continue;
        }
        if (url.host !== host || !/^https?:$/.test(url.protocol))
            continue;
        if (!LINK_HINT.test(url.pathname))
            continue;
        url.hash = "";
        const key = url.toString();
        if (seen.has(key) || url.pathname === "/")
            continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}
function meta(html) {
    const title = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)?.[1]?.trim();
    const description = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i.exec(html)?.[1] ??
        /<meta[^>]+content=["']([^"']{1,400})["'][^>]+name=["']description["']/i.exec(html)?.[1];
    return { title, description: description?.trim() };
}
function socials(html) {
    const out = new Set();
    for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
        if (SOCIAL_HINT.test(m[1]))
            out.add(m[1].replace(/\/$/, ""));
    }
    return [...out].slice(0, 6);
}
function robotsRules(txt) {
    const rules = [];
    let applies = false;
    for (const raw of txt.split("\n")) {
        const line = raw.split("#")[0].trim();
        const idx = line.indexOf(":");
        if (idx === -1)
            continue;
        const key = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();
        if (key === "user-agent")
            applies = value === "*";
        else if (applies && key === "disallow" && value)
            rules.push(value);
    }
    return rules;
}
async function disallowedPaths(domain, domains, get) {
    const cached = domains.get(domain).robots;
    if (cached)
        return cached;
    const txt = await get(`https://${domain}/robots.txt`);
    const rules = txt ? robotsRules(txt) : [];
    domains.patch(domain, { robots: rules });
    return rules;
}
const allowed = (pathname, rules) => !rules.some((rule) => (rule === "/" ? true : pathname.startsWith(rule)));
export async function scrapeDomain(domain, domains, opts = {}) {
    const cached = memo.get(domain);
    if (cached)
        return cached;
    const get = opts.fetchText ?? defaultFetcher(opts.timeoutMs ?? 8000);
    const maxPages = Math.max(1, opts.maxPages ?? 4);
    const findings = { emails: [], roleEmails: [], socials: [], pages: [] };
    const rules = await disallowedPaths(domain, domains, get);
    const emails = new Set();
    const roles = new Set();
    const add = (html, url) => {
        findings.pages.push(url);
        const hit = extractEmails(html, domain);
        hit.emails.forEach((e) => emails.add(e));
        hit.roleEmails.forEach((e) => roles.add(e));
    };
    let home = null;
    let base = `https://${domain}/`;
    if (allowed("/", rules)) {
        home = await get(base);
        if (!home) {
            base = `http://${domain}/`;
            home = await get(base);
        }
    }
    if (home) {
        add(home, base);
        const { title, description } = meta(home);
        findings.title = title;
        findings.description = description;
        findings.socials = socials(home);
        const links = hintedLinks(home, base, maxPages * 3).filter((url) => allowed(new URL(url).pathname, rules));
        for (const url of links.slice(0, maxPages - 1)) {
            const html = await get(url);
            if (html)
                add(html, url);
        }
    }
    findings.emails = [...emails];
    findings.roleEmails = [...roles];
    domains.patch(domain, {
        roleEmails: findings.roleEmails,
        title: findings.title,
        description: findings.description,
        socials: findings.socials,
        scrapedAt: Date.now(),
    });
    memo.set(domain, findings);
    return findings;
}
export function clearScrapeMemo() {
    memo.clear();
}
export function createScrapeProvider(opts = {}) {
    return {
        name: "scrape",
        cost: 0,
        async lookup(row, ctx) {
            const findings = await scrapeDomain(row.domain, ctx.domains, opts);
            for (const email of findings.emails) {
                const pattern = inferPattern(email, row.first, row.last);
                if (!pattern)
                    continue;
                ctx.domains.learn(row.domain, pattern, "scrape");
                return {
                    email,
                    source: "scrape",
                    cost: 0,
                    verified: true,
                    method: "scrape",
                    pattern,
                    note: "published on the company website",
                };
            }
            const learned = ctx.domains.pattern(row.domain) ??
                findings.emails.map(structuralPattern).find((p) => !!p);
            if (!learned)
                return null;
            ctx.domains.learn(row.domain, learned, "structural");
            const guess = applyPattern(learned, row);
            if (!guess)
                return null;
            return {
                email: guess,
                source: "scrape",
                cost: 0,
                verified: false,
                method: "pattern-only",
                pattern: learned,
                note: `pattern ${learned} learned from a published email`,
            };
        },
    };
}
