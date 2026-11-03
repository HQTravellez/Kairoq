"use strict";
// Kairoq in Ka's Figma design: the stylesheet loads last, the Home box holds the Web app /
// Phone app / Website switch, the first build shows the app being put together, and the
// browser pane folds away when idle.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

test("the Figma look loads after every other stylesheet", () => {
  const html = read("create.html");
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)[^"]*">/g)].map(m => m[1]);
  assert.equal(links.at(-1), "/ui/forma.css", "forma.css is the last stylesheet");
  assert.match(html, /family=Inter:wght@[^"]*family=IBM\+Plex\+Mono/);
  const css = read("ui/forma.css");
  assert.match(css, /--c-accent:#7552E8/);
  assert.match(css, /--f-chrome:#242329/);
  assert.match(css, /prefers-reduced-motion:reduce/, "motion can be turned off");
});

test("the Home box holds the switch, with an icon on each choice", () => {
  const html = read("create.html");
  const box = html.slice(html.indexOf('<div class="wow">'), html.indexOf('<div class="examples" id="examples">'));
  assert.match(box, /<div class="wow-ring">\s*<form id="new-form" class="prompt-box">/);
  assert.match(box, /id="new-kind"/, "the switch is inside the box");
  assert.equal((box.match(/<svg class="kind-ico"/g) || []).length, 3, "Web app, Phone app and Website each have a line icon");
  assert.match(box, /id="kind-hint"/);
  const js = read("create.js");
  assert.match(js, /text\(\$\('kind-hint'\),\{site:/);
});

test("the first build shows the app being put together until a version can be previewed", () => {
  const js = read("create.js");
  assert.match(js, /function previewWait\(id,title,sub,spin\)/);
  assert.match(js, /if\(state\.firstBuild&&!shown\)buildWaiting\(label\)/);
  assert.match(js, /planWaiting\(false\);state\.firstBuild=true;/);
  assert.match(read("ui/forma.css"), /\.pw-b\.hero/);
});

test("project cards sit in a colour frame and the browser pane folds when idle", () => {
  const js = read("create.js");
  assert.match(js, /thumb\.style\.setProperty\('--frame',FRAMES\[/);
  const pane = read("builder-browser-pane.js");
  assert.match(pane, /foldTimer=setTimeout\(fold,3500\)/);
  assert.match(pane, /if\(byHand\|\|Date\.now\(\)-lastUserAt<15000/, "never folds while you are using it");
  assert.match(pane, /reopen\.onclick=\(\)=>\{byHand=true;open\(\)\}/);
});

test("on a phone the top is one dark band and the browser stays open while watched", () => {
  const css = read("ui/forma.css");
  assert.match(css, /\.phone-panes\{background:var\(--f-chrome\)!important/);
  assert.match(css, /\.phone-panes button\[aria-selected=true\]\{background:#fff!important/);
  assert.match(read("builder-browser-pane.js"), /editor\.dataset\.pane==="browser"\)return;/);
});

test("Home and the editor follow the Figma frames: breadcrumb, project header, card body, worded view tabs", () => {
  const html = read("create.html");
  assert.match(html, /class="tp-crumbs home-crumbs"><span>Workspace<\/span><span aria-hidden="true">\/<\/span><b>Projects<\/b>/);
  assert.match(html, /id="tab-projects" aria-selected="true">All projects<span class="n" id="project-count"><\/span>/);
  assert.match(html, /id="pj-search"/); assert.match(html, /id="pj-sort"/);
  const js = read("create.js");
  assert.match(js, /p\.published\?'Published':'Draft'/);
  assert.match(js, /'Edited '\+ago\(p\.updated_at\)/);
  assert.match(js, /el\('details','pj-menu'\)/, "Delete sits in the ··· menu");
  const css = read("ui/forma.css");
  assert.match(css, /\.tabs-seg \.lbl\{display:inline!important/);
});

test("the editor follows the App builder frame: light second rows, a browser window with the real address, the starter scene", () => {
  const js = read("create.js");
  assert.match(js, /function formaRows\(\)/);
  assert.match(js, /c\.append\(el\('b',null,'Chat with Kairoq'\)\)/);
  assert.match(js, /url=live\?String\(p\.urls\[0\]\):location\.host\+\(state\.previewBase\|\|p\.preview_url\|\|''\)/, "the address is the real one, not made up");
  assert.match(js, /starterWaiting\(Boolean\(project\.starter\)&&!job&&!active_job\)/);
  assert.match(js, /if\(url&&url!==state\.previewBase\)starterWaiting\(false\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "create-api.js"), "utf8"), /starter=require\('\.\/react-design'\)\.isUntouchedStarter/);
  const css = read("ui/forma.css");
  assert.match(css, /#messages>li\.assistant::before\{content:"Kairoq"!important/);
  assert.match(css, /\.fm-sub \.tabs-seg button\[aria-pressed=true\]\{color:var\(--c-accent\)!important\}/);
});

test("the chat's questions, plan and research follow the Figma builder chat", () => {
  const js = read("create.js");
  // Questions like Emergent: a slim line in the chat, one question at a time docked above the message box.
  assert.match(js, /el\('span','ask-wait-t','Kairoq has questions for you'\)/);
  assert.match(js, /\$\('chat-form'\)\.before\(dock\);document\.body\.classList\.add\('asking'\);/);
  assert.match(js, /count\.textContent='Question '\+\(at\+1\)\+' of '\+questions\.length;/);
  assert.match(js, /if\(i===q\.recommended\)words\.append\(' ',el\('span','ad-tag','Suggested'\)\)/);
  assert.match(js, /auto\.onclick=\(\)=>\{suggest\(\);finish\(\)\};/, "Use my suggestions accepts Kairoq's picks");
  assert.match(read("ui/forma.css"), /html body\.app\.in-editor\.asking #editor #chat-form\{display:none!important\}/);
  assert.match(js, /el\('button','ask-next plan-approve','Build it'\)/);
  assert.match(js, /el\('span','plan-meta','1 build'\+\(cost\?' · '\+cost\+' credits':''\)\)/, "the real price, no made-up time");
  assert.match(read("builder-browser-pane.js"), /function researchChip\(href,done\)/);
});

test("Kairoq's thinking shows: purple breathing dots and a shimmer on 'is thinking…', with no extra label", () => {
  const css = read("ui/forma.css");
  assert.match(css, /#messages>li\.work::before\{content:none!important/);
  assert.match(css, /\.k-grid i,html body\.app \.k-dots i\{background:var\(--c-accent/);
  assert.match(css, /\.status-line:not\(\.done\) \.status-text\{background:linear-gradient/);
  assert.match(css, /@keyframes fm-think/);
});

test("the plan card and look picker are slim like the question panel", () => {
  const css = read("ui/forma.css");
  assert.match(css, /#messages :is\(\.plan-card,\.ask-card\) \.ask-foot \.ask-next\{flex:none!important;width:auto!important;min-width:0!important;height:32px!important/);
  assert.match(css, /#messages \.brand-opts\{display:flex!important;flex-direction:column!important/);
  assert.match(css, /#messages \.brand-body \.lk-page\{zoom:\.6;/);
  const look = read("create-look.js");
  assert.match(look, /opt\('kairoq','Design it for me','Kairoq picks a direction for this business and shows it',data\.brand\?null:'Suggested'\)/);
});

test("work and replies like Emergent: step rows, a finished line, next steps that fill the message box", () => {
  const js = read("create.js"), css = read("ui/forma.css");
  // Since #390 the steps stay folded behind "Worked for …" (like Lovable): the chat shows the work, then what was done.
  assert.doesNotMatch(js, /if\(last&&tl\.length&&index>=0\)\{fill\(\);fold\.classList\.add\('open'\)/, "steps do not open by themselves");
  assert.match(js, /b\.onclick=\(\)=>\{fill\(\);const open=fold\.classList\.toggle\('open'\)/, "a click on Worked for … opens them");
  assert.match(js, /rail\.append\(eventRow\(e,\{expand:true,version:m\.version\}\)\)/, "an edit opens its diff");
  assert.match(js, /el\('span','agent-done-t','Kairoq Agent finished'\)/);
  assert.match(js, /b\.onclick=\(\)=>\{const t=\$\('chat-input'\);t\.value=ask;/, "a next step goes into the message box, nothing is spent");
  assert.match(css, /#messages \.rail \.ev\{position:relative;display:flex!important/);
  // Like Lovable: next steps are small pills above the message box, not rows inside it.
  assert.match(css, /#editor \.composer-ideas \.idea-chip\{[^}]*border-radius:999px/);
  assert.match(read("create.html"), /id="composer-ideas"[^>]*><\/div>\n\s*<form id="chat-form"/);
});

test("settings live in the preview area like Emergent: Connectors, Payments, Secrets, Monitoring from real project data", () => {
  const js = read("create.js"), html = read("create.html");
  assert.match(html, /<button type="button" id="view-manage" aria-pressed="false"/);
  for (const t of ["connectors", "payments", "secrets", "monitoring"]) assert.match(html, new RegExp('data-mg="' + t + '"'));
  assert.match(html, /id="composer-connect"/);
  assert.match(js, /settings=\(await api\('\/projects\/'\+p\.id\+'\/settings'\)\)\.settings/);
  assert.match(js, /mine=\(await api\('\/projects\/'\+p\.id\+'\/secrets'\)\)\.secrets/);
  assert.match(js, /api\('\/projects\/'\+p\.id\+'\/analytics'\),api\('\/projects\/'\+p\.id\+'\/logs'\)/);
  assert.match(js, /\$\('connect-open'\)\.onclick=\(\)=>openManage\('connectors'\);/);
  assert.match(read("ui/forma.css"), /#canvas\[data-view\]:not\(\[data-view=preview\]\)>#device\{display:none!important\}/);
});

test("composer and preview like Emergent: model note and cost, share picture and links, floating preview bar", () => {
  const js = read("create.js"), css = read("ui/forma.css");
  assert.match(js, /panel\.append\(el\('p','model-when','Model changes apply from your next message'\)\)/);
  assert.match(js, /name\.append\(el\('i','model-tag cost',m\.credits\+' credit'/);
  assert.match(js, /if\(p\.thumb\)\{const img=el\('img'\);img\.src=p\.thumb/, "the app's own picture, only when one exists");
  assert.match(js, /\['LinkedIn','https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url='\]/);
  assert.match(js, /function previewFloat\(\)\{/);
  assert.match(css, /#canvas\[data-view\]:not\(\[data-view=preview\]\)>\.pv-float\{display:none!important\}/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "create-api.js"), "utf8"), /thumb:\(\(\)=>\{try\{return require\('\.\/project-thumbs'\)\.url\(\{id,current_version:meta\.current_version\}\)\}/);
});

test("dot-matrix motion: the working grid follows the phase, the preview shows a dot field that dissolves, reduced motion stays still", () => {
  const js = read("create.js"), css = read("ui/forma.css");
  assert.match(js, /function gridPattern\(j\)\{/);
  assert.match(js, /if\(kg&&kg\.dataset\.p!==pat\)kg\.dataset\.p=pat;/);
  assert.match(js, /function dotMatrix\(win\)\{/);
  assert.match(js, /if\(!c\.isConnected\)\{ro\?\.disconnect\(\);return\}/, "stops when the preview window goes away");
  assert.match(js, /if\(!document\.hidden\)\{/, "pauses while the tab is hidden");
  assert.match(css, /\.k-grid\[data-p=write\] i\{animation-duration:1\.1s!important;animation-delay:calc\(var\(--x,0\) \* \.14s\)!important\}/);
  assert.match(css, /@keyframes pw-dissolve\{/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\n  html body\.app \.k-grid\[data-p\] i\{animation:none!important/);
});

test("the preview's slow-load notice is one small bar, not a paragraph", () => {
  const html = read("create.html");
  assert.match(html, /<span class="pn-text">Preview is taking a moment<\/span>/);
  for (const id of ["preview-reload", "preview-rebuild", "preview-open", "preview-diagnosis", "preview-rebuild-status"]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.doesNotMatch(html, /say "the preview is blank" in the chat/);
  assert.match(read("ui/forma.css"), /#preview-notice:not\(\.hidden\)\{position:absolute!important;top:58px!important;/);
});

test("while Kairoq thinks its status uses playful words that change; concrete steps keep their own words", () => {
  const js = read("create.js");
  assert.match(js, /const THINK_WORDS=\['musing','noodling','tinkering',/);
  assert.match(js, /if\(phaseOf\(j\)==='thinking'&&!\(j\.mode==='discuss'&&j\.stream&&j\.stream\.text\)\)sayThinking\(stx,'is '\);else\{const st0=liveStatus\(j\);delete stx\.dataset\.think;/);
  assert.match(js, /setInterval\(\(\)=>\{if\(document\.hidden\)return;for\(const n of document\.querySelectorAll\('\[data-think\]'\)\)/);
  assert.match(read("ui/forma.css"), /@keyframes tw-in\{/);
});

test("Share stays in the top bar on laptops; only phones hide it (it is in the More menu there)", () => {
  const ws = read("workspace.css");
  assert.doesNotMatch(/@media \(max-width:1380px\)\{[^}]*\}/.exec(ws)[0], /#share-open\{display:none\}/);
  assert.match(ws, /\.stage-bar #share-open\{display:none\}/, "still hidden on phones");
});
