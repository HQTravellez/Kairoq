"use strict";
/* Non-destructive enhancements to /create. All existing iframe / builder handlers stay in place. */
function kqSplitBounds(width,{chatMin=320,previewMin=720,minPct=22,maxPct=60}={}){
 const w=Number(width);
 if(!Number.isFinite(w)||w<=0)return{compact:false,min:minPct,max:maxPct};
 if(w<chatMin+previewMin)return{compact:true,min:minPct,max:maxPct};
 const min=Math.max(minPct,chatMin/w*100),max=Math.min(maxPct,(w-previewMin)/w*100);
 return{compact:false,min:Math.min(min,max),max:Math.max(min,max)};
}
if(typeof module!=="undefined"&&module.exports)module.exports={kqSplitBounds};

(function(){
 if(typeof document==="undefined")return;
 const editor=document.getElementById("editor"),chat=editor?.querySelector(":scope > .chat"),stage=editor?.querySelector(":scope > .stage");
 if(!editor||!chat||!stage)return;
 const tabs=stage.querySelector(".tabs-seg"),bar=document.getElementById("preview-bar");
 if(!tabs||!bar)return;
 const CHAT_MIN_PX=320,PREVIEW_MIN_PX=720;
 const handle=document.createElement("div");handle.id="kq-split-handle";handle.setAttribute("role","separator");handle.setAttribute("aria-label","Resize chat and live preview");handle.setAttribute("aria-orientation","vertical");handle.tabIndex=0;
 editor.insertBefore(handle,stage);
 const safeWidth=()=>{try{const v=Number(localStorage.getItem("kq-chat-width"));return Number.isFinite(v)&&v>=22&&v<=60?v:30}catch{return 30}};
 let preferredWidth=safeWidth(),appliedWidth=preferredWidth,dragging=false;
 function bounds(){return kqSplitBounds(editor.getBoundingClientRect().width,{chatMin:CHAT_MIN_PX,previewMin:PREVIEW_MIN_PX})}
 function width(v,{keepPreferred=false}={}){
  const raw=Number(v),target=Number.isFinite(raw)?Math.min(60,Math.max(22,raw)):preferredWidth;
  if(!keepPreferred)preferredWidth=target;
  const b=bounds(),full=editor.classList.contains("kq-preview-full");
  editor.classList.toggle("kq-split-compact",b.compact&&!full);
  handle.setAttribute("aria-disabled",String(b.compact||full));
  if(b.compact&&!full){
   editor.style.removeProperty("grid-template-columns");
   handle.setAttribute("aria-valuemin","22");handle.setAttribute("aria-valuemax","60");
   handle.setAttribute("aria-valuenow",String(Math.round(appliedWidth)));
   handle.setAttribute("aria-valuetext","Compact workspace: preview and chat are stacked");
   return appliedWidth;
  }
  const n=Math.min(b.max,Math.max(b.min,target));appliedWidth=n;
  if(!keepPreferred)preferredWidth=n;
  editor.style.setProperty("--kq-chat-width",n+"%");
  if(!full)editor.style.setProperty("grid-template-columns","minmax("+CHAT_MIN_PX+"px, "+n+"%) minmax("+PREVIEW_MIN_PX+"px, 1fr)","important");
  handle.style.left=n+"%";
  handle.setAttribute("aria-valuemin",String(Math.round(b.min*100)/100));
  handle.setAttribute("aria-valuemax",String(Math.round(b.max*100)/100));
  handle.setAttribute("aria-valuenow",String(Math.round(n)));
  handle.setAttribute("aria-valuetext",Math.round(n)+" percent chat, "+Math.round(100-n)+" percent preview");
  return n;
 }
 width(preferredWidth,{keepPreferred:true});
 function changeFromClient(x){const r=editor.getBoundingClientRect(),b=bounds();if(!r.width||b.compact)return;width((x-r.left)/r.width*100)}
 function save(){try{localStorage.setItem("kq-chat-width",String(preferredWidth))}catch{}}
 function stopDrag(){
  if(!dragging)return;
  dragging=false;editor.classList.remove("kq-resizing");document.body.classList.remove("kq-split-dragging");
  document.removeEventListener("pointermove",moveDrag,true);document.removeEventListener("pointerup",stopDrag,true);document.removeEventListener("pointercancel",stopDrag,true);window.removeEventListener("blur",stopDrag);save();
 }
 function moveDrag(e){if(!dragging)return;e.preventDefault();changeFromClient(e.clientX)}
 handle.addEventListener("pointerdown",e=>{
  if(e.button!==0||editor.classList.contains("kq-preview-full")||bounds().compact||matchMedia("(max-width:900px)").matches)return;
  e.preventDefault();dragging=true;editor.classList.add("kq-resizing");document.body.classList.add("kq-split-dragging");changeFromClient(e.clientX);
  document.addEventListener("pointermove",moveDrag,true);document.addEventListener("pointerup",stopDrag,true);document.addEventListener("pointercancel",stopDrag,true);window.addEventListener("blur",stopDrag);
 });
 handle.addEventListener("keydown",e=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
  const b=bounds();if(b.compact||editor.classList.contains("kq-preview-full"))return;
  e.preventDefault();const current=parseFloat(editor.style.getPropertyValue("--kq-chat-width"))||appliedWidth;
  width(e.key==="Home"?b.min:e.key==="End"?b.max:current+(e.key==="ArrowRight"?2:-2));save();
 });
 const reflow=()=>{if(!dragging&&!editor.classList.contains("kq-preview-full"))width(preferredWidth,{keepPreferred:true})};
 if(typeof ResizeObserver!=="undefined")new ResizeObserver(reflow).observe(editor);else window.addEventListener("resize",reflow);
 const testTab=document.createElement("button");testTab.type="button";testTab.id="kq-tests-tab";testTab.textContent="Tests";testTab.title="Open saved functional tests and checks";testTab.setAttribute("aria-pressed","false");tabs.append(testTab);
 testTab.addEventListener("click",()=>{document.getElementById("checks-open")?.click();testTab.setAttribute("aria-pressed","false")});
 const expand=document.createElement("button");expand.type="button";expand.id="kq-expand-preview";expand.className="ghost";expand.textContent="Expand";expand.setAttribute("aria-pressed","false");expand.setAttribute("aria-label","Expand live app preview");bar.append(expand);
 function full(on){
  editor.classList.toggle("kq-preview-full",on);editor.classList.remove("kq-split-compact");
  if(on)editor.style.setProperty("grid-template-columns","0 minmax(0, 1fr)","important");else width(preferredWidth,{keepPreferred:true});
  expand.textContent=on?"Show chat":"Expand";expand.setAttribute("aria-pressed",String(on));expand.setAttribute("aria-label",on?"Restore chat panel":"Expand live app preview");
 }
 expand.addEventListener("click",()=>full(!editor.classList.contains("kq-preview-full")));
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&editor.classList.contains("kq-preview-full"))full(false)});
})();