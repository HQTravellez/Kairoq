'use strict';
async function inspect(page,screen){
 const issues=await page.evaluate(()=>{
  const out=[],seen=new Set();const add=(issue,fix)=>{if(out.length<8&&!seen.has(issue)){seen.add(issue);out.push({severity:'major',issue,fix});}};
  const rgba=value=>{const m=value.match(/^rgba?\(([^)]+)\)$/);if(!m)return null;const n=m[1].split(',').map(Number);return n.length>=3?[n[0],n[1],n[2],n[3]??1]:null;};
  const mix=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  for(const el of [...document.querySelectorAll('h1,h2,h3,p,label,button,a,td,th,small,span')].slice(0,250)){
   const rect=el.getBoundingClientRect(),s=getComputedStyle(el),text=(el.innerText||'').trim();if(!text||text.length<3||!rect.width||!rect.height||el.closest('[aria-hidden="true"],button:disabled')||s.visibility==='hidden'||s.display==='none')continue;
   if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>=3))continue;
   const snippet=text.slice(0,45);if(parseFloat(s.fontSize)<12)add('Text below 12px: '+snippet,'Increase compact text to at least 12px and reading text to 16px.');
   if(el.scrollWidth>el.clientWidth+3&&['hidden','clip'].includes(s.overflowX)&&!(s.textOverflow==='ellipsis'&&(el.title||el.getAttribute('aria-label'))))add('Clipped text: '+snippet,'Wrap the text or provide a readable responsive layout.');
   const chain=[];for(let parent=el;parent;parent=parent.parentElement)chain.push(getComputedStyle(parent));if(chain.some(c=>parseFloat(c.opacity)<1||c.backgroundImage!=='none'||c.filter!=='none'))continue;
   let bg=[255,255,255];let known=true;for(const c of chain.reverse()){const color=rgba(c.backgroundColor);if(!color){known=false;break;}bg=mix(color,bg);}const fg=rgba(s.color);if(!known||!fg)continue;const color=mix(fg,bg),l1=lum(color),l2=lum(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&parseInt(s.fontWeight)>=700),threshold=large?3:4.5;
   if(ratio+.05<threshold)add('Low text contrast ('+ratio.toFixed(2)+':1): '+snippet,'Increase foreground/background contrast to '+threshold+':1 or higher.');
  }
  if(document.documentElement.scrollWidth>innerWidth+8)add('Horizontal page overflow','Make layout fit this viewport; confine wide tables to a labelled scroll region.');
  return out;
 });return issues.map(x=>({...x,screen}));
}
module.exports={inspect};
