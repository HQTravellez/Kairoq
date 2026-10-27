"use strict";
// Section recipes (design-recipes.js): Kairoq's own library of premium section patterns. The art
// director gets the library with suggestions for the request, picks one per section, and every
// build's design brief describes the chosen sections.
const test=require('node:test'),assert=require('node:assert/strict');
const recipes=require('../design-recipes'),design=require('../react-design');

test('the library: unique ids, every section kind covered, kit pieces that exist',()=>{
 const ids=recipes.RECIPES.map(r=>r.id);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(ids.length>=45,'about fifty recipes: '+ids.length);
 assert.deepEqual(recipes.KINDS,['hero','features','story','gallery','process','pricing','testimonials','stats','faq','cta','contact','footer']);
 const kit=Object.keys(design.KIT_API).join(' ');
 for(const r of recipes.RECIPES){
  assert.ok(r.look.length>60&&r.fits.length>5,r.id);
  for(const u of r.uses)if(!/kairoq\//.test(u))assert.ok(new RegExp('\\b'+u+'\\b').test(Object.values(design.KIT_API).join(' ')+' '+kit)||['TextLoop','TextEffect','TextShimmer','Magnetic','BackgroundPaths','AnimatedGradient','AnimatedGroup','Tilt','Spotlight','ProgressiveBlur','ImageComparison','InView'].includes(u),'kit piece '+u+' in '+r.id);
 }
});

test('suggestions follow the business; the choice is checked; the brief describes the sections',()=>{
 assert.deepEqual(recipes.suggest('A boutique watchmaker in Montréal').slice(0,2),['hero-product-3d','process-scroll-assembly']);
 assert.ok(recipes.suggest('Kitchen renovation contractor').includes('gallery-before-after'));
 assert.ok(recipes.suggest('An AI scheduling SaaS for clinics').includes('hero-glow-gradient'));
 const note=recipes.note('A cosy café in Ottawa');
 assert.match(note,/- hero: hero-split-photo/);assert.match(note,/Suggested for this request: hero-split-photo, pricing-menu/);
 // Unknown ids and recipes in the wrong section are dropped.
 assert.deepEqual(recipes.normalize({hero:'hero-split-photo',pricing:'pricing-menu',features:'hero-bento',cta:'nope'}),{hero:'hero-split-photo',pricing:'pricing-menu'});
 assert.equal(recipes.normalize({}),null);assert.equal(recipes.normalize('hero-split-photo'),null);
 const t=recipes.text({hero:'hero-rotating-words',gallery:'gallery-before-after'});
 assert.match(t,/^Section recipes \(build these sections this way; real content only\):/);
 assert.match(t,/- Hero: Rotating words\. .*Kit: TextLoop, TextEffect, Magnetic\./);
 assert.match(t,/- Gallery: Before and after\./);
});

test('the art director is offered the library, and the chosen recipes reach every build',async()=>{
 const seen=[];
 const callModel=async(o,parse)=>{seen.push(o.messages[1].content);return parse(JSON.stringify({name:'Warm Bakery',summary:'Warm and calm.',palette:{background:'#fbf6ee',foreground:'#2a211b',primary:'#9c4a1a',secondary:'#f1e7d8',accent:'#3f6b4f',muted:'#f4ece0'},fonts:{display:'Fraunces',body:'Inter'},radius:'0.75rem',recipes:{hero:'hero-split-photo',pricing:'pricing-menu',story:'story-split-quote',footer:'hero-bento'}}))};
 const brief=await design.createBrief('A family bakery in Ottawa with a seasonal menu',{callModel,projectName:'Maple Crumb'});
 assert.match(seen[0],/Section recipes \(Kairoq's library/);
 assert.deepEqual(brief.recipes,{hero:'hero-split-photo',pricing:'pricing-menu',story:'story-split-quote'});
 const note=design.designNote(brief);
 assert.match(note,/- Hero: Split with photo\./);assert.match(note,/- Pricing: Menu list\./);
});
