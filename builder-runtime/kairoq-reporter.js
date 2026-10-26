// Injected into every Kairoq Create build. Reports runtime problems to the
// Kairoq editor (the parent frame) so it can offer "Fix it".
const send=(type,data)=>{try{if(window.parent!==window)window.parent.postMessage({source:'kairoq-app',type,...data},'*')}catch{}};
const report=(kind,message)=>send('runtime-error',{kind,message:String(message||'').slice(0,800)});
// Files from other sites that fail to load (a broken image link, a blocked font) are not
// code problems, so only the app's own files are reported.
const ownUrl=u=>{try{return new URL(u,location.href).origin===location.origin}catch{return false}};
window.addEventListener('error',e=>{if(e.target&&e.target!==window&&e.target.tagName){const src=e.target.src||e.target.href||'';if(ownUrl(src))report('resource','Failed to load '+e.target.tagName.toLowerCase()+' '+src);return}report('error',(e.error&&e.error.stack)||e.message)},true);
// The page the owner is looking at, so the editor can open a new version on the same page.
const route=()=>send('route',{path:location.pathname+location.search+location.hash});
for(const k of ['pushState','replaceState']){const f=history[k];if(typeof f==='function')history[k]=function(...a){const r=f.apply(this,a);route();return r}}
window.addEventListener('popstate',route);window.addEventListener('hashchange',route);window.addEventListener('load',route);
window.addEventListener('unhandledrejection',e=>report('promise',(e.reason&&(e.reason.stack||e.reason.message))||e.reason));
const consoleError=console.error.bind(console);
console.error=(...args)=>{report('console',args.map(a=>a instanceof Error?a.stack||a.message:typeof a==='object'?(()=>{try{return JSON.stringify(a)}catch{return String(a)}})():String(a)).join(' '));consoleError(...args)};
if(window.fetch){const realFetch=window.fetch.bind(window);window.fetch=async(...args)=>{try{const r=await realFetch(...args);if(r.status>=500)report('network','HTTP '+r.status+' from '+(args[0]&&args[0].url||args[0]));return r}catch(err){report('network','Request failed: '+(args[0]&&args[0].url||args[0])+' '+err.message);throw err}}}
window.addEventListener('load',()=>setTimeout(()=>{const root=document.getElementById('root');if(root&&!root.innerText.trim()&&!root.querySelector('img,svg,canvas,video,input,button'))report('blank','Blank page: nothing rendered inside #root.');send('ready',{})},2500));
// Visual edit mode: the editor turns it on; hovering outlines elements, clicking selects one.
let selecting=false,box=null,selected=null;
function outline(el,color){
 if(!box){box=document.createElement('div');box.setAttribute('aria-hidden','true');Object.assign(box.style,{position:'fixed',pointerEvents:'none',zIndex:2147483647,border:'2px solid #bc6649',borderRadius:'3px',transition:'all .05s'});document.documentElement.appendChild(box)}
 if(!el){box.style.display='none';return}
 const r=el.getBoundingClientRect();
 Object.assign(box.style,{display:'block',left:r.left-2+'px',top:r.top-2+'px',width:r.width+4+'px',height:r.height+4+'px',borderColor:color||'#bc6649'});
}
const target=e=>e.target&&e.target.closest?e.target.closest('[data-kq]'):null;
document.addEventListener('mouseover',e=>{if(selecting)outline(target(e))},true);
document.addEventListener('click',e=>{
 if(!selecting)return;
 const el=target(e);e.preventDefault();e.stopPropagation();
 if(!el)return;
 selected=el;outline(el,'#2f7d4f');
 send('select',{loc:el.getAttribute('data-kq'),tag:el.tagName.toLowerCase(),text:(el.innerText||'').slice(0,500)});
},true);
document.addEventListener('submit',e=>{if(selecting){e.preventDefault();e.stopPropagation()}},true);
window.addEventListener('message',e=>{
 if(e.source!==window.parent||!e.data||e.data.source!=='kairoq-editor')return;
 if(e.data.type==='select-mode'){selecting=!!e.data.on;document.documentElement.style.cursor=selecting?'crosshair':'';if(!selecting){selected=null;outline(null)}}
});
window.addEventListener('scroll',()=>{if(selected)outline(selected,'#2f7d4f')},true);
