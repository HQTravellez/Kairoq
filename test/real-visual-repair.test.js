'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require('playwright-core');
const {inspect}=require('../design-dom');
const browserPath=process.env.CHROMIUM_PATH||'/usr/bin/chromium';
test('real Chromium dashboard defect is repaired and rescreened at mobile, tablet and desktop',{skip:!fs.existsSync(browserPath),timeout:90000},async()=>{
 const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();
  const html=`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;font:16px Arial;background:#fff;color:#182b40}
  .shell{max-width:100%;padding:20px}.panels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
  .panel{padding:20px;border:1px solid #a3b4c4;border-radius:12px;min-width:0}
  .panel h2{margin:0 0 12px;font-size:20px}
  .panel button{font:inherit;min-width:44px;min-height:44px;padding:8px;background:#dfe9f4;border:1px solid #8399af;border-radius:6px}
  .broken-wide{width:1600px}
  </style></head><body><main class="shell"><h1>Travellez Operations</h1><div class="panels broken-wide">
  <section class="panel"><h2>Trips</h2><button>Open trips</button></section>
  <section class="panel"><h2>Approvals</h2><button>Open approvals</button></section>
  <section class="panel"><h2>Expenses</h2><button>Open expenses</button></section>
  <section class="panel"><h2>Travelers</h2><button>Open travelers</button></section>
  </div></main></body></html>`;
  await page.setViewportSize({width:390,height:844});await page.setContent(html);
  const before=await inspect(page,'Mobile Travellez dashboard');
  const first=await page.screenshot({type:'jpeg'});
  assert.ok(before.some(x=>x.issue.includes('Horizontal page overflow')),'fixture must expose the real overflow defect');
  // Deterministic safe repair for this known overflow class. Production AI repairs still use the model pipeline.
  await page.addStyleTag({content:'.panels.broken-wide{width:100%;max-width:100%}@media(max-width:1100px){.panels{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.panels{grid-template-columns:minmax(0,1fr)}}'});
  const second=await page.screenshot({type:'jpeg'});
  assert.notEqual(crypto.createHash('sha256').update(first).digest('hex'),crypto.createHash('sha256').update(second).digest('hex'),'repair must change the rendered screenshot');
  for(const width of [390,768,1024,1440]){
   await page.setViewportSize({width,height:900});
   const issues=await inspect(page,'Travellez dashboard '+width+'px');
   assert.ok(!issues.some(x=>/Horizontal page overflow|outside viewport|Small mobile tap target/.test(x.issue)),JSON.stringify({width,issues}));
   assert.equal(await page.locator('.panel').count(),4);
   assert.equal(await page.locator('.panel button').count(),4);
   const cols=await page.locator('.panels').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
   assert.equal(cols,width<=600?1:width<=1100?2:4,'responsive columns at '+width);
  }
 }finally{await browser.close();}
});
