"use strict";
// The "made by AI" look: patterns that make a generated site look like every other template.
// One list, used by the design reviewers (design-panel.js), the polish pass (react-builder.js)
// and the default-on craft skill (design-skills/craft-floor). Adapted from impeccable by Paul
// Bakaus (Apache License 2.0), open-design by nexu-io (anti-ai-slop, Apache 2.0 / MIT) and
// ui-ux-pro-max-skill by Next Level Builder (MIT) and taste-skill by Leonxlnx (MIT); rewritten for Kairoq.
const PATTERNS=[
 'the default indigo or purple accent (or a purple-to-blue gradient) when nothing about the business asks for it',
 'a two-colour gradient behind the hero headline, or gradient-coloured text',
 'a row of three or four identical cards (icon, title, two lines) used for everything',
 'cards inside cards, or every section boxed in a card',
 'a hero with big made-up numbers ("10k+ customers", "99% satisfaction") the business never gave',
 'tiny all-caps "eyebrow" labels above every heading',
 'emoji used as icons',
 'decorative glass blur panels, glowing blobs or random floating shapes',
 'a coloured stripe down one side of cards or alerts',
 'very rounded cards and buttons (more than about 16px) on everything',
 'filler copy ("Unlock your potential", "Seamless solutions", "Elevate your experience") instead of what this business actually offers',
 'body text lines longer than about 75 characters, or light grey text that is hard to read',
 'buttons and links with no visible hover and keyboard focus state',
 // The dated registry of tells from taste-skill by Leonxlnx (MIT): the 2025 and 2025-2026 waves.
 'a pill badge above the hero headline ("New", "Introducing", "Beta")',
 'one word of the headline picked out in italic serif, colour or underline',
 'a cream or yellow-cream background with a terracotta, rust or clay accent (the "warm editorial" fix that became the most common AI look)',
 'a floating rounded pill navigation bar with a blur behind it',
 'a fake product screen built from grey bars and donut charts',
 'a pulsing "live" or "available" status dot used as decoration',
 'monospace micro-labels, 01 / 02 / 03 index numbers, or tiny letter-spaced captions scattered around',
 'hairline rules and 1px outlined boxes everywhere instead of space and tone',
 'the headline is a full sentence over three or four lines at display size (keep it to about five words, the rest below)',
 'everything centred, or every section using the same layout',
 'the same fade-up on every section, hover lift on every card, or bounce easing',
 'copy that corrects itself ("not just X, it\'s Y"), three-part slogan headlines, or "Get started" and "Learn more" as button labels',
];
function list(){return PATTERNS.map(p=>'- '+p).join('\n')}
module.exports={PATTERNS,list};
