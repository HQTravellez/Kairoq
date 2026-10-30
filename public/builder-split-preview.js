"use strict";
/* Non-destructive enhancements to /create. All existing iframe / builder handlers stay in place. */
(function(){
 const editor=document.getElementById("editor"),chat=editor?.querySelector(":scope > .chat"),stage=editor?.querySelector(":scope > .stage");
 if(!editor||!chat||!stage)return;
 const tabs=stage.querySelector(".tabs-seg"),bar=document.getElementById("preview-bar");
 if(!tabs||!bar)return;
 const handle=document.createElement("div");handle.id="kq-split-handle";handle.setAttribute("role","separator");handle.setAttribute("aria-label","Resize chat and live preview");handle.setAttribute("aria-orientation","vertical");handle.tabIndex=0;
 editor.insertBefore(handle,stage);
 const safeWidth=()=>{try{const v=Number(localStorage.getItem("kq-chat-width"));return Number.isFinite(v)&&v>=22&&v<=60?v:30}catch{return 30}};
 function width(v){const n=Math.min(60,Math.max(22,Math.round(v)));editor.style.setProperty("--kq-chat-width",n+"%");handle.setAttribute("aria-valuenow",String(n));handle.setAttribute("aria-valuetext",n+" percent chat, "+(100-n)+" percent preview")}
 handle.setAttribute("aria-valuemin","22");handle.setAttribute("aria-valuemax","60");width(safeWidth());
 function changeFromClient(x){const r=editor.getBoundingClientRect();width((x-r.left)/r.width*100)}
 handle.addEventListener("pointerdown",e=>{if(e.button!==0||editor.classList.contains("kq-preview-full"))return;e.preventDefault();handle.setPointerCapture(e.pointerId);editor.classList.add("kq-resizing");changeFromClient(e.clientX)});
 handle.addEventListener("pointermove",e=>{if(handle.hasPointerCapture(e.pointerId))changeFromClient(e.clientX)});
 function done(e){if(!handle.hasPointerCapture(e.pointerId))return;handle.releasePointerCapture(e.pointerId);editor.classList.remove("kq-resizing");try{localStorage.setItem("kq-chat-width",parseFloat(editor.style.getPropertyValue("--kq-chat-width")))}catch{}}
 handle.addEventListener("pointerup",done);handle.addEventListener("pointercancel",done);
 handle.addEventListener("keydown",e=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();const current=parseFloat(editor.style.getPropertyValue("--kq-chat-width"))||30;width(e.key==="Home"?22:e.key==="End"?60:current+(e.key==="ArrowRight"?2:-2));try{localStorage.setItem("kq-chat-width",parseFloat(editor.style.getPropertyValue("--kq-chat-width")))}catch{}});
 const testTab=document.createElement("button");testTab.type="button";testTab.id="kq-tests-tab";testTab.textContent="Tests";testTab.title="Open saved functional tests and checks";testTab.setAttribute("aria-pressed","false");
 tabs.append(testTab);
 testTab.addEventListener("click",()=>{document.getElementById("checks-open")?.click();testTab.setAttribute("aria-pressed","false")});
 const expand=document.createElement("button");expand.type="button";expand.id="kq-expand-preview";expand.className="ghost";expand.textContent="Expand";expand.setAttribute("aria-pressed","false");expand.setAttribute("aria-label","Expand live app preview");
 bar.append(expand);
 function full(on){editor.classList.toggle("kq-preview-full",on);expand.textContent=on?"Show chat":"Expand";expand.setAttribute("aria-pressed",String(on));expand.setAttribute("aria-label",on?"Restore chat panel":"Expand live app preview")}
 expand.addEventListener("click",()=>full(!editor.classList.contains("kq-preview-full")));
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&editor.classList.contains("kq-preview-full"))full(false)});
})();
