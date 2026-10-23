'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const browserPath=process.env.CHROMIUM_PATH||'/usr/bin/chromium';
const source=fs.readFileSync(path.join(__dirname,'../public/app-platform-runtime.js'),'utf8');
test('trusted platform panel mounts before a generated page footer', {skip:!fs.existsSync(browserPath)},async()=>{
 const browser=await require('playwright-core').chromium.launch({executablePath:browserPath,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();
  await page.setContent('<div id="app-view"><main><h1>Workspace</h1></main><footer>Page footer</footer></div>');
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.KairoqPlatform.initialize({collections:[]},{}));
  assert.deepEqual(await page.locator('#app-view > *').evaluateAll(nodes=>nodes.map(n=>n.tagName.toLowerCase())),['main','section','footer']);
  assert.equal(await page.locator('#kq-platform-controls').count(),1);
  await page.evaluate(()=>window.KairoqPlatform.initialize({collections:[]},{}));
  assert.equal(await page.locator('#kq-platform-controls').count(),1,'reinitialization must not duplicate the panel');
 }finally{await browser.close();}
});
