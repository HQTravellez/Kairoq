// Read-only Stagehand v4 experiment against local test previews. No clicks or writes.
import fs from "node:fs";import os from "node:os";import path from "node:path";
const u=new URL(process.argv[2]||"");
if(u.protocol!=="http:"||!["localhost","127.0.0.1","[::1]"].includes(u.hostname)||u.username||u.password)throw Error("Only local HTTP preview");
const key=process.env.KAIROQ_STAGEHAND_TRIAL_KEY;if(!key)throw Error("Missing trial model key");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-stagehand-"));
let browser,stagehand;
try{
 const {Stagehand,localBrowser}=await import("@browserbasehq/stagehand");
 browser=await localBrowser.launch({userDataDir:root,headless:true});
 stagehand=await Stagehand.create({browser,model:{modelName:process.env.KAIROQ_STAGEHAND_TRIAL_MODEL||"openai/gpt-5.4-mini",apiKey:key}});
 const pages=await browser.context.pages(),page=pages[0]||await browser.context.newPage();
 await page.goto(u.href);
 const data=await page.extract("List visible headings, form fields, buttons and navigation links. Do not click or submit.");
 console.log(JSON.stringify({status:"observed",result:data}));
}finally{
 if(stagehand&&typeof stagehand.close==="function")await stagehand.close().catch(()=>{});
 if(browser&&typeof browser.close==="function")await browser.close().catch(()=>{});
 fs.rmSync(root,{recursive:true,force:true});
}
