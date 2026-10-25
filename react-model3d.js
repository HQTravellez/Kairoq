"use strict";
// The 'kairoq/3d' module generated apps import: <Model3D />, a tested React wrapper around
// Google's <model-viewer> (Apache-2.0, vendor/model-viewer). The viewer script (with its own
// copy of three.js) is copied into the build at ./_kairoq/ and loaded only when a Model3D is on
// the page. It shows the poster picture first, keeps showing it if 3D cannot run, stops moving
// for people who prefer reduced motion, and offers AR ("View in your room") on phones.
const {VIEWER_FILE}=require('./react-models');

function source(){return `import React,{useEffect,useRef,useState} from 'react';
const h=React.createElement;
let loading=null;
function loadViewer(){
 if(typeof window==='undefined')return Promise.reject(Error('no window'));
 if(window.customElements&&customElements.get('model-viewer'))return Promise.resolve();
 if(!loading)loading=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.type='module';s.src=new URL('./_kairoq/${VIEWER_FILE}',document.baseURI).href;
  s.onload=()=>customElements.whenDefined('model-viewer').then(resolve);s.onerror=()=>{loading=null;reject(Error('The 3D viewer did not load'))};
  document.head.appendChild(s);
 });
 return loading;
}
function webgl(){try{const c=document.createElement('canvas');return Boolean(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}}
function reduced(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}}
// "30deg 75deg 105%" -> [30,75,105,'%']
function parseOrbit(s){const m=/^\\s*(-?[\\d.]+)deg\\s+(-?[\\d.]+)deg\\s+(-?[\\d.]+)(%|m)\\s*$/.exec(String(s||''));return m?[+m[1],+m[2],+m[3],m[4]]:null}
function mix(a,b,t){return a+(b-a)*t}
function orbitAt(stops,p){
 const list=stops.map(s=>typeof s==='string'?s:s&&s.orbit).filter(Boolean);if(!list.length)return null;
 const x=Math.min(list.length-1,Math.max(0,p*(list.length-1))),i=Math.floor(x),j=Math.min(list.length-1,i+1),t=x-i;
 const a=parseOrbit(list[i]),b=parseOrbit(list[j]);
 if(!a||!b||a[3]!==b[3])return list[Math.round(x)];
 return mix(a[0],b[0],t).toFixed(1)+'deg '+mix(a[1],b[1],t).toFixed(1)+'deg '+mix(a[2],b[2],t).toFixed(1)+a[3];
}
function Poster({poster,alt,className,style}){
 return poster?h('img',{src:poster,alt,className,style:{objectFit:'contain',width:'100%',height:'100%',...style},loading:'lazy',decoding:'async'})
  :h('div',{role:'img','aria-label':alt,className,style:{background:'linear-gradient(160deg,rgba(127,127,127,.12),rgba(127,127,127,.04))',...style}});
}
export function Model3D({src,poster,alt='3D model',mode='product',environment,skybox,autoRotate,ar,hotspots=[],stops=[],cameraOrbit,cameraTarget,fieldOfView,exposure=0.95,toneMapping='aces',shadow=1,className='',style,onLoad,children}){
 const ref=useRef(null);const [ready,setReady]=useState(false);const [failed,setFailed]=useState(false);
 const still=reduced();
 useEffect(()=>{let live=true;if(!webgl()){setFailed(true);return}loadViewer().then(()=>{if(live)setReady(true)}).catch(()=>{if(live)setFailed(true)});return()=>{live=false}},[]);
 useEffect(()=>{const el=ref.current;if(!el)return;const bad=()=>setFailed(true),ok=()=>{el.dataset.kqLoaded='true';onLoad&&onLoad(el)};el.addEventListener('error',bad);el.addEventListener('load',ok);return()=>{el.removeEventListener('error',bad);el.removeEventListener('load',ok)}},[ready,src]);
 // Scroll story: the camera follows how far the section has scrolled through the screen.
 useEffect(()=>{
  if(mode!=='scroll'||!ready||still||!stops.length)return;
  const el=ref.current;if(!el)return;const host=el.closest('[data-scroll-story]')||el.parentElement;
  let raf=0;const tick=()=>{raf=0;const r=host.getBoundingClientRect(),span=Math.max(1,r.height-innerHeight);const p=Math.min(1,Math.max(0,-r.top/span));const o=orbitAt(stops,p);if(o)el.cameraOrbit=o;const s=stops[Math.round(p*(stops.length-1))];if(s&&s.target)el.cameraTarget=s.target};
  const on=()=>{if(!raf)raf=requestAnimationFrame(tick)};addEventListener('scroll',on,{passive:true});addEventListener('resize',on);tick();
  return()=>{removeEventListener('scroll',on);removeEventListener('resize',on);if(raf)cancelAnimationFrame(raf)};
 },[mode,ready,still,JSON.stringify(stops)]);
 // A softly shaded stage behind the model unless the app gives its own background.
 const stage=mode!=='background'&&!/(^|\\s)bg-/.test(className)&&!(style&&(style.background||style.backgroundColor));
 const box={position:'relative',minHeight:240,...(stage?{background:'radial-gradient(ellipse at 50% 38%,#ffffff 0%,#f1f3f6 55%,#e3e7ed 100%)',borderRadius:24,overflow:'hidden'}:{}),...style};
 if(failed||!ready)return h('div',{className,style:box,'data-kq-model':src},h(Poster,{poster,alt,style:{position:'absolute',inset:0}}),children);
 const bg=mode==='background',rotate=!still&&(autoRotate!==undefined?autoRotate:(mode==='product'||bg)),useAr=ar!==undefined?ar:mode==='product';
 const attrs={ref,src,alt,poster:poster||undefined,loading:'eager',reveal:'auto','shadow-intensity':String(shadow),exposure:String(exposure),'tone-mapping':toneMapping,'interaction-prompt':bg?'none':'auto',
  style:{width:'100%',height:'100%',background:'transparent','--poster-color':'transparent',pointerEvents:bg?'none':undefined}};
 if(!bg&&mode!=='scroll')attrs['camera-controls']='';
 if(mode==='scroll'){attrs['disable-zoom']='';attrs['interpolation-decay']='120'}
 if(bg){attrs['disable-zoom']='';attrs['rotation-per-second']='8deg';attrs['aria-hidden']='true'}
 if(rotate){attrs['auto-rotate']='';attrs['auto-rotate-delay']='0'}
 if(useAr){attrs.ar='';attrs['ar-modes']='webxr scene-viewer quick-look'}
 // Soft studio light built into model-viewer (no download) unless an HDRI is given.
 attrs['environment-image']=environment||'neutral';attrs['shadow-softness']='0.9';
 if(skybox)attrs['skybox-image']=skybox;
 if(cameraOrbit||(mode==='scroll'&&stops.length))attrs['camera-orbit']=cameraOrbit||orbitAt(stops,0);
 if(cameraTarget)attrs['camera-target']=cameraTarget;
 if(fieldOfView)attrs['field-of-view']=fieldOfView;
 const spots=(mode==='background'?[]:hotspots).slice(0,12).map((s,i)=>h('button',{key:i,type:'button',slot:'hotspot-'+(i+1),'data-position':s.position,'data-normal':s.normal||'0 1 0','data-visibility-attribute':'visible',
  style:{padding:'4px 10px',borderRadius:'999px',border:'1px solid rgba(0,0,0,.15)',background:'rgba(255,255,255,.92)',color:'#111',font:'500 13px/1.3 system-ui,sans-serif',boxShadow:'0 2px 8px rgba(0,0,0,.15)',cursor:'pointer',whiteSpace:'nowrap'},
  onClick:()=>{const el=ref.current;if(el&&s.orbit)el.cameraOrbit=s.orbit;if(el&&s.target)el.cameraTarget=s.target;else if(el&&s.position)el.cameraTarget=s.position;s.onClick&&s.onClick()}},s.label||String(i+1)));
 return h('div',{className,style:box,'data-kq-model':src},h('model-viewer',attrs,...spots),children);
}
export default Model3D;
`}
module.exports={source};
