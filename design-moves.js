"use strict";
// Design moves: named changes the owner can ask for with one tap in the editor, from Impeccable's
// command vocabulary (pbakaus/impeccable, Apache-2.0; its references rewritten in Kairoq's words
// for a builder whose work is built, opened in a browser and measured). Each move is a full
// instruction to the builder; the chat shows only the move's name and the owner's note.
//  - build moves change the app (Polish, Bolder, Quieter, Distill, Clarify);
//  - Critique is a review in Discuss: nothing changes until the owner says so;
//  - Audit is deterministic: Impeccable's detector and Kairoq's measured giveaways on the
//    current version, no model (create-api.js runs it through impeccable.js and craft-check.js).

const SCOPE='Scope: if the owner named a page, section or part after the colon, touch only that and leave everything else exactly as it is; otherwise work through the whole app. Keep every page, feature, form, record and piece of real content working. Do not add a colour, font, radius, shadow or component the app does not already have unless the owner asked for it. In "message", say in plain words what you changed and where.';

const MOVES={
 polish:{label:'Polish',mode:'build',hint:'Finish what is there: alignment, spacing, states, consistency',
  text:note=>`Polish the design: refinement, never a hidden redesign. Keep the app's look, content and behaviour; make what is there finished.
Fix in this order, across the whole path a visitor takes, not one corner:
1. anything broken or misleading: dead controls, wrong state, text that overflows or breaks at phone width;
2. missing states: loading (Skeleton), empty, error, success, disabled;
3. drift from the design tokens and the UI kit: one-off colours, sizes, spacings or hand-styled copies of a kit component (use the kit, extend it with a variant if needed);
4. layout and type: align to the grid and the 4/8 px spacing scale, group related things tightly and separate groups generously, line lengths of 60 to 75 characters, one weight and one colour per heading, tabular figures for numbers;
5. interaction: hover, pressed, focus-visible and disabled on everything clickable without layout shift; keyboard works everywhere;
6. motion: only what answers an action, short, with a prefers-reduced-motion fallback.
Do not perfect one section and leave the rest below the same bar. ${SCOPE}${note?'\nThe owner adds: '+note:''}`},
 bolder:{label:'Bolder',mode:'build',hint:'Give one part real conviction without changing the brand',
  text:note=>`Make it bolder: an amplification, not a new idea. The app's brand, tokens and conventions are the given; raise ${note?'the part the owner named':'the weakest, flattest section (say which one you chose)'} to the conviction the rest of the app already has.
- Amplify what the app already owns: its display type at full strength, its structural devices, its signature move, turned up here rather than invented here. The bolder version looks more like the same brand, not less.
- Commit, then clarify: make one decisive move completely (scale, a full-bleed image or band, a figure set in the display face, a tight rhythm change), then quiet everything around it so the move is legible. If everything got louder, nothing did.
- Give it its own rhythm: a peak in the scroll, a change in density or pace from its neighbours.
- Keep content true: keep every existing claim and number; never invent a metric, quote, logo or count.
- Skeleton test: with the copy removed, the structure alone should still say what this section is and why it matters.
${SCOPE}${note?'\nThe owner adds: '+note:''}`},
 quieter:{label:'Quieter',mode:'build',hint:'Calm it down without making it generic',
  text:note=>`Make it quieter: reduce visual intensity without losing the point of view. Quiet is harder than loud; generic quiet (grey text on white, one sans at one weight, a grid of identical cards) is not the goal.
- Colour: fewer colours; neutrals do most of the work and the accent appears where it matters (about a tenth of the surface); soften saturated colours to 70–85 %; tinted greys instead of pure grey; never grey text on a coloured background (use a darker shade of that colour instead).
- Weight: very few elements stay bold; everything else recedes a step. Smaller display sizes where they shout, lighter weights, more whitespace and typographic air.
- Surfaces: flatter cards, fewer backgrounds and borders, no glow, fewer decorations.
- Motion: remove or shorten anything that moves on its own.
- Keep the personality: the signature move, the display face and the content stay; drama is reduced, not deleted.
${SCOPE}${note?'\nThe owner adds: '+note:''}`},
 distill:{label:'Distill',mode:'build',hint:'Strip it to what earns its place',
  text:note=>`Distill it: strip the design to its essence. Remove what does not earn its place: redundant elements, repeated information, decorative noise, cosmetic complexity.
- One primary goal per screen; one primary action, few secondary, the rest hidden until needed (progressive disclosure: an accordion, a dialog, a step).
- Remove redundancy: if it is said elsewhere, do not repeat it here; merge similar buttons; combine related forms.
- Visual: one or two colours plus neutrals; one font family, three or four sizes; remove borders, shadows and backgrounds that carry no hierarchy; flatten nesting (never a card inside a card; spacing and alignment instead of boxes); one spacing scale.
- Keep every feature and all real content: simplicity removes obstacles between visitors and their goal, not the goal.
${SCOPE}${note?'\nThe owner adds: '+note:''}`},
 clarify:{label:'Clarify',mode:'build',hint:'Rewrite unclear words: labels, errors, empty states',
  text:note=>`Clarify the words: rewrite unclear interface text so visitors know what happened, what matters and what to do next. Keep the facts, the product's own terms and the owner's voice; this is not a redesign.
Read the whole path, not isolated strings. Fix: vague nouns and verbs, jargon, labels that name the gesture instead of the outcome, inconsistent terms and capitalisation, redundant headings and intros, text that breaks at phone width.
- Actions: a specific verb and object ("Book a table", not "Submit"); the same name for the same thing everywhere; destructive actions name the object and the consequence, with undo preferred over a confirmation.
- Forms: persistent labels (placeholders are examples), requirements before submission, validation that says what to fix without blame, next to the field.
- Errors: what failed, why when known, how to recover; no internal codes as the message; no promised cause the app cannot know.
- Loading, empty and success states: name the real operation; an empty state says which kind of empty it is and offers the next useful action; success confirms the outcome briefly.
- Say each idea once; sentence case; no filler ("seamless", "unlock", "elevate").
${SCOPE}${note?'\nThe owner adds: '+note:''}`},
 critique:{label:'Critique',mode:'discuss',hint:'A scored design review; nothing changes',
  text:note=>`Give a design critique of the current app${note?' ('+note+')':''}: a scored review, nothing changes until the owner asks.
Look at the whole app as a visitor and as a design director. Score each area 1 to 10 with one line of evidence from the actual pages (name the page and the element): first impression and hierarchy; type (faces, sizes, line length, weights); colour and contrast; layout and spacing rhythm; copy (clear, specific, no filler); states (loading, empty, error, success); interaction (hover, focus, keyboard, touch targets); responsiveness at phone width; motion; the "made by AI" tells (eyebrows, arrows on buttons, one coloured word in a heading, identical card grids, gradient text, glows, invented numbers).
Then list the five changes that would matter most, most important first, each as a concrete instruction the owner could send back ("Make it bolder: the hero", "Clarify: the booking form errors"). Be strict and specific; a generic compliment is worth nothing.`},
 audit:{label:'Audit',mode:'audit',hint:'Impeccable\'s 62 rules and Kairoq\'s measurements, no model',text:()=>''},
};

function get(id){return Object.hasOwn(MOVES,id)?{id,...MOVES[id]}:null}
function list(){return Object.entries(MOVES).map(([id,m])=>({id,label:m.label,hint:m.hint,mode:m.mode}))}
// What the chat shows for a move the owner sent: its name and their note.
function shown(id,note){const m=get(id);return m?m.label+(note?': '+String(note).trim():''):''}
function instruction(id,note){const m=get(id);return m?m.text(String(note||'').trim().slice(0,2000)):''}

// The audit report: deterministic findings as a message the owner reads in the chat.
function auditReport({detected=[],measured=[],url=''}={}){
 const all=[...measured,...detected];
 if(!all.length)return{text:'Audit: nothing to flag. Impeccable\'s rules and Kairoq\'s measurements found none of the "made by AI" tells or quality problems on this version.',count:0};
 const lines=all.slice(0,14).map((i,n)=>(n+1)+'. '+(String(i.kind||'').startsWith('impeccable:')?'['+i.kind.slice(11)+'] ':'')+i.issue+'. **Fix:** '+i.fix);
 return{text:'Audit of the current version ('+detected.length+' from Impeccable\'s rules, '+measured.length+' measured on the page):\n'+lines.join('\n')+(all.length>14?'\n…and '+(all.length-14)+' more.':'')+'\nSay "Fix the audit findings" and the builder makes exactly these changes.',count:all.length};
}
// The build message for "Fix the audit findings".
function fixAudit(report){return'Fix exactly these findings from the design audit, across every page and section where they appear, keeping all content, features and data working:\n'+String(report||'').replace(/^Audit[^\n]*\n/,'').replace(/\nSay "Fix the audit findings".*$/s,'')+'\nIn "message", say in one sentence what you fixed.'}

module.exports={MOVES,get,list,shown,instruction,auditReport,fixAudit};
