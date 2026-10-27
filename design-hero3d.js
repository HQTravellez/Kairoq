'use strict';
// The 3D art director: while writing the design brief, the brief writer may give a landing page
// one 3D hero from kairoq/hero3d (react-hero3d.js), chosen for what this business is, in its
// colours. Kairoq suggests the recipe and object that fit the request; the brief writer decides
// (or says "none"), and every later change sees the choice in the design brief.

const RECIPES = {
  HeroObject: { fits: 'a business with one object people recognise it by (travel: a suitcase; stays: a house or a key; a shop: a bag; a café: a cup; a gym: a dumbbell)', needsObject: true },
  GlassShapes: { fits: 'software, AI, finance and other businesses with no physical object: glass and glossy shapes in the brand colours' },
  DeviceMockup: { fits: 'an app or software product, only when the owner gave a real screenshot of it', needsScreenshot: true },
  ExplodedView: { fits: 'a physical product made of parts, or a gift or box that opens as the page scrolls', needsObject: true },
  Diorama: { fits: 'places and local businesses: stays, real estate, a neighbourhood, a campus (a tiny isometric world)' },
  ScrollAssembly: { fits: 'a premium product people want to see inside (a watch, headphones, a gadget, a machine): pinned while the page scrolls, it comes apart layer by layer with labels and assembles again', needsObject: true },
};
const OBJECTS = ['suitcase', 'house', 'key', 'shopping-bag', 'plane', 'gift-box', 'dumbbell', 'phone', 'laptop', 'coffee-cup', 'espresso-machine', 'pizza', 'pizza-box', 'oven', 'watch'];
const MOODS = ['studio', 'sunset', 'neon'];

// Words in a request, mapped to the recipe and object that suit them.
// Most specific first: "a boutique watchmaker" is about watches, not shops.
const HINTS = [
  [/\b(watch|watches|watchmaker|horolog\w*|jewell?er\w*|timepiece)\b/i, 'ScrollAssembly', 'watch'],
  [/\b(travel|trips?|flights?|airline|luggage|tour|tours|visa|corporate travel)\b/i, 'HeroObject', 'suitcase'],
  [/\b(flight|airline|airport|aviation|pilot)\b/i, 'HeroObject', 'plane'],
  [/\b(stays?|apartments?|furnished|corporate housing|rentals?|airbnb|villa|real estate|realtor|propert(y|ies)|homes|housing)\b/i, 'Diorama', 'house'],
  [/\b(renovat\w*|contractor|interior\w*|remodel\w*|home builder|construction)\b/i, 'Diorama', 'house'],
  [/\b(keys?|lettings?|landlord|tenants?|locksmith)\b/i, 'HeroObject', 'key'],
  [/\b(shop|store|boutique|e-?commerce|retail|fashion|clothing)\b/i, 'HeroObject', 'shopping-bag'],
  [/\b(gifts?|events?|party|parties|wedding|birthday|celebrat\w*)\b/i, 'ExplodedView', 'gift-box'],
  [/\b(gym|fitness|trainer|workout|strength|crossfit)\b/i, 'HeroObject', 'dumbbell'],
  [/\b(caf[eé]|coffee|espresso|barista|roaster)\b/i, 'HeroObject', 'coffee-cup'],
  [/\b(pizza|pizzeria)\b/i, 'HeroObject', 'pizza'],
  [/\b(saas|software|platform|ai|assistant|automation|fintech|finance|analytics|startup|api)\b/i, 'GlassShapes', null],
];

// The recipe and object Kairoq suggests for a request (null when nothing fits).
function suggest(request) {
  const t = String(request || '');
  for (const [re, recipe, object] of HINTS) if (re.test(t)) return { recipe, ...(object ? { object } : {}) };
  return null;
}

// The block for the brief writer.
function note(request, { hasScreenshot = false } = {}) {
  const s = suggest(request);
  const lines = ['', '3D hero (optional; Kairoq can build one premium 3D visual for the hero of a landing page):'];
  for (const [id, r] of Object.entries(RECIPES)) if (!r.needsScreenshot || hasScreenshot) lines.push('- ' + id + ': ' + r.fits);
  lines.push('Objects for HeroObject and ExplodedView: ' + OBJECTS.join(', ') + '. Moods: studio (clean, bright), sunset (warm), neon (dark and vivid).');
  if (s) lines.push('Suggested for this request: ' + s.recipe + (s.object ? ' with "' + s.object + '"' : '') + '. Use it if it carries this business\'s idea.');
  lines.push('When no object in the list fits but this business has a signature object (a camera shop, a bike maker, a perfume brand), add "custom": "a short description of that object" and Kairoq models it in Blender (for HeroObject, ExplodedView or ScrollAssembly).');
  lines.push('Set "hero3d" in your JSON to {"recipe":"...","object":"...","custom":"","mood":"..."}, or {"recipe":"none"} for a page that is better without 3D (content-led, editorial, or a screen people work in).');
  return lines.join('\n');
}

// Keeps only a valid choice: a known recipe, a known object when the recipe needs one, a mood.
function normalize(v) {
  if (!v || typeof v !== 'object') return null;
  const recipe = String(v.recipe || '');
  if (recipe === 'none') return { recipe: 'none' };
  if (!RECIPES[recipe]) return null;
  const out = { recipe };
  const object = String(v.object || '').toLowerCase().trim();
  if (RECIPES[recipe].needsObject) out.object = OBJECTS.includes(object) ? object : recipe === 'ScrollAssembly' ? 'watch' : 'gift-box';
  if (recipe === 'Diorama') out.objects = OBJECTS.includes(object) ? [object, 'tree', object, 'tree'] : ['house', 'tree', 'house', 'tree'];
  if (recipe === 'DeviceMockup') out.device = object === 'laptop' ? 'laptop' : 'phone';
  // A bespoke object for the Blender modelling agent (model-agent.js), and the model it made.
  const custom = String(v.custom || '').replace(/[\u0000-\u001f"<>{}]/g, ' ').trim().slice(0, 120);
  if (custom && RECIPES[recipe].needsObject) out.custom = custom;
  if (/^\.\/models\/[\w.-]+\.glb$/.test(String(v.src || ''))) out.src = String(v.src);
  out.mood = MOODS.includes(String(v.mood)) ? String(v.mood) : 'studio';
  return out;
}

// The JSX the builder is asked to use, as text for the design brief.
function jsx(h) {
  if (!h || h.recipe === 'none' || !RECIPES[h.recipe]) return '';
  const attrs = [];
  if (h.src) attrs.push('src="' + h.src + '"');
  else if (h.object) attrs.push('object="' + h.object + '"');
  if (h.objects) attrs.push('objects={' + JSON.stringify(h.objects).replace(/"/g, "'") + '}');
  if (h.device) attrs.push('device="' + h.device + '" screenshot="(the owner\'s screenshot in ./uploads/)"');
  if (h.mood && h.mood !== 'studio') attrs.push('mood="' + h.mood + '"');
  return '<' + h.recipe + (attrs.length ? ' ' + attrs.join(' ') : '') + ' />';
}

// The line in every build's design brief.
function text(h) {
  const tag = jsx(h);
  if (!tag) return h && h.recipe === 'none' ? '3D hero: none (this page is better without 3D).' : '';
  return "3D hero: " + tag + " from 'kairoq/hero3d', as the visual of the hero section (beside the headline, not behind it), with a real height (height={480} on desktop; it fits narrow screens by itself). Only one 3D scene on the page.";
}

module.exports = { RECIPES, OBJECTS, MOODS, suggest, note, normalize, jsx, text };
