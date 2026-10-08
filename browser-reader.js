"use strict";
const {chromium}=require("playwright-core");
async function renderPage(url){
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||"/usr/bin/chromium",headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--no-zygote"]});
  try{
    const context=await browser.newContext({userAgent:"Mozilla/5.0 KairoqResearch/1.0",viewport:{width:1280,height:900},acceptDownloads:false,serviceWorkers:"block"});
    const page=await context.newPage();
    await page.route("**/*",route=>{
      const target=route.request().url();
      try{
        const u=new URL(target);
        const h=u.hostname.toLowerCase();
        if(!["http:","https:"].includes(u.protocol)||h==="localhost"||h.endsWith(".local")||h.endsWith(".internal")||/^\d+\.\d+\.\d+\.\d+$/.test(h)||/^\[/.test(h))return route.abort();
        if(["image","media","font","websocket"].includes(route.request().resourceType()))return route.abort();
        return route.continue();
      }catch{return route.abort()}
    });
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:18000});
    await page.waitForTimeout(1400);
    const result=await page.evaluate(()=>{
      document.querySelectorAll("script,style,nav,footer,noscript,svg").forEach(el=>el.remove());
      return {title:document.title,body:document.body?.innerText?.slice(0,15000)||"",headings:[...document.querySelectorAll("h1,h2,h3")].slice(0,18).map(el=>el.textContent.trim())};
    });
    await context.close();
    return result;
  }finally{await browser.close()}
}
module.exports={renderPage};
