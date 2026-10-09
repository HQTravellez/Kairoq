"use strict";
const designGuidance=require("./design-guidance");
const designPipeline=require("./design-pipeline"),designSystem=require("./design-system"),designDom=require("./design-dom"),effects=require("./visual-effects");
// Isolated website/web-app generation. Generated code is only previewed in sandboxed iframes.
const fs=require("fs"),path=require("path"),crypto=require("crypto"),vm=require("vm");
const ROOT=path.join(__dirname,"workspace","developer-projects");
const slug=s=>String(s||"project").toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,45)||"project";
const validId=id=>/^[a-z0-9-]{5,85}$/.test(String(id||""));
const escapeHtml=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function dirFor(id){if(!validId(id))throw Error("Invalid project ID");return path.join(ROOT,id)}
function getProject(id){
  const dir=dirFor(id);
  const meta=JSON.parse(fs.readFileSync(path.join(dir,"project.json"),"utf8"));
  const files={};const names=Array.isArray(meta.file_names)&&meta.file_names.length?meta.file_names:["index.html","styles.css","app.js"];
  for(const name of names)files[name]=fs.readFileSync(path.join(dir,name),"utf8");
  return {...meta,files};
}
function normalizeFiles(raw){
  const obj=raw?.files||raw||{},files={"index.html":String(obj["index.html"]||obj.html||""),"styles.css":String(obj["styles.css"]||obj.css||""),"app.js":String(obj["app.js"]||obj.js||"")};
  for(const [name,value] of Object.entries(obj)){
    if(name==="index.html"||name==="styles.css"||name==="app.js"||name==="html"||name==="css"||name==="js")continue;
    if(/^[a-z0-9][a-z0-9-]{0,48}\.html$/.test(name))files[name]=String(value||"");
  }
  const pages=Object.keys(files).filter(n=>n.endsWith(".html"));if(!files["index.html"]||pages.length>10)throw Error("Website needs index.html and at most 10 HTML pages.");
  if(pages.some(n=>files[n].length<350)||files["styles.css"].length<500)throw Error("The AI produced incomplete website files.");
  if(Object.values(files).some(x=>x.length>160000))throw Error("Generated file exceeds size limit.");
  for(const page of pages){
    const scripts=[...files[page].matchAll(/<script\b[^>]*\bsrc\s*=\s*["\x27]([^"\x27]+)["\x27]/gi)];
    if(scripts.some(x=>!/^\.?\/?app\.js(?:\?.*)?$/.test(x[1])))throw Error("Only the shared local app.js script is allowed.");
  }
  try{new vm.Script(files["app.js"],{filename:"app.js",timeout:1000})}catch(e){throw Error("Generated JavaScript syntax error: "+e.message)}
  return files;
}
function assemble(files,pageName="index.html"){
  let html=files[pageName].replace(/<script\b[^>]*\bsrc\s*=\s*["\x27]\.?\/?app\.js(?:\?[^"\x27]*)?["\x27][^>]*>\s*<\/script>/gi,"").replace(/<link\b[^>]*href\s*=\s*["\x27]\.?\/?styles\.css["\x27][^>]*>/gi,"");
  const css="<style>\n"+files["styles.css"].replace(/<\/style/gi,"<\\/style")+"\n</style>";
  const js="<script>\n"+files["app.js"].replace(/<\/script/gi,"<\\/script")+"\n<\/script>";
  html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,css+"\n</head>"):css+"\n"+html;
  html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,js+"\n</body>"):html+"\n"+js;
  return html;
}
async function audit(files,{capture=false}={}){
  const notes=[],screenshots=[],designChecks=[],pages=Object.keys(files).filter(n=>n.endsWith(".html")).sort((a,b)=>a==="index.html"?-1:b==="index.html"?1:a.localeCompare(b));
  for(const pageName of pages){if(!/<meta[^>]+name=["']viewport["']/i.test(files[pageName]))notes.push(pageName+": missing viewport meta tag");if(!/<h1[\s>]/i.test(files[pageName]))notes.push(pageName+": missing primary heading");
   const links=[...files[pageName].matchAll(/href=["']([^"'#?]+\.html)(?:[?#][^"']*)?["']/gi)].map(m=>m[1].replace(/^\.\//,""));for(const href of links)if(!files[href])notes.push(pageName+": missing linked page "+href);}
  try{
    const {chromium}=require("playwright-core");
    const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||"/usr/bin/chromium",headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]});
    try{
      for(const pageName of pages)for(const width of [1440,390]){
        const html=assemble(files,pageName);const ctx=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:true,serviceWorkers:"block"});
        const page=await ctx.newPage(),errors=[];
        page.on("pageerror",err=>errors.push(err.message));
        await page.route("**/*",route=>route.request().url().startsWith("data:")?route.continue():route.abort());
        await page.setContent(html,{waitUntil:"domcontentloaded",timeout:18000});
        await page.waitForTimeout(250);
        const broken=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(h.slice(1))));if(broken.length)notes.push(width+"px: navigation targets missing: "+broken.slice(0,4).join(', '));
        let controlIndex=0;for(const toggle of await page.locator('button[aria-expanded][aria-controls],details > summary').all()){if(!await toggle.isVisible())continue;const before=await toggle.evaluate(n=>n.tagName==='SUMMARY'?n.parentElement.open:n.getAttribute('aria-expanded'));await toggle.click();const after=await toggle.evaluate(n=>n.tagName==='SUMMARY'?n.parentElement.open:n.getAttribute('aria-expanded'));if(after===before)notes.push(width+"px: expandable control did not change state");if(capture){const label=width+'px '+pageName+' · expanded control '+(++controlIndex);designChecks.push(...await designDom.inspect(page,label));screenshots.push({label,bytes:await page.screenshot({type:'jpeg',quality:65,fullPage:false})});}await toggle.click();}
        await page.evaluate(()=>window.scrollTo(0,0));
        const check=await page.evaluate(()=>({title:document.title,text:document.body.innerText.trim().length,overflow:document.documentElement.scrollWidth>innerWidth+8,buttons:[...document.querySelectorAll("button")].length}));
        if(check.text<150)notes.push(width+"px: insufficient meaningful page content");
        if(check.overflow)notes.push(width+"px: horizontal overflow");
        if(errors.length)notes.push(width+"px: JS errors: "+errors.slice(0,2).join(" | "));if(capture){const label=width+"px "+pageName;designChecks.push(...await designDom.inspect(page,label));screenshots.push({label,bytes:await page.screenshot({type:"jpeg",quality:65,fullPage:true})});}
        if(capture){let sectionIndex=0;for(const section of await page.locator('main > section,main > article,[role=main] > section').all()){if(!await section.isVisible())continue;const heading=(await section.locator('h1,h2').count()?(await section.locator('h1,h2').first().textContent())?.trim().replace(/\s+/g,' ').slice(0,45):'Section')||'Section';const label=width+'px '+pageName+' · '+(++sectionIndex)+' '+heading;screenshots.push({label,bytes:await section.screenshot({type:'jpeg',quality:65})});}}
        await ctx.close();
      }
    }finally{await browser.close()}
  }catch(e){notes.push("Browser QA unavailable: "+e.message)}
  return {passed:notes.length===0,findings:notes,pages,...(capture?{_screenshots:screenshots,design_checks:designChecks}:{}),tested:["all HTML routes","desktop 1440px","mobile 390px","JavaScript execution","horizontal overflow","semantic structure","internal and cross-page navigation","expandable controls"]};
}
async function finishDesign(files,qa,designPlan,brief,callModel,effectConfig={motion:"subtle",threeD:"off"}){
 let evidence=[];if(!qa.passed){designPipeline.stripShots(qa);return{files,qa,evidence};}
 for(let polish=0;polish<3;polish++){
  evidence=designPipeline.stripShots(qa);const visual=await designPipeline.review(callModel,designPlan,evidence,qa.design_checks);qa.visual_review=visual;if(visual.passed)break;
  if(polish===2){qa.passed=false;qa.findings.push('Design review needs further refinement');break;}
  files=effects.inject(designSystem.apply(normalizeFiles(await callModel({messages:[{role:'user',content:'Return ONLY JSON {files:{...}} containing complete shared styles.css/app.js AND every existing HTML page. Polish this working website while preserving all routes, interactions, content and valid navigation. Never remove an existing page. No external scripts, images, fonts, credentials or fake backend actions.'+designPipeline.instructions(designPlan)+designPipeline.repairInstructions(visual)+'\nOriginal brief: '+brief+'\nCurrent files: '+JSON.stringify(effects.source(designSystem.source(files)))}]})),designPlan.style),effectConfig);qa=await audit(files,{capture:true});if(!qa.passed){designPipeline.stripShots(qa);break;}
 }
 return{files,qa,evidence};
}
async function build({brief,kind="website",style="editorial",projectName,motion="subtle",threeD="off"},callModel){
  brief=String(brief||"").trim().slice(0,3000);
  if(brief.length<12)throw Error("Describe the website or app in at least 12 characters.");
  kind=kind==="webapp"?"webapp":"website";
  const id=slug(projectName||brief.slice(0,35))+"-"+crypto.randomBytes(3).toString("hex");
  const effectConfig=effects.normalize({motion,threeD});const designPlan=await designPipeline.plan(callModel,{brief,kind,style});
  const system="You are a senior product designer, creative director, and principal frontend engineer. Return ONLY a JSON object with keys project_name,summary,files. files must contain shared styles.css and app.js plus index.html and, when the product needs multiple routes, additional safe lowercase-kebab HTML pages such as platform.html, about.html, pricing.html or industries-travel.html. Generate 2–8 coherent pages for a multi-page website request; every page shares the same design system, header/footer and working navigation. Build a premium, real, fully usable responsive "+kind+" based on the user's brief. Original creative direction, impeccable typography, restrained palette, layout hierarchy, deliberate whitespace, subtle interactions, premium mobile UX, accessibility and working navigation/CTAs. Choose a high-end design appropriate to industry, not generic AI gradients, neon blobs, or bland templates. Strong designed hero and multiple coherent sections with realistic domain-specific copy, meaningful content, responsive 390px and 1440px layouts. CSS animations respect prefers-reduced-motion. Include inline SVG icons or CSS illustrations instead of external image dependencies. Pure HTML CSS browser JS, no framework, no external scripts, no API credentials, no fake payment or authentication claims. Every HTML page links the shared styles.css and app.js using relative paths. Cross-page links must target the generated .html files. Do not embed CSS or JS inside HTML. Webapps must have functional client-side interactions using in-memory/localStorage only, not fake backend actions. Quality bar: visually finished and polished, not a wireframe. Prioritize complete working code over lengthy prose. Keep total output under 7000 tokens, and output complete files without truncation.";
  const prompt=system+designPipeline.instructions(designPlan)+effects.instructions(effectConfig)+"\n"+designGuidance.guidance(kind,style)+"\n\nDESIGN DIRECTION: "+style+"\nPROJECT NAME: "+String(projectName||"").slice(0,100)+"\nUSER BRIEF:\n"+brief;
  let generated,usedStarter=false;
  try{generated=await callModel({messages:[{role:"user",content:prompt}],temperature:0.45})}
  catch(e){console.warn("[developer-model] Generation unavailable:",String(e.message||e).slice(0,400));if(process.env.OPENROUTER_API_KEY || kind==="webapp")throw Error("Custom AI generation failed: "+e.message+". This is not an AI-generated project; check model access or credits.");generated=require("./developer-starter").starter(brief,projectName,style);usedStarter=true;}
  let files=effects.inject(designSystem.apply(normalizeFiles(generated),designPlan.style),effectConfig),qa=await audit(files,{capture:true}),revisions=0;
  if(!usedStarter && qa.findings.length && qa.findings.every(x=>!x.startsWith("Browser QA unavailable"))){
    try{
      const fix="Return only JSON with files containing complete styles.css, app.js, index.html and every current HTML page. Do not remove routes. Repair these browser QA issues: "+qa.findings.join("; ")+"\nOriginal brief:"+brief+"\nCurrent files JSON:\n"+JSON.stringify(effects.source(designSystem.source(files))).slice(0,34000)+". Preserve and enhance premium design.";
      const repaired=effects.inject(designSystem.apply(normalizeFiles(await callModel({messages:[{role:"user",content:fix}],temperature:0.2})),designPlan.style),effectConfig);
      const repairedQa=await audit(repaired,{capture:true});
      if(repairedQa.findings.length<=qa.findings.length){files=repaired;qa=repairedQa;revisions=1}
    }catch(e){qa.findings.push("Repair attempt unsuccessful: "+e.message)}
  }
  const finished=await finishDesign(files,qa,designPlan,brief,callModel,effectConfig);files=finished.files;qa=finished.qa;
  const metadata={id,file_names:Object.keys(files),pages:Object.keys(files).filter(n=>n.endsWith(".html")),effects:effectConfig,design_plan:designPlan,project_name:String(generated.project_name||projectName||"New Project").slice(0,100),summary:String(generated.summary||brief).slice(0,500),brief,kind,style,created_at:new Date().toISOString(),qa,revisions,status:"draft",generation_mode:usedStarter?"starter_template":"ai_generated"};
  const folder=dirFor(id);
  fs.mkdirSync(folder,{recursive:true});designPipeline.saveEvidence(folder,finished.evidence);
  for(const [name,contents] of Object.entries(files))fs.writeFileSync(path.join(folder,name),contents);
  fs.writeFileSync(path.join(folder,"project.json"),JSON.stringify(metadata,null,2));
  return {...metadata,files,preview:assemble(files)};
}
async function revise(id,instruction,callModel){
  const p=getProject(id),revision=String(instruction||"").trim().slice(0,1600),effectConfig=effects.normalize(p.effects||{});
  if(revision.length<5)throw Error("Describe the design or functionality change.");
  if(p.status==="pull_request")throw Error("This project has a pending GitHub PR. Create a new project before revising.");
  const designPlan=await designPipeline.plan(callModel,{brief:p.brief,kind:p.kind,style:p.style,previous:p.design_plan,existing:p.files});
  const prompt=designPipeline.instructions(designPlan)+effects.instructions(effectConfig)+designGuidance.guidance(p.kind,p.style,true)+"\nYou are a world-class frontend product designer and engineer. Revise this working website/webapp. Return ONLY JSON containing a files object with complete shared styles.css/app.js and EVERY existing HTML page. Never remove or rename an existing route. Preserve its working features, improve the visual polish and fix any issues. Do not inject external scripts. Maintain responsive and accessible layouts. No fake backend functionality. User changes: "+revision+"\nOriginal brief: "+p.brief+"\nExisting full project JSON:\n"+JSON.stringify(effects.source(designSystem.source(p.files))).slice(0,37000);
  const modelResult=await callModel({messages:[{role:"user",content:prompt}],temperature:0.25});
  let files=effects.inject(designSystem.apply(normalizeFiles(modelResult),designPlan.style),effectConfig),qa=await audit(files,{capture:true});
  if(qa.findings.length && qa.findings.every(x=>!x.startsWith("Browser QA unavailable"))){
    try{
      const patch=await callModel({messages:[{role:"user",content:"Fix these code problems: "+qa.findings.join("; ")+"\nReturn full JSON files containing shared styles.css/app.js and every existing HTML route:\n"+JSON.stringify(effects.source(designSystem.source(files))).slice(0,30000)}],temperature:0.15});
      const fixed=effects.inject(designSystem.apply(normalizeFiles(patch),designPlan.style),effectConfig),test=await audit(fixed,{capture:true});
      if(test.findings.length<=qa.findings.length){files=fixed;qa=test}
    }catch{}
  }
  const finished=await finishDesign(files,qa,designPlan,p.brief,callModel,effectConfig);files=finished.files;qa=finished.qa;if(!qa.passed)throw Error("Revision did not pass functional and visual review; previous project preserved");designPipeline.saveEvidence(dirFor(id),finished.evidence);
  for(const [name,code] of Object.entries(files))fs.writeFileSync(path.join(dirFor(id),name),code);
  const meta={...p};delete meta.files;
  meta.design_plan=designPlan;meta.revisions=Number(meta.revisions||0)+1;meta.qa=qa;meta.updated_at=new Date().toISOString();
  fs.writeFileSync(path.join(dirFor(id),"project.json"),JSON.stringify(meta,null,2));
  return {...meta,files,preview:assemble(files)}
}
async function publish(id,{branchPrefix="kairoq-build"}={}){
  const project=getProject(id),token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPO;
  if(!project.qa?.passed||project.qa.visual_review&&!project.qa.visual_review.passed)throw Error("Publishing requires passing functional QA and any visual review. Revise the project and resolve its findings first.");
  if(!token||!/^[\w.-]+\/[\w.-]+$/.test(repo||""))throw Error("GitHub publishing requires GITHUB_TOKEN and GITHUB_REPO variables.");
  const base="https://api.github.com/repos/"+repo;
  const api=async(method,p,body)=>{
    const r=await fetch(base+p,{method,headers:{"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(16000)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error("GitHub "+r.status+": "+String(d.message||"Request failed").slice(0,240));
    return d;
  };
  const repoInfo=await api("GET","");const baseBranch=repoInfo.default_branch;
  const baseRef=await api("GET","/git/ref/heads/"+encodeURIComponent(baseBranch));
  const branch=branchPrefix+"/"+id;
  await api("POST","/git/refs",{ref:"refs/heads/"+branch,sha:baseRef.object.sha});
  const parent=await api("GET","/git/commits/"+baseRef.object.sha);
  const tree=await api("POST","/git/trees",{base_tree:parent.tree.sha,tree:Object.entries(project.files).map(([name,content])=>({path:"generated-sites/"+id+"/"+name,mode:"100644",type:"blob",content}))});
  const commit=await api("POST","/git/commits",{message:"Generate "+project.project_name+" via Kairoq Developer",tree:tree.sha,parents:[baseRef.object.sha]});
  await api("PATCH","/git/refs/heads/"+branch,{sha:commit.sha});
  const pr=await api("POST","/pulls",{title:"[Kairoq Build] "+project.project_name,head:branch,base:baseBranch,body:"Generated website/webapp preview. Review source and QA results before merging.\n\nQA:\n"+JSON.stringify(project.qa,null,2)});
  const dir=dirFor(id),meta={...project};delete meta.files;
  meta.status="pull_request";meta.pull_request_url=pr.html_url;meta.pull_request_number=pr.number;
  fs.writeFileSync(path.join(dir,"project.json"),JSON.stringify(meta,null,2));
  return {url:pr.html_url,number:pr.number,branch,repository:repo,status:"awaiting_review"};
}
function listProjects(){if(!fs.existsSync(ROOT))return[];return fs.readdirSync(ROOT).flatMap(id=>{try{const {files,...p}=getProject(id);return[p];}catch{return[];}});}
module.exports={build,revise,getProject,listProjects,publish,assemble,audit};
