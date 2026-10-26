"use strict";
// The 'kairoq/hero3d' module generated apps import: premium 3D hero scenes for landing pages
// (HeroObject, GlassShapes, DeviceMockup, ExplodedView, Diorama) with Blender-made objects. Its
// readable source lives in app-modules/kairoq-hero3d.js; the builder serves it as a virtual module.
const fs=require('fs'),path=require('path');
const FILE=path.join(__dirname,'app-modules','kairoq-hero3d.js');
function source(){return fs.readFileSync(FILE,'utf8')}
// The object library (the same names as OBJECTS in the module) and the story's own models.
const OBJECTS={suitcase:'hero-suitcase.glb',house:'hero-house.glb',key:'hero-key.glb','shopping-bag':'hero-shopping-bag.glb',plane:'hero-plane.glb','gift-box':'hero-gift-box.glb',dumbbell:'hero-dumbbell.glb',phone:'hero-phone.glb',laptop:'hero-laptop.glb','coffee-cup':'espresso-cup.glb','espresso-machine':'espresso-machine.glb',pizza:'pizza.glb','pizza-box':'pizza-box.glb',oven:'pizza-oven.glb'};
const STORY=['espresso-machine.glb','espresso-cup.glb','pizza-oven.glb','pizza.glb','pizza-peel.glb','pizza-box.glb'];
// What a recipe shows when the code names no object.
const DEFAULTS={HeroObject:'gift-box',DeviceMockup:'phone',ExplodedView:'gift-box',Diorama:'house'};
// The model files an app needs: the story's when it uses kairoq/story; for kairoq/hero3d, the
// library objects its code names ("suitcase", device="laptop") and the defaults of the recipes it uses.
function neededModels(files){
 const code=Object.values(files||{}).filter(c=>typeof c==='string').join('\n');
 const out=new Set();
 if(/['"]kairoq\/story['"]/.test(code))for(const f of STORY)out.add(f);
 if(/['"]kairoq\/hero3d['"]/.test(code)){
  for(const [name,file] of Object.entries(OBJECTS))if(new RegExp('[\'"`]'+name.replace(/-/g,'\\-')+'[\'"`]').test(code))out.add(file);
  for(const [recipe,name] of Object.entries(DEFAULTS))if(new RegExp('<'+recipe+'\\b|\\b'+recipe+'\\s*,|h\\('+recipe+'\\b').test(code))out.add(OBJECTS[name]);
 }
 return[...out];
}
module.exports={source,FILE,OBJECTS,STORY,neededModels};
