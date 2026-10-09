"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm");
const effects=require("../visual-effects");

test("visual effect modes normalize to safe bounded values",()=>{
 assert.deepEqual(effects.normalize({motion:"cinematic",threeD:"interactive"}),{motion:"cinematic",threeD:"interactive",models:true});
 assert.deepEqual(effects.normalize({motion:"wild",threeD:"everything"}),{motion:"subtle",threeD:"off",models:true});
 assert.equal(effects.normalize({motion:"off",three_d:"hero"}).threeD,"hero");
});

test("trusted runtime is injected once, strips cleanly, and remains valid JavaScript",()=>{
 const files={"index.html":"<html><body></body></html>","styles.css":"body{}".repeat(200),"app.js":"window.presentation=true;"};
 const once=effects.inject(files,{motion:"cinematic",threeD:"interactive"}),twice=effects.inject(once,{motion:"subtle",threeD:"hero"});
 assert.equal((twice["app.js"].match(/BEGIN KAIROQ VISUAL EFFECTS RUNTIME/g)||[]).length,1);
 assert.match(twice["app.js"],/"threeD":"hero"/);
 assert.match(twice["app.js"],/prefers-reduced-motion/);
 assert.match(twice["app.js"],/MAX_SCENES/);
 assert.match(twice["app.js"],/hardwareConcurrency/);
 assert.match(twice["app.js"],/data-kq-model/);
 assert.doesNotThrow(()=>new vm.Script(twice["app.js"]));
 assert.equal(effects.source(twice)["app.js"],"window.presentation=true;");
});

test("effect instructions keep 3D optional and cap scenes",()=>{
 const text=effects.instructions({motion:"cinematic",threeD:"interactive"});
 assert.match(text,/at most two/i);assert.match(text,/optional enhancement/i);assert.match(text,/same-origin GLB\/GLTF/i);
});
