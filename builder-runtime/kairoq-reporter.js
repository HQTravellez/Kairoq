// Injected into every Kairoq Create build. Reports runtime problems to the
// Kairoq editor (the parent frame) so it can offer "Fix it".
const send=(type,data)=>{try{if(window.parent!==window)window.parent.postMessage({source:'kairoq-app',type,...data},'*')}catch{}};
const report=(kind,message)=>send('runtime-error',{kind,message:String(message||'').slice(0,800)});
window.addEventListener('error',e=>{if(e.target&&e.target!==window&&e.target.tagName){report('resource','Failed to load '+e.target.tagName.toLowerCase()+' '+(e.target.src||e.target.href||''));return}report('error',(e.error&&e.error.stack)||e.message)},true);
window.addEventListener('unhandledrejection',e=>report('promise',(e.reason&&(e.reason.stack||e.reason.message))||e.reason));
const consoleError=console.error.bind(console);
console.error=(...args)=>{report('console',args.map(a=>a instanceof Error?a.stack||a.message:typeof a==='object'?(()=>{try{return JSON.stringify(a)}catch{return String(a)}})():String(a)).join(' '));consoleError(...args)};
if(window.fetch){const realFetch=window.fetch.bind(window);window.fetch=async(...args)=>{try{const r=await realFetch(...args);if(r.status>=500)report('network','HTTP '+r.status+' from '+(args[0]&&args[0].url||args[0]));return r}catch(err){report('network','Request failed: '+(args[0]&&args[0].url||args[0])+' '+err.message);throw err}}}
window.addEventListener('load',()=>setTimeout(()=>{const root=document.getElementById('root');if(root&&!root.innerText.trim()&&!root.querySelector('img,svg,canvas,video,input,button'))report('blank','Blank page: nothing rendered inside #root.');send('ready',{})},2500));
