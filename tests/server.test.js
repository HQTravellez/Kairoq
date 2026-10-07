const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");

process.env.NODE_ENV = "test";
process.env.APP_ENCRYPTION_KEY = "test-key-that-is-not-used-in-production";

const {
  encryptJson,
  decryptJson,
  sanitizeAuditData,
  nextRunAt,
  safeWorkspacePath,
  DEFAULT_TOOL_PERMISSIONS,
  cleanModel,
  agentPersona,
  normalizeMediaProviderOrder,
  imageAspectRatio,
  pollinationsImageSize,
  mediaProviderOrderForBudget,
  likelyConsequentialMessage,
  normalizeOpenLoop,
  openLoopPriorityScore,
  normalizeShopifyStorePlan,
  renderStorePreview,
  calculateStoreHealth,
  normalizeStoreExperiment,
  calculateCommerceFunnel,
  normalizeArrivalBrief,
  arrivalFacts,
  renderArrivalBriefHtml
} = require("../server.js");

test("encrypted JSON round-trips and is not stored as plaintext", () => {
  const input = { refresh_token: "secret-refresh-token", nested: { x: 1 } };
  const encrypted = encryptJson(input);
  assert.equal(encrypted.__encrypted, true);
  assert.equal(JSON.stringify(encrypted).includes("secret-refresh-token"), false);
  assert.deepEqual(decryptJson(encrypted), input);
});

test("audit sanitizer redacts secret-looking fields and tokens", () => {
  const clean = sanitizeAuditData({
    apiKey: "abc",
    authorization: "Bearer xyz",
    ordinary: "safe",
    value: "sk-test-secret"
  });
  assert.equal(clean.apiKey, "[REDACTED]");
  assert.equal(clean.authorization, "[REDACTED]");
  assert.equal(clean.value, "[REDACTED]");
  assert.equal(clean.ordinary, "safe");
});

test("workspace sandbox rejects traversal", () => {
  assert.throws(() => safeWorkspacePath("../../outside.txt"), /escapes the workspace sandbox/i);
  assert.ok(safeWorkspacePath("notes/test.txt").includes(path.join("workspace", "notes", "test.txt")));
});

test("default permission policy protects consequential actions", () => {
  assert.equal(DEFAULT_TOOL_PERMISSIONS.gmail_read, "auto");
  assert.equal(DEFAULT_TOOL_PERMISSIONS.gmail_send, "approve");
  assert.equal(DEFAULT_TOOL_PERMISSIONS.browser_agent_task, "approve");
  assert.equal(DEFAULT_TOOL_PERMISSIONS.write_workspace_file, "approve");
});

test("model metadata detects free, tools, reasoning, and vision", () => {
  const m = cleanModel({
    id: "vendor/model",
    name: "Model",
    pricing: { prompt: "0", completion: "0" },
    architecture: { input_modalities: ["text", "image"] },
    supported_parameters: ["tools", "reasoning"]
  });
  assert.equal(m.isFree, true);
  assert.equal(m.supportsTools, true);
  assert.equal(m.supportsReasoning, true);
  assert.equal(m.supportsVision, true);
});

test("daily schedule advances to the next future occurrence", () => {
  const from = new Date("2026-09-18T12:00:00Z");
  const next = nextRunAt({ schedule: { frequency: "daily", hour: 8, minute: 0 } }, from);
  assert.equal(next, "2026-09-19T08:00:00.000Z");
});

test("weekly schedule lands on the requested weekday", () => {
  const from = new Date("2026-09-18T12:00:00Z"); // Friday
  const next = nextRunAt({ schedule: { frequency: "weekly", dayOfWeek: 1, hour: 8, minute: 0 } }, from);
  assert.equal(new Date(next).getUTCDay(), 1);
});


test("named agent team maps to specialist personas", () => {
  for (const [id, name] of [
    ["atlas","Kairoq"],["scout","Scout"],["forge","Forge"],["relay","Relay"],
    ["orbit","Orbit"],["compass","Compass"],["ledger","Ledger"],["beacon","Beacon"],
    ["vault","Vault"],["rover","Rover"],["writer","Writer"],["closer","Closer"],["guardian","Guardian"]
  ]) assert.match(agentPersona(id), new RegExp(name));
});


test("media router normalizes provider order", () => {
  assert.deepEqual(
    normalizeMediaProviderOrder(["pollinations","openrouter","pollinations"]),
    ["pollinations","openrouter","localsd","wan2gp","selfhost","higgsfield","fal"]
  );
});

test("media router maps image sizing", () => {
  assert.equal(imageAspectRatio("landscape_16_9"), "16:9");
  assert.equal(imageAspectRatio("portrait_4_3"), "3:4");
  assert.equal(pollinationsImageSize("landscape_4_3"), "1024x768");
});


test("self-host provider is part of the normalized media order", () => {
  const order = normalizeMediaProviderOrder(["selfhost","openrouter"]);
  assert.equal(order[0], "selfhost");
  assert.ok(order.includes("pollinations"));
  assert.ok(order.includes("fal"));
});


test("command center homepage is present", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  assert.match(html, /id="commandCenter"/);
  assert.match(html, /id="ccPriorityList"/);
  assert.match(html, /id="ccAgentGrid"/);
  assert.match(html, /id="chatViewBtn"/);
  assert.match(js, /function refreshCommandCenter\(/);
  assert.match(js, /function setMainView\(/);
});


test("atlas-first homepage elements are present", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  assert.match(html, /id="atlasCapabilityList"/);
  assert.match(html, /id="spendModeSelect"/);
  assert.match(html, /id="shellModeBtn"/);
  assert.match(js, /function applyShellMode\(/);
  assert.match(js, /function renderAtlasCapabilities\(/);
});


test("budget-aware media routing keeps paid Higgsfield out of free-first mode", () => {
  const free = mediaProviderOrderForBudget("free");
  const best = mediaProviderOrderForBudget("best");
  assert.equal(free.includes("higgsfield"), false);
  assert.equal(best[0], "higgsfield");
});

test("message action detector flags consequential requests", () => {
  assert.equal(likelyConsequentialMessage("send Sarah an email"), true);
  assert.equal(likelyConsequentialMessage("research Sarah's company"), false);
});

test("Atlas Anywhere UI and connector fields are present", () => {
  const fs=require("node:fs"),path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  assert.match(html,/id="atlasChannelStatus"/);
  assert.match(html,/id="telegramConnectorStatus"/);
  assert.match(html,/id="twilioConnectorStatus"/);
  assert.match(html,/id="higgsfieldConnectorStatus"/);
});


test("open loop normalizer preserves outcome state", () => {
  const loop = normalizeOpenLoop({
    title:"Get hotel refund",
    goal:"Refund is received",
    status:"waiting",
    money_value:1800,
    risk:"high"
  });
  assert.equal(loop.title, "Get hotel refund");
  assert.equal(loop.status, "waiting");
  assert.equal(loop.money_value, 1800);
  assert.equal(loop.risk, "high");
  assert.ok(loop.id);
});

test("open loop priority favors money and urgent risk", () => {
  const low = normalizeOpenLoop({title:"Low",goal:"Done",risk:"low",money_value:0,status:"open"});
  const high = normalizeOpenLoop({title:"High",goal:"Paid",risk:"high",money_value:5000,status:"blocked"});
  assert.ok(openLoopPriorityScore(high) > openLoopPriorityScore(low));
});

test("finish it UI is present", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  assert.match(html, /id="finishItBtn"/);
  assert.match(html, /id="openLoopsList"/);
  assert.match(html, /id="scanLoopsBtn"/);
  assert.match(js, /function scanCurrentChatForLoops\(/);
  assert.match(js, /function renderOpenLoops\(/);
});


test("commerce operator store plan normalizes safely", () => {
  const plan = normalizeShopifyStorePlan({
    brand:{name:"Spiffy Lab",tagline:"Better rituals"},
    products:[{title:"Serum One",price:39.99,tags:["serum"]}],
    collections:[{title:"Best Sellers",product_titles:["Serum One"]}],
    pages:[{title:"About",body_html:"<p>Hello</p>"}]
  });
  assert.equal(plan.brand.name, "Spiffy Lab");
  assert.equal(plan.products.length, 1);
  assert.equal(plan.products[0].handle, "serum-one");
  assert.equal(plan.collections[0].handle, "best-sellers");
});

test("commerce operator renders a real preview file", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const plan = normalizeShopifyStorePlan({
    id:"test-store-preview",
    brand:{name:"Spiffy Lab",tagline:"Better rituals"},
    hero:{headline:"Premium made simple"},
    products:[{title:"Serum One",price:39.99}]
  });
  const url = renderStorePreview(plan);
  assert.match(url, /\/generated\/store-previews\/test-store-preview\/index\.html$/);
  const file = path.join(__dirname,"..","public",url.replace(/^\//,""));
  assert.equal(fs.existsSync(file), true);
  const html = fs.readFileSync(file,"utf8");
  assert.match(html,/Spiffy Lab/);
  assert.match(html,/Serum One/);
});

test("commerce operator UI exists", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const server = fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  assert.match(html,/Build Shopify store/);
  assert.match(server,/name:"create_store_concept"/);
  assert.match(server,/name:"shopify_apply_store_draft"/);
  assert.match(server,/SHOPIFY_THEME_WRITE_ENABLED/);
});


test("store health finds operational ecommerce issues", () => {
  const products=[{
    id:1,title:"Serum",body_html:"short",images:[],product_type:"",
    variants:[{price:"0",inventory_quantity:0,inventory_management:"shopify"}]
  }];
  const orders=[{
    id:1,created_at:new Date().toISOString(),total_price:"100.00",
    financial_status:"paid",fulfillment_status:"unfulfilled",refunds:[]
  }];
  const health=calculateStoreHealth(products,orders,30);
  assert.equal(health.metrics.orders,1);
  assert.equal(health.metrics.gross_order_value,100);
  assert.ok(health.issues.some(x=>x.type==="out_of_stock"));
  assert.ok(health.issues.some(x=>x.type==="missing_image"));
  assert.ok(health.issues.some(x=>x.type==="missing_price"));
  assert.ok(health.health_score<100);
});

test("store experiments normalize lifecycle state", () => {
  const exp=normalizeStoreExperiment({
    name:"Hero headline",
    hypothesis:"Clearer value proposition improves add-to-cart intent",
    target:"homepage hero",
    primary_metric:"add to cart rate",
    variant_a:"Current headline",
    variant_b:"Outcome-focused headline",
    status:"ready"
  });
  assert.equal(exp.name,"Hero headline");
  assert.equal(exp.status,"ready");
  assert.equal(exp.primary_metric,"add to cart rate");
  assert.ok(exp.id);
});

test("commerce autopilot UI and tools are present", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  assert.match(html,/id="storeOperatorPanel"/);
  assert.match(html,/Run my store/);
  assert.match(js,/function renderStoreHealth\(/);
  assert.match(server,/name:"shopify_store_health"/);
  assert.match(server,/name:"create_store_experiment"/);
  assert.match(server,/name:"storefront_audit"/);
});


test("commerce funnel calculates directional blended economics", () => {
  const funnel=calculateCommerceFunnel({
    days:30,
    storeHealth:{metrics:{gross_order_value:3000,orders:20}},
    abandoned:{metrics:{unresolved:4,unresolved_value:600,observed_recovery_rate:20}},
    meta:{metrics:{spend:500}},
    google:{metrics:{spend:250}}
  });
  assert.equal(funnel.metrics.ad_spend,750);
  assert.equal(funnel.metrics.blended_roas,4);
  assert.equal(funnel.metrics.unresolved_checkouts,4);
  assert.equal(funnel.metrics.abandoned_checkout_value,600);
  assert.match(funnel.attribution_note,/directional/i);
});

test("growth intelligence connectors and UI are present", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  assert.match(server,/name:"shopify_abandoned_checkouts"/);
  assert.match(server,/name:"meta_ads_insights"/);
  assert.match(server,/name:"google_ads_insights"/);
  assert.match(server,/name:"commerce_funnel_health"/);
  assert.match(server,/META_GRAPH_VERSION \|\| "v26\.0"/);
  assert.match(server,/GOOGLE_ADS_API_VERSION \|\| "v25"/);
  assert.match(html,/id="growthBlendedRoas"/);
  assert.match(html,/id="metaAdsConnectorStatus"/);
  assert.match(html,/id="googleAdsConnectorStatus"/);
  assert.match(js,/function renderCommerceFunnel\(/);
});


test("Kairoq product identity is visible", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  assert.match(html,/<title>Kairoq<\/title>/);
  assert.match(html,/What needs to happen\?/);
  assert.match(html,/✓ Outcomes/);
  assert.match(html,/◴ History/);
  assert.match(html,/⌁ Connections/);
  assert.match(html,/◷ Watchers/);
  assert.match(html,/⬡ How We Work/);
  assert.match(js,/"name": "Kairoq"/);
  assert.match(server,/SITE_NAME = process\.env\.SITE_NAME \|\| "Kairoq"/);
});

test("simple Kairoq mode hides manual AI machinery", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const css=fs.readFileSync(path.join(__dirname,"..","public","styles.css"),"utf8");
  assert.match(css,/\.simple-mode \.model-inline/);
  assert.match(css,/\.simple-mode #agentQuickBtn/);
  assert.match(css,/Kairoq handles models, specialists and routing automatically/);
});


test("autonomous browser operator tools are present", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  assert.match(server,/name:"browser_research_task"/);
  assert.match(server,/name:"browser_action_task"/);
  assert.match(server,/browser_research_task:"auto"/);
  assert.match(server,/browser_action_task:"approve"/);
  assert.match(server,/allowed domains/i);
  assert.match(server,/Sensitive credential/i);
  assert.match(html,/Do it on the web/);
});

test("browser action remains approval gated", () => {
  const {DEFAULT_TOOL_PERMISSIONS}=require("../server.js");
  assert.equal(DEFAULT_TOOL_PERMISSIONS.browser_research_task,"auto");
  assert.equal(DEFAULT_TOOL_PERMISSIONS.browser_action_task,"approve");
});


test("smooth streaming respects reader scroll intent", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  assert.match(js,/function createSmoothTextRenderer\(/);
  assert.match(js,/userPausedAutoScroll/);
  assert.match(js,/if\(e\.deltaY<0\)setAutoFollow\(false\)/);
  assert.match(html,/id="jumpLatestBtn"/);
  assert.match(html,/id="responsePace"/);
});

test("main stream no longer forces scrollTop for every token", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  assert.match(js,/smoothRenderer\.push\(token\)/);
  assert.doesNotMatch(js,/if\(event==="token"\)\{text\+=data\.text\|\|"";contentEl\.innerHTML=renderMarkdown\(text\);bindCodeButtons\(contentEl\);messagesEl\.scrollTop=messagesEl\.scrollHeight\}/);
});


test("creative engine provider order prefers local routes", () => { const {mediaProviderOrderForBudget}=require("../server.js"); const free=mediaProviderOrderForBudget("free"); assert.equal(free[0],"localsd"); assert.equal(free[1],"wan2gp"); assert.ok(free.includes("selfhost")); assert.ok(!free.includes("higgsfield")); });

test("persistent media jobs normalize durable state", () => { const {normalizeMediaJob}=require("../server.js"); const job=normalizeMediaJob({kind:"video",prompt:"make a shoe ad",status:"running",budget_mode:"free"}); assert.equal(job.kind,"video"); assert.equal(job.status,"running"); assert.equal(job.budget_mode,"free"); assert.ok(job.id); assert.ok(job.updated_at); });

test("creative engine routes and job API are present", () => { const fs=require("node:fs"),path=require("node:path"); const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8"),env=fs.readFileSync(path.join(__dirname,"..",".env.example"),"utf8"),html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8"); assert.match(server,/function generateImageLocalSd\(/); assert.match(server,/function generateImageWan2gp\(/); assert.match(server,/function generateVideoWan2gp\(/); assert.match(server,/MEDIA_JOBS_FILE/); assert.match(server,/name:"create_media_job"/); assert.match(server,/url === "\/api\/media\/jobs"/); assert.match(env,/LOCAL_SDCPP_BINARY=/); assert.match(env,/WAN2GP_BASE_URL=/); assert.match(html,/Create for me/); });


test("Work Studio tools and UI are present", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  assert.match(server,/name:"create_excel_workbook"/);
  assert.match(server,/name:"create_word_document"/);
  assert.match(server,/name:"create_powerpoint"/);
  assert.match(server,/name:"create_pdf_report"/);
  assert.match(server,/name:"create_csv_file"/);
  assert.match(server,/url === "\/api\/work-products"/);
  assert.match(html,/WORK STUDIO/);
  assert.match(html,/Create a file/);
});

test("Work Studio generates real file signatures", () => {
  const fs=require("node:fs");
  const {
    createXlsxWorkProduct,createDocxWorkProduct,createPptxWorkProduct,
    createPdfWorkProduct,createCsvWorkProduct
  }=require("../server.js");
  const files=[
    createXlsxWorkProduct({title:"Test Workbook",filename:"test-v14.xlsx",sheets:[{name:"Data",headers:["A","B"],rows:[[1,2],[3,4]],formulas:[{cell:"C4",formula:"=A4+B4"}]}]}),
    createDocxWorkProduct({title:"Test Document",filename:"test-v14.docx",sections:[{heading:"Summary",paragraphs:["Hello"]}]}),
    createPptxWorkProduct({title:"Test Deck",filename:"test-v14.pptx",slides:[{title:"Slide One",bullets:["One","Two"]}]}),
    createPdfWorkProduct({title:"Test PDF",filename:"test-v14.pdf",sections:[{heading:"Summary",paragraphs:["Hello"]}]}),
    createCsvWorkProduct({title:"Test CSV",filename:"test-v14.csv",headers:["A","B"],rows:[[1,2]]})
  ];
  for(const r of files){
    const p=require("node:path").join(__dirname,"..","public",decodeURIComponent(r.work_product.url));
    assert.ok(fs.existsSync(p));
    const b=fs.readFileSync(p);
    if(/xlsx|docx|pptx/.test(r.work_product.kind))assert.equal(b.slice(0,2).toString(),"PK");
    if(r.work_product.kind==="pdf")assert.equal(b.slice(0,5).toString(),"%PDF-");
  }
});


test("Microsoft 365 connector scopes are least-privilege by feature", () => {
  const {microsoftScopes}=require("../server.js");
  const scopes=microsoftScopes();
  assert.ok(scopes.includes("offline_access"));
  assert.ok(scopes.includes("User.Read"));
  assert.ok(scopes.includes("Files.ReadWrite"));
  assert.ok(scopes.includes("Mail.Read"));
  assert.ok(scopes.includes("Mail.Send"));
  assert.ok(scopes.includes("Calendars.ReadWrite"));
  assert.ok(!scopes.includes("Sites.ReadWrite.All"));
  assert.ok(!scopes.includes("ChannelMessage.Send"));
});

test("Microsoft 365 connector and tools are present", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const env=fs.readFileSync(path.join(__dirname,"..",".env.example"),"utf8");
  assert.match(server,/handleMicrosoftConnect/);
  assert.match(server,/handleMicrosoftCallback/);
  assert.match(server,/name:"microsoft_onedrive_upload_work_product"/);
  assert.match(server,/name:"microsoft_excel_update_range"/);
  assert.match(server,/name:"microsoft_outlook_send"/);
  assert.match(server,/name:"microsoft_calendar_create"/);
  assert.match(server,/name:"microsoft_teams_send"/);
  assert.match(server,/name:"microsoft_sharepoint_upload_work_product"/);
  assert.match(html,/Microsoft 365/);
  assert.match(html,/id="connectMicrosoft"/);
  assert.match(env,/MICROSOFT_CLIENT_ID=/);
});

test("Microsoft consequential writes require approval", () => {
  const {DEFAULT_TOOL_PERMISSIONS}=require("../server.js");
  for(const tool of [
    "microsoft_onedrive_upload_work_product",
    "microsoft_excel_update_range",
    "microsoft_outlook_send",
    "microsoft_calendar_create",
    "microsoft_teams_send",
    "microsoft_sharepoint_upload_work_product"
  ]) assert.equal(DEFAULT_TOOL_PERMISSIONS[tool],"approve");
  assert.equal(DEFAULT_TOOL_PERMISSIONS.microsoft_onedrive_list,"auto");
  assert.equal(DEFAULT_TOOL_PERMISSIONS.microsoft_outlook_read,"auto");
});


test("rich markdown renderer supports tables and structured chat", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  const css=fs.readFileSync(path.join(__dirname,"..","public","styles.css"),"utf8");
  assert.match(js,/function renderMarkdown\(markdown=""/);
  assert.match(js,/md-table-wrap/);
  assert.match(js,/isTableSeparator/);
  assert.match(js,/md-code-wrap/);
  assert.match(js,/replace\(\/\\\\\\\|\//);
  assert.match(css,/\.md-table-wrap/);
  assert.match(css,/\.message-content blockquote/);
});

test("chat renderer no longer relies on raw pipe-table text", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  assert.match(js,/<table class="md-table">/);
  assert.match(js,/<thead><tr>/);
  assert.match(js,/<tbody>/);
});


test("zero cost mode defaults to local-first and paid locked", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  const env=fs.readFileSync(path.join(__dirname,"..",".env.example"),"utf8");
  assert.match(server,/ZERO_COST_MODE/);
  assert.match(server,/PAID_LLM_ENABLED/);
  assert.match(server,/LOCAL_LLM_BASE_URL/);
  assert.match(server,/streamLocalLlm/);
  assert.match(server,/model:"openrouter\/free"/);
  assert.match(env,/ZERO_COST_MODE=true/);
  assert.match(env,/PAID_LLM_ENABLED=false/);
  assert.match(env,/OPENROUTER_WEB_SEARCH_ENABLED=false/);
});

test("free fallbacks never send local model IDs to OpenRouter", () => {
  const {freeFallbacks}=require("../server.js");
  const models=[
    {id:"local/qwen",isFree:true,context_length:999999},
    {id:"openrouter/free",isFree:true,context_length:200000},
    {id:"vendor/free-a",isFree:true,context_length:100000},
    {id:"vendor/free-b",isFree:true,context_length:50000}
  ];
  assert.deepEqual(freeFallbacks(models,"",3),["vendor/free-a","vendor/free-b"]);
});

test("zero cost UI exposes local AI status", () => {
  const fs=require("node:fs");
  const path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  assert.match(html,/LOCAL \+ FREE/);
  assert.match(html,/id="localAiConnectorStatus"/);
  assert.match(js,/AI: Local · \$0/);
});


test("Listing-to-Sales Engine UI and API are present",()=>{
  const fs=require("node:fs");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  assert.match(html,/Listing → Sales Engine/);
  assert.match(html,/Make Sales Ready/);
  assert.match(server,/\/api\/listings\/import-url/);
  assert.match(server,/generateListingSalesPack/);
  assert.match(server,/Never invent amenities/);
});


test('Listings Pro exposes three primary workflows and branded proposal routes', () => {
  const fs = require('node:fs');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const serverText = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(html, /Make Sales Ready/);
  assert.match(html, /Create Property Video/);
  assert.match(html, /Create Client Proposal/);
  assert.match(html, /PlanURstay sales workflow/);
  assert.match(js, /\/api\/listings\/make-sales-ready/);
  assert.match(js, /\/api\/listings\/property-video/);
  assert.match(js, /\/api\/listings\/client-proposal/);
  assert.match(serverText, /const LISTING_BRAND =/);
  assert.match(serverText, /Use the supplied real property image as the factual source/);
});


test("Pursuit Agent scores corporate-housing demand signals", () => {
  const { pursuitScore } = require("../server.js");
  const hot=pursuitScore("Construction contract awarded in Toronto; company hiring 120 workers for project mobilization");
  const weak=pursuitScore("Company publishes annual picnic photos");
  assert.ok(hot.score > weak.score);
  assert.ok(hot.score >= 70);
});

test("Pursuit Agent UI and API routes are present", () => {
  const fs=require("node:fs");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  assert.match(html,/Pursuit Agent/);
  assert.match(html,/Discover opportunities/);
  assert.match(server,/\/api\/pursuit\/discover/);
  assert.match(server,/\/api\/pursuit\/brief/);
  assert.match(server,/public news signals/i);
});


test("ArrivalBrief normalizes verified arrival facts and renders a private guide", () => {
  const item=normalizeArrivalBrief({guest_name:"Jennifer",property_name:"Test Suite",parking:"P2-184",access:"Lockbox 3",wifi:"GuestNet",language:"French"});
  const facts=arrivalFacts(item);
  assert.ok(facts.some(x=>x.title==="Parking"&&x.body==="P2-184"));
  const html=renderArrivalBriefHtml({...item,guide:{welcome:"Bienvenue Jennifer",steps:facts,closing:"Call support"}});
  assert.match(html,/noindex,nofollow,noarchive/);
  assert.match(html,/P2-184/);
  assert.match(html,/I'm settled in/);
});

test("ArrivalBrief UI is present and keeps Higgsfield welcome generation separate", () => {
  const fs=require("node:fs"),path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  assert.match(html,/data-studio-tab="arrival"/);
  assert.match(html,/id="arrivalGenerateBtn"/);
  assert.match(html,/id="arrivalVideoBtn"/);
  assert.match(js,/billable Higgsfield Seedance 2\.5 request/);
});

test("Interactive Tour Builder exposes four independent outputs", () => {
  const fs=require("node:fs"),path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  assert.match(html,/data-studio-tab="tours"/);
  assert.match(html,/Create Interactive Tour/);
  assert.match(html,/Walkthrough Video/);
  assert.match(html,/Vertical Reel/);
  assert.match(html,/Enhanced Gallery/);
  assert.match(js,/\/api\/tours\/interactive/);
  assert.match(server,/This tour does not reconstruct or invent room geometry/);
});

test("Tour Builder ships a real-photo sample tour and pre-rendered outputs", () => {
  const fs=require("node:fs"),path=require("node:path");
  const root=path.join(__dirname,"..");
  assert.ok(fs.existsSync(path.join(root,"public","sample-tour","living-1.jpeg")));
  assert.ok(fs.existsSync(path.join(root,"public","generated","tours","sample-planurstay-tour","index.html")));
  assert.ok(fs.existsSync(path.join(root,"public","generated","tours","sample-planurstay-tour","walkthrough.mp4")));
  assert.ok(fs.existsSync(path.join(root,"public","generated","tours","sample-planurstay-tour","reel.mp4")));
});


test("Premium Tour Builder wires Higgsfield room motion and reusable exports", () => {
  const fs = require("node:fs");
  const root = path.join(__dirname,"..");
  const server = fs.readFileSync(path.join(root,"server.js"),"utf8");
  const html = fs.readFileSync(path.join(root,"public","index.html"),"utf8");
  const js = fs.readFileSync(path.join(root,"public","app.js"),"utf8");
  assert.match(server,/bytedance\/seedance-2\.5\/image-to-video/);
  assert.match(server,/@higgsfield\/client\/v2/);
  assert.match(server,/do not add, remove, redesign, widen, restage, furnish, declutter/i);
  assert.match(server,/\/api\/tours\/premium\/generate/);
  assert.match(server,/\/api\/tours\/premium\/rebuild/);
  assert.match(html,/Generate Premium AI Tour/);
  assert.match(js,/Premium Walkthrough/);
  assert.match(js,/Premium Reel/);
});


test("Tour Builder can use local Wan2GP motion as a zero-API-cost engine", () => {
  const fs = require("node:fs");
  const root = path.join(__dirname,"..");
  const server = fs.readFileSync(path.join(root,"server.js"),"utf8");
  const html = fs.readFileSync(path.join(root,"public","index.html"),"utf8");
  const js = fs.readFileSync(path.join(root,"public","app.js"),"utf8");
  assert.match(server,/WAN2GP_TOUR_IMAGE_TO_VIDEO_MODEL/);
  assert.match(server,/engine===\"wan2gp\"/);
  assert.match(html,/Local Wan · free \/ draft/);
  assert.match(js,/Local Wan on this Mac/);
});

test("v16 Sales and Marketing outcome-agent surfaces are present", () => {
  const fs=require("node:fs"),path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
  const js=fs.readFileSync(path.join(__dirname,"..","public","app.js"),"utf8");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  assert.match(html,/data-studio-tab="salesAgent"/);
  assert.match(html,/data-studio-tab="marketingAgent"/);
  assert.match(html,/id="salesRunBtn"/);
  assert.match(html,/id="marketingGenerateBtn"/);
  assert.match(js,/function renderSalesAgent\(/);
  assert.match(js,/function renderMarketingAgent\(/);
  assert.match(server,/\/api\/agents\/sales\/run/);
  assert.match(server,/\/api\/agents\/marketing\/publish/);
});

test("v16 external sales and marketing writes are approval-gated", () => {
  const {DEFAULT_TOOL_PERMISSIONS,toolNeedsApproval}=require("../server.js");
  assert.equal(DEFAULT_TOOL_PERMISSIONS.sales_email_send,"approve");
  assert.equal(DEFAULT_TOOL_PERMISSIONS.marketing_post_publish,"approve");
  assert.equal(toolNeedsApproval("sales_email_send"),true);
  assert.equal(toolNeedsApproval("marketing_post_publish"),true);
});

test("v16 optional integrations are environment-driven and not hard-coded", () => {
  const fs=require("node:fs"),path=require("node:path");
  const env=fs.readFileSync(path.join(__dirname,"..",".env.example"),"utf8");
  const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
  assert.match(env,/OPENENRICH_BIN=/);
  assert.match(env,/POSTIZ_API_KEY=/);
  assert.match(server,/process\.env\.POSTIZ_API_KEY/);
  assert.match(server,/process\.env\.OPENENRICH_BIN/);
});

test("v16 Marketing Agent uploads generated media to Postiz before approved scheduling", () => {
  const fs=require("node:fs"),path=require("node:path");
  const root=path.join(__dirname,"..");
  const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
  const js=fs.readFileSync(path.join(root,"public","app.js"),"utf8");
  assert.match(server,/async function postizUploadBuffer/);
  assert.match(server,/\/upload`/);
  assert.match(server,/uploadMarketingMediaToPostiz/);
  assert.match(server,/media_attached/);
  assert.match(server,/did not schedule a text-only fallback/);
  assert.match(server,/post_type='post'/);
  assert.match(js,/generated image\/video is uploaded with the approved post/);
});
