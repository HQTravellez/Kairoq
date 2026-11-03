"use strict";
// Kairoq's browser, the editor's third pane: a real browser. The screen streams live from the
// server's Chromium (/api/create/live-browser/stream): you watch Kairoq search and read pages
// while it researches, and when it is done the browser is yours: type an address, go back and
// forward, click, type and scroll on the page itself.
(function(){
 if(typeof document==="undefined")return;
 const editor=document.getElementById("editor"),pane=document.getElementById("web-browser-pane");
 if(!editor||!pane)return;
 const $=id=>document.getElementById(id);
 const title=$("web-browser-title"),url=$("web-browser-url"),shot=$("web-browser-shot"),empty=$("web-browser-empty"),
  status=$("web-browser-status"),external=$("web-browser-external"),closeBtn=$("web-browser-close"),
  bar=$("kb-bar"),dot=$("kb-dot"),driving=$("kb-driving"),drivingText=$("kb-driving-text"),toggle=$("view-browser");
 let current=null,byHand=false,live=null,stream=null,lastFrameAt=0,editing=false;

 function notify(open){toggle?.setAttribute("aria-pressed",String(Boolean(open)));window.dispatchEvent(new CustomEvent("kairoq-browser-pane",{detail:{open:Boolean(open)}}))}
 function safePublicUrl(value){try{const u=new URL(String(value||""),location.origin);return["http:","https:"].includes(u.protocol)?u.href:""}catch{return""}}
 function setError(text){status.textContent=text?String(text).slice(0,300):"";status.classList.toggle("hidden",!text);if(text)setTimeout(()=>{if(status.textContent===text)setError("")},5000)}
 function setFrame(b64){if(!b64)return;shot.src="data:image/jpeg;base64,"+b64;shot.classList.remove("hidden");empty.classList.add("hidden");lastFrameAt=Date.now()}
 function setPage(href,name){
  if(!editing&&href!==undefined)url.value=href?String(href).replace(/^https:\/\//,"").replace(/\/$/,""):"";
  if(name!==undefined){title.textContent=String(name||"").slice(0,80)||(href?String(href).replace(/^https?:\/\/(www\.)?/,"").split("/")[0]:"New tab");title.parentElement.title=title.textContent}
  const h=safePublicUrl(href);
  if(h&&/^https:\/\//.test(h)){external.href=h;external.classList.remove("hidden")}else{external.removeAttribute("href");external.classList.add("hidden")}
 }
 function setDriving(text){
  driving.classList.toggle("hidden",!text);if(text)drivingText.textContent=text;
  pane.classList.toggle("kb-busy",Boolean(text));
 }

 // The live screen: one stream while the pane is open.
 function connect(){
  if(stream||!window.EventSource)return;
  stream=new EventSource("/api/create/live-browser/stream");
  stream.onmessage=e=>{
   let d;try{d=JSON.parse(e.data)}catch{return}
   live=d;
   if(d.frame)setFrame(d.frame);
   if(d.url)setPage(d.url,d.title);
   dot.className="kb-dot"+(d.loading?" loading":d.url?" on":"");
   if(d.driver!=="kairoq"&&!(current&&current.busy))setDriving("");
  };
  stream.onerror=()=>{stream?.close();stream=null;if(!pane.classList.contains("hidden"))setTimeout(connect,2000)};
 }
 function disconnect(){stream?.close();stream=null}

 // The server's browser takes the pane's size, so pages lay out for it (like a real browser).
 const view=$("web-browser-viewport");let sentSize="",sizeTimer=null;
 function sendSize(){clearTimeout(sizeTimer);sizeTimer=setTimeout(()=>{const w=Math.round(view.clientWidth),h=Math.round(view.clientHeight);if(w<320||h<300)return;const k=w+"x"+h;if(k===sentSize)return;sentSize=k;send({type:"size",width:w,height:h})},250)}
 if(window.ResizeObserver)new ResizeObserver(()=>{if(!pane.classList.contains("hidden"))sendSize()}).observe(view);
 function open(){pane.classList.remove("hidden");editor.classList.add("kq-browser-open");notify(true);connect();sendSize()}
 function close(){pane.classList.add("hidden");editor.classList.remove("kq-browser-open","kq-browser-stacked");notify(false);disconnect()}

 // Kairoq's research reports here (job.browser): the pane opens and one quiet line says what
 // it is doing. The picture itself comes from the live stream; a still is only a fallback.
 function show(data={}){
  const href=safePublicUrl(data.url),image=String(data.screenshot||"").replace(/^data:image\/jpeg;base64,/i,"").trim();
  if(!href&&!image&&!data.error&&!data.steps)return;
  const list=Array.isArray(data.steps)?data.steps.filter(x=>typeof x==="string"):[];
  const last=String(list[list.length-1]||"").replace(/^Step \d+ · /,"");
  const done=!last||/^Done\b/.test(last);
  current={...current,...data,url:href||current?.url||"",busy:!done};
  open();
  document.getElementById("phone-panes")?.querySelector('[data-pane="browser"]')?.classList.add("live");
  if(href&&(!live||!live.url))setPage(href,data.title);
  if(image&&Date.now()-lastFrameAt>3000)setFrame(image);
  setDriving(done?"":last.replace(/^Searching the web for/,"Searching for").slice(0,90));
  if(data.error)setError(data.error);
 }
 function steps(){}  // the step log is gone; kept so older callers don't break
 function reset(){current=null;live=null;shot.removeAttribute("src");shot.classList.add("hidden");empty.classList.remove("hidden");setPage("","New tab");setDriving("");close()}

 // The owner's own browsing.
 async function send(ev){
  try{
   const r=await fetch("/api/create/live-browser",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(ev)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error||"The browser did not respond");
  }catch(e){setError(e.message)}
 }
 bar.addEventListener("submit",e=>{e.preventDefault();const v=url.value.trim();if(!v)return;editing=false;url.blur();open();send({type:"go",url:v})});
 url.addEventListener("focus",()=>{editing=true;url.select()});
 url.addEventListener("blur",()=>{editing=false});
 for(const b of bar.querySelectorAll("[data-kb]"))b.addEventListener("click",()=>send({type:b.dataset.kb}));
 const point=e=>{const r=shot.getBoundingClientRect(),w=(live&&live.width)||1280,h=(live&&live.height)||800;return{x:Math.round((e.clientX-r.left)*w/r.width),y:Math.round((e.clientY-r.top)*h/r.height)}};
 shot.addEventListener("click",e=>{shot.focus();send({type:"click",...point(e)})});
 let wheel=0,wheelTimer=null;
 shot.addEventListener("wheel",e=>{e.preventDefault();wheel+=e.deltaY;if(!wheelTimer)wheelTimer=setTimeout(()=>{send({type:"scroll",dy:Math.round(wheel)});wheel=0;wheelTimer=null},120)},{passive:false});
 const KEYS=new Set(["Enter","Escape","Tab","Backspace","Delete","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","PageUp","PageDown","Home","End"]);
 let typed="",typeTimer=null;
 shot.addEventListener("keydown",e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.key.length===1){e.preventDefault();typed+=e.key;clearTimeout(typeTimer);typeTimer=setTimeout(()=>{send({type:"type",text:typed});typed=""},150);return}
  if(KEYS.has(e.key)){e.preventDefault();if(typed){send({type:"type",text:typed});typed=""}send({type:"key",key:e.key})}
 });

 // On a phone the editor shows one pane at a time: Chat, Preview or Browser (the tabs at the top).
 const tabs=document.getElementById("phone-panes");
 function pick(name){editor.dataset.pane=name;for(const b of tabs?.querySelectorAll("[data-pane]")||[])b.setAttribute("aria-selected",String(b.dataset.pane===name))}
 tabs?.addEventListener("click",e=>{const b=e.target.closest("[data-pane]");if(b){pick(b.dataset.pane);if(b.dataset.pane==="browser")connect()}});
 closeBtn?.addEventListener("click",()=>{byHand=false;close();if(editor.dataset.pane==="browser")pick("preview")});
 toggle?.addEventListener("click",()=>{if(pane.classList.contains("hidden")){byHand=true;open()}else{byHand=false;close()}});
 window.kairoqBrowserPane={show,open,close,reset,steps,pick,get current(){return current},get byHand(){return byHand}};
})();
