"use strict";
const fs=require("fs"),path=require("path");
const MOTION=new Set(["off","subtle","cinematic"]),THREED=new Set(["off","hero","interactive"]);
function normalize(raw={}){
 const motion=MOTION.has(String(raw.motion||"subtle"))?String(raw.motion||"subtle"):"subtle";
 const threeD=THREED.has(String(raw.threeD||raw.three_d||"off"))?String(raw.threeD||raw.three_d||"off"):"off";
 return{motion,threeD,models:raw.models!==false};
}
function instructions(raw){
 const c=normalize(raw);
 if(c.motion==="off"&&c.threeD==="off")return "\nVISUAL EFFECTS: disabled. Do not add decorative motion or 3D scenes.";
 return "\nVISUAL EFFECTS (trusted Kairoq runtime): motion="+c.motion+", 3D="+c.threeD+". Do not import animation or 3D libraries. The server injects the trusted effects runtime. Use data-kq-reveal for scroll reveals, data-kq-parallax on decorative layers only, and data-kq-tilt on a small number of premium cards or device mockups. For 3D, use accessible canvas elements with data-kq-scene=\"globe|routes|particles|device\" and aria-label. If a same-origin GLB/GLTF exists, data-kq-model may reference it. Hero mode uses at most one primary 3D canvas; interactive mode uses at most two. Never place essential text or controls in canvas. Effects must remain optional enhancement.";
}
function runtime(raw){
 const tpl=fs.readFileSync(path.join(__dirname,"public","visual-effects-runtime.js"),"utf8");
 return tpl.replace("__KAIROQ_EFFECT_CONFIG__",JSON.stringify(normalize(raw)).replace(/</g,"\\u003c"));
}
function strip(js){return String(js||"").replace(/\/\* BEGIN KAIROQ VISUAL EFFECTS RUNTIME \*\/[\s\S]*?\/\* END KAIROQ VISUAL EFFECTS RUNTIME \*\/\n?/g,"").trimStart();}
function inject(files,raw){return{...files,"app.js":runtime(raw).trimEnd()+"\n"+strip(files["app.js"])}}
function source(files){return{...files,"app.js":strip(files["app.js"])}}
module.exports={normalize,instructions,inject,source,runtime,strip};
