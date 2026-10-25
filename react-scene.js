"use strict";
// The 'kairoq/scene' module generated apps import: tested three.js pieces built on React Three
// Fiber 8 and drei 9 (both MIT). Scene3D is a safe stage for custom 3D; Configurator, Globe,
// Particles and MiniGame are ready-made. Every piece shows a plain fallback when the device has
// no WebGL, only animates while on screen, holds still for people who prefer reduced motion, and
// marks itself data-kq-scene / data-kq-drawn so Kairoq's browser check can see it really drew.
const LAND=require('fs').readFileSync(require('path').join(__dirname,'vendor','land-1deg.b64'),'utf8').trim();
function source(){return `import React,{Suspense,useEffect,useMemo,useRef,useState,useCallback} from 'react';
import * as THREE from 'three';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls,useGLTF,ContactShadows,Center,Html,Environment,Lightformer,QuadraticBezierLine,RoundedBox} from '@react-three/drei';
const h=React.createElement;

// ---------- shared ----------
let glOk=null;
export function hasWebGL(){if(glOk!==null)return glOk;try{const c=document.createElement('canvas');glOk=Boolean(c.getContext('webgl2')||c.getContext('webgl'))}catch{glOk=false}return glOk}
export function prefersStill(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}}
// A colour from the app's design tokens (--primary, --accent...), or the fallback.
export function themeColor(name,fallback){
 try{const el=document.createElement('span');el.style.color='hsl(var(--'+name+'))';document.body.appendChild(el);const c=getComputedStyle(el).color;el.remove();if(c&&c!=='rgb(0, 0, 0)'&&c!=='rgba(0, 0, 0, 0)')return c}catch{}
 return fallback;
}
function useInView(ref){
 const [on,setOn]=useState(false);
 useEffect(()=>{const el=ref.current;if(!el||typeof IntersectionObserver==='undefined'){setOn(true);return}const io=new IntersectionObserver(([e])=>setOn(e.isIntersecting),{rootMargin:'120px'});io.observe(el);return()=>io.disconnect()},[]);
 return on;
}
// Marks the wrapper once a real frame has been drawn (for Kairoq's browser check).
function Drawn({host}){const done=useRef(false);useFrame(()=>{if(!done.current&&host.current){done.current=true;host.current.dataset.kqDrawn='true'}});return null}
function Fallback({poster,alt,className,style,children}){
 return h('div',{className,style:{position:'relative',minHeight:200,...style},'data-kq-scene':'fallback',role:alt?'img':undefined,'aria-label':alt||undefined},
  poster?h('img',{src:poster,alt:alt||'',style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}):null,children);
}

// ---------- Scene3D: a safe stage for any custom 3D ----------
// children: React Three Fiber elements. controls: true for drag-to-turn. lights: 'soft' (default),
// 'studio' (soft reflections, made on the device with no download) or false. stage: 'light',
// 'dark', 'sky' or a CSS background for the area behind the 3D.
const STAGES={light:'radial-gradient(ellipse at 50% 38%,#ffffff 0%,#f1f3f6 55%,#e3e7ed 100%)',dark:'radial-gradient(ellipse at 50% 40%,#16284a 0%,#0b1630 55%,#050a17 100%)',sky:'linear-gradient(180deg,#dbeafe 0%,#f0f9ff 55%,#fef9c3 100%)'};
function Studio(){
 return h(Environment,{resolution:256,frames:1},
  h(Lightformer,{form:'rect',intensity:1.4,position:[0,5,1],scale:[10,3,1],rotation:[Math.PI/2,0,0]}),
  h(Lightformer,{form:'rect',intensity:1.6,position:[-5,1.5,1.5],scale:[3,6,1],rotation:[0,Math.PI/2,0]}),
  h(Lightformer,{form:'rect',intensity:1.0,position:[5,1.5,1.5],scale:[3,6,1],rotation:[0,-Math.PI/2,0]}),
  h(Lightformer,{form:'ring',intensity:0.7,position:[0,1,-6],scale:4,rotation:[0,0,0]}));
}
export function Scene3D({children,className='',style,poster,alt,camera,target,controls=false,autoRotate=false,lights='soft',stage,background,overlay,dpr,onCreated,fallback,orbit}){
 const host=useRef(null),inView=useInView(host),still=prefersStill();
 const bg=stage?(STAGES[stage]||stage):undefined;
 if(typeof window!=='undefined'&&!hasWebGL())return fallback||h(Fallback,{poster,alt,className,style:{background:bg,...style}},overlay);
 return h('div',{ref:host,className,style:{position:'relative',minHeight:200,overflow:'hidden',background:bg,...style},'data-kq-scene':'canvas',role:alt?'img':undefined,'aria-label':alt||undefined},
  h(Canvas,{camera:camera||{position:[0,0.6,4.5],fov:45},dpr:dpr||[1,1.75],gl:{antialias:true,alpha:!background,powerPreference:'default'},frameloop:inView&&!still?'always':'demand',
   style:{position:'absolute',inset:0},onCreated},
   background?h('color',{attach:'background',args:[background]}):null,
   lights==='studio'?h(React.Fragment,null,h('ambientLight',{intensity:0.25}),h('directionalLight',{position:[3,6,4],intensity:1.1}),h(Studio)):
   lights?h(React.Fragment,null,h('ambientLight',{intensity:0.6}),h('hemisphereLight',{args:['#ffffff','#bbbbbb',0.6]}),h('directionalLight',{position:[4,6,5],intensity:1.4})):null,
   h(Suspense,{fallback:null},children),
   controls?h(OrbitControls,{target:target||[0,0,0],enablePan:false,autoRotate:autoRotate&&!still,autoRotateSpeed:0.7,makeDefault:true,minDistance:1,maxDistance:20,enableDamping:true,...orbit}):null,
   h(Drawn,{host})),
  overlay||null);
}

// ---------- Configurator: a model and its colour or material options ----------
// options: [{label, color, price?, roughness?, metalness?}]; parts: material or mesh names to
// recolour (case-insensitive, part of the name is enough). Without parts, materials named like
// fabric, leather, paint or body change; if the model has none of those, every material does.
const MAIN=/fabric|cloth|leather|upholst|velvet|linen|cushion|seat|body|paint|shell|main|base ?color/i;
function Recolor({src,option,parts}){
 const {scene}=useGLTF(src);
 // A copy with its own materials, scaled so its largest side is 1.6 units whatever the file's units.
 const copy=useMemo(()=>{const c=scene.clone(true);c.traverse(o=>{if(o.isMesh){o.castShadow=true;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone()}});const size=new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3());const big=Math.max(size.x,size.y,size.z)||1;c.scale.multiplyScalar(1.6/big);return c},[scene]);
 const pick=useMemo(()=>{
  const want=(parts||[]).map(p=>String(p).toLowerCase());const names=m=>((m.name||'')+' '+(m.userData&&m.userData.mesh||'')).toLowerCase();
  const all=[];copy.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material)){m.userData.mesh=o.name;all.push(m)}});
  if(want.length)return all.filter(m=>want.some(p=>names(m).includes(p)));
  const main=all.filter(m=>MAIN.test(names(m)));return main.length?main:all;
 },[copy,JSON.stringify(parts||[])]);
 useEffect(()=>{if(!option)return;for(const m of pick){if(option.color&&m.color)m.color.set(option.color);if(option.color&&m.sheenColor)m.sheenColor.set(option.color).multiplyScalar(1.15);if(option.roughness!=null&&'roughness' in m)m.roughness=option.roughness;if(option.metalness!=null&&'metalness' in m)m.metalness=option.metalness;m.needsUpdate=true}},[pick,option]);
 return h(Center,{top:true},h('primitive',{object:copy}));
}
export function Configurator({src,poster,alt='3D model',options=[],parts,initial=0,className='',style,height=440,onChange,autoRotate=true,currency='$',stage='light',title}){
 const [i,setI]=useState(Math.min(initial,Math.max(0,options.length-1)));const pick=options[i];
 const choose=n=>{setI(n);onChange&&onChange(options[n],n)};
 const ring=on=>on?'0 0 0 3px #fff, 0 0 0 5px currentColor':'0 0 0 1px rgba(0,0,0,.12)';
 const bar=h('div',{style:{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:16,marginTop:18}},
  h('div',null,h('div',{style:{fontSize:13,opacity:.65}},title||'Colour'),h('div',{style:{fontSize:18,fontWeight:600},'aria-live':'polite'},pick?pick.label:'')),
  h('div',{style:{display:'flex',flexWrap:'wrap',gap:14,alignItems:'center'},role:'radiogroup','aria-label':title||'Colour'},
   ...options.map((o,n)=>h('button',{key:n,type:'button',role:'radio','aria-checked':String(n===i),'aria-label':o.label,title:o.label,onClick:()=>choose(n),
    style:{width:36,height:36,borderRadius:'50%',background:o.color||'#ccc',border:0,boxShadow:ring(n===i),cursor:'pointer',padding:0,transition:'box-shadow .15s'}}))),
  pick&&pick.price!=null?h('div',{style:{fontSize:22,fontWeight:700}},currency+Number(pick.price).toLocaleString()):null);
 return h('div',{className,style},
  h(Scene3D,{poster,alt:alt+(pick?', '+pick.label:''),controls:true,autoRotate,lights:'studio',stage,style:{height,borderRadius:24},camera:{position:[0.9,1.25,3.2],fov:38},target:[0,0.7,0],orbit:{maxPolarAngle:Math.PI/2.05,minDistance:1.8,maxDistance:6}},
   h(Recolor,{src,option:pick,parts}),h(ContactShadows,{position:[0,0,0],opacity:0.5,scale:6,blur:2.2,far:2.5,resolution:512,color:'#1f2937'})),
  options.length?bar:null);
}

// ---------- Globe: places and routes ----------
// Land comes from a 1-degree world map built in (Natural Earth via global-land-mask, public domain).
const LAND='${LAND}';let landBits=null;
function isLand(lat,lng){
 if(!landBits){const b=atob(LAND);landBits=new Uint8Array(b.length);for(let k=0;k<b.length;k++)landBits[k]=b.charCodeAt(k)}
 const r=Math.min(179,Math.max(0,Math.floor(90-lat))),c=Math.min(359,Math.max(0,Math.floor(lng+180))),k=r*360+c;
 return(landBits[k>>3]>>(7-(k&7)))&1;
}
const RAD=Math.PI/180;
export function latLng(lat,lng,r=1){const phi=(90-lat)*RAD,th=(lng+180)*RAD;return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(th),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(th))}
let dotTexture=null;
function roundDot(){if(dotTexture)return dotTexture;const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#fff';x.beginPath();x.arc(32,32,28,0,Math.PI*2);x.fill();dotTexture=new THREE.CanvasTexture(c);return dotTexture}
const GLOW_V='varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const GLOW_F='uniform vec3 c;varying vec3 vN;void main(){float i=pow(0.66-dot(vN,vec3(0.0,0.0,1.0)),3.0)*0.85;gl_FragColor=vec4(c,1.0)*i;}';
function Route({a,color}){
 const ref=useRef();const still=prefersStill();
 const s=latLng(a.from[0],a.from[1],1.003),e=latLng(a.to[0],a.to[1],1.003),m=s.clone().add(e).multiplyScalar(0.5);m.normalize().multiplyScalar(1+Math.max(0.12,s.distanceTo(e)*0.42));
 useFrame((_,dt)=>{if(ref.current&&!still)ref.current.material.dashOffset-=dt*0.35});
 return h(React.Fragment,null,
  h(QuadraticBezierLine,{start:s,end:e,mid:m,color,lineWidth:1,transparent:true,opacity:0.25}),
  h(QuadraticBezierLine,{ref,start:s,end:e,mid:m,color,lineWidth:2.2,dashed:true,dashScale:6,dashSize:0.6,gapSize:1.4,transparent:true,opacity:0.95}));
}
function Marker({p,color,labels}){
 const ring=useRef();const still=prefersStill();const v=latLng(p.lat,p.lng,1.004);
 const q=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),v.clone().normalize()),[p.lat,p.lng]);
 useFrame(({clock})=>{if(!ring.current)return;const t=still?0.5:(clock.elapsedTime*0.7+p.lat*0.01)%1;ring.current.scale.setScalar(1+t*2.2);ring.current.material.opacity=0.8*(1-t)});
 return h('group',{position:[v.x,v.y,v.z],quaternion:q},
  h('mesh',null,h('circleGeometry',{args:[0.014,24]}),h('meshBasicMaterial',{color:p.color||color})),
  h('mesh',{ref:ring},h('ringGeometry',{args:[0.016,0.022,32]}),h('meshBasicMaterial',{color:p.color||color,transparent:true,depthWrite:false})),
  labels&&p.label?h(Html,{distanceFactor:1.6,center:true,zIndexRange:[20,0],style:{pointerEvents:'none',transform:'translateY(-14px)',whiteSpace:'nowrap',font:'600 11px/1.2 system-ui,sans-serif',color:'#fff',background:'rgba(8,15,30,.72)',border:'1px solid rgba(255,255,255,.18)',padding:'3px 7px',borderRadius:999}},p.label):null);
}
function GlobeBody({points,arcs,ocean,land,glow,arcColor,spin,labels}){
 const outer=useRef(),still=prefersStill();
 useFrame(({clock},dt)=>{if(!outer.current||still)return;if(spin==='full')outer.current.rotation.y+=dt*0.06;else if(spin)outer.current.rotation.y=Math.sin(clock.elapsedTime*0.18)*0.22});
 const dots=useMemo(()=>{const n=18000,pos=[],gold=Math.PI*(3-Math.sqrt(5));for(let k=0;k<n;k++){const y=1-(k/(n-1))*2,r=Math.sqrt(1-y*y),t=gold*k,x=Math.cos(t)*r,z=Math.sin(t)*r;const lat=Math.asin(y)/RAD;let lng=Math.atan2(z,-x)/RAD-180;if(lng<-180)lng+=360;if(isLand(lat,lng))pos.push(x*1.004,y*1.004,z*1.004)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));return g},[]);
 // Turn the globe so the places are in front.
 const facing=useMemo(()=>{if(!points.length)return new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35,-0.6,0));const sum=new THREE.Vector3();for(const p of points)sum.add(latLng(p.lat,p.lng));return new THREE.Quaternion().setFromUnitVectors(sum.normalize(),new THREE.Vector3(0,0.3,1).normalize())},[JSON.stringify(points)]);
 const glowMat=useMemo(()=>new THREE.ShaderMaterial({uniforms:{c:{value:new THREE.Color(glow)}},vertexShader:GLOW_V,fragmentShader:GLOW_F,side:THREE.BackSide,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}),[glow]);
 return h(React.Fragment,null,
  h('mesh',{scale:1.11,material:glowMat},h('sphereGeometry',{args:[1,64,64]})),
  h('group',{ref:outer},h('group',{quaternion:facing},
   h('mesh',null,h('sphereGeometry',{args:[1,96,96]}),h('meshStandardMaterial',{color:ocean,roughness:0.75,metalness:0.1,emissive:ocean,emissiveIntensity:0.45})),
   h('points',{geometry:dots},h('pointsMaterial',{size:0.017,color:land,map:roundDot(),alphaTest:0.5,transparent:true,opacity:0.95,sizeAttenuation:true})),
   ...arcs.map((a,k)=>h(Route,{key:'r'+k,a,color:a.color||arcColor})),
   ...points.map((p,k)=>h(Marker,{key:'m'+k,p,color:arcColor,labels})))));
}
export function Globe({points=[],arcs=[],ocean='#13305e',land='#cfe6ff',glow='#4f8df7',arcColor='#fbbf24',labels=true,spin=true,stage='dark',className='',style,height=480,alt='Globe',poster}){
 return h(Scene3D,{className,stage,style:{height,borderRadius:24,...style},alt:alt+(points.length?': '+points.map(p=>p.label).filter(Boolean).join(', '):''),poster,controls:true,lights:false,camera:{position:[0,0,3.55],fov:42},orbit:{minDistance:2,maxDistance:6}},
  h('ambientLight',{intensity:0.8}),h('directionalLight',{position:[-3,2,4],intensity:1.8}),
  h(GlobeBody,{points,arcs,ocean,land,glow,arcColor,spin,labels}));
}

// ---------- Particles: a calm animated background ----------
function Dust({count,color,size,speed}){
 const p=useRef();const {pointer}=useThree();const still=prefersStill();
 const geo=useMemo(()=>{const pos=new Float32Array(count*3);for(let k=0;k<count;k++){pos[k*3]=(Math.random()-0.5)*10;pos[k*3+1]=(Math.random()-0.5)*6;pos[k*3+2]=(Math.random()-0.5)*6}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));return g},[count]);
 useFrame((_,dt)=>{if(!p.current||still)return;p.current.rotation.y+=dt*0.03*speed;p.current.rotation.x+=((pointer.y*0.15)-p.current.rotation.x)*0.03;p.current.rotation.z+=((pointer.x*0.1)-p.current.rotation.z)*0.03});
 return h('points',{ref:p,geometry:geo},h('pointsMaterial',{size,color,transparent:true,opacity:0.8,sizeAttenuation:true,depthWrite:false}));
}
export function Particles({count=1400,color,size=0.035,speed=1,className='',style}){
 const n=typeof window!=='undefined'&&innerWidth<640?Math.round(count/2):count;
 return h('div',{className,style:{position:'absolute',inset:0,pointerEvents:'none',zIndex:0,...style},'aria-hidden':'true'},
  h(Scene3D,{lights:false,style:{position:'absolute',inset:0,minHeight:0},camera:{position:[0,0,5],fov:60},fallback:h('div',{style:{position:'absolute',inset:0}})},
   h(Dust,{count:n,color:color||themeColor('primary','#94a3b8'),size,speed})));
}

// ---------- MiniGame: catch the falling items ----------
// A tested starter: move with arrow keys, dragging or tapping left/right; catch good items,
// avoid bad ones. items: [{color, points, label?}] (negative points = avoid). seconds: round length.
function Game({state,items,basketColor,speed,onEnd}){
 const basket=useRef(),drops=useRef([]),spawn=useRef(0),{viewport,pointer}=useThree();
 useEffect(()=>{drops.current=[];spawn.current=0},[state.round]);
 useFrame((_,dt)=>{
  const s=state.current;if(!s.playing||!basket.current)return;
  dt=Math.min(dt,0.05);s.left-=dt;if(s.left<=0){s.playing=false;onEnd(s.score);return}
  const half=viewport.width/2-0.4;
  if(s.useKeys)basket.current.position.x=THREE.MathUtils.clamp(basket.current.position.x+s.dir*dt*6,-half,half);
  else if(s.pointerMoved)basket.current.position.x=THREE.MathUtils.clamp(pointer.x*viewport.width/2,-half,half);
  spawn.current-=dt;if(spawn.current<=0){spawn.current=0.45/speed;const it=items[Math.floor(Math.random()*items.length)];drops.current.push({x:(Math.random()-0.5)*(viewport.width-1),y:viewport.height/2+0.4,v:(1.6+Math.random())*speed,it,mesh:null})}
  for(const d of drops.current){d.y-=d.v*dt;if(d.mesh)d.mesh.position.set(d.x,d.y,0);
   if(!d.done&&d.y<-viewport.height/2+0.75&&Math.abs(d.x-basket.current.position.x)<0.75){d.done=true;s.score+=d.it.points;s.flash=d.it.points;state.render()}
   if(d.y<-viewport.height/2-1)d.done=true}
  drops.current=drops.current.filter(d=>!d.done);
  state.tick();
 });
 return h(React.Fragment,null,
  h(RoundedBox,{ref:basket,args:[1.3,0.34,0.5],radius:0.14,smoothness:4,position:[0,-viewport.height/2+0.45,0]},h('meshStandardMaterial',{color:basketColor,roughness:0.35})),
  h(DropMeshes,{drops,round:state.current.round}));
}
function DropMeshes({drops}){
 const [,force]=useState(0);const group=useRef();
 useFrame(()=>{const g=group.current;if(!g)return;const live=drops.current;
  while(g.children.length<live.length){const m=new THREE.Mesh(new THREE.SphereGeometry(0.32,32,32),new THREE.MeshStandardMaterial({roughness:0.25,metalness:0.05}));g.add(m)}
  g.children.forEach((m,k)=>{const d=live[k];m.visible=Boolean(d);if(d){m.position.set(d.x,d.y,0);m.material.color.set(d.it.color);d.mesh=m}})});
 return h('group',{ref:group});
}
export function MiniGame({title='Catch!',items=[{color:'#22c55e',points:1,label:'Catch green'},{color:'#ef4444',points:-1,label:'Avoid red'}],seconds=30,speed=1,basketColor,stage='sky',className='',style,height=440,onFinish}){
 const st=useRef({playing:false,score:0,left:seconds,dir:0,useKeys:false,pointerMoved:false,round:0,flash:0});
 const [,setV]=useState(0);const render=useCallback(()=>setV(v=>v+1),[]);
 const last=useRef(0);const tick=useCallback(()=>{const t=Math.ceil(st.current.left);if(t!==last.current){last.current=t;render()}},[render]);
 const state=useMemo(()=>({get current(){return st.current},render,tick,get round(){return st.current.round}}),[render,tick]);
 const [best,setBest]=useState(()=>{try{return Number(localStorage.getItem('kq-game-best:'+title))||0}catch{return 0}});
 const start=()=>{Object.assign(st.current,{playing:true,score:0,left:seconds,round:st.current.round+1,flash:0});render()};
 const end=score=>{if(score>best){setBest(score);try{localStorage.setItem('kq-game-best:'+title,String(score))}catch{}}render();onFinish&&onFinish(score)};
 useEffect(()=>{const down=e=>{if(!st.current.playing)return;if(e.key==='ArrowLeft'||e.key==='a'){st.current.dir=-1;st.current.useKeys=true;e.preventDefault()}if(e.key==='ArrowRight'||e.key==='d'){st.current.dir=1;st.current.useKeys=true;e.preventDefault()}};const up=e=>{if(['ArrowLeft','ArrowRight','a','d'].includes(e.key))st.current.dir=0};addEventListener('keydown',down);addEventListener('keyup',up);return()=>{removeEventListener('keydown',down);removeEventListener('keyup',up)}},[]);
 const s=st.current,over=!s.playing&&s.round>0;
 const panel={position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,background:'rgba(15,23,42,.55)',backdropFilter:'blur(3px)',color:'#fff',textAlign:'center',padding:16};
 const btn={padding:'12px 22px',borderRadius:999,border:0,font:'700 16px/1 system-ui,sans-serif',background:'#fff',color:'#111',cursor:'pointer'};
 const overlay=h(React.Fragment,null,
  h('div',{style:{position:'absolute',top:14,left:16,right:16,display:'flex',justifyContent:'space-between',color:'#0f172a',font:'800 16px/1.2 system-ui,sans-serif',pointerEvents:'none'},'aria-live':'polite'},h('span',null,'Score '+s.score),h('span',null,s.playing?Math.ceil(s.left)+'s':'Best '+best)),
  !s.playing?h('div',{style:panel},h('h3',{style:{margin:0,font:'800 26px/1.2 system-ui,sans-serif'}},over?'Score: '+s.score:title),
   h('p',{style:{margin:0,maxWidth:340}},items.map(i=>i.label).filter(Boolean).join(' · ')||'Catch what falls'),
   h('p',{style:{margin:0,opacity:.85,fontSize:13}},'Arrow keys, or drag on the game'),
   h('button',{type:'button',style:btn,onClick:start,autoFocus:over},over?'Play again':'Start')):null);
 return h(Scene3D,{className,stage,lights:'studio',style:{height,borderRadius:24,touchAction:'none',...style},alt:title+' game',camera:{position:[0,0,8],fov:50},overlay,
  onCreated:({gl})=>{gl.domElement.addEventListener('pointermove',()=>{st.current.pointerMoved=true;st.current.useKeys=false})}},
  h(Game,{state,items,basketColor:basketColor||themeColor('primary','#6366f1'),speed:prefersStill()?speed*0.6:speed,onEnd:end}));
}
`}
module.exports={source};
