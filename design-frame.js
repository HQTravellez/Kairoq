"use strict";
// Page-frame checks, measured in the browser rather than judged by a model: a clear title on the
// first screen, no screen-high blank stretches, side margins that match, and no text hidden under
// a pinned element. The rules come from the inspector in taste-skill by Leonxlnx (MIT), rewritten
// for Kairoq. Used with design-dom.js on the screenshots of the design review (runtime-check.js).
async function frame(page,screen){
 const issues=await page.evaluate(()=>{
  const out=[],add=(severity,issue,fix)=>{if(out.length<6)out.push({severity,issue,fix})};
  const H=innerHeight,W=innerWidth,docH=document.documentElement.scrollHeight;
  const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&parseFloat(s.opacity)>0.05&&r.width>2&&r.height>2&&!el.closest('[aria-hidden="true"]')};
  const top=el=>el.getBoundingClientRect().top+scrollY;
  // 1. A title on the first screen: the page says what it is before anyone scrolls.
  const heads=[...document.querySelectorAll('h1,h2,[role="heading"]')].filter(visible);
  const big=[...document.querySelectorAll('h1,h2,h3,p,span,div,a')].filter(el=>visible(el)&&parseFloat(getComputedStyle(el).fontSize)>=32&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1));
  const firstTitle=[...heads,...big].map(top).sort((a,b)=>a-b)[0];
  if(firstTitle===undefined)add('major','No title anywhere on the page','Give the page one clear heading (h1) that says what this is.');
  else if(firstTitle>H*0.92)add('major','Late title: the first heading starts '+Math.round(firstTitle)+'px down, below the first screen ('+H+'px)','Bring the title onto the first screen; a picture can sit beside or behind it, not above it.');
  // 2. Blank stretches: a screen or more of scrolling with nothing on it.
  const content=[...document.querySelectorAll('img,svg,video,canvas,picture,input,select,textarea,button,iframe')].filter(visible);
  for(const el of document.querySelectorAll('body *')){if(content.length>1500)break;if([...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1)&&visible(el))content.push(el)}
  for(const el of document.querySelectorAll('body *')){const s=getComputedStyle(el);if(s.backgroundImage!=='none'&&visible(el)&&el.getBoundingClientRect().height<H*2)content.push(el)}
  const spans=content.map(el=>{const r=el.getBoundingClientRect();return[r.top+scrollY,r.bottom+scrollY]}).sort((a,b)=>a[0]-b[0]);
  let reach=0;
  for(const [a,b] of spans){if(a-reach>=H*0.8&&reach>0&&a<docH-40){add('major','Empty stretch of '+Math.round(a-reach)+'px with nothing on it (from '+Math.round(reach)+'px down)','Remove the empty space (a min-h-screen or tall padding on an empty section, or content that failed to reveal), or fill it with real content.');break}reach=Math.max(reach,b)}
  // 3. Side margins: each section's content column sits evenly, not shoved to one side.
  if(W>=900){
   const blocks=[...document.querySelectorAll('main > *, body > div > *, section, header, footer')].filter(visible).slice(0,40);
   for(const sec of blocks){
    const sr=sec.getBoundingClientRect();if(sr.width<W*0.9)continue;
    const inner=[...sec.querySelectorAll(':scope > *, :scope > * > *')].filter(el=>{const r=el.getBoundingClientRect();return visible(el)&&r.width>=sr.width*0.4&&r.width<sr.width*0.97&&r.height>40}).sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0];
    if(!inner)continue;
    const r=inner.getBoundingClientRect(),left=r.left-sr.left,right=sr.right-r.right;
    if(left>=0&&right>=0&&Math.abs(left-right)>Math.max(64,W*0.1)&&Math.min(left,right)<Math.max(left,right)*0.4){
     const name=(sec.id||sec.getAttribute('aria-label')||(sec.querySelector('h1,h2,h3')||{}).innerText||sec.tagName).toString().trim().slice(0,40);
     add('minor','Uneven side margins in "'+name+'": '+Math.round(left)+'px on the left, '+Math.round(right)+'px on the right','Centre the content column (mx-auto with a max width) or make the asymmetry deliberate and balanced by other content.');
    }
   }
  }
  // 4. Text hidden under a pinned bar or overlay (header, cookie banner, floating button).
  const pinned=[...document.querySelectorAll('body *')].filter(el=>{const s=getComputedStyle(el);return(s.position==='fixed'||s.position==='sticky')&&visible(el)}).map(el=>el.getBoundingClientRect()).filter(r=>r.width*r.height<W*H*0.5);
  for(const el of [...document.querySelectorAll('h1,h2,h3,p,label,a,button')].filter(visible).slice(0,200)){
   const r=el.getBoundingClientRect();if(r.bottom<0||r.top>H||el.closest('[style*="fixed"],[style*="sticky"]'))continue;
   const s=getComputedStyle(el);if(s.position==='fixed'||s.position==='sticky')continue;
   const x=r.left+Math.min(r.width/2,40),y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
   if(!hit||el.contains(hit)||hit.contains(el))continue;
   const hs=getComputedStyle(hit);let p=hit,fixed=false;while(p&&p!==document.body){const ps=getComputedStyle(p);if(ps.position==='fixed'||ps.position==='sticky'){fixed=true;break}p=p.parentElement}
   if(fixed&&pinned.length&&hs.pointerEvents!=='none'){add('major','Covered text: "'+(el.innerText||'').trim().slice(0,40)+'" is hidden under a pinned element','Give the page top padding under a fixed header, or make the floating element smaller or not cover content.');break}
  }
  return out;
 }).catch(()=>[]);
 return issues.map(x=>({...x,screen}));
}
// The measured problems as a block for the design review request.
function note(issues){
 const list=(issues||[]).filter(Boolean).slice(0,14);
 if(!list.length)return'';
 return'\nMeasured in the browser on these screenshots (fix these first; they are facts, not opinions):\n'+list.map(i=>'- ['+i.screen+'] '+i.issue+' → '+i.fix).join('\n');
}
module.exports={frame,note};
