'use strict';
const crypto=require('crypto');
async function verify(url){
 const browser=await require('playwright-core').chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});const shots=[],tested=[];
 try{for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',request=>new URL(request.request().url()).origin===new URL(url).origin?request.continue():request.abort());let response;for(let attempt=0;attempt<6;attempt++){response=await page.goto(url);if(response?.ok()||![502,503,504].includes(response?.status())||attempt===5)break;await new Promise(resolve=>setTimeout(resolve,Math.min(8000,2000*(attempt+1))));}if(!response?.ok())throw Error('Public website returned '+response?.status());
  const frames=page.frames().filter(f=>f!==page.mainFrame());if(frames.length>1)throw Error('Unexpected nested website preview');const surface=frames[0]||page.mainFrame();
  if((await surface.locator('h1').count())!==1)throw Error('Website primary heading is missing or ambiguous');if(await surface.evaluate(()=>document.documentElement.scrollWidth>innerWidth+8))throw Error('Deployed website overflow at '+width);
  if(!frames.length){
   const visited=new Set();
   for(const link of await surface.locator('a[href]').all()){
    const href=await link.getAttribute('href');if(!href||href.startsWith('#')||!await link.isVisible())continue;
    const target=new URL(href,url);if(target.origin!==new URL(url).origin||!target.pathname.endsWith('.html')||(target.pathname===new URL(url).pathname&&target.search===new URL(url).search)||visited.has(target.href))continue;
    visited.add(target.href);
    const resource=new URL(target.href);resource.hash='';
    const [loaded]=await Promise.all([page.waitForResponse(response=>response.request().isNavigationRequest()&&response.url()===resource.href,{timeout:10000}),link.click()]);if(!loaded.ok())throw Error('Published cross-page navigation failed: '+target.pathname);
    await page.waitForURL(target.href);await page.goto(url);
   }
   tested.push(width+'px: cross-page link navigation');
  }
  const links=await surface.locator('a[href^="#"]').all();for(const link of links){const href=await link.getAttribute('href');if(href.length<2||!await link.isVisible())continue;if(await link.evaluate(n=>n.classList.contains('skip-link'))){await link.focus();if(await link.evaluate(n=>{const r=n.getBoundingClientRect();return r.bottom<=0||r.top>=innerHeight;}))throw Error('Keyboard skip link is invisible when focused');await link.press('Enter');}else await link.click();const target=surface.locator('[id="'+href.slice(1).replace(/"/g,'')+'"]');if(!await target.count())throw Error('Deployed navigation target is missing: '+href);await target.waitFor({state:'visible'});await target.evaluate(n=>n.getBoundingClientRect());await surface.waitForFunction(id=>{const rect=document.getElementById(id)?.getBoundingClientRect();return rect&&rect.y<innerHeight&&rect.y+rect.height>0;},href.slice(1),{timeout:5000});if(page.frames().length!==frames.length+1)throw Error('Fragment navigation nested the website preview');}
  for(const control of await surface.locator('button[aria-expanded][aria-controls],details > summary').all()){if(!await control.isVisible())continue;const before=await control.evaluate(n=>n.tagName==='SUMMARY'?n.parentElement.open:n.getAttribute('aria-expanded'));await control.click();const after=await control.evaluate(n=>n.tagName==='SUMMARY'?n.parentElement.open:n.getAttribute('aria-expanded'));if(after===before)throw Error('Deployed expandable control is unresponsive');await control.click();}
  await surface.waitForFunction(()=>[...document.images].filter(n=>n.loading!=='lazy').every(n=>n.complete),null,{timeout:10000});if(await surface.locator('img').evaluateAll(nodes=>nodes.some(n=>n.complete&&!n.naturalWidth)))throw Error('Published image failed to load');
  if(errors.length)throw Error(errors.join('; '));await surface.evaluate(()=>window.scrollTo(0,0));shots.push({label:'Public website · '+width+'px',bytes:await page.screenshot({type:'jpeg',quality:70,fullPage:true})});tested.push(width+'px: public HTTP route, navigation scroll, expandable controls, overflow, JavaScript');await page.close();
 }return{passed:true,url,scope:'public deployed URL',tested,_screenshots:shots,evidence:shots.map(s=>({screen:s.label,sha256:crypto.createHash('sha256').update(s.bytes).digest('hex')})),at:new Date().toISOString()};}finally{await browser.close();}
}
module.exports={verify};
