"use strict";
const MOTION=new Set(["off","subtle","cinematic"]),THREED=new Set(["off","hero","interactive"]);
function normalize(raw={}){
 const motion=MOTION.has(String(raw.motion||"subtle"))?String(raw.motion||"subtle"):"subtle";
 const threeD=THREED.has(String(raw.threeD||raw.three_d||"off"))?String(raw.threeD||raw.three_d||"off"):"off";
 return{motion,threeD,models:raw.models!==false};
}
function instructions(raw){
 const c=normalize(raw);
 if(c.motion==="off"&&c.threeD==="off")return "\nVISUAL EFFECTS: disabled. Do not add decorative motion or 3D scenes.";
 return "\nVISUAL EFFECTS (trusted Kairoq runtime): motion="+c.motion+", 3D="+c.threeD+". Do not import animation or 3D libraries. The server injects the trusted effects runtime. Use data-kq-reveal on elements that should enter as they scroll into view; data-kq-parallax on decorative layers only; data-kq-tilt on a small number of premium product cards/device mockups. For 3D, use at most two accessible CANVAS elements with data-kq-scene=\"globe|routes|particles|device\" and an aria-label, plus useful non-canvas content beside them. If a same-origin GLB/GLTF asset exists, set data-kq-model to its relative URL; never invent remote model URLs. Hero mode should use 3D only in the primary hero. Interactive mode may use pointer/touch rotation on one primary scene and one secondary scene. Never place important text or controls inside a canvas. Effects must remain optional enhancement; layout and content must work when effects are disabled.";
}
function runtime(config){
 const json=JSON.stringify(normalize(config)).replace(/</g,"\\u003c");
 return `/* BEGIN KAIROQ VISUAL EFFECTS RUNTIME */
(()=>{"use strict";if(globalThis.__kairoqEffectsLoaded)return;globalThis.__kairoqEffectsLoaded=true;
const CFG=${json},REDUCED=matchMedia("(prefers-reduced-motion: reduce)").matches,SAVE=!!navigator.connection?.saveData,LOW=SAVE||innerWidth<620||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2)||(navigator.deviceMemory&&navigator.deviceMemory<=2);
const MOTION=REDUCED?"off":CFG.motion,THREE=CFG.threeD,MAX_SCENES=THREE==="interactive"?2:THREE==="hero"?1:0,POINTS=LOW?140:(MOTION==="cinematic"?620:360),FPS=LOW?24:(MOTION==="cinematic"?45:30);
const style=document.createElement("style");style.textContent=`
[data-kq-reveal]{opacity:1;transform:none}
html.kq-motion [data-kq-reveal]{opacity:0;transform:translate3d(0,18px,0);transition:opacity .65s ease,transform .65s cubic-bezier(.2,.8,.2,1)}
html.kq-motion [data-kq-reveal].kq-in{opacity:1;transform:none}
[data-kq-tilt]{transform-style:preserve-3d;will-change:transform}
.kq-effect-canvas{display:block;width:100%;height:100%;min-height:220px;touch-action:pan-y}
.kq-effect-fallback{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;opacity:.45}
@media(max-width:600px){.kq-effect-canvas{min-height:180px}}
@media(prefers-reduced-motion:reduce){[data-kq-reveal]{opacity:1!important;transform:none!important;transition:none!important}[data-kq-parallax],[data-kq-tilt]{transform:none!important}}
`;document.head.append(style);if(MOTION!=="off")document.documentElement.classList.add("kq-motion");
function reveal(){const nodes=[...document.querySelectorAll("[data-kq-reveal]")];if(!nodes.length)return;if(MOTION==="off"||!("IntersectionObserver"in window)){nodes.forEach(n=>n.classList.add("kq-in"));return;}const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("kq-in");io.unobserve(e.target);}}),{rootMargin:"0px 0px -8% 0px",threshold:.08});nodes.forEach(n=>io.observe(n));}
function motion(){
 if(MOTION==="off")return;const par=[...document.querySelectorAll("[data-kq-parallax]")].slice(0,8),tilt=[...document.querySelectorAll("[data-kq-tilt]")].slice(0,8);let scheduled=false;
 const update=()=>{scheduled=false;const y=scrollY;for(const n of par){const r=n.getBoundingClientRect(),depth=Math.max(.03,Math.min(.14,Number(n.dataset.kqParallax)||.06));if(r.bottom>0&&r.top<innerHeight)n.style.transform="translate3d(0,"+((r.top-innerHeight/2)*depth).toFixed(1)+"px,0)";}};
 addEventListener("scroll",()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update)}},{passive:true});update();
 if(THREE!=="interactive"||LOW)return;for(const n of tilt){n.addEventListener("pointermove",e=>{if(e.pointerType==="touch")return;const r=n.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;n.style.transform="perspective(900px) rotateX("+(-y*5).toFixed(2)+"deg) rotateY("+(x*7).toFixed(2)+"deg)";});n.addEventListener("pointerleave",()=>n.style.transform="");}
}
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||"shader");return s}
function program(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,`attribute vec3 a;uniform float t,rx,ry,aspect,ps,scale;varying float d;void main(){vec3 p=a*scale;float cx=cos(rx),sx=sin(rx),cy=cos(ry),sy=sin(ry);p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);float w=max(2.2,p.z+4.4);gl_Position=vec4(p.x*1.7/aspect,p.y*1.7,p.z+2.0,w);gl_PointSize=ps;d=clamp((p.z+1.5)/3.0,0.0,1.0);}`));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,`precision mediump float;uniform vec3 color;uniform float pointMode;varying float d;void main(){if(pointMode>.5){vec2 q=gl_PointCoord-.5;if(dot(q,q)>.25)discard;}gl_FragColor=vec4(color*(.72+.38*d),.38+.55*d);}`));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)||"program");return p}
function globePoints(n,routes=false){const out=[];for(let i=0;i<n;i++){const y=1-(i/(n-1))*2,rad=Math.sqrt(Math.max(0,1-y*y)),a=i*2.3999632297;out.push(Math.cos(a)*rad,y,Math.sin(a)*rad);}if(routes){for(let j=0;j<3;j++)for(let i=0;i<55;i++){const u=i/54,a=(-1.5+j*.85)+u*(1.6+j*.25),y=.55*Math.sin(u*Math.PI)-.35+j*.3,rad=Math.sqrt(Math.max(.05,1-y*y));out.push(Math.cos(a)*rad*1.03,y,Math.sin(a)*rad*1.03);}}return new Float32Array(out)}
function particles(n){const out=new Float32Array(n*3);for(let i=0;i<n;i++){const a=i*12.9898,b=Math.sin(a)*43758.5453,c=Math.sin(a*1.7)*9631.417;out[i*3]=((b-Math.floor(b))-.5)*2.8;out[i*3+1]=((c-Math.floor(c))-.5)*2.0;out[i*3+2]=((Math.sin(a*2.3)*2311.1%1)-.5)*2.5;}return out}
function device(){return new Float32Array([-1,-.65,0,1,-.65,0,1,-.65,0,1,.65,0,1,.65,0,-1,.65,0,-1,.65,0,-1,-.65,0,-.82,-.48,.08,.82,-.48,.08,.82,-.48,.08,.82,.48,.08,.82,.48,.08,-.82,.48,.08,-.82,.48,.08,-.82,-.48,.08])}
function dataUri(uri){const m=/^data:.*?;base64,(.*)$/.exec(uri||"");if(!m)return null;const bin=atob(m[1]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer}
async function loadModel(src){
 if(!CFG.models||!src)return null;const u=new URL(src,location.href);if(u.origin!==location.origin||!/\.(?:glb|gltf)$/i.test(u.pathname))return null;
 let json,bins=[];if(/\.glb$/i.test(u.pathname)){const ab=await(await fetch(u)).arrayBuffer(),dv=new DataView(ab);if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2)throw Error("Unsupported GLB");let o=12;while(o<ab.byteLength){const len=dv.getUint32(o,true),type=dv.getUint32(o+4,true),chunk=ab.slice(o+8,o+8+len);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk));else if(type===0x004e4942)bins.push(chunk);o+=8+len;}}
 else{json=await(await fetch(u)).json();bins=await Promise.all((json.buffers||[]).map(async b=>dataUri(b.uri)||await(await fetch(new URL(b.uri,u))).arrayBuffer()));}
 const prim=json?.meshes?.[0]?.primitives?.[0],acc=json?.accessors?.[prim?.attributes?.POSITION],view=json?.bufferViews?.[acc?.bufferView];if(!prim||!acc||!view||acc.componentType!==5126||acc.type!=="VEC3")throw Error("Model needs FLOAT VEC3 positions");
 const buf=bins[view.buffer||0];if(!buf)throw Error("Model buffer missing");const offset=(view.byteOffset||0)+(acc.byteOffset||0),stride=view.byteStride||12,out=new Float32Array(acc.count*3),dv=new DataView(buf);
 for(let i=0;i<acc.count;i++)for(let j=0;j<3;j++)out[i*3+j]=dv.getFloat32(offset+i*stride+j*4,true);
 let indices=null;if(prim.indices!=null){const ia=json.accessors[prim.indices],iv=json.bufferViews[ia.bufferView],ib=bins[iv.buffer||0],off=(iv.byteOffset||0)+(ia.byteOffset||0),bytes=ia.componentType===5125?4:ia.componentType===5123?2:1;indices=new Uint32Array(ia.count);const idv=new DataView(ib);for(let i=0;i<ia.count;i++)indices[i]=bytes===4?idv.getUint32(off+i*4,true):bytes===2?idv.getUint16(off+i*2,true):idv.getUint8(off+i);}
 return{positions:out,indices};
}
function fallback(canvas){const c=canvas.getContext("2d");if(!c)return;const dpr=Math.min(devicePixelRatio||1,1.5),r=canvas.getBoundingClientRect();canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);c.scale(dpr,dpr);c.clearRect(0,0,r.width,r.height);c.strokeStyle="rgba(70,100,120,.35)";c.lineWidth=1;const rad=Math.min(r.width,r.height)*.28,cx=r.width/2,cy=r.height/2;c.beginPath();c.arc(cx,cy,rad,0,Math.PI*2);c.stroke();for(let i=0;i<6;i++){c.beginPath();c.arc(cx,cy,rad*(.25+i*.12),0,Math.PI*2);c.stroke();}}
async function scene(canvas,index){
 canvas.classList.add("kq-effect-canvas");let gl=canvas.getContext("webgl",{alpha:true,antialias:!LOW,powerPreference:LOW?"low-power":"high-performance"});if(!gl){fallback(canvas);return;}
 let model=null;try{model=await loadModel(canvas.dataset.kqModel)}catch(e){canvas.dataset.kqModelError=String(e.message||e).slice(0,120)}
 const type=canvas.dataset.kqScene||"globe",p=program(gl),pos=model?.positions||(type==="particles"?particles(POINTS):type==="device"?device():globePoints(POINTS,type==="routes"));
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,pos,gl.STATIC_DRAW);const a=gl.getAttribLocation(p,"a");gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,0,0);
 let ib=null;if(model?.indices){ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,model.indices,gl.STATIC_DRAW);}
 const u=n=>gl.getUniformLocation(p,n),ut=u("t"),urx=u("rx"),ury=u("ry"),ua=u("aspect"),ups=u("ps"),usc=u("scale"),uc=u("color"),upm=u("pointMode");let rx=.18,ry=-.35,targetX=rx,targetY=ry,active=true,last=0,raf=0;
 const interactive=THREE==="interactive"&&!LOW&&!REDUCED;canvas.addEventListener("pointermove",e=>{if(!interactive)return;const r=canvas.getBoundingClientRect();targetY=((e.clientX-r.left)/r.width-.5)*.9;targetX=((e.clientY-r.top)/r.height-.5)*-.55;});canvas.addEventListener("pointerleave",()=>{targetX=.18;targetY=-.35;});
 const io=new IntersectionObserver(es=>{active=!!es[0]?.isIntersecting;if(active&&!raf)raf=requestAnimationFrame(draw)});io.observe(canvas);
 function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,LOW?1:1.5),w=Math.max(1,Math.floor(r.width*d)),h=Math.max(1,Math.floor(r.height*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}return w/h}
 function draw(ts){raf=0;if(!active||document.hidden)return;if(ts-last<1000/FPS){raf=requestAnimationFrame(draw);return;}last=ts;const aspect=resize();rx+=(targetX-rx)*.06;ry+=(targetY-ry)*.06;if(MOTION==="cinematic"&&!REDUCED)ry+=.0015;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(p);gl.uniform1f(ut,ts*.001);gl.uniform1f(urx,rx);gl.uniform1f(ury,ry+(MOTION==="cinematic"?scrollY*.00008:0));gl.uniform1f(ua,aspect);gl.uniform1f(ups,type==="particles"?3.0:2.0);gl.uniform1f(usc,model?Number(canvas.dataset.kqScale||.9):1);gl.uniform3f(uc,.18,.55,.47);const points=!model&&type!=="device";gl.uniform1f(upm,points?1:0);if(model?.indices)gl.drawElements(gl.TRIANGLES,model.indices.length,gl.UNSIGNED_INT,0);else gl.drawArrays(points?gl.POINTS:type==="device"?gl.LINES:gl.TRIANGLES,0,pos.length/3);raf=requestAnimationFrame(draw);}
 raf=requestAnimationFrame(draw);
}
function scenes(){if(!MAX_SCENES)return;const all=[...document.querySelectorAll("canvas[data-kq-scene]")];all.slice(MAX_SCENES).forEach(c=>{c.dataset.kqDisabled="budget";fallback(c)});all.slice(0,MAX_SCENES).forEach((c,i)=>scene(c,i).catch(()=>fallback(c)));}
function init(){reveal();motion();scenes();}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
/* END KAIROQ VISUAL EFFECTS RUNTIME */`;
}
function strip(js){return String(js||"").replace(/\/\* BEGIN KAIROQ VISUAL EFFECTS RUNTIME \*\/[\s\S]*?\/\* END KAIROQ VISUAL EFFECTS RUNTIME \*\/\n?/g,"").trimStart();}
function inject(files,raw){const c=normalize(raw);return{...files,"app.js":runtime(c).trimEnd()+"\n"+strip(files["app.js"])}}
function source(files){return{...files,"app.js":strip(files["app.js"])}}
module.exports={normalize,instructions,inject,source,runtime};
