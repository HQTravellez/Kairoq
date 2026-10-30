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
 function width(v){
  const n=Math.min(60,Math.max(22,Math.round(v*100)/100));
  editor.style.setProperty("--kq-chat-width",n+"%");
  // Apply to the layout itself, not only the decorative divider. Some workspace
  // themes override grid-template-columns with higher-specificity rules.
  if(!editor.classList.contains("kq-preview-full"))editor.style.setProperty("grid-template-columns","minmax(0, "+n+"%) minmax(0, 1fr)","important");
  handle.style.left=n+"%";
  handle.setAttribute("aria-valuenow",String(Math.round(n)));
  handle.setAttribute("aria-valuetext",Math.round(n)+" percent chat, "+Math.round(100-n)+" percent preview");
 }
 handle.setAttribute("aria-valuemin","22");handle.setAttribute("aria-valuemax","60");width(safeWidth());
 let dragging=false;
 function changeFromClient(x){const r=editor.getBoundingClientRect();if(r.width)width((x-r.left)/r.width*100)}
 function save(){try{localStorage.setItem("kq-chat-width",String(parseFloat(editor.style.getPropertyValue("--kq-chat-width"))))}catch{}}
 function stopDrag(){
  if(!dragging)return;
  dragging=false;
  editor.classList.remove("kq-resizing");
  document.body.classList.remove("kq-split-dragging");
  document.removeEventListener("pointermove",moveDrag,true);
  document.removeEventListener("pointerup",stopDrag,true);
  document.removeEventListener("pointercancel",stopDrag,true);
  window.removeEventListener("blur",stopDrag);
  save();
 }
 function moveDrag(e){if(!dragging)return;e.preventDefault();changeFromClient(e.clientX)}
 handle.addEventListener("pointerdown",e=>{
  if(e.button!==0||editor.classList.contains("kq-preview-full")||matchMedia("(max-width:900px)").matches)return;
  e.preventDefault();dragging=true;editor.classList.add("kq-resizing");document.body.classList.add("kq-split-dragging");
  changeFromClient(e.clientX);
  // Listen at document capture level and temporarily disable iframe hit-testing,
  // otherwise the embedded live preview steals pointer events mid-drag.
  document.addEventListener("pointermove",moveDrag,true);
  document.addEventListener("pointerup",stopDrag,true);
  document.addEventListener("pointercancel",stopDrag,true);
  window.addEventListener("blur",stopDrag);
 });
 handle.addEventListener("keydown",e=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
  e.preventDefault();
  const current=parseFloat(editor.style.getPropertyValue("--kq-chat-width"))||30;
  width(e.key==="Home"?22:e.key==="End"?60:current+(e.key==="ArrowRight"?2:-2));
  save();
 });
 const testTab=document.createElement("button");testTab.type="button";testTab.id="kq-tests-tab";testTab.textContent="Tests";testTab.title="Open saved functional tests and checks";testTab.setAttribute("aria-pressed","false");
 tabs.append(testTab);
 testTab.addEventListener("click",()=>{document.getElementById("checks-open")?.click();testTab.setAttribute("aria-pressed","false")});
 const expand=document.createElement("button");expand.type="button";expand.id="kq-expand-preview";expand.className="ghost";expand.textContent="Expand";expand.setAttribute("aria-pressed","false");expand.setAttribute("aria-label","Expand live app preview");
 bar.append(expand);
 function full(on){editor.classList.toggle("kq-preview-full",on);if(on)editor.style.setProperty("grid-template-columns","0 minmax(0, 1fr)","important");else width(parseFloat(editor.style.getPropertyValue("--kq-chat-width"))||30);expand.textContent=on?"Show chat":"Expand";expand.setAttribute("aria-pressed",String(on));expand.setAttribute("aria-label",on?"Restore chat panel":"Expand live app preview")}
 expand.addEventListener("click",()=>full(!editor.classList.contains("kq-preview-full")));
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&editor.classList.contains("kq-preview-full"))full(false)});
})();
