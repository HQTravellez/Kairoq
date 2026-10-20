"use strict";
// The "made by AI" look: patterns that make a generated site look like every other template.
// One list, used by the design reviewers (design-panel.js), the polish pass (react-builder.js)
// and the default-on craft skill (design-skills/craft-floor). Adapted from impeccable by Paul
// Bakaus (Apache License 2.0), open-design by nexu-io (anti-ai-slop, Apache 2.0 / MIT) and
// ui-ux-pro-max-skill by Next Level Builder (MIT); rewritten for Kairoq.
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
];
function list(){return PATTERNS.map(p=>'- '+p).join('\n')}
module.exports={PATTERNS,list};
