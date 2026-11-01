"use strict";
// Kairoq's browser, the editor's third pane: where the owner watches Kairoq search the web, read
// a site or use the app it just built. Frames arrive with the job (job.browser: url, title,
// screenshot, steps); the Browser button in the top bar opens and closes the pane by hand.
(function(){
 if(typeof document==="undefined")return;
 const editor=document.getElementById("editor"),pane=document.getElementById("web-browser-pane");
 if(!editor||!pane)return;
 const title=document.getElementById("web-browser-title"),url=document.getElementById("web-browser-url"),
  shot=document.getElementById("web-browser-shot"),empty=document.getElementById("web-browser-empty"),
  status=document.getElementById("web-browser-status"),external=document.getElementById("web-browser-external"),
  closeBtn=document.getElementById("web-browser-close"),log=document.getElementById("web-browser-log"),
  toggle=document.getElementById("view-browser");
 let current=null,byHand=false;
 function notify(open){toggle?.setAttribute("aria-pressed",String(Boolean(open)));window.dispatchEvent(new CustomEvent("kairoq-browser-pane",{detail:{open:Boolean(open)}}))}
 function safePublicUrl(value){
  try{const u=new URL(String(value||""),location.origin);return["http:","https:"].includes(u.protocol)?u.href:""}catch{return""}
 }
 function open(){pane.classList.remove("hidden");editor.classList.add("kq-browser-open");notify(true)}
 function steps(list){
  if(!log)return;
  const items=Array.isArray(list)?list.filter(x=>typeof x==="string"&&x.trim()).slice(-8):[];
  log.replaceChildren(...items.map((t,i)=>{const li=document.createElement("li");li.textContent=t.slice(0,160);if(i===items.length-1)li.className="now";return li}));
  log.classList.toggle("hidden",!items.length);
 }
 function show(data={}){
  const href=safePublicUrl(data.url),image=String(data.screenshot||"").replace(/^data:image\/jpeg;base64,/i,"").trim();
  if(!href&&!image&&!data.error)return;
  current={...current,...data,url:href||data.url||current?.url||""};
  open();
  tabs?.querySelector('[data-pane="browser"]')?.classList.add("live");
  title.textContent=String(data.title||current.title||"").slice(0,120);
  let shown=String(href||current.url||"");try{shown=shown.replace(/^https?:\/\//,"")}catch{}
  url.textContent=(shown||"Browser active").slice(0,260);
  if(href&&/^https?:\/\//.test(href)&&!href.startsWith(location.origin+"/builder/")){external.href=href;external.classList.remove("hidden")}else{external.removeAttribute("href");external.classList.add("hidden")}
  if(image){
   shot.src="data:image/jpeg;base64,"+image;shot.classList.remove("hidden");empty.classList.add("hidden");
  }else if(!shot.getAttribute("src")){
   shot.classList.add("hidden");empty.classList.remove("hidden");
  }
  if(data.steps)steps(data.steps);
  if(data.error){status.textContent=String(data.error).slice(0,300);status.classList.remove("hidden")}
  else{status.textContent="";status.classList.add("hidden")}
 }
 function close(){
  pane.classList.add("hidden");editor.classList.remove("kq-browser-open","kq-browser-stacked");
  notify(false);
 }
 function reset(){current=null;shot.removeAttribute("src");shot.classList.add("hidden");empty.classList.remove("hidden");title.textContent="";url.textContent="Nothing open yet";steps([]);close()}
 // On a phone the editor shows one pane at a time: Chat, Preview or Browser (the tabs at the top).
 const tabs=document.getElementById("phone-panes");
 function pick(name){editor.dataset.pane=name;for(const b of tabs?.querySelectorAll("[data-pane]")||[])b.setAttribute("aria-selected",String(b.dataset.pane===name))}
 tabs?.addEventListener("click",e=>{const b=e.target.closest("[data-pane]");if(b)pick(b.dataset.pane)});
 closeBtn?.addEventListener("click",()=>{byHand=false;close();if(editor.dataset.pane==="browser")pick("preview")});
 toggle?.addEventListener("click",()=>{if(pane.classList.contains("hidden")){byHand=true;open()}else{byHand=false;close()}});
 window.kairoqBrowserPane={show,open,close,reset,steps,pick,get current(){return current},get byHand(){return byHand}};
})();
