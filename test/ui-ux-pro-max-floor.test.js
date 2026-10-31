"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const runtime=require("../runtime-check"),tells=require("../design-tells");

test("critical UI UX Pro Max failures are measured on the rendered phone UI",{skip:!runtime.available()},async()=>{
 const {chromium}=require("playwright-core");
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent('<!doctype html><html><head><style>body{margin:0;font-family:Inter,sans-serif}.row{display:flex;width:520px;gap:2px}.tiny{width:28px;height:28px;padding:0}.copy{font-size:13px}.bottom{position:fixed;bottom:0;left:0;right:0;height:64px}</style></head><body><main><h1>Account</h1><h3>Profile details</h3><p class="copy">This is normal reading copy that is intentionally too small for a mobile interface.</p><p class="copy">Another paragraph is also intentionally too small so the deterministic threshold fires.</p><div class="row"><button class="tiny"><svg width="16" height="16"></svg></button><button class="tiny"><svg width="16" height="16"></svg></button><span>Content wider than the viewport</span></div><input id="email" placeholder="Email"><img><div class="bottom">Bottom actions</div></main></body></html>');
  const result=await tells.tells(page,"phone"),kinds=result.issues.map(x=>x.kind);
  for(const k of ["touch-targets","mobile-text","icon-labels","form-labels","image-alt","heading-order","horizontal-overflow","fixed-safe-area"])assert.ok(kinds.includes(k),"finds "+k+" in "+kinds.join(","));
  assert.ok(result.issues.every(x=>x.fix&&x.issue));
 }finally{await browser.close()}
});
