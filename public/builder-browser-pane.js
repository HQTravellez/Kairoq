"use strict";
(function(){
 if(typeof document==="undefined")return;
 const editor=document.getElementById("editor"),pane=document.getElementById("web-browser-pane");
 if(!editor||!pane)return;
 const title=document.getElementById("web-browser-title"),url=document.getElementById("web-browser-url"),
  shot=document.getElementById("web-browser-shot"),empty=document.getElementById("web-browser-empty"),
  status=document.getElementById("web-browser-status"),external=document.getElementById("web-browser-external"),
  closeBtn=document.getElementById("web-browser-close");
 let current=null;
 function notify(open){window.dispatchEvent(new CustomEvent("kairoq-browser-pane",{detail:{open:Boolean(open)}}))}
 function safePublicUrl(value){
  try{const u=new URL(String(value||""));return["http:","https:"].includes(u.protocol)?u.href:""}catch{return""}
 }
 function show(data={}){
  const href=safePublicUrl(data.url),image=String(data.screenshot||"").replace(/^data:image\/jpeg;base64,/i,"").trim();
  if(!href&&!image&&!data.error)return;
  current={...current,...data,url:href||data.url||current?.url||""};
  pane.classList.remove("hidden");editor.classList.add("kq-browser-open");
  title.textContent=String(data.title||current.title||"Public website").slice(0,120);
  url.textContent=String(href||current.url||"Browser active").slice(0,260);
  if(href){external.href=href;external.classList.remove("hidden")}else{external.removeAttribute("href");external.classList.add("hidden")}
  if(image){
   shot.src="data:image/jpeg;base64,"+image;shot.classList.remove("hidden");empty.classList.add("hidden");
  }else if(!shot.getAttribute("src")){
   shot.classList.add("hidden");empty.classList.remove("hidden");
  }
  if(data.error){status.textContent=String(data.error).slice(0,300);status.classList.remove("hidden")}
  else{status.textContent="";status.classList.add("hidden")}
  notify(true);
 }
 function close(){
  pane.classList.add("hidden");editor.classList.remove("kq-browser-open","kq-browser-stacked");
  notify(false);
 }
 function reset(){current=null;shot.removeAttribute("src");shot.classList.add("hidden");empty.classList.remove("hidden");close()}
 closeBtn?.addEventListener("click",close);
 window.kairoqBrowserPane={show,close,reset,get current(){return current}};
})();
