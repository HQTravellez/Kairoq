const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { execFile } = require("child_process");

loadEnv();

const PORT = Number(process.env.PORT || 3002);
const SITE_NAME = process.env.SITE_NAME || "Kairoq";
const PUBLIC_DIR = path.join(__dirname, "public");
const OR_CHAT = "https://openrouter.ai/api/v1/chat/completions";
const OR_MODELS = "https://openrouter.ai/api/v1/models";
const OR_KEY = "https://openrouter.ai/api/v1/key";
const ZERO_COST_MODE = String(process.env.ZERO_COST_MODE || "true").toLowerCase() !== "false";
const PAID_LLM_ENABLED = String(process.env.PAID_LLM_ENABLED || "false").toLowerCase() === "true";
const OPENROUTER_FREE_FALLBACK_ENABLED = String(process.env.OPENROUTER_FREE_FALLBACK_ENABLED || "true").toLowerCase() !== "false";
const OPENROUTER_WEB_SEARCH_ENABLED = String(process.env.OPENROUTER_WEB_SEARCH_ENABLED || "false").toLowerCase() === "true";
const LOCAL_LLM_BASE_URL = String(process.env.LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1").replace(/\/$/,"");
const LOCAL_LLM_MODEL = String(process.env.LOCAL_LLM_MODEL || "").trim();
const LOCAL_LLM_TOOL_MODEL = String(process.env.LOCAL_LLM_TOOL_MODEL || LOCAL_LLM_MODEL || "").trim();
const LOCAL_LLM_API_KEY = String(process.env.LOCAL_LLM_API_KEY || "").trim();
const LOCAL_LLM_TIMEOUT_MS = Math.max(5000,Math.min(1800000,Number(process.env.LOCAL_LLM_TIMEOUT_MS || 300000)));

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const MEMORY_OWNER_ID = process.env.MEMORY_OWNER_ID || "personal";
const WORKSPACE_DIR = path.join(__dirname, "workspace");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";
const AGENT_WEBHOOK_URL = process.env.AGENT_WEBHOOK_URL || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/google/callback`;
const NUITEE_API_KEY = process.env.NUITEE_API_KEY || "";
const GOOGLE_TOKEN_FILE = path.join(__dirname, "workspace", ".google-token.json");
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "";
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "";
const MICROSOFT_TENANT = process.env.MICROSOFT_TENANT || "common";
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${PORT}/api/microsoft/callback`;
const MICROSOFT_TOKEN_FILE = path.join(__dirname, "workspace", ".microsoft-token.json");
const MICROSOFT_ENABLE_OUTLOOK = String(process.env.MICROSOFT_ENABLE_OUTLOOK || "true").toLowerCase() !== "false";
const MICROSOFT_ENABLE_TEAMS = String(process.env.MICROSOFT_ENABLE_TEAMS || "false").toLowerCase() === "true";
const MICROSOFT_ENABLE_SHAREPOINT = String(process.env.MICROSOFT_ENABLE_SHAREPOINT || "false").toLowerCase() === "true";
const MICROSOFT_SHAREPOINT_SITE_ID = String(process.env.MICROSOFT_SHAREPOINT_SITE_ID || "").trim();
const MICROSOFT_SHAREPOINT_DRIVE_ID = String(process.env.MICROSOFT_SHAREPOINT_DRIVE_ID || "").trim();
const MICROSOFT_SHAREPOINT_FOLDER = String(process.env.MICROSOFT_SHAREPOINT_FOLDER || "Kairoq").replace(/^\/+|\/+$/g,"");
const MICROSOFT_ONEDRIVE_FOLDER = String(process.env.MICROSOFT_ONEDRIVE_FOLDER || "Kairoq").replace(/^\/+|\/+$/g,"");

const pendingApprovals = new Map();
const JOB_FILE = path.join(__dirname, "workspace", ".agent-jobs.json");
const RUN_FILE = path.join(__dirname, "workspace", ".agent-runs.json");
const AUDIT_FILE = path.join(__dirname, "workspace", ".audit-log.jsonl");
const PERMISSIONS_FILE = path.join(__dirname, "workspace", ".tool-permissions.json");
const USAGE_FILE = path.join(__dirname, "workspace", ".usage-ledger.jsonl");
const DEAD_LETTER_FILE = path.join(__dirname, "workspace", ".dead-letter.json");
const PLAYBOOK_FILE = path.join(__dirname, "workspace", ".company-playbook.json");
const PRODUCT_STATE_FILE = path.join(__dirname, "workspace", ".product-state.json");
const OPEN_LOOPS_FILE = path.join(__dirname, "workspace", ".open-loops.json");
const STORE_EXPERIMENTS_FILE = path.join(__dirname, "workspace", ".store-experiments.json");
const MEDIA_JOBS_FILE = path.join(__dirname, "workspace", ".media-jobs.json");
const WORK_PRODUCTS_FILE = path.join(__dirname, "workspace", ".work-products.json");
const WORK_PRODUCTS_DIR = path.join(__dirname, "public", "generated", "work-products");
fs.mkdirSync(WORK_PRODUCTS_DIR, { recursive: true });
const STUDIO_AVATARS_FILE = path.join(__dirname, "workspace", ".studio-avatars.json");
const STUDIO_PROJECTS_FILE = path.join(__dirname, "workspace", ".studio-projects.json");
const STUDIO_LIBRARY_FILE = path.join(__dirname, "workspace", ".studio-library.json");
const STUDIO_HISTORY_FILE = path.join(__dirname, "workspace", ".studio-history.json");
const LISTINGS_FILE = path.join(__dirname, "workspace", ".listing-sales-engine.json");
const PURSUITS_FILE = path.join(__dirname, "workspace", ".pursuit-agent.json");
const ARRIVALBRIEFS_FILE = path.join(__dirname, "workspace", ".arrivalbrief.json");
const ARRIVALBRIEFS_DIR = path.join(__dirname, "public", "generated", "arrivalbrief");
fs.mkdirSync(ARRIVALBRIEFS_DIR, { recursive: true });
const LISTINGS_DIR = path.join(__dirname, "public", "generated", "listings");
fs.mkdirSync(LISTINGS_DIR, { recursive: true });
const LISTING_BRAND = {
  name: process.env.LISTING_BRAND_NAME || "PlanURstay",
  website: process.env.LISTING_BRAND_WEBSITE || "https://planurstay.com",
  phone: process.env.LISTING_BRAND_PHONE || "1-866-343-0689",
  email: process.env.LISTING_BRAND_EMAIL || "info@planurstay.com",
  logo_url: process.env.LISTING_BRAND_LOGO_URL || "https://planurstay.com/images/logo.png",
  tagline: process.env.LISTING_BRAND_TAGLINE || "Move-in ready homes. One rate. Nothing to arrange.",
  standards: [
    "Fully furnished with kitchenware",
    "Utilities and high-speed internet included",
    "Flexible monthly terms",
    "Dedicated account manager and 24/7 support"
  ]
};
const APP_ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY || "";
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const SHOPIFY_STORE_DOMAIN = (process.env.SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || "";
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const SHOPIFY_THEME_WRITE_ENABLED = String(process.env.SHOPIFY_THEME_WRITE_ENABLED || "").toLowerCase() === "true";
const META_ADS_ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN || "";
const META_AD_ACCOUNT_ID = String(process.env.META_AD_ACCOUNT_ID || "").replace(/^act_/,"").trim();
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";
const GOOGLE_ADS_CUSTOMER_ID = String(process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g,"").trim();
const GOOGLE_ADS_LOGIN_CUSTOMER_ID = String(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g,"").trim();
const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v25";
const BROWSERLESS_URL = (process.env.BROWSERLESS_URL || "https://production-sfo.browserless.io").replace(/\/$/, "");
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || "";
const NOTIFY_WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const TELEGRAM_ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID || "";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM || "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "";
const TWILIO_ALLOWED_FROM = String(process.env.TWILIO_ALLOWED_FROM || "").split(/[;,]/).map(x=>x.trim()).filter(Boolean);
const HIGGSFIELD_CREDENTIALS = process.env.HF_CREDENTIALS || process.env.HIGGSFIELD_CREDENTIALS || (process.env.HIGGSFIELD_API_KEY_ID && process.env.HIGGSFIELD_API_KEY_SECRET ? `${process.env.HIGGSFIELD_API_KEY_ID}:${process.env.HIGGSFIELD_API_KEY_SECRET}` : "");
const HIGGSFIELD_IMAGE_MODEL = process.env.HIGGSFIELD_IMAGE_MODEL || "alibaba/qwen-image-3/text-to-image";
const HIGGSFIELD_VIDEO_MODEL = process.env.HIGGSFIELD_VIDEO_MODEL || "bytedance/seedance-2.5/text-to-video";
const HIGGSFIELD_IMAGE_TO_VIDEO_MODEL = process.env.HIGGSFIELD_IMAGE_TO_VIDEO_MODEL || "bytedance/seedance-2.5/image-to-video";
const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || "";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "fal-ai/flux/dev"; // legacy fal fallback
const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || "bytedance-seed/seedream-4.5";
const OPENROUTER_IMAGE_EDIT_MODEL = process.env.OPENROUTER_IMAGE_EDIT_MODEL || "google/gemini-3.1-flash-image";
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || process.env.POLLINATIONS_KEY || "";
const POLLINATIONS_IMAGE_MODEL = process.env.POLLINATIONS_IMAGE_MODEL || "black-forest-labs/flux.1-schnell";
const POLLINATIONS_VIDEO_MODEL = process.env.POLLINATIONS_VIDEO_MODEL || "bytedance/seedance-2.0-fast";
const SELF_HOST_MEDIA_BASE_URL = String(process.env.SELF_HOST_MEDIA_BASE_URL || "").replace(/\/$/,"");
const SELF_HOST_MEDIA_API_KEY = process.env.SELF_HOST_MEDIA_API_KEY || "";
const LOCAL_SDCPP_ENABLED = String(process.env.LOCAL_SDCPP_ENABLED || "").toLowerCase() === "true";
const LOCAL_SDCPP_BINARY = String(process.env.LOCAL_SDCPP_BINARY || "").trim();
const LOCAL_SDCPP_MODEL_PATH = String(process.env.LOCAL_SDCPP_MODEL_PATH || "").trim();
const LOCAL_SDCPP_MODEL_NAME = String(process.env.LOCAL_SDCPP_MODEL_NAME || "Local SD").trim();
const LOCAL_SDCPP_MODEL_TYPE = String(process.env.LOCAL_SDCPP_MODEL_TYPE || "sd1").trim().toLowerCase();
const LOCAL_SDCPP_STEPS = Math.max(1, Math.min(100, Number(process.env.LOCAL_SDCPP_STEPS || 20)));
const LOCAL_SDCPP_CFG = Math.max(0, Math.min(30, Number(process.env.LOCAL_SDCPP_CFG || 7)));
const LOCAL_SDCPP_SAMPLER = String(process.env.LOCAL_SDCPP_SAMPLER || "euler_a").trim();
const WAN2GP_BASE_URL = String(process.env.WAN2GP_BASE_URL || "").replace(/\/$/,"");
const WAN2GP_IMAGE_MODEL = String(process.env.WAN2GP_IMAGE_MODEL || "qwen_image").trim();
const WAN2GP_VIDEO_MODEL = String(process.env.WAN2GP_VIDEO_MODEL || "wan22_t2v").trim();
const WAN2GP_IMAGE_TO_VIDEO_MODEL = String(process.env.WAN2GP_IMAGE_TO_VIDEO_MODEL || "wan22_i2v").trim();
const QWEN_IMAGE_MODEL = process.env.QWEN_IMAGE_MODEL || "Qwen/Qwen-Image";
const QWEN_IMAGE_EDIT_MODEL = process.env.QWEN_IMAGE_EDIT_MODEL || "Qwen/Qwen-Image-Edit";
const WAN_VIDEO_MODEL = process.env.WAN_VIDEO_MODEL || "Wan-AI/Wan2.2-T2V";
const WAN_IMAGE_TO_VIDEO_MODEL = process.env.WAN_IMAGE_TO_VIDEO_MODEL || "Wan-AI/Wan2.2-I2V";
const MEDIA_PROVIDER_ORDER = String(process.env.MEDIA_PROVIDER_ORDER || "localsd,wan2gp,selfhost,pollinations,higgsfield,openrouter,fal")
  .split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
const GENERATED_MEDIA_DIR = path.join(PUBLIC_DIR, "generated");
const STORE_PREVIEW_DIR = path.join(GENERATED_MEDIA_DIR, "store-previews");
const STORE_BUILDS_DIR = path.join(WORKSPACE_DIR, "store-builds");
const DAILY_COST_LIMIT_USD = Number(process.env.DAILY_COST_LIMIT_USD || 5);
const MONTHLY_COST_LIMIT_USD = Number(process.env.MONTHLY_COST_LIMIT_USD || 50);
const REQUESTS_PER_MINUTE = Number(process.env.REQUESTS_PER_MINUTE || 30);
const MAX_AGENT_TOOL_LOOPS = Math.max(2, Math.min(20, Number(process.env.MAX_AGENT_TOOL_LOOPS || 8)));
const MAX_DELEGATIONS = Math.max(0, Math.min(5, Number(process.env.MAX_DELEGATIONS || 2)));
let schedulerBusy = false;
const rateBuckets = new Map();
fs.mkdirSync(GENERATED_MEDIA_DIR, { recursive: true });
fs.mkdirSync(STORE_PREVIEW_DIR, { recursive: true });
fs.mkdirSync(STORE_BUILDS_DIR, { recursive: true });

let modelCache = { fetchedAt: 0, models: [] };
const MODEL_CACHE_MS = 5 * 60 * 1000;
const SESSION_COOKIE = "private_ai_session";

function loadEnv() {
  // Local secrets take precedence over .env. Neither file should be committed.
  for (const filename of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, filename);
    if (!fs.existsSync(envPath)) continue;
    const text = fs.readFileSync(envPath, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}


function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function fetchWithRetry(url, options = {}, cfg = {}) {
  const retries = Math.max(0, Number(cfg.retries ?? 3));
  const retryStatuses = new Set(cfg.retryStatuses || [408,409,425,429,500,502,503,504]);
  let lastErr = null;
  for (let attempt=0; attempt<=retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!retryStatuses.has(response.status) || attempt===retries) return response;
      const ra=Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(ra)?ra*1000:Math.min(10000,400*(2**attempt)+Math.floor(Math.random()*250)));
    } catch(err) {
      lastErr=err; if(attempt===retries) throw err;
      await sleep(Math.min(10000,400*(2**attempt)+Math.floor(Math.random()*250)));
    }
  }
  if(lastErr) throw lastErr; throw new Error("Request failed after retries.");
}
function encryptionKey(){ return APP_ENCRYPTION_KEY?crypto.createHash("sha256").update(APP_ENCRYPTION_KEY).digest():null; }
function encryptJson(value){
  const key=encryptionKey(); if(!key) return {__plaintext:true,value};
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  const data=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value),"utf8")),cipher.final()]);
  return {__encrypted:true,alg:"aes-256-gcm",iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:data.toString("base64")};
}
function decryptJson(record){
  if(!record)return null; if(record.__plaintext)return record.value; if(!record.__encrypted)return record;
  const key=encryptionKey(); if(!key)throw new Error("APP_ENCRYPTION_KEY is required to decrypt stored connector credentials.");
  const d=crypto.createDecipheriv("aes-256-gcm",key,Buffer.from(record.iv,"base64")); d.setAuthTag(Buffer.from(record.tag,"base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(record.data,"base64")),d.final()]).toString("utf8"));
}
function sanitizeAuditData(data){
  const S=/token|secret|password|authorization|api.?key|cookie|credential/i;
  function c(v,k=""){ if(S.test(k))return "[REDACTED]"; if(typeof v==="string"){if(/^(sk-|ghp_|github_pat_|xox[baprs]-)/i.test(v))return "[REDACTED]";return v.length>5000?v.slice(0,5000)+"…[truncated]":v} if(Array.isArray(v))return v.slice(0,50).map(x=>c(x)); if(v&&typeof v==="object"){const o={};for(const [a,b] of Object.entries(v))o[a]=c(b,a);return o} return v}
  return c(data);
}
async function audit(type,data={}){
  const event={id:crypto.randomUUID(),type,at:new Date().toISOString(),data:sanitizeAuditData(data)};
  try{fs.appendFileSync(AUDIT_FILE,JSON.stringify(event)+"\\n","utf8")}catch{}
  if(cloudConfigured()){try{await fetchWithRetry(`${SUPABASE_URL}/rest/v1/ai_audit_log`,{method:"POST",headers:supabaseHeaders(),body:JSON.stringify({id:event.id,owner_id:MEMORY_OWNER_ID,event,created_at:event.at})},{retries:2})}catch{}}
  return event;
}
function readLocalJsonLines(file,limit=500){try{if(!fs.existsSync(file))return[];return fs.readFileSync(file,"utf8").trim().split(/\\n+/).filter(Boolean).slice(-limit).reverse().map(JSON.parse)}catch{return[]}}
async function getAuditEvents(limit=200){
  if(cloudConfigured()){try{const u=`${SUPABASE_URL}/rest/v1/ai_audit_log?owner_id=eq.${encodeURIComponent(MEMORY_OWNER_ID)}&select=event&order=created_at.desc&limit=${Math.min(500,limit)}`;const r=await fetchWithRetry(u,{headers:supabaseHeaders()},{retries:2});const d=await r.json().catch(()=>[]);if(r.ok)return(d||[]).map(x=>x.event).filter(Boolean)}catch{}}
  return readLocalJsonLines(AUDIT_FILE,limit);
}
const DEFAULT_TOOL_PERMISSIONS={list_workspace_files:"auto",read_workspace_file:"auto",write_workspace_file:"approve",github_read_file:"auto",github_create_issue:"approve",gmail_search:"auto",gmail_read:"auto",gmail_send:"approve",calendar_list:"auto",calendar_create:"approve",nuitee_search_hotels:"auto",slack_history:"auto",slack_send:"approve",shopify_list_products:"auto",shopify_list_orders:"auto",create_store_concept:"auto",shopify_apply_store_draft:"approve",shopify_list_themes:"auto",shopify_apply_theme_overlay:"approve",shopify_store_health:"auto",shopify_abandoned_checkouts:"auto",meta_ads_insights:"auto",google_ads_insights:"auto",commerce_funnel_health:"auto",create_store_experiment:"auto",list_store_experiments:"auto",update_store_experiment:"auto",browser_render:"auto",storefront_audit:"auto",browser_research_task:"auto",browser_action_task:"approve",browser_agent_task:"approve",send_webhook:"approve",message_send:"approve",list_open_loops:"auto",create_open_loop:"auto",update_open_loop:"auto",create_media_job:"auto",list_media_jobs:"auto",create_excel_workbook:"auto",create_word_document:"auto",create_powerpoint:"auto",create_pdf_report:"auto",create_csv_file:"auto",list_work_products:"auto",
microsoft_onedrive_list:"auto",microsoft_onedrive_upload_work_product:"approve",microsoft_excel_read_range:"auto",microsoft_excel_update_range:"approve",
microsoft_outlook_search:"auto",microsoft_outlook_read:"auto",microsoft_outlook_send:"approve",microsoft_calendar_list:"auto",microsoft_calendar_create:"approve",
microsoft_teams_list:"auto",microsoft_teams_channels:"auto",microsoft_teams_send:"approve",microsoft_sharepoint_list:"auto",microsoft_sharepoint_upload_work_product:"approve",
delegate_agent:"auto"};
async function loadToolPermissions(){
 if(cloudConfigured()){try{const u=`${SUPABASE_URL}/rest/v1/ai_tool_permissions?owner_id=eq.${encodeURIComponent(MEMORY_OWNER_ID)}&select=permissions`;const r=await fetchWithRetry(u,{headers:supabaseHeaders()},{retries:2});const d=await r.json().catch(()=>[]);if(r.ok&&d?.[0]?.permissions)return{...DEFAULT_TOOL_PERMISSIONS,...d[0].permissions}}catch{}}
 try{if(fs.existsSync(PERMISSIONS_FILE))return{...DEFAULT_TOOL_PERMISSIONS,...JSON.parse(fs.readFileSync(PERMISSIONS_FILE,"utf8"))}}catch{} return{...DEFAULT_TOOL_PERMISSIONS};
}
async function saveToolPermissions(p){const m={...DEFAULT_TOOL_PERMISSIONS,...p};fs.writeFileSync(PERMISSIONS_FILE,JSON.stringify(m,null,2),"utf8");if(cloudConfigured()){const r=await fetchWithRetry(`${SUPABASE_URL}/rest/v1/ai_tool_permissions?on_conflict=owner_id`,{method:"POST",headers:supabaseHeaders({Prefer:"resolution=merge-duplicates,return=minimal"}),body:JSON.stringify({owner_id:MEMORY_OWNER_ID,permissions:m,updated_at:new Date().toISOString()})},{retries:2});if(!r.ok)throw new Error(`Permission save failed (${r.status})`)}await audit("permissions.updated",{permissions:m});return m}
async function toolPermission(name){return(await loadToolPermissions())[name]||"approve"}
function requestRateKey(req){return String(req.headers["x-forwarded-for"]||"").split(",")[0].trim()||req.socket?.remoteAddress||"local"}
function enforceRateLimit(req){if(!(REQUESTS_PER_MINUTE>0))return;const k=requestRateKey(req),now=Date.now(),a=(rateBuckets.get(k)||[]).filter(t=>now-t<60000);if(a.length>=REQUESTS_PER_MINUTE){const e=new Error("Rate limit exceeded. Try again shortly.");e.statusCode=429;throw e}a.push(now);rateBuckets.set(k,a)}
async function recordUsage(usage={},context={}){const cost=Number(usage.cost??usage.total_cost??0),r={id:crypto.randomUUID(),at:new Date().toISOString(),cost:Number.isFinite(cost)?cost:0,prompt_tokens:Number(usage.prompt_tokens||usage.input_tokens||0),completion_tokens:Number(usage.completion_tokens||usage.output_tokens||0),total_tokens:Number(usage.total_tokens||0),context:sanitizeAuditData(context)};try{fs.appendFileSync(USAGE_FILE,JSON.stringify(r)+"\\n","utf8")}catch{};if(cloudConfigured()){try{await fetchWithRetry(`${SUPABASE_URL}/rest/v1/ai_usage_ledger`,{method:"POST",headers:supabaseHeaders(),body:JSON.stringify({id:r.id,owner_id:MEMORY_OWNER_ID,usage:r,created_at:r.at})},{retries:2})}catch{}}return r}
async function usageTotals(){let rs=[];if(cloudConfigured()){try{const d=new Date();d.setUTCDate(1);d.setUTCHours(0,0,0,0);const u=`${SUPABASE_URL}/rest/v1/ai_usage_ledger?owner_id=eq.${encodeURIComponent(MEMORY_OWNER_ID)}&created_at=gte.${encodeURIComponent(d.toISOString())}&select=usage`;const r=await fetchWithRetry(u,{headers:supabaseHeaders()},{retries:2});const x=await r.json().catch(()=>[]);if(r.ok)rs=(x||[]).map(y=>y.usage).filter(Boolean)}catch{}}if(!rs.length)rs=readLocalJsonLines(USAGE_FILE,5000);const n=new Date(),day=n.toISOString().slice(0,10),mon=n.toISOString().slice(0,7);let daily=0,monthly=0;for(const x of rs){const at=String(x.at||""),c=Number(x.cost||0);if(at.startsWith(day))daily+=c;if(at.startsWith(mon))monthly+=c}return{daily,monthly}}
async function enforceBudget(){const t=await usageTotals();if(DAILY_COST_LIMIT_USD>0&&t.daily>=DAILY_COST_LIMIT_USD)throw new Error(`Daily AI cost limit reached ($${DAILY_COST_LIMIT_USD.toFixed(2)}).`);if(MONTHLY_COST_LIMIT_USD>0&&t.monthly>=MONTHLY_COST_LIMIT_USD)throw new Error(`Monthly AI cost limit reached ($${MONTHLY_COST_LIMIT_USD.toFixed(2)}).`);return t}
async function notify(title,message,data={}){await audit("notification.created",{title,message,data});if(!NOTIFY_WEBHOOK_URL)return{delivered:false};try{const r=await fetchWithRetry(NOTIFY_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,message,data,at:new Date().toISOString()})},{retries:3});return{delivered:r.ok,status:r.status}}catch(e){return{delivered:false,error:e.message}}}

function authEnabled() {
  return Boolean(process.env.APP_PASSWORD);
}

function sessionToken() {
  if (!authEnabled()) return "";
  return crypto
    .createHash("sha256")
    .update(`openrouter-private-ai:${process.env.APP_PASSWORD}`)
    .digest("hex");
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  for (const pair of raw.split(";")) {
    const i = pair.indexOf("=");
    if (i < 0) continue;
    out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return out;
}

function isAuthenticated(req) {
  if (!authEnabled()) return true;
  const cookies = parseCookies(req);
  const received = cookies[SESSION_COOKIE] || "";
  const expected = sessionToken();
  if (received.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}


function openRouterConfigured(){
  return Boolean(process.env.OPENROUTER_API_KEY);
}
function localLlmHeaders(extra={}){
  return {
    "Content-Type":"application/json",
    ...(LOCAL_LLM_API_KEY?{Authorization:`Bearer ${LOCAL_LLM_API_KEY}`}:{ }),
    ...extra
  };
}
let localLlmCache={fetchedAt:0,models:[]};
async function getLocalLlmModels(force=false){
  const fresh=Date.now()-localLlmCache.fetchedAt<30_000;
  if(!force&&fresh)return localLlmCache.models;
  try{
    const response=await fetch(`${LOCAL_LLM_BASE_URL}/models`,{
      headers:localLlmHeaders(),
      signal:AbortSignal.timeout(Math.min(5000,LOCAL_LLM_TIMEOUT_MS))
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`Local model endpoint error (${response.status})`);
    const models=(data.data||[]).map(x=>String(x.id||x.name||"").trim()).filter(Boolean);
    localLlmCache={fetchedAt:Date.now(),models};
    return models;
  }catch{
    localLlmCache={fetchedAt:Date.now(),models:[]};
    return [];
  }
}
async function resolveLocalLlmModel({tools=false}={}){
  const explicit=tools?LOCAL_LLM_TOOL_MODEL:LOCAL_LLM_MODEL;
  if(explicit)return explicit;
  const models=await getLocalLlmModels();
  return models[0]||"";
}
async function localLlmAvailable(){
  return Boolean(await resolveLocalLlmModel());
}
function isLocalModelId(id=""){
  return String(id).startsWith("local/");
}
function stripLocalModelId(id=""){
  return String(id).replace(/^local\//,"");
}
async function localChatCompletion({messages,temperature=0.2,tools=null,responseFormat=null,model="",stream=false}={}){
  const resolved=model||await resolveLocalLlmModel({tools:Array.isArray(tools)&&tools.length>0});
  if(!resolved)throw new Error("No local model is available. Start Ollama/llama.cpp or set LOCAL_LLM_MODEL.");
  const payload={
    model:resolved,
    messages,
    temperature,
    stream
  };
  if(Array.isArray(tools)&&tools.length){
    payload.tools=tools;
    payload.tool_choice="auto";
  }
  if(responseFormat)payload.response_format=responseFormat;
  const response=await fetchWithRetry(`${LOCAL_LLM_BASE_URL}/chat/completions`,{
    method:"POST",
    headers:localLlmHeaders(stream?{Accept:"text/event-stream"}:{}),
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(LOCAL_LLM_TIMEOUT_MS)
  },{retries:1});
  if(!response.ok){
    const raw=await response.text().catch(()=>"");
    let message=`Local model error (${response.status})`;
    try{
      const data=JSON.parse(raw);
      message=data?.error?.message||data?.message||data?.error||message;
    }catch{}
    throw new Error(String(message));
  }
  if(stream)return {response,model:resolved};
  const data=await response.json().catch(()=>({}));
  const message=data?.choices?.[0]?.message;
  if(!message)throw new Error("Local model returned no message.");
  return {message,usage:data.usage||null,model:data.model||resolved};
}
async function streamLocalLlm({messages,temperature=0.7,model=""},res){
  const {response,model:resolved}=await localChatCompletion({messages,temperature,model,stream:true});
  if(!response.body)throw new Error("Local model returned no stream.");
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let buffer="",emitted=false,usage=null,finalModel=resolved;
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    buffer+=decoder.decode(value,{stream:true});
    const blocks=buffer.split("\\n\\n");
    buffer=blocks.pop()||"";
    for(const block of blocks){
      for(const line of block.split("\\n")){
        if(!line.startsWith("data:"))continue;
        const raw=line.slice(5).trim();
        if(!raw||raw==="[DONE]")continue;
        let chunk;try{chunk=JSON.parse(raw)}catch{continue}
        if(chunk?.error)throw new Error(chunk.error?.message||String(chunk.error));
        if(chunk?.model)finalModel=chunk.model;
        if(chunk?.usage)usage=chunk.usage;
        const delta=chunk?.choices?.[0]?.delta?.content;
        if(typeof delta==="string"&&delta){
          emitted=true;
          writeSSE(res,"token",{text:delta});
        }
      }
    }
  }
  writeSSE(res,"meta",{model:`local/${finalModel}`,usage,provider:"local"});
  return {emitted,finalModel:`local/${finalModel}`,usage,provider:"local"};
}
async function callFreeLlmText({messages,temperature=0.2,webSearch=false}={}){
  if(ZERO_COST_MODE){
    try{
      const local=await localChatCompletion({messages,temperature});
      return String(local.message?.content||"");
    }catch(localErr){
      if(!OPENROUTER_FREE_FALLBACK_ENABLED||!openRouterConfigured())throw localErr;
    }
  }
  if(!openRouterConfigured())throw new Error("No free LLM route is available. Start a local model or configure an OpenRouter API key.");
  const payload={model:"openrouter/free",messages,temperature};
  if(webSearch&&OPENROUTER_WEB_SEARCH_ENABLED){
    payload.tools=[{type:"openrouter:web_search",parameters:{engine:"auto",max_results:5,max_total_results:10,search_context_size:"medium"}}];
  }
  const response=await fetch(OR_CHAT,{method:"POST",headers:openRouterHeaders(),body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||data?.message||`OpenRouter free route error (${response.status})`);
  return typeof data?.choices?.[0]?.message?.content==="string"?data.choices[0].message.content:JSON.stringify(data?.choices?.[0]?.message?.content??"");
}
async function callFreeLlmJSON({messages,temperature=0.1}={}){
  if(ZERO_COST_MODE){
    try{
      const local=await localChatCompletion({messages,temperature,responseFormat:{type:"json_object"}});
      const content=local.message?.content||"{}";
      try{return JSON.parse(content)}catch{
        const m=String(content).match(/\\{[\\s\\S]*\\}/);
        if(m)return JSON.parse(m[0]);
      }
    }catch(localErr){
      if(!OPENROUTER_FREE_FALLBACK_ENABLED||!openRouterConfigured())throw localErr;
    }
  }
  if(!openRouterConfigured())throw new Error("No free LLM route is available for JSON work.");
  const response=await fetch(OR_CHAT,{
    method:"POST",headers:openRouterHeaders(),
    body:JSON.stringify({model:"openrouter/free",messages,temperature,response_format:{type:"json_object"}})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||data?.message||`OpenRouter free route error (${response.status})`);
  const content=data?.choices?.[0]?.message?.content||"{}";
  try{return JSON.parse(content)}catch{
    const m=String(content).match(/\\{[\\s\\S]*\\}/);
    if(m)return JSON.parse(m[0]);
    throw new Error("Free model did not return valid JSON.");
  }
}

function openRouterHeaders(extra = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is missing. Add it to .env and restart.");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.SITE_URL || `http://localhost:${PORT}`,
    "X-OpenRouter-Title": SITE_NAME,
    ...extra
  };
}

function json(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(data));
}

function getBody(req, limit = 12_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function getRawBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > limit) { reject(new Error("Request too large")); req.destroy(); }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
function parseFormEncoded(raw="") {
  const out={};
  for(const [k,v] of new URLSearchParams(raw)) out[k]=v;
  return out;
}
function xmlEscape(s="") { return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"}[c]||c)); }

function cleanModel(m) {
  const prompt = Number(m?.pricing?.prompt);
  const completion = Number(m?.pricing?.completion);
  const isFree = Number.isFinite(prompt) && Number.isFinite(completion) && prompt === 0 && completion === 0;
  const architecture = m?.architecture || {};
  const inputModalities = architecture.input_modalities || architecture.inputModalities || [];
  const supported = m?.supported_parameters || [];
  return {
    id: m.id,
    name: m.name || m.id,
    context_length: m.context_length || null,
    isFree,
    inputPrice: m?.pricing?.prompt ?? null,
    outputPrice: m?.pricing?.completion ?? null,
    inputModalities,
    supportsVision: inputModalities.includes("image"),
    supportsTools: supported.includes("tools"),
    supportsReasoning: supported.includes("reasoning") || supported.includes("reasoning_effort")
  };
}

async function getModels(force = false) {
  const fresh = Date.now() - modelCache.fetchedAt < MODEL_CACHE_MS;
  if (!force && fresh && modelCache.models.length) return modelCache.models;

  const localNames=await getLocalLlmModels(force);
  const localModels=localNames.map((id,idx)=>({
    id:`local/${id}`,
    name:`${id} · Local`,
    context_length:null,
    isFree:true,
    inputPrice:"0",
    outputPrice:"0",
    inputModalities:["text"],
    supportsVision:false,
    supportsTools:true,
    supportsReasoning:true,
    source:"local",
    local:true,
    preferred:idx===0
  }));

  let openRouterModels=[];
  if(openRouterConfigured()){
    try{
      const response=await fetchWithRetry(OR_MODELS,{headers:openRouterHeaders()},{retries:2});
      const data=await response.json().catch(()=>({}));
      if(response.ok)openRouterModels=(data?.data||[]).map(x=>({...cleanModel(x),source:"openrouter"}));
    }catch{}
  }

  const models=[
    ...(localModels.length?[{
      id:"local/auto",name:"Kairoq Local Auto · FREE",context_length:null,isFree:true,
      inputPrice:"0",outputPrice:"0",inputModalities:["text"],supportsVision:false,
      supportsTools:true,supportsReasoning:true,source:"local",local:true,preferred:true
    }]:[]),
    ...localModels,
    ...(openRouterConfigured()?[{
      id:"openrouter/free",name:"OpenRouter Free Auto",context_length:200000,isFree:true,
      inputPrice:"0",outputPrice:"0",inputModalities:["text","image"],supportsVision:true,
      supportsTools:true,supportsReasoning:true,source:"openrouter"
    }]:[]),
    ...openRouterModels.filter(x=>x.id!=="openrouter/free")
  ];

  modelCache={fetchedAt:Date.now(),models};
  return models;
}

function freeFallbacks(models, primary = "", limit = 3) {
  return models
    .filter(m => m.isFree && m.id !== primary && !isLocalModelId(m.id) && m.id !== "openrouter/free")
    .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
    .slice(0, Math.max(0, Math.min(3, limit)))
    .map(m => m.id);
}

function purposePrompt(purpose) {
  const map = {
    general: "",
    coding: "Focus on correct implementation, debugging, edge cases, architecture, and practical code. Be explicit about assumptions.",
    research: "Prioritize careful research, factual grounding, uncertainty, dates, and source-aware reasoning. Clearly separate facts from inference.",
    writing: "Prioritize polished natural writing, clarity, tone, structure, and preservation of the user's intent.",
    business: "Act as a practical business operator. Focus on economics, tradeoffs, execution, risks, prioritization, and next actions.",
    vision: "Inspect the attached image(s) carefully and answer from what is actually visible. Mention uncertainty where visual evidence is ambiguous."
  };
  return map[purpose] || "";
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-50).map(msg => ({
    role: ["user", "assistant", "system"].includes(msg.role) ? msg.role : "user",
    content: msg.content
  }));
}

function writeSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamOpenRouter(payload, res) {
  const response = await fetchWithRetry(OR_CHAT, {
    method: "POST",
    headers: openRouterHeaders({ Accept: "text/event-stream" }),
    body: JSON.stringify(payload)
  }, { retries: 3 });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let message = `OpenRouter error (${response.status})`;
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.error?.message || parsed?.message || message;
    } catch {}
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  if (!response.body) throw new Error("No response body returned.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = false;
  let finalModel = payload.model || payload.models?.[0] || "unknown";
  let usage = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const dataLine = block.split("\n").find(line => line.startsWith("data:"));
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;

      let chunk;
      try { chunk = JSON.parse(raw); }
      catch { continue; }

      if (chunk?.error) {
        const err = new Error(chunk.error?.message || "OpenRouter stream error.");
        err.afterPartial = emitted;
        throw err;
      }

      if (chunk?.model) finalModel = chunk.model;
      if (chunk?.usage) usage = chunk.usage;

      const delta = chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        emitted = true;
        writeSSE(res, "token", { text: delta });
      }
    }
  }

  writeSSE(res, "meta", { model: finalModel, usage });
  return { emitted, finalModel, usage };
}



function cloudConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function cloudLoadState() {
  if (!cloudConfigured()) return null;
  const url = `${SUPABASE_URL}/rest/v1/ai_state?owner_id=eq.${encodeURIComponent(MEMORY_OWNER_ID)}&select=state,updated_at`;
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(data?.message || `Supabase load failed (${response.status})`);
  return data?.[0] || null;
}

async function cloudSaveState(state) {
  if (!cloudConfigured()) throw new Error("Cloud memory is not configured.");
  const url = `${SUPABASE_URL}/rest/v1/ai_state?on_conflict=owner_id`;
  const response = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders({
      Prefer: "resolution=merge-duplicates,return=representation"
    }),
    body: JSON.stringify({
      owner_id: MEMORY_OWNER_ID,
      state,
      updated_at: new Date().toISOString()
    })
  });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(data?.message || `Supabase save failed (${response.status})`);
  return data?.[0] || { state };
}

async function callOpenRouterText({ model, messages, temperature = 0.2, webSearch = false }) {
  if(ZERO_COST_MODE)return callFreeLlmText({messages,temperature,webSearch});

  const requested=model||"openrouter/free";
  if(requested!=="openrouter/free"&&!PAID_LLM_ENABLED){
    throw new Error("Paid LLMs are locked. Set PAID_LLM_ENABLED=true to permit them.");
  }
  const payload={model:requested,messages,temperature};
  if(webSearch&&OPENROUTER_WEB_SEARCH_ENABLED){
    payload.tools=[{type:"openrouter:web_search",parameters:{engine:"auto",max_results:5,max_total_results:10,search_context_size:"medium"}}];
  }
  const response=await fetch(OR_CHAT,{method:"POST",headers:openRouterHeaders(),body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||data?.message||`OpenRouter error (${response.status})`);
  const content=data?.choices?.[0]?.message?.content;
  return typeof content==="string"?content:JSON.stringify(content??"");
}

async function callOpenRouterJSON({ model, messages, temperature = 0.1 }) {
  if(ZERO_COST_MODE)return callFreeLlmJSON({messages,temperature});

  const requested=model||"openrouter/free";
  if(requested!=="openrouter/free"&&!PAID_LLM_ENABLED){
    throw new Error("Paid LLMs are locked. Set PAID_LLM_ENABLED=true to permit them.");
  }
  const response=await fetch(OR_CHAT,{
    method:"POST",headers:openRouterHeaders(),
    body:JSON.stringify({model:requested,messages,temperature,response_format:{type:"json_object"}})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||data?.message||`OpenRouter error (${response.status})`);
  const content=data?.choices?.[0]?.message?.content||"{}";
  try{return JSON.parse(content)}catch{
    const match=String(content).match(/\{[\s\S]*\}/);
    if(match){try{return JSON.parse(match[0])}catch{}}
    throw new Error("Memory model did not return valid JSON.");
  }
}

async function handleMemoryExtract(req, res) {
  try {
    const body = await getBody(req);
    const recentMessages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const existingGlobal = typeof body.existingGlobal === "string" ? body.existingGlobal : "";
    const existingProject = typeof body.existingProject === "string" ? body.existingProject : "";
    const projectName = typeof body.projectName === "string" ? body.projectName : "General";
    const memoryModel = typeof body.memoryModel === "string" && body.memoryModel ? body.memoryModel : "openrouter/free";

    const instruction = `You are a memory curator for a personal AI app.
Return ONLY valid JSON with this exact shape:
{
  "global_additions": ["durable fact or preference", "..."],
  "project_additions": ["durable project fact, decision, constraint, or goal", "..."],
  "chat_summary": "concise summary of the important conversation context that future models need"
}

Rules:
- Keep only durable facts, stable preferences, decisions, constraints, goals, and unresolved tasks.
- Do NOT store casual greetings, temporary phrasing, or low-value chatter.
- Do NOT repeat items already present in existing memory.
- Keep each list item short and factual.
- If there is nothing worth adding, return an empty list.
- Never invent anything not supported by the conversation.
- Project is "${projectName}".`;

    const result = await callOpenRouterJSON({
      model: memoryModel,
      messages: [
        { role: "system", content: instruction },
        { role: "user", content:
`EXISTING GLOBAL MEMORY:
${existingGlobal || "(none)"}

EXISTING PROJECT MEMORY:
${existingProject || "(none)"}

RECENT CONVERSATION:
${JSON.stringify(recentMessages)}`
        }
      ],
      temperature: 0
    });

    return json(res, 200, {
      global_additions: Array.isArray(result.global_additions) ? result.global_additions : [],
      project_additions: Array.isArray(result.project_additions) ? result.project_additions : [],
      chat_summary: typeof result.chat_summary === "string" ? result.chat_summary : ""
    });
  } catch (err) {
    return json(res, 500, { error: err.message || "Could not update memory." });
  }
}


async function handleCloudStatus(_req, res) {
  return json(res, 200, {
    configured: cloudConfigured(),
    owner_id: MEMORY_OWNER_ID
  });
}

async function handleCloudLoad(_req, res) {
  try {
    if (!cloudConfigured()) return json(res, 200, { configured: false, state: null });
    const row = await cloudLoadState();
    return json(res, 200, {
      configured: true,
      state: row?.state || null,
      updated_at: row?.updated_at || null
    });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}

async function handleCloudSave(req, res) {
  try {
    if (!cloudConfigured()) return json(res, 400, { error: "Cloud memory is not configured." });
    const body = await getBody(req, 4_000_000);
    const state = body?.state;
    if (!state || typeof state !== "object") return json(res, 400, { error: "Missing state." });
    const row = await cloudSaveState(state);
    return json(res, 200, { ok: true, updated_at: row?.updated_at || new Date().toISOString() });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}




function readJsonFileSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFileSafe(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}


function normalizeOpenLoop(input = {}) {
  const now = new Date().toISOString();
  const statusAllowed = new Set(["open","waiting","approval","blocked","done","cancelled"]);
  const riskAllowed = new Set(["low","medium","high"]);
  const status = statusAllowed.has(String(input.status||"").toLowerCase()) ? String(input.status).toLowerCase() : "open";
  const risk = riskAllowed.has(String(input.risk||"").toLowerCase()) ? String(input.risk).toLowerCase() : "medium";
  const money = Number(input.money_value || input.value_usd || 0);
  return {
    id: String(input.id || crypto.randomUUID()),
    title: String(input.title || input.goal || "Open loop").trim().slice(0, 180),
    goal: String(input.goal || input.title || "").trim().slice(0, 1000),
    source: String(input.source || "manual").trim().slice(0, 80),
    source_ref: String(input.source_ref || "").trim().slice(0, 500),
    status,
    next_action: String(input.next_action || "").trim().slice(0, 1000),
    waiting_on: String(input.waiting_on || "").trim().slice(0, 300),
    due_at: input.due_at ? String(input.due_at) : null,
    completion_signal: String(input.completion_signal || "").trim().slice(0, 1000),
    money_value: Number.isFinite(money) ? Math.max(0, money) : 0,
    risk,
    notes: String(input.notes || "").trim().slice(0, 3000),
    created_at: input.created_at || now,
    updated_at: now,
    completed_at: status === "done" ? (input.completed_at || now) : (input.completed_at || null)
  };
}

function openLoopPriorityScore(loop = {}) {
  if (["done","cancelled"].includes(loop.status)) return -999;
  let score = 0;
  if (loop.status === "blocked") score += 35;
  if (loop.status === "approval") score += 30;
  if (loop.status === "waiting") score += 12;
  if (loop.risk === "high") score += 30;
  if (loop.risk === "medium") score += 12;
  score += Math.min(35, Number(loop.money_value || 0) / 250);
  if (loop.due_at) {
    const ms = Date.parse(loop.due_at) - Date.now();
    if (Number.isFinite(ms)) {
      const days = ms / 86400000;
      if (days < 0) score += 40;
      else if (days <= 1) score += 30;
      else if (days <= 3) score += 20;
      else if (days <= 7) score += 10;
    }
  }
  return Math.round(score * 10) / 10;
}

function loadOpenLoops() {
  const loops = readJsonFileSafe(OPEN_LOOPS_FILE, []);
  return Array.isArray(loops) ? loops.map(normalizeOpenLoop) : [];
}

function saveOpenLoops(loops) {
  const safe = (Array.isArray(loops) ? loops : []).slice(0, 1000);
  writeJsonFileSafe(OPEN_LOOPS_FILE, safe);
  return safe;
}

function sortOpenLoops(loops) {
  return [...loops].sort((a,b) => {
    const sa = openLoopPriorityScore(a), sb = openLoopPriorityScore(b);
    if (sb !== sa) return sb - sa;
    return Date.parse(b.updated_at||0) - Date.parse(a.updated_at||0);
  });
}

function loopSimilarityKey(loop = {}) {
  return String(loop.title || loop.goal || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim()
    .split(/\s+/)
    .slice(0,12)
    .join(" ");
}

function upsertOpenLoop(input = {}) {
  const loops = loadOpenLoops();
  const normalized = normalizeOpenLoop(input);
  const key = loopSimilarityKey(normalized);
  let index = input.id ? loops.findIndex(x => x.id === input.id) : -1;
  if (index < 0 && key) index = loops.findIndex(x => !["done","cancelled"].includes(x.status) && loopSimilarityKey(x) === key);

  if (index >= 0) {
    const merged = normalizeOpenLoop({
      ...loops[index],
      ...input,
      id: loops[index].id,
      created_at: loops[index].created_at
    });
    loops[index] = merged;
    saveOpenLoops(loops);
    return merged;
  }

  loops.unshift(normalized);
  saveOpenLoops(loops);
  return normalized;
}

async function handleOpenLoopsList(req, res) {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const includeDone = parsed.searchParams.get("include_done") === "true";
  let loops = sortOpenLoops(loadOpenLoops());
  if (!includeDone) loops = loops.filter(x => !["done","cancelled"].includes(x.status));
  return json(res, 200, {
    loops,
    counts: {
      active: loops.filter(x => !["done","cancelled"].includes(x.status)).length,
      waiting: loops.filter(x => x.status === "waiting").length,
      approval: loops.filter(x => x.status === "approval").length,
      overdue: loops.filter(x => x.due_at && Date.parse(x.due_at) < Date.now() && !["done","cancelled"].includes(x.status)).length
    },
    value_at_stake: loops.filter(x => !["done","cancelled"].includes(x.status)).reduce((sum,x)=>sum+Number(x.money_value||0),0)
  });
}

async function handleOpenLoopCreate(req, res) {
  try {
    const body = await getBody(req, 1_000_000);
    const loop = upsertOpenLoop({ ...body, source: body.source || "manual" });
    await audit("open_loop.created", { id: loop.id, title: loop.title, source: loop.source, status: loop.status });
    return json(res, 200, { ok:true, loop });
  } catch (err) {
    return json(res, 400, { error: err.message || "Could not create open loop." });
  }
}

async function handleOpenLoopUpdate(req, res) {
  try {
    const body = await getBody(req, 1_000_000);
    const id = String(body.id || "");
    if (!id) return json(res, 400, { error:"Loop id is required." });
    const loops = loadOpenLoops();
    const existing = loops.find(x=>x.id===id);
    if (!existing) return json(res, 404, { error:"Open loop not found." });
    const loop = upsertOpenLoop({ ...existing, ...body, id });
    await audit("open_loop.updated", { id: loop.id, title: loop.title, status: loop.status });
    return json(res, 200, { ok:true, loop });
  } catch (err) {
    return json(res, 400, { error: err.message || "Could not update open loop." });
  }
}

async function handleOpenLoopsExtract(req, res) {
  try {
    const body = await getBody(req, 3_000_000);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const text = String(body.text || "").trim();
    if (!messages.length && !text) return json(res, 400, { error:"Provide conversation messages or text to scan." });

    const existing = loadOpenLoops()
      .filter(x=>!["done","cancelled"].includes(x.status))
      .slice(0,100)
      .map(x=>({id:x.id,title:x.title,status:x.status,due_at:x.due_at,waiting_on:x.waiting_on}));

    const model = String(body.model || "openrouter/free");
    const result = await callOpenRouterJSON({
      model,
      temperature: 0,
      messages: [
        {
          role:"system",
          content:`You are Kairoq Outcome Detector.
Find only unresolved outcomes that a capable assistant should continue owning until completion.

An open loop includes things such as:
- money owed, refunds, invoices or reimbursements not yet received
- promises to send, call, reply, deliver, submit or follow up
- requests waiting on another person/company
- deadlines, renewals, expiring credits, reservations, applications or disputes
- sales leads or customer issues that have not reached an outcome
- travel or operational problems still unresolved

Do NOT create loops for completed items, casual ideas, generic advice, or things with no implied outcome.

Return ONLY JSON:
{
  "loops": [
    {
      "title": "short outcome-oriented title",
      "goal": "what must become true before this can be considered finished",
      "source": "chat",
      "status": "open|waiting|approval|blocked",
      "next_action": "best next step Atlas could take",
      "waiting_on": "person/company if applicable",
      "due_at": null,
      "completion_signal": "observable evidence that proves it is finished",
      "money_value": 0,
      "risk": "low|medium|high",
      "notes": "brief evidence"
    }
  ]
}

Be conservative. Prefer 0-5 important loops, not a long task list.
Never invent dates, money amounts, names or obligations.`
        },
        {
          role:"user",
          content:`EXISTING OPEN LOOPS:
${JSON.stringify(existing)}

CONTENT TO SCAN:
${text || JSON.stringify(messages)}`
        }
      ]
    });

    const candidates = Array.isArray(result.loops) ? result.loops.slice(0,10) : [];
    const saved = candidates
      .filter(x=>x && (x.title || x.goal))
      .map(x=>upsertOpenLoop({ ...x, source:x.source || "chat" }));

    await audit("open_loop.scan", { found:saved.length, model });
    return json(res, 200, { ok:true, loops:saved });
  } catch (err) {
    return json(res, 500, { error: err.message || "Could not scan for open loops." });
  }
}

async function loadJobs() {
  if (cloudConfigured()) {
    const url = `${SUPABASE_URL}/rest/v1/ai_agent_jobs?owner_id=eq.${encodeURIComponent(MEMORY_OWNER_ID)}&select=job`;
    const response = await fetch(url, { headers: supabaseHeaders() });
    const data = await response.json().catch(() => ([]));
    if (!response.ok) throw new Error(data?.message || `Job load failed (${response.status})`);
    return (data || []).map(r => r.job).filter(Boolean);
  }
  return readJsonFileSafe(JOB_FILE, []);
}

async function saveJob(job) {
  if (cloudConfigured()) {
    const url = `${SUPABASE_URL}/rest/v1/ai_agent_jobs?on_conflict=id`;
    const response = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        id: job.id,
        owner_id: MEMORY_OWNER_ID,
        job,
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || `Job save failed (${response.status})`);
    }
    return;
  }
  const jobs = readJsonFileSafe(JOB_FILE, []);
  const next = jobs.filter(j => j.id !== job.id);
  next.push(job);
  writeJsonFileSafe(JOB_FILE, next);
}

async function deleteJob(id) {
  if (cloudConfigured()) {
    const url = `${SUPABASE_URL}/rest/v1/ai_agent_jobs?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(MEMORY_OWNER_ID)}`;
    const response = await fetch(url, { method: "DELETE", headers: supabaseHeaders() });
    if (!response.ok) throw new Error(`Job delete failed (${response.status})`);
    return;
  }
  const jobs = readJsonFileSafe(JOB_FILE, []);
  writeJsonFileSafe(JOB_FILE, jobs.filter(j => j.id !== id));
}

async function saveRun(run) {
  if (cloudConfigured()) {
    const url = `${SUPABASE_URL}/rest/v1/ai_agent_runs`;
    const response = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({
        id: run.id,
        owner_id: MEMORY_OWNER_ID,
        job_id: run.job_id,
        run,
        created_at: run.created_at
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || `Run save failed (${response.status})`);
    }
    return;
  }
  const runs = readJsonFileSafe(RUN_FILE, []);
  runs.unshift(run);
  writeJsonFileSafe(RUN_FILE, runs.slice(0, 500));
}

async function loadRuns(jobId = null, limit = 100) {
  if (cloudConfigured()) {
    let url = `${SUPABASE_URL}/rest/v1/ai_agent_runs?owner_id=eq.${encodeURIComponent(MEMORY_OWNER_ID)}&select=run&order=created_at.desc&limit=${Math.min(200, limit)}`;
    if (jobId) url += `&job_id=eq.${encodeURIComponent(jobId)}`;
    const response = await fetch(url, { headers: supabaseHeaders() });
    const data = await response.json().catch(() => ([]));
    if (!response.ok) throw new Error(data?.message || `Run load failed (${response.status})`);
    return (data || []).map(r => r.run).filter(Boolean);
  }
  const runs = readJsonFileSafe(RUN_FILE, []);
  return runs.filter(r => !jobId || r.job_id === jobId).slice(0, limit);
}

function nextRunAt(job, from = new Date()) {
  const now = new Date(from);
  const schedule = job.schedule || {};
  const freq = schedule.frequency || "daily";
  const hour = Number.isFinite(Number(schedule.hour)) ? Number(schedule.hour) : 8;
  const minute = Number.isFinite(Number(schedule.minute)) ? Number(schedule.minute) : 0;

  if (freq === "hourly") {
    const d = new Date(now);
    d.setSeconds(0, 0);
    d.setMinutes(minute);
    if (d <= now) d.setHours(d.getHours() + 1);
    return d.toISOString();
  }

  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);

  if (freq === "weekly") {
    const target = Number.isFinite(Number(schedule.dayOfWeek)) ? Number(schedule.dayOfWeek) : 1;
    let delta = (target - d.getDay() + 7) % 7;
    if (delta === 0 && d <= now) delta = 7;
    d.setDate(d.getDate() + delta);
    return d.toISOString();
  }

  if (d <= now) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function buildReadOnlyBackgroundTools({ allowWeb = true } = {}) {
  const all = agentToolDefinitions({ allowWeb });
  const denied = new Set(["write_workspace_file", "github_create_issue", "send_webhook", "gmail_send", "calendar_create", "message_send"]);
  return all.filter(t => {
    const name = t?.function?.name;
    return !name || !denied.has(name);
  });
}

async function runBackgroundAgent(job) {
  let model = job.model || "openrouter/free";
  if (model === "smart-auto") model = "openrouter/auto";

  const persona = agentPersona(job.agentType || "general");
  const memory = [
    job.globalMemory ? `GLOBAL MEMORY:\n${job.globalMemory}` : "",
    job.projectMemory ? `PROJECT MEMORY (${job.projectName || "General"}):\n${job.projectMemory}` : "",
    job.companyPlaybook ? `COMPANY PLAYBOOK:\n${job.companyPlaybook}` : ""
  ].filter(Boolean).join("\n\n");

  const tools = buildReadOnlyBackgroundTools({ allowWeb: job.webSearch !== false });
  const messages = [
    {
      role: "system",
      content: `${persona}

You are running as a scheduled background agent.
You may use read-only tools and the internal open-loop tools. You may create/update open loops because they only track internal state.
Do not attempt to send email, create calendar events, write files, create GitHub issues, make bookings, or perform other consequential actions.
If such an action appears necessary, include a clearly labeled "Needs approval" section in the final result.
Complete the requested monitoring/research/analysis task and produce a concise actionable result.`
    },
    { role: "user", content: `${memory}\n\nSCHEDULED GOAL:\n${job.goal}` }
  ];

  const repeated = new Map();
  for (let iteration = 0; iteration < 8; iteration++) {
    const message = await sendAgentToolTurn({ model, messages, tools });
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    messages.push({
      role: "assistant",
      content: message.content || "",
      ...(calls.length ? { tool_calls: calls } : {})
    });

    if (!calls.length) {
      return message.content || "(Scheduled agent completed without a text response.)";
    }

    for (const call of calls) {
      const name = call?.function?.name;
      let args = {};
      try { args = JSON.parse(call?.function?.arguments || "{}"); } catch {}

      const signature = `${name}:${JSON.stringify(args)}`;
      const count = (repeated.get(signature) || 0) + 1;
      repeated.set(signature, count);
      if (count > 2) throw new Error(`Scheduled agent repeated ${name} too many times.`);

      const permission=await toolPermission(name);
      if(permission!=="auto"){messages.push({role:"tool",tool_call_id:call.id,name,content:JSON.stringify({ok:false,denied:true,reason:"Background jobs only use tools set to Auto."})});continue}
      let result;try{result=await executeAgentTool(name,args,{model,memory:messages.map(m=>m.content||"").join("\n\n"),delegationDepth:0})}catch(err){result={ok:false,error:err.message}}

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: JSON.stringify(result)
      });
    }
  }

  throw new Error("Scheduled agent hit its iteration limit.");
}

async function runScheduledJob(job, reason = "schedule") {
  const started=new Date().toISOString(),run={id:crypto.randomUUID(),job_id:job.id,job_name:job.name,created_at:started,reason,status:"running",attempts:0,output:""};
  const maxAttempts=Math.max(1,Math.min(5,Number(job.retry?.maxAttempts||3)));let lastErr=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){run.attempts=attempt;try{await enforceBudget();run.output=await runBackgroundAgent(job);run.status="complete";lastErr=null;break}catch(err){lastErr=err;await audit("job.attempt_failed",{job_id:job.id,attempt,error:err.message});if(attempt<maxAttempts)await sleep(Math.min(60000,1000*(2**(attempt-1))))}}
  if(lastErr){run.status="error";run.output=lastErr.message||"Scheduled run failed.";const dead=readJsonFileSafe(DEAD_LETTER_FILE,[]);dead.unshift({id:crypto.randomUUID(),job_id:job.id,job_name:job.name,failed_at:new Date().toISOString(),attempts:run.attempts,error:run.output});writeJsonFileSafe(DEAD_LETTER_FILE,dead.slice(0,500));await notify(`Bot failed: ${job.name}`,run.output,{job_id:job.id,run_id:run.id})}else await notify(`Bot complete: ${job.name}`,String(run.output||"").slice(0,1500),{job_id:job.id,run_id:run.id});
  await saveRun(run);await audit("job.completed",{job_id:job.id,run_id:run.id,status:run.status,attempts:run.attempts});job.last_run_at=started;job.last_status=run.status;job.next_run_at=nextRunAt(job,new Date(started));await saveJob(job);return run;
}

async function schedulerTick() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const jobs = await loadJobs();
    const now = Date.now();
    for (const job of jobs) {
      if (!job.enabled) continue;
      const next = job.next_run_at ? Date.parse(job.next_run_at) : NaN;
      if (!Number.isFinite(next)) {
        job.next_run_at = nextRunAt(job);
        await saveJob(job);
        continue;
      }
      if (next <= now) {
        await runScheduledJob(job, "schedule");
      }
    }
  } catch (err) {
    console.error("Scheduler error:", err.message);
  } finally {
    schedulerBusy = false;
  }
}

function googleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

async function connectorTokenLoad(connector) {
  if (cloudConfigured()) {
    const url = `${SUPABASE_URL}/rest/v1/ai_connector_tokens?owner_id=eq.${encodeURIComponent(MEMORY_OWNER_ID)}&connector=eq.${encodeURIComponent(connector)}&select=token,updated_at`;
    const response = await fetch(url, { headers: supabaseHeaders() });
    const data = await response.json().catch(() => ([]));
    if (!response.ok) throw new Error(data?.message || `Connector token load failed (${response.status})`);
    return data?.[0]?.token ? decryptJson(data[0].token) : null;
  }

  if (connector === "google" && fs.existsSync(GOOGLE_TOKEN_FILE)) {
    try { return decryptJson(JSON.parse(fs.readFileSync(GOOGLE_TOKEN_FILE, "utf8"))); } catch {}
  }
  if (connector === "microsoft" && fs.existsSync(MICROSOFT_TOKEN_FILE)) {
    try { return decryptJson(JSON.parse(fs.readFileSync(MICROSOFT_TOKEN_FILE, "utf8"))); } catch {}
  }
  return null;
}

async function connectorTokenSave(connector, token) {
  if (cloudConfigured()) {
    const url = `${SUPABASE_URL}/rest/v1/ai_connector_tokens?on_conflict=owner_id,connector`;
    const response = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        owner_id: MEMORY_OWNER_ID,
        connector,
        token: encryptJson(token),
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || `Connector token save failed (${response.status})`);
    }
    return;
  }

  if (connector === "google") {
    fs.mkdirSync(path.dirname(GOOGLE_TOKEN_FILE), { recursive: true });
    fs.writeFileSync(GOOGLE_TOKEN_FILE, JSON.stringify(encryptJson(token), null, 2), "utf8");
  }
  if (connector === "microsoft") {
    fs.mkdirSync(path.dirname(MICROSOFT_TOKEN_FILE), { recursive: true });
    fs.writeFileSync(MICROSOFT_TOKEN_FILE, JSON.stringify(encryptJson(token), null, 2), "utf8");
  }
}

async function getGoogleAccessToken() {
  if (!googleConfigured()) throw new Error("Google OAuth is not configured.");
  let token = await connectorTokenLoad("google");
  if (!token) throw new Error("Google is not connected.");

  const expiresAt = Number(token.expires_at || 0);
  if (token.access_token && Date.now() < expiresAt - 60_000) return token.access_token;
  if (!token.refresh_token) throw new Error("Google refresh token is unavailable. Reconnect Google.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error_description || data?.error || "Google token refresh failed.");

  token = {
    ...token,
    access_token: data.access_token,
    scope: data.scope || token.scope,
    token_type: data.token_type || token.token_type,
    expires_at: Date.now() + Number(data.expires_in || 3600) * 1000
  };
  await connectorTokenSave("google", token);
  return token.access_token;
}

async function googleApi(url, options = {}) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Google API error (${response.status})`);
  return data;
}


function microsoftConfigured(){
  return Boolean(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET);
}
function microsoftScopes(){
  const scopes=["openid","profile","offline_access","User.Read","Files.ReadWrite"];
  if(MICROSOFT_ENABLE_OUTLOOK)scopes.push("Mail.Read","Mail.Send","Calendars.ReadWrite");
  if(MICROSOFT_ENABLE_SHAREPOINT)scopes.push("Sites.ReadWrite.All");
  if(MICROSOFT_ENABLE_TEAMS)scopes.push("Team.ReadBasic.All","Channel.ReadBasic.All","ChannelMessage.Send","ChatMessage.Send");
  return [...new Set(scopes)];
}
async function getMicrosoftAccessToken(){
  if(!microsoftConfigured())throw new Error("Microsoft OAuth is not configured.");
  let token=await connectorTokenLoad("microsoft");
  if(!token)throw new Error("Microsoft 365 is not connected.");
  const expiresAt=Number(token.expires_at||0);
  if(token.access_token && Date.now()<expiresAt-60_000)return token.access_token;
  if(!token.refresh_token)throw new Error("Microsoft refresh token is unavailable. Reconnect Microsoft 365.");
  const endpoint=`https://login.microsoftonline.com/${encodeURIComponent(MICROSOFT_TENANT)}/oauth2/v2.0/token`;
  const response=await fetchWithRetry(endpoint,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      client_id:MICROSOFT_CLIENT_ID,
      client_secret:MICROSOFT_CLIENT_SECRET,
      refresh_token:token.refresh_token,
      grant_type:"refresh_token",
      scope:String(token.scope||microsoftScopes().join(" "))
    })
  },{retries:2});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error_description||data?.error||"Microsoft token refresh failed.");
  token={
    ...token,
    access_token:data.access_token,
    refresh_token:data.refresh_token||token.refresh_token,
    scope:data.scope||token.scope,
    token_type:data.token_type||token.token_type,
    expires_at:Date.now()+Number(data.expires_in||3600)*1000
  };
  await connectorTokenSave("microsoft",token);
  return token.access_token;
}
async function microsoftGraphRaw(pathOrUrl,options={}){
  const accessToken=await getMicrosoftAccessToken();
  const url=/^https?:\/\//i.test(pathOrUrl)?pathOrUrl:`https://graph.microsoft.com/v1.0${pathOrUrl}`;
  const response=await fetchWithRetry(url,{
    ...options,
    headers:{
      Authorization:`Bearer ${accessToken}`,
      ...(options.body && !(options.body instanceof Buffer) && !(options.body instanceof Uint8Array) && !(options.body instanceof Blob) ? {"Content-Type":"application/json"} : {}),
      ...(options.headers||{})
    }
  },{retries:2});
  return response;
}
async function microsoftGraphJson(pathOrUrl,options={}){
  const response=await microsoftGraphRaw(pathOrUrl,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||data?.error_description||`Microsoft Graph error (${response.status})`);
  return data;
}
function graphOdataString(v=""){
  return String(v).replace(/'/g,"''");
}
function oneDrivePath(p=""){
  return String(p||"").split("/").filter(Boolean).map(encodeURIComponent).join("/");
}
function getWorkProductRecord(args={}){
  const products=listWorkProducts();
  const id=String(args.work_product_id||"").trim();
  const filename=String(args.filename||"").trim();
  const rec=id?products.find(x=>x.id===id):products.find(x=>x.filename===filename);
  if(!rec)throw new Error("Kairoq work product not found.");
  const full=path.resolve(WORK_PRODUCTS_DIR,rec.filename);
  if(!full.startsWith(path.resolve(WORK_PRODUCTS_DIR)+path.sep)||!fs.existsSync(full))throw new Error("Generated work product file is unavailable.");
  return {rec,full};
}
function updateWorkProductCloud(id,cloud){
  const products=listWorkProducts();
  const idx=products.findIndex(x=>x.id===id);
  if(idx<0)return null;
  products[idx]={...products[idx],cloud:{...(products[idx].cloud||{}),...cloud},updated_at:new Date().toISOString()};
  writeJsonFileSafe(WORK_PRODUCTS_FILE,products.slice(0,300));
  return products[idx];
}
async function microsoftEnsureOneDriveFolder(){
  const folder=MICROSOFT_ONEDRIVE_FOLDER||"Kairoq";
  const encoded=oneDrivePath(folder);
  try{
    return await microsoftGraphJson(`/me/drive/root:/${encoded}`);
  }catch{
    return microsoftGraphJson("/me/drive/root/children",{
      method:"POST",
      body:JSON.stringify({name:folder,folder:{}, "@microsoft.graph.conflictBehavior":"rename"})
    });
  }
}
async function microsoftOneDriveList(args={}){
  const folder=String(args.folder||MICROSOFT_ONEDRIVE_FOLDER||"Kairoq").replace(/^\/+|\/+$/g,"");
  const encoded=oneDrivePath(folder);
  const top=Math.max(1,Math.min(100,Number(args.limit||30)));
  try{
    const data=await microsoftGraphJson(`/me/drive/root:/${encoded}:/children?$top=${top}&$select=id,name,size,lastModifiedDateTime,webUrl,file,folder`);
    return {folder,items:data.value||[]};
  }catch(err){
    if(folder===MICROSOFT_ONEDRIVE_FOLDER){
      await microsoftEnsureOneDriveFolder();
      const data=await microsoftGraphJson(`/me/drive/root:/${encoded}:/children?$top=${top}&$select=id,name,size,lastModifiedDateTime,webUrl,file,folder`);
      return {folder,items:data.value||[]};
    }
    throw err;
  }
}
async function microsoftUploadWorkProduct(args={}){
  const {rec,full}=getWorkProductRecord(args);
  const folder=MICROSOFT_ONEDRIVE_FOLDER||"Kairoq";
  await microsoftEnsureOneDriveFolder();
  const buffer=fs.readFileSync(full);
  if(buffer.length>250*1024*1024)throw new Error("This build supports direct OneDrive upload for files up to 250 MB.");
  const target=`/me/drive/root:/${oneDrivePath(folder)}/${encodeURIComponent(rec.filename)}:/content`;
  const response=await microsoftGraphRaw(target,{
    method:"PUT",
    headers:{"Content-Type":"application/octet-stream"},
    body:buffer
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||`OneDrive upload failed (${response.status})`);
  const updated=updateWorkProductCloud(rec.id,{
    provider:"onedrive",item_id:data.id||null,web_url:data.webUrl||null,path:`${folder}/${rec.filename}`
  });
  await audit("microsoft.onedrive_upload",{work_product_id:rec.id,filename:rec.filename,item_id:data.id||null});
  return {ok:true,item:data,work_product:updated||rec};
}
function microsoftWorkProductCloudItem(args={}){
  const {rec}=getWorkProductRecord(args);
  const itemId=String(args.item_id||rec.cloud?.item_id||"").trim();
  if(!itemId)throw new Error("This work product has not been uploaded to OneDrive yet.");
  return {rec,itemId};
}
async function microsoftExcelReadRange(args={}){
  const {rec,itemId}=microsoftWorkProductCloudItem(args);
  if(rec.kind!=="xlsx")throw new Error("Excel Online range tools require an XLSX work product.");
  const ws=graphOdataString(args.worksheet||"Sheet1");
  const address=graphOdataString(args.address||"A1:Z100");
  const path=`/me/drive/items/${encodeURIComponent(itemId)}/workbook/worksheets('${encodeURIComponent(ws)}')/range(address='${encodeURIComponent(address)}')`;
  const data=await microsoftGraphJson(path);
  return {work_product_id:rec.id,worksheet:args.worksheet||"Sheet1",address:args.address||"A1:Z100",values:data.values||[],formulas:data.formulas||[],numberFormat:data.numberFormat||[]};
}
async function microsoftExcelUpdateRange(args={}){
  const {rec,itemId}=microsoftWorkProductCloudItem(args);
  if(rec.kind!=="xlsx")throw new Error("Excel Online range tools require an XLSX work product.");
  const ws=graphOdataString(args.worksheet||"Sheet1");
  const address=graphOdataString(args.address);
  if(!address)throw new Error("Excel range address is required.");
  const payload={};
  if(Array.isArray(args.values))payload.values=args.values;
  if(Array.isArray(args.formulas))payload.formulas=args.formulas;
  if(Array.isArray(args.numberFormat))payload.numberFormat=args.numberFormat;
  if(!Object.keys(payload).length)throw new Error("Provide values, formulas, or numberFormat.");
  const path=`/me/drive/items/${encodeURIComponent(itemId)}/workbook/worksheets('${encodeURIComponent(ws)}')/range(address='${encodeURIComponent(address)}')`;
  const data=await microsoftGraphJson(path,{method:"PATCH",body:JSON.stringify(payload)});
  await audit("microsoft.excel_update",{work_product_id:rec.id,item_id:itemId,worksheet:args.worksheet,address:args.address});
  return {ok:true,address:data.address||args.address,values:data.values||null,formulas:data.formulas||null};
}
async function microsoftOutlookSearch(args={}){
  if(!MICROSOFT_ENABLE_OUTLOOK)throw new Error("Microsoft Outlook integration is disabled.");
  const top=Math.max(1,Math.min(50,Number(args.limit||15)));
  const select="id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,webLink";
  const q=String(args.query||"").trim();
  let path=`/me/messages?$top=${top}&$select=${encodeURIComponent(select)}&$orderby=receivedDateTime%20desc`;
  if(q){
    path=`/me/messages?$top=${top}&$select=${encodeURIComponent(select)}&$search=${encodeURIComponent('"'+q+'"')}`;
  }
  const data=await microsoftGraphJson(path,{headers:{ConsistencyLevel:"eventual"}});
  return {messages:(data.value||[]).map(m=>({
    id:m.id,subject:m.subject||"",from:m.from?.emailAddress||null,
    to:(m.toRecipients||[]).map(x=>x.emailAddress),received:m.receivedDateTime,
    preview:m.bodyPreview||"",is_read:!!m.isRead,web_url:m.webLink||""
  }))};
}
async function microsoftOutlookRead(args={}){
  if(!MICROSOFT_ENABLE_OUTLOOK)throw new Error("Microsoft Outlook integration is disabled.");
  const id=String(args.message_id||"").trim();
  if(!id)throw new Error("message_id is required.");
  const data=await microsoftGraphJson(`/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,webLink`);
  return {
    id:data.id,subject:data.subject||"",from:data.from?.emailAddress||null,
    to:(data.toRecipients||[]).map(x=>x.emailAddress),cc:(data.ccRecipients||[]).map(x=>x.emailAddress),
    received:data.receivedDateTime,body_type:data.body?.contentType||"",body:String(data.body?.content||"").slice(0,100000),web_url:data.webLink||""
  };
}
async function microsoftOutlookSend(args={}){
  if(!MICROSOFT_ENABLE_OUTLOOK)throw new Error("Microsoft Outlook integration is disabled.");
  const to=(Array.isArray(args.to)?args.to:[args.to]).filter(Boolean).map(address=>({emailAddress:{address:String(address)}}));
  if(!to.length)throw new Error("At least one recipient is required.");
  const cc=(Array.isArray(args.cc)?args.cc:[]).filter(Boolean).map(address=>({emailAddress:{address:String(address)}}));
  const payload={message:{
    subject:String(args.subject||""),
    body:{contentType:args.html?"HTML":"Text",content:String(args.body||"")},
    toRecipients:to,
    ...(cc.length?{ccRecipients:cc}:{})
  },saveToSentItems:true};
  const response=await microsoftGraphRaw("/me/sendMail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    throw new Error(data?.error?.message||`Outlook send failed (${response.status})`);
  }
  await audit("microsoft.outlook_send",{to:to.map(x=>x.emailAddress.address),subject:String(args.subject||"").slice(0,300)});
  return {ok:true,status:response.status};
}
async function microsoftCalendarList(args={}){
  if(!MICROSOFT_ENABLE_OUTLOOK)throw new Error("Microsoft calendar integration is disabled.");
  const start=args.start||new Date().toISOString();
  const end=args.end||new Date(Date.now()+14*86400000).toISOString();
  const top=Math.max(1,Math.min(100,Number(args.limit||30)));
  const params=new URLSearchParams({startDateTime:start,endDateTime:end,"$top":String(top),"$select":"id,subject,start,end,location,organizer,webLink,isAllDay"});
  const data=await microsoftGraphJson(`/me/calendarView?${params.toString()}`);
  return {events:(data.value||[]).map(e=>({id:e.id,subject:e.subject,start:e.start,end:e.end,location:e.location?.displayName||"",organizer:e.organizer?.emailAddress||null,web_url:e.webLink||"",all_day:!!e.isAllDay}))};
}
async function microsoftCalendarCreate(args={}){
  if(!MICROSOFT_ENABLE_OUTLOOK)throw new Error("Microsoft calendar integration is disabled.");
  const event={
    subject:String(args.subject||""),
    body:{contentType:"Text",content:String(args.body||"")},
    start:{dateTime:String(args.start||""),timeZone:String(args.time_zone||"UTC")},
    end:{dateTime:String(args.end||""),timeZone:String(args.time_zone||"UTC")},
    location:{displayName:String(args.location||"")},
    attendees:(Array.isArray(args.attendees)?args.attendees:[]).filter(Boolean).map(address=>({emailAddress:{address:String(address)},type:"required"}))
  };
  const data=await microsoftGraphJson("/me/events",{method:"POST",body:JSON.stringify(event)});
  await audit("microsoft.calendar_create",{subject:event.subject,start:event.start.dateTime,end:event.end.dateTime});
  return {ok:true,event:{id:data.id,subject:data.subject,start:data.start,end:data.end,web_url:data.webLink||""}};
}
async function microsoftTeamsList(){
  if(!MICROSOFT_ENABLE_TEAMS)throw new Error("Microsoft Teams integration is disabled.");
  const data=await microsoftGraphJson("/me/joinedTeams");
  return {teams:(data.value||[]).map(t=>({id:t.id,name:t.displayName||"",description:t.description||"",archived:!!t.isArchived}))};
}
async function microsoftTeamsChannels(args={}){
  if(!MICROSOFT_ENABLE_TEAMS)throw new Error("Microsoft Teams integration is disabled.");
  const teamId=String(args.team_id||"");
  if(!teamId)throw new Error("team_id is required.");
  const data=await microsoftGraphJson(`/teams/${encodeURIComponent(teamId)}/channels?$select=id,displayName,description,membershipType`);
  return {channels:(data.value||[]).map(c=>({id:c.id,name:c.displayName||"",description:c.description||"",membership_type:c.membershipType||""}))};
}
async function microsoftTeamsSend(args={}){
  if(!MICROSOFT_ENABLE_TEAMS)throw new Error("Microsoft Teams integration is disabled.");
  const teamId=String(args.team_id||""),channelId=String(args.channel_id||"");
  if(!teamId||!channelId)throw new Error("team_id and channel_id are required.");
  const data=await microsoftGraphJson(`/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,{
    method:"POST",body:JSON.stringify({body:{contentType:"html",content:xmlEsc(String(args.message||"")).replace(/\n/g,"<br>")}})
  });
  await audit("microsoft.teams_send",{team_id:teamId,channel_id:channelId,message:String(args.message||"").slice(0,500)});
  return {ok:true,message:{id:data.id,created:data.createdDateTime,web_url:data.webUrl||""}};
}
function microsoftSharePointConfigured(){
  return Boolean(MICROSOFT_ENABLE_SHAREPOINT && MICROSOFT_SHAREPOINT_SITE_ID && MICROSOFT_SHAREPOINT_DRIVE_ID);
}
async function microsoftSharePointList(args={}){
  if(!microsoftSharePointConfigured())throw new Error("SharePoint drive is not configured.");
  const top=Math.max(1,Math.min(100,Number(args.limit||30)));
  const data=await microsoftGraphJson(`/sites/${encodeURIComponent(MICROSOFT_SHAREPOINT_SITE_ID)}/drives/${encodeURIComponent(MICROSOFT_SHAREPOINT_DRIVE_ID)}/root/children?$top=${top}&$select=id,name,size,lastModifiedDateTime,webUrl,file,folder`);
  return {items:data.value||[]};
}
async function microsoftSharePointUploadWorkProduct(args={}){
  if(!microsoftSharePointConfigured())throw new Error("SharePoint drive is not configured.");
  const {rec,full}=getWorkProductRecord(args);
  const buffer=fs.readFileSync(full);
  if(buffer.length>250*1024*1024)throw new Error("This build supports direct SharePoint upload for files up to 250 MB.");
  const folder=MICROSOFT_SHAREPOINT_FOLDER;
  let prefix="";
  if(folder){
    try{
      await microsoftGraphJson(`/sites/${encodeURIComponent(MICROSOFT_SHAREPOINT_SITE_ID)}/drives/${encodeURIComponent(MICROSOFT_SHAREPOINT_DRIVE_ID)}/root:/${oneDrivePath(folder)}`);
    }catch{
      await microsoftGraphJson(`/sites/${encodeURIComponent(MICROSOFT_SHAREPOINT_SITE_ID)}/drives/${encodeURIComponent(MICROSOFT_SHAREPOINT_DRIVE_ID)}/root/children`,{
        method:"POST",body:JSON.stringify({name:folder,folder:{}, "@microsoft.graph.conflictBehavior":"rename"})
      });
    }
    prefix=`${oneDrivePath(folder)}/`;
  }
  const endpoint=`/sites/${encodeURIComponent(MICROSOFT_SHAREPOINT_SITE_ID)}/drives/${encodeURIComponent(MICROSOFT_SHAREPOINT_DRIVE_ID)}/root:/${prefix}${encodeURIComponent(rec.filename)}:/content`;
  const response=await microsoftGraphRaw(endpoint,{method:"PUT",headers:{"Content-Type":"application/octet-stream"},body:buffer});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||`SharePoint upload failed (${response.status})`);
  await audit("microsoft.sharepoint_upload",{work_product_id:rec.id,filename:rec.filename,item_id:data.id||null});
  return {ok:true,item:data};
}

function base64UrlEncode(str) {
  return Buffer.from(str, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(str) {
  return Buffer.from(String(str || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function findHeader(headers, name) {
  return (headers || []).find(h => String(h.name).toLowerCase() === name.toLowerCase())?.value || "";
}

async function gmailSearch(args) {
  const q = encodeURIComponent(String(args.query || ""));
  const max = Math.max(1, Math.min(20, Number(args.maxResults || 10)));
  const list = await googleApi(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${max}`);
  const out = [];
  for (const m of (list.messages || []).slice(0, max)) {
    const msg = await googleApi(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`);
    out.push({
      id: msg.id,
      threadId: msg.threadId,
      from: findHeader(msg.payload?.headers, "From"),
      to: findHeader(msg.payload?.headers, "To"),
      subject: findHeader(msg.payload?.headers, "Subject"),
      date: findHeader(msg.payload?.headers, "Date"),
      snippet: msg.snippet || ""
    });
  }
  return { messages: out };
}

function extractGmailBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) return base64UrlDecode(payload.body.data);
  for (const p of payload.parts || []) {
    if (p.mimeType === "text/plain" && p.body?.data) return base64UrlDecode(p.body.data);
  }
  for (const p of payload.parts || []) {
    const nested = extractGmailBody(p);
    if (nested) return nested;
  }
  return "";
}

async function gmailRead(args) {
  const msg = await googleApi(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(args.messageId)}?format=full`);
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: findHeader(msg.payload?.headers, "From"),
    to: findHeader(msg.payload?.headers, "To"),
    subject: findHeader(msg.payload?.headers, "Subject"),
    date: findHeader(msg.payload?.headers, "Date"),
    snippet: msg.snippet || "",
    body: extractGmailBody(msg.payload).slice(0, 80_000)
  };
}

async function gmailSend(args) {
  const headers = [
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8"
  ];
  if (args.inReplyTo) headers.push(`In-Reply-To: ${args.inReplyTo}`);
  if (args.references) headers.push(`References: ${args.references}`);
  const raw = base64UrlEncode(headers.join("\r\n") + "\r\n\r\n" + String(args.body || ""));
  return googleApi("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw, ...(args.threadId ? { threadId: args.threadId } : {}) })
  });
}

async function calendarList(args) {
  const timeMin = encodeURIComponent(args.timeMin || new Date().toISOString());
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(Math.max(1, Math.min(50, Number(args.maxResults || 20)))),
    timeMin
  });
  if (args.timeMax) params.set("timeMax", args.timeMax);
  const data = await googleApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`);
  return {
    events: (data.items || []).map(e => ({
      id: e.id,
      summary: e.summary || "",
      start: e.start,
      end: e.end,
      location: e.location || "",
      htmlLink: e.htmlLink || ""
    }))
  };
}

async function calendarCreate(args) {
  const event = {
    summary: args.summary,
    description: args.description || "",
    location: args.location || "",
    start: args.allDay ? { date: args.start } : { dateTime: args.start, ...(args.timeZone ? { timeZone: args.timeZone } : {}) },
    end: args.allDay ? { date: args.end } : { dateTime: args.end, ...(args.timeZone ? { timeZone: args.timeZone } : {}) }
  };
  if (Array.isArray(args.attendees) && args.attendees.length) {
    event.attendees = args.attendees.map(email => ({ email }));
  }
  const query = args.sendUpdates ? `?sendUpdates=${encodeURIComponent(args.sendUpdates)}` : "";
  return googleApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events${query}`, {
    method: "POST",
    body: JSON.stringify(event)
  });
}

async function nuiteeSearchHotels(args) {
  if (!NUITEE_API_KEY) throw new Error("Nuitee API key is not configured.");
  const payload = {
    checkin: args.checkin,
    checkout: args.checkout,
    currency: args.currency || "USD",
    guestNationality: args.guestNationality || "US",
    occupancies: Array.isArray(args.occupancies) && args.occupancies.length ? args.occupancies : [{ adults: 2, children: [] }],
    timeout: Math.max(3, Math.min(12, Number(args.timeout || 8))),
    limit: Math.max(1, Math.min(30, Number(args.limit || 10))),
    maxRatesPerHotel: Math.max(1, Math.min(5, Number(args.maxRatesPerHotel || 1))),
    includeHotelData: true
  };
  if (args.cityName) payload.cityName = args.cityName;
  if (args.countryCode) payload.countryCode = args.countryCode;
  if (args.iataCode) payload.iataCode = args.iataCode;
  if (args.aiSearch) payload.aiSearch = args.aiSearch;

  const response = await fetch("https://api.liteapi.travel/v3.0/hotels/rates", {
    method: "POST",
    headers: {
      "X-API-Key": NUITEE_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || `Nuitee search failed (${response.status})`);
  return data;
}

function safeWorkspacePath(relPath) {
  const raw = String(relPath || "").replace(/^[/\\]+/, "");
  const resolved = path.resolve(WORKSPACE_DIR, raw);
  const base = path.resolve(WORKSPACE_DIR);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error("Path escapes the workspace sandbox.");
  }
  return resolved;
}

function listWorkspaceFilesRecursive(dir = WORKSPACE_DIR, prefix = "") {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(prefix, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listWorkspaceFilesRecursive(full, rel));
    } else {
      out.push(rel);
    }
    if (out.length >= 200) break;
  }
  return out;
}


function telegramConfigured(){return Boolean(TELEGRAM_BOT_TOKEN)}
function twilioConfigured(){return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_SMS_FROM || TWILIO_WHATSAPP_FROM))}
function messagingConfigured(){return telegramConfigured() || twilioConfigured()}
function allowedTwilioSender(from="") { return !TWILIO_ALLOWED_FROM.length || TWILIO_ALLOWED_FROM.includes(String(from)); }
function allowedTelegramChat(chatId="") { return !TELEGRAM_ALLOWED_CHAT_ID || String(chatId)===String(TELEGRAM_ALLOWED_CHAT_ID); }

async function telegramSendMessage(chatId,text){
  if(!telegramConfigured()) throw new Error("Telegram is not configured.");
  const r=await fetchWithRetry(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:String(chatId),text:String(text||"").slice(0,4000)})},{retries:2});
  const d=await r.json().catch(()=>({})); if(!r.ok||!d.ok)throw new Error(d?.description||`Telegram send failed (${r.status})`); return {ok:true,channel:"telegram",message_id:d?.result?.message_id||null};
}
async function twilioSendMessage({channel="sms",to,text}){
  if(!twilioConfigured()) throw new Error("Twilio messaging is not configured.");
  const isWhatsApp=channel==="whatsapp" || String(to||"").startsWith("whatsapp:");
  const from=isWhatsApp?TWILIO_WHATSAPP_FROM:TWILIO_SMS_FROM;
  if(!from) throw new Error(`${isWhatsApp?"WhatsApp":"SMS"} sender is not configured.`);
  const destination=isWhatsApp && !String(to).startsWith("whatsapp:")?`whatsapp:${to}`:String(to||"");
  const body=new URLSearchParams({From:from,To:destination,Body:String(text||"").slice(0,1500)});
  const auth=Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const r=await fetchWithRetry(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`,{method:"POST",headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()},{retries:2});
  const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d?.message||`Twilio send failed (${r.status})`); return {ok:true,channel:isWhatsApp?"whatsapp":"sms",sid:d.sid||null,status:d.status||null};
}
function twilioWebhookUrl(req){
  const base=(process.env.SITE_URL||`http://localhost:${PORT}`).replace(/\/$/,"");
  return `${base}${req.url}`;
}
function validateTwilioSignature(req,params){
  if(!TWILIO_AUTH_TOKEN)return false;
  const sig=String(req.headers["x-twilio-signature"]||"");
  let data=twilioWebhookUrl(req);
  for(const key of Object.keys(params).sort()) data+=key+String(params[key]??"");
  const expected=crypto.createHmac("sha1",TWILIO_AUTH_TOKEN).update(data).digest("base64");
  try{return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}catch{return false}
}
function likelyConsequentialMessage(text=""){
  return /\b(send|email|message|book|buy|purchase|pay|delete|cancel|publish|post|schedule|create\s+(?:an?\s+)?(?:event|meeting)|order|refund)\b/i.test(text);
}
async function runChannelAtlas({goal,channel,from}){
  const result=await runBackgroundAgent({
    name:`Atlas via ${channel}`,
    agentType:"atlas",
    model:"openrouter/free",
    webSearch:true,
    projectName:"General",
    goal:`You are replying through ${channel}. Be concise and useful. Use read-only tools when helpful. If the request requires a consequential action that cannot safely run in the background, clearly say that it is prepared but needs approval in the Atlas app.\n\nUSER MESSAGE:\n${goal}`
  });
  if(likelyConsequentialMessage(goal)){
    await addWorkflowCard({type:"channel_approval",title:`Approval requested from ${channel}`,body:`${from}: ${goal}`,agent:"atlas",status:"approval needed"}).catch(()=>{});
  } else {
    await addWorkflowCard({type:"channel_message",title:`Atlas handled ${channel} message`,body:String(goal).slice(0,500),agent:"atlas",status:"complete"}).catch(()=>{});
  }
  return result;
}
async function handleTelegramWebhook(req,res){
  if(!telegramConfigured()) return json(res,503,{error:"Telegram not configured."});
  if(!TELEGRAM_WEBHOOK_SECRET) return json(res,503,{error:"TELEGRAM_WEBHOOK_SECRET is required for inbound Telegram messages."});
  if(String(req.headers["x-telegram-bot-api-secret-token"]||"")!==TELEGRAM_WEBHOOK_SECRET) return json(res,403,{error:"Invalid Telegram webhook secret."});
  const body=await getBody(req,2_000_000); const msg=body?.message||body?.edited_message; const chatId=msg?.chat?.id; const text=String(msg?.text||msg?.caption||"").trim();
  if(!chatId||!text) return json(res,200,{ok:true,ignored:true});
  if(!allowedTelegramChat(chatId)) return json(res,403,{error:"Telegram chat is not allowed."});
  json(res,200,{ok:true});
  setImmediate(async()=>{try{const answer=await runChannelAtlas({goal:text,channel:"Telegram",from:String(chatId)});await telegramSendMessage(chatId,answer)}catch(err){await audit("channel.telegram.error",{error:err.message,chatId}).catch(()=>{})}});
}
async function handleTwilioInbound(req,res){
  if(!twilioConfigured()){res.writeHead(503,{"Content-Type":"text/xml"});return res.end("<Response/>")}
  const raw=await getRawBody(req,500_000); const params=parseFormEncoded(raw);
  if(!validateTwilioSignature(req,params)){res.writeHead(403,{"Content-Type":"text/xml"});return res.end("<Response/>")}
  const from=String(params.From||""); const text=String(params.Body||"").trim();
  if(!allowedTwilioSender(from)){res.writeHead(403,{"Content-Type":"text/xml"});return res.end("<Response/>")}
  res.writeHead(200,{"Content-Type":"text/xml; charset=utf-8"});res.end("<Response></Response>");
  if(!text)return;
  const channel=from.startsWith("whatsapp:")?"whatsapp":"sms";
  setImmediate(async()=>{try{const answer=await runChannelAtlas({goal:text,channel:channel==="whatsapp"?"WhatsApp":"SMS",from});await twilioSendMessage({channel,to:from,text:answer})}catch(err){await audit("channel.twilio.error",{error:err.message,from,channel}).catch(()=>{})}});
}

function slackConfigured(){return Boolean(SLACK_BOT_TOKEN)}
function shopifyConfigured(){return Boolean(SHOPIFY_STORE_DOMAIN&&SHOPIFY_ADMIN_TOKEN)}
function browserlessConfigured(){return Boolean(BROWSERLESS_TOKEN)}
async function slackApi(method,body={}){const r=await fetchWithRetry(`https://slack.com/api/${method}`,{method:"POST",headers:{Authorization:`Bearer ${SLACK_BOT_TOKEN}`,"Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(body)},{retries:3});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||`Slack API error (${r.status})`);return d}
async function shopifyApi(pathname,options={}){const r=await fetchWithRetry(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}${pathname}`,{...options,headers:{"X-Shopify-Access-Token":SHOPIFY_ADMIN_TOKEN,"Content-Type":"application/json",...(options.headers||{})}},{retries:3});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.errors?JSON.stringify(d.errors):`Shopify API error (${r.status})`);return d}


async function shopifyGraphql(query, variables = {}) {
  if (!shopifyConfigured()) throw new Error("Shopify is not configured.");
  const r = await fetchWithRetry(
    `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method:"POST",
      headers:{
        "X-Shopify-Access-Token":SHOPIFY_ADMIN_TOKEN,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({query,variables})
    },
    {retries:3}
  );
  const d = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(d?.errors ? JSON.stringify(d.errors) : `Shopify GraphQL error (${r.status})`);
  if (Array.isArray(d.errors) && d.errors.length) throw new Error(d.errors.map(x=>x.message||JSON.stringify(x)).join("; "));
  return d.data || {};
}

function cleanSlug(value="store") {
  return String(value||"store")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g,"")
    .trim()
    .replace(/[\s_]+/g,"-")
    .replace(/-+/g,"-")
    .slice(0,72) || "store";
}

function htmlEscapeServer(value="") {
  return String(value??"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function safeCssColor(value, fallback) {
  const s=String(value||"").trim();
  return /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-zA-Z]{3,20}$)/.test(s) ? s : fallback;
}

function normalizeShopifyStorePlan(input = {}) {
  const brand = input.brand || {};
  const visual = input.visual || {};
  const products = Array.isArray(input.products) ? input.products.slice(0,20) : [];
  const collections = Array.isArray(input.collections) ? input.collections.slice(0,10) : [];
  const pages = Array.isArray(input.pages) ? input.pages.slice(0,10) : [];
  const name = String(brand.name || input.store_name || "Atlas Store").trim().slice(0,100);

  return {
    id: String(input.id || crypto.randomUUID()),
    brand: {
      name,
      tagline: String(brand.tagline || input.tagline || "").trim().slice(0,220),
      description: String(brand.description || input.description || "").trim().slice(0,1200),
      tone: String(brand.tone || "premium, clear, trustworthy").trim().slice(0,220)
    },
    visual: {
      style_prompt: String(visual.style_prompt || input.style_prompt || "premium editorial ecommerce").trim().slice(0,800),
      primary: safeCssColor(visual.primary || "#111827","#111827"),
      background: safeCssColor(visual.background || "#F7F5F0","#F7F5F0"),
      accent: safeCssColor(visual.accent || "#C79A5B","#C79A5B"),
      text: safeCssColor(visual.text || "#111827","#111827")
    },
    hero: {
      eyebrow: String(input.hero?.eyebrow || "NEW COLLECTION").trim().slice(0,120),
      headline: String(input.hero?.headline || brand.tagline || `Discover ${name}`).trim().slice(0,180),
      subheadline: String(input.hero?.subheadline || brand.description || "Thoughtfully selected products, presented beautifully.").trim().slice(0,500),
      cta: String(input.hero?.cta || "Shop now").trim().slice(0,80)
    },
    products: products.map((p,i)=>({
      title: String(p.title || `Product ${i+1}`).trim().slice(0,180),
      handle: cleanSlug(p.handle || p.title || `product-${i+1}`),
      description_html: String(p.description_html || p.description || "").slice(0,10000),
      price: Math.max(0, Number(p.price || 0)),
      compare_at_price: Math.max(0, Number(p.compare_at_price || 0)),
      vendor: String(p.vendor || name).trim().slice(0,120),
      product_type: String(p.product_type || p.type || "").trim().slice(0,120),
      tags: Array.isArray(p.tags) ? p.tags.slice(0,30).map(x=>String(x).slice(0,80)) : [],
      images: Array.isArray(p.images) ? p.images.slice(0,8).map(String).filter(x=>/^https?:\/\//i.test(x)) : [],
      source_url: /^https?:\/\//i.test(String(p.source_url||"")) ? String(p.source_url) : "",
      verified_source: Boolean(p.verified_source),
      variants: Array.isArray(p.variants) ? p.variants.slice(0,100).map(v=>({
        title:String(v.title||"").slice(0,120),
        price:Math.max(0,Number(v.price ?? p.price ?? 0)),
        compare_at_price:Math.max(0,Number(v.compare_at_price ?? p.compare_at_price ?? 0)),
        options:(v.options && typeof v.options==="object" && !Array.isArray(v.options)) ? v.options : {}
      })) : []
    })),
    collections: collections.map((c,i)=>({
      title:String(c.title||`Collection ${i+1}`).trim().slice(0,180),
      handle:cleanSlug(c.handle||c.title||`collection-${i+1}`),
      description_html:String(c.description_html||c.description||"").slice(0,10000),
      product_titles:Array.isArray(c.product_titles)?c.product_titles.slice(0,100).map(String):[]
    })),
    pages: pages.map((p,i)=>({
      title:String(p.title||`Page ${i+1}`).trim().slice(0,180),
      handle:cleanSlug(p.handle||p.title||`page-${i+1}`),
      body_html:String(p.body_html||p.body||"").slice(0,20000)
    })),
    launch_notes:String(input.launch_notes||"").slice(0,4000),
    created_at: input.created_at || new Date().toISOString(),
    shopify: input.shopify || null
  };
}

function storeBuildPath(buildId) {
  const safe=cleanSlug(buildId);
  return path.join(STORE_BUILDS_DIR, `${safe}.json`);
}

function saveStoreBuild(plan) {
  const safeId=cleanSlug(plan.id);
  const final={...plan,id:safeId,updated_at:new Date().toISOString()};
  writeJsonFileSafe(storeBuildPath(safeId), final);
  return final;
}

function loadStoreBuild(buildId) {
  const p=storeBuildPath(buildId);
  if(!fs.existsSync(p)) throw new Error("Store build not found.");
  return normalizeShopifyStorePlan(readJsonFileSafe(p,{}));
}

function renderStorePreview(plan) {
  const p=normalizeShopifyStorePlan(plan);
  const previewDir=path.join(STORE_PREVIEW_DIR, cleanSlug(p.id));
  fs.mkdirSync(previewDir,{recursive:true});
  const products=p.products.slice(0,8).map((x,i)=>{
    const img=x.images?.[0];
    return `<article class="product">
      <div class="product-media">${img?`<img src="${htmlEscapeServer(img)}" alt="${htmlEscapeServer(x.title)}">`:`<div class="placeholder">${String(i+1).padStart(2,"0")}</div>`}</div>
      <div class="product-copy">
        <small>${htmlEscapeServer(x.product_type||"CURATED")}</small>
        <h3>${htmlEscapeServer(x.title)}</h3>
        <div class="price">${x.price?`$${Number(x.price).toFixed(2)}`:"Price coming soon"}</div>
      </div>
    </article>`;
  }).join("");

  const html=`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlEscapeServer(p.brand.name)} — Kairoq preview</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:${p.visual.text};background:${p.visual.background}}
a{text-decoration:none;color:inherit}.announcement{padding:9px 18px;background:${p.visual.primary};color:white;text-align:center;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
nav{height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid rgba(17,24,39,.12);background:rgba(255,255,255,.45);backdrop-filter:blur(18px);position:sticky;top:0;z-index:10}
.logo{font-family:Georgia,serif;font-size:25px;letter-spacing:.02em}.navlinks{display:flex;gap:26px;font-size:12px}.bag{font-size:12px;padding:10px 14px;border:1px solid currentColor;border-radius:999px}
.hero{min-height:68vh;display:grid;grid-template-columns:1.05fr .95fr;align-items:stretch}.hero-copy{padding:9vw 7vw;display:flex;flex-direction:column;justify-content:center}.eyebrow{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${p.visual.accent};font-weight:800}.hero h1{font-family:Georgia,serif;font-weight:500;font-size:clamp(46px,6vw,92px);line-height:.98;letter-spacing:-.045em;margin:20px 0;max-width:850px}.hero p{max-width:560px;font-size:16px;line-height:1.7;color:rgba(17,24,39,.68)}.cta{display:inline-flex;align-self:flex-start;margin-top:20px;padding:14px 20px;border-radius:999px;background:${p.visual.primary};color:#fff;font-size:12px;font-weight:800}
.hero-art{margin:28px 28px 28px 0;border-radius:28px;background:radial-gradient(circle at 68% 24%,${p.visual.accent},transparent 18%),linear-gradient(145deg,${p.visual.primary},${p.visual.accent});position:relative;overflow:hidden;min-height:520px}.hero-art:after{content:"${htmlEscapeServer(p.brand.name).replace('"','')}";position:absolute;left:8%;bottom:8%;font-family:Georgia,serif;font-size:9vw;line-height:.8;color:rgba(255,255,255,.13);white-space:nowrap}
.story{padding:90px 7vw;text-align:center}.story small{letter-spacing:.18em;font-size:10px;color:${p.visual.accent};font-weight:800}.story h2{font-family:Georgia,serif;font-size:clamp(32px,4vw,60px);font-weight:500;max-width:900px;margin:18px auto}.story p{max-width:700px;margin:auto;color:rgba(17,24,39,.63);line-height:1.7}
.products-wrap{padding:20px 5vw 90px}.section-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:26px}.section-head h2{font-family:Georgia,serif;font-size:40px;font-weight:500;margin:0}.section-head span{font-size:11px;color:rgba(17,24,39,.55)}
.products{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.product-media{aspect-ratio:4/5;border-radius:18px;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.7),rgba(17,24,39,.08))}.product-media img{width:100%;height:100%;object-fit:cover}.placeholder{height:100%;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:72px;color:rgba(17,24,39,.16)}.product-copy{padding:14px 4px}.product-copy small{font-size:9px;letter-spacing:.12em;color:rgba(17,24,39,.45)}.product h3{font-size:14px;margin:7px 0}.price{font-size:12px;color:rgba(17,24,39,.68)}
.promise{margin:0 5vw 80px;padding:50px;border-radius:26px;background:${p.visual.primary};color:white;display:grid;grid-template-columns:1fr 1fr;gap:60px}.promise h2{font-family:Georgia,serif;font-size:42px;font-weight:500;margin:0}.promise p{line-height:1.7;color:rgba(255,255,255,.72)}
footer{padding:50px 5vw;border-top:1px solid rgba(17,24,39,.12);display:flex;justify-content:space-between;font-size:11px;color:rgba(17,24,39,.55)}
.badge{position:fixed;right:18px;bottom:18px;padding:9px 12px;background:white;border:1px solid rgba(17,24,39,.12);border-radius:999px;font-size:10px;box-shadow:0 10px 30px rgba(17,24,39,.08)}
@media(max-width:900px){.hero{grid-template-columns:1fr}.hero-art{margin:0 20px 20px;min-height:420px}.products{grid-template-columns:repeat(2,1fr)}.promise{grid-template-columns:1fr}.navlinks{display:none}}@media(max-width:560px){.products{grid-template-columns:1fr}.hero-copy{padding:80px 24px}.products-wrap,.story{padding-left:20px;padding-right:20px}.promise{margin-left:20px;margin-right:20px;padding:30px}}
</style></head>
<body>
<div class="announcement">Kairoq concept preview · Draft only</div>
<nav><div class="logo">${htmlEscapeServer(p.brand.name)}</div><div class="navlinks"><a>Shop</a><a>About</a><a>Journal</a><a>Contact</a></div><div class="bag">Bag · 0</div></nav>
<section class="hero"><div class="hero-copy"><div class="eyebrow">${htmlEscapeServer(p.hero.eyebrow)}</div><h1>${htmlEscapeServer(p.hero.headline)}</h1><p>${htmlEscapeServer(p.hero.subheadline)}</p><a class="cta">${htmlEscapeServer(p.hero.cta)} →</a></div><div class="hero-art"></div></section>
<section class="story"><small>THE BRAND</small><h2>${htmlEscapeServer(p.brand.tagline||p.hero.headline)}</h2><p>${htmlEscapeServer(p.brand.description||"A clear, premium brand story designed to turn attention into confidence.")}</p></section>
<section class="products-wrap"><div class="section-head"><h2>Selected for you</h2><span>${p.products.length} products in draft</span></div><div class="products">${products||'<div>No products yet.</div>'}</div></section>
<section class="promise"><h2>Built to feel considered, not templated.</h2><p>${htmlEscapeServer(p.launch_notes||`Visual direction: ${p.visual.style_prompt}. Kairoq can now turn this concept into draft Shopify products, collections and pages, then keep iterating before launch.`)}</p></section>
<footer><span>© ${new Date().getFullYear()} ${htmlEscapeServer(p.brand.name)}</span><span>Store concept generated by Kairoq</span></footer>
<div class="badge">Preview · not live</div>
</body></html>`;
  fs.writeFileSync(path.join(previewDir,"index.html"),html,"utf8");
  return `/generated/store-previews/${cleanSlug(p.id)}/index.html`;
}

function createStoreConcept(args={}) {
  const plan=normalizeShopifyStorePlan(args);
  const saved=saveStoreBuild(plan);
  const preview_url=renderStorePreview(saved);
  return {
    ok:true,
    build_id:saved.id,
    store_name:saved.brand.name,
    preview_url,
    products:saved.products.length,
    collections:saved.collections.length,
    pages:saved.pages.length,
    note:"Concept preview created. Shopify is unchanged until the user approves applying the draft."
  };
}

function toProductSetInput(product) {
  const input={
    title:product.title,
    handle:product.handle,
    descriptionHtml:product.description_html || "",
    vendor:product.vendor || undefined,
    productType:product.product_type || undefined,
    tags:product.tags || [],
    status:"DRAFT",
    seo:{title:product.title.slice(0,70),description:String(product.description_html||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,320)}
  };
  if(product.images?.length) input.files=product.images.map((url,i)=>({originalSource:url,alt:`${product.title} ${i+1}`,contentType:"IMAGE"}));

  if(product.variants?.length){
    const optionNames=[...new Set(product.variants.flatMap(v=>Object.keys(v.options||{})))].slice(0,3);
    if(optionNames.length){
      input.productOptions=optionNames.map((name,idx)=>({
        name,
        position:idx+1,
        values:[...new Set(product.variants.map(v=>String(v.options?.[name]||"")).filter(Boolean))].map(name=>({name}))
      }));
      input.variants=product.variants.map(v=>({
        optionValues:optionNames.map(name=>({optionName:name,name:String(v.options?.[name]||"")})).filter(x=>x.name),
        price:Number(v.price||0),
        ...(Number(v.compare_at_price||0)>0?{compareAtPrice:Number(v.compare_at_price)}:{})
      }));
    } else {
      input.variants=product.variants.map(v=>({
        price:Number(v.price||0),
        ...(Number(v.compare_at_price||0)>0?{compareAtPrice:Number(v.compare_at_price)}:{})
      }));
    }
  } else if(Number(product.price||0)>0) {
    input.variants=[{
      price:Number(product.price),
      ...(Number(product.compare_at_price||0)>0?{compareAtPrice:Number(product.compare_at_price)}:{})
    }];
  }
  return input;
}

async function shopifyProductSet(product) {
  const query=`mutation AtlasProductSet($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input:$input,synchronous:$synchronous) {
      product { id title handle status variants(first:100){nodes{id title price compareAtPrice}} }
      userErrors { field message code }
    }
  }`;
  const d=await shopifyGraphql(query,{input:toProductSetInput(product),synchronous:true});
  const payload=d.productSet||{};
  if(payload.userErrors?.length) throw new Error(payload.userErrors.map(x=>x.message).join("; "));
  if(!payload.product?.id) throw new Error("Shopify did not return a product.");
  return payload.product;
}

async function shopifyCollectionCreate(collection, productIds=[]) {
  const query=`mutation AtlasCollectionCreate($input: CollectionInput!) {
    collectionCreate(input:$input) {
      collection { id title handle }
      userErrors { field message }
    }
  }`;
  const input={
    title:collection.title,
    handle:collection.handle,
    descriptionHtml:collection.description_html||"",
    ...(productIds.length?{products:productIds}:{})
  };
  const d=await shopifyGraphql(query,{input});
  const payload=d.collectionCreate||{};
  if(payload.userErrors?.length) throw new Error(payload.userErrors.map(x=>x.message).join("; "));
  return payload.collection;
}

async function shopifyPageCreate(page) {
  const query=`mutation AtlasPageCreate($page: PageCreateInput!) {
    pageCreate(page:$page) {
      page { id title handle }
      userErrors { field message code }
    }
  }`;
  const d=await shopifyGraphql(query,{page:{title:page.title,handle:page.handle,body:page.body_html||"",isPublished:false}});
  const payload=d.pageCreate||{};
  if(payload.userErrors?.length) throw new Error(payload.userErrors.map(x=>x.message).join("; "));
  return payload.page;
}

async function shopifyApplyStoreDraft(args={}) {
  const plan=loadStoreBuild(args.build_id);
  const result={build_id:plan.id,store_name:plan.brand.name,products:[],collections:[],pages:[],errors:[]};
  const titleToId=new Map();

  for(const product of plan.products){
    try{
      const created=await shopifyProductSet(product);
      result.products.push(created);
      titleToId.set(product.title.toLowerCase(),created.id);
    }catch(err){
      result.errors.push({type:"product",title:product.title,error:err.message});
    }
  }

  for(const collection of plan.collections){
    try{
      const ids=(collection.product_titles||[]).map(t=>titleToId.get(String(t).toLowerCase())).filter(Boolean);
      const created=await shopifyCollectionCreate(collection,ids);
      result.collections.push(created);
    }catch(err){
      result.errors.push({type:"collection",title:collection.title,error:err.message});
    }
  }

  for(const page of plan.pages){
    try{
      const created=await shopifyPageCreate(page);
      result.pages.push(created);
    }catch(err){
      result.errors.push({type:"page",title:page.title,error:err.message});
    }
  }

  const enriched=saveStoreBuild({
    ...plan,
    shopify:{
      applied_at:new Date().toISOString(),
      store:SHOPIFY_STORE_DOMAIN,
      products:result.products,
      collections:result.collections,
      pages:result.pages,
      errors:result.errors
    }
  });
  result.preview_url=renderStorePreview(enriched);
  result.theme_write_enabled=SHOPIFY_THEME_WRITE_ENABLED;
  result.note=SHOPIFY_THEME_WRITE_ENABLED
    ? "Draft resources created. Kairoq can also apply the generated homepage overlay to a NON-LIVE theme after separate approval."
    : "Draft resources created. Theme preview is local because Shopify theme-file API access requires write_themes plus Shopify's exemption.";

  upsertOpenLoop({
    title:`Launch ${plan.brand.name} store`,
    goal:`The ${plan.brand.name} Shopify store is reviewed, visually approved, and intentionally launched.`,
    source:"shopify",
    source_ref:SHOPIFY_STORE_DOMAIN,
    status: result.errors.length ? "blocked" : "approval",
    next_action: result.errors.length ? "Resolve Shopify draft creation errors, then review the preview." : "Review the store preview and draft resources; apply the theme to a duplicate theme if available, then approve launch.",
    waiting_on:"store owner",
    completion_signal:"Store is live on the intended domain with approved products, pages, collections and theme.",
    risk:"medium",
    notes:`Draft build ${plan.id}. Created ${result.products.length} products, ${result.collections.length} collections, ${result.pages.length} pages. Errors: ${result.errors.length}.`
  });

  await audit("shopify.store_draft_applied",{build_id:plan.id,store:SHOPIFY_STORE_DOMAIN,created:{products:result.products.length,collections:result.collections.length,pages:result.pages.length},errors:result.errors.length});
  return result;
}

async function shopifyListThemes() {
  const query=`query AtlasThemes { themes(first:20) { nodes { id name role processing } } }`;
  const d=await shopifyGraphql(query,{});
  return {themes:d.themes?.nodes||[],theme_write_enabled:SHOPIFY_THEME_WRITE_ENABLED};
}

function renderThemeFiles(plan) {
  const p=normalizeShopifyStorePlan(plan);
  const createdProducts=p.shopify?.products||[];
  const productByHandle=new Map(createdProducts.map(x=>[x.handle,x]));
  const productCards=p.products.slice(0,8).map(x=>{
    const shop=productByHandle.get(x.handle);
    const href=shop?.handle?`/products/${shop.handle}`:"#";
    const image=x.images?.[0];
    return `<a class="atlas-product" href="${href}">
      <div class="atlas-product-media">${image?`<img src="${image}" alt="${htmlEscapeServer(x.title)}">`:""}</div>
      <div class="atlas-product-title">${htmlEscapeServer(x.title)}</div>
      <div class="atlas-product-price">${x.price?`$${Number(x.price).toFixed(2)}`:""}</div>
    </a>`;
  }).join("\n");

  const section=`{{ 'atlas-store.css' | asset_url | stylesheet_tag }}
<section class="atlas-home" style="--atlas-primary:${p.visual.primary};--atlas-bg:${p.visual.background};--atlas-accent:${p.visual.accent};--atlas-text:${p.visual.text}">
  <div class="atlas-hero">
    <div class="atlas-hero-copy">
      <div class="atlas-eyebrow">${htmlEscapeServer(p.hero.eyebrow)}</div>
      <h1>${htmlEscapeServer(p.hero.headline)}</h1>
      <p>${htmlEscapeServer(p.hero.subheadline)}</p>
      <a href="/collections/all" class="atlas-cta">${htmlEscapeServer(p.hero.cta)} →</a>
    </div>
    <div class="atlas-hero-art"><span>${htmlEscapeServer(p.brand.name)}</span></div>
  </div>
  <div class="atlas-story"><small>THE BRAND</small><h2>${htmlEscapeServer(p.brand.tagline||p.hero.headline)}</h2><p>${htmlEscapeServer(p.brand.description)}</p></div>
  <div class="atlas-products"><div class="atlas-head"><h2>Selected for you</h2><a href="/collections/all">View all</a></div><div class="atlas-grid">${productCards}</div></div>
</section>
{% schema %}{"name":"Kairoq Storefront","settings":[],"presets":[{"name":"Kairoq Storefront"}]}{% endschema %}`;

  const css=`.atlas-home{background:var(--atlas-bg);color:var(--atlas-text);font-family:var(--font-body-family,Arial,sans-serif)}.atlas-hero{min-height:70vh;display:grid;grid-template-columns:1.05fr .95fr;align-items:stretch}.atlas-hero-copy{padding:9vw 7vw;display:flex;flex-direction:column;justify-content:center}.atlas-eyebrow{font-size:11px;letter-spacing:.18em;color:var(--atlas-accent);font-weight:700}.atlas-hero h1{font-family:var(--font-heading-family,Georgia,serif);font-size:clamp(48px,6vw,92px);font-weight:500;line-height:.98;letter-spacing:-.04em;margin:20px 0}.atlas-hero p{max-width:560px;line-height:1.7;opacity:.68}.atlas-cta{align-self:flex-start;margin-top:18px;padding:14px 20px;background:var(--atlas-primary);color:#fff;border-radius:999px;text-decoration:none;font-size:12px;font-weight:700}.atlas-hero-art{margin:28px 28px 28px 0;border-radius:28px;background:radial-gradient(circle at 68% 24%,var(--atlas-accent),transparent 18%),linear-gradient(145deg,var(--atlas-primary),var(--atlas-accent));position:relative;overflow:hidden}.atlas-hero-art span{position:absolute;bottom:8%;left:8%;font-family:Georgia,serif;font-size:8vw;color:rgba(255,255,255,.13);white-space:nowrap}.atlas-story{padding:90px 7vw;text-align:center}.atlas-story small{letter-spacing:.18em;color:var(--atlas-accent)}.atlas-story h2{font-family:Georgia,serif;font-size:clamp(34px,4vw,60px);font-weight:500}.atlas-story p{max-width:700px;margin:auto;line-height:1.7;opacity:.65}.atlas-products{padding:20px 5vw 90px}.atlas-head{display:flex;justify-content:space-between;align-items:end}.atlas-head h2{font-family:Georgia,serif;font-size:40px;font-weight:500}.atlas-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.atlas-product{text-decoration:none;color:inherit}.atlas-product-media{aspect-ratio:4/5;border-radius:18px;overflow:hidden;background:linear-gradient(145deg,#fff,rgba(0,0,0,.07))}.atlas-product-media img{width:100%;height:100%;object-fit:cover}.atlas-product-title{font-weight:650;font-size:14px;margin-top:12px}.atlas-product-price{font-size:12px;opacity:.6;margin-top:5px}@media(max-width:900px){.atlas-hero{grid-template-columns:1fr}.atlas-hero-art{min-height:420px;margin:0 20px 20px}.atlas-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.atlas-grid{grid-template-columns:1fr}.atlas-hero-copy{padding:80px 24px}}`;
  const template=JSON.stringify({sections:{atlas_home:{type:"atlas-home",settings:{}}},order:["atlas_home"]});
  return [
    {filename:"sections/atlas-home.liquid",body:{type:"TEXT",value:section}},
    {filename:"assets/atlas-store.css",body:{type:"TEXT",value:css}},
    {filename:"templates/index.json",body:{type:"TEXT",value:template}}
  ];
}

async function shopifyApplyThemeOverlay(args={}) {
  if(!SHOPIFY_THEME_WRITE_ENABLED) throw new Error("Theme write is disabled. Set SHOPIFY_THEME_WRITE_ENABLED=true only after the Shopify app has write_themes access and Shopify's required exemption.");
  const build=loadStoreBuild(args.build_id);
  const themes=await shopifyListThemes();
  const theme=themes.themes.find(x=>x.id===args.theme_id);
  if(!theme) throw new Error("Theme was not found or cannot be read.");
  if(String(theme.role||"").toUpperCase()==="MAIN") throw new Error("Kairoq refuses to overwrite the live MAIN theme. Duplicate the theme first and apply the draft to the duplicate.");
  const query=`mutation AtlasThemeFiles($files:[OnlineStoreThemeFilesUpsertFileInput!]!,$themeId:ID!){
    themeFilesUpsert(files:$files,themeId:$themeId){upsertedThemeFiles{filename} job{id} userErrors{field message}}
  }`;
  const d=await shopifyGraphql(query,{themeId:args.theme_id,files:renderThemeFiles(build)});
  const payload=d.themeFilesUpsert||{};
  if(payload.userErrors?.length) throw new Error(payload.userErrors.map(x=>x.message).join("; "));
  await audit("shopify.theme_overlay_applied",{build_id:build.id,theme_id:args.theme_id,theme_name:theme.name,files:payload.upsertedThemeFiles?.map(x=>x.filename)||[]});
  return {ok:true,build_id:build.id,theme,files:payload.upsertedThemeFiles||[],job:payload.job||null,note:"Applied only to a non-live theme. Review it in Shopify before any launch decision."};
}


function metaAdsConfigured(){
  return Boolean(META_ADS_ACCESS_TOKEN && META_AD_ACCOUNT_ID);
}
function googleAdsConfigured(){
  return Boolean(GOOGLE_ADS_CUSTOMER_ID && googleConfigured());
}
function dateOnlyUTC(date){
  return new Date(date).toISOString().slice(0,10);
}
function dateRangeForDays(days=30){
  const safe=Math.max(1,Math.min(365,Number(days||30)));
  const until=new Date();
  const since=new Date(Date.now()-(safe-1)*86400000);
  return {days:safe,since:dateOnlyUTC(since),until:dateOnlyUTC(until)};
}
function moneyAmount(moneyBag){
  return Number(moneyBag?.shopMoney?.amount ?? moneyBag?.presentmentMoney?.amount ?? 0) || 0;
}

async function shopifyAbandonedCheckouts(args={}){
  if(!shopifyConfigured())throw new Error("Shopify is not configured.");
  const {days,since}=dateRangeForDays(args.days||30);
  const first=Math.max(1,Math.min(100,Number(args.limit||50)));
  const query=`query AtlasAbandonedCheckouts($first:Int!,$query:String!){
    abandonedCheckouts(first:$first,sortKey:CREATED_AT,reverse:true,query:$query){
      nodes{
        id name createdAt updatedAt completedAt abandonedCheckoutUrl
        customer{firstName lastName email}
        totalPriceSet{shopMoney{amount currencyCode}}
        subtotalPriceSet{shopMoney{amount currencyCode}}
        lineItems(first:20){nodes{title quantity}}
      }
    }
  }`;
  const data=await shopifyGraphql(query,{first,query:`created_at:>=${since}`});
  const nodes=data.abandonedCheckouts?.nodes||[];
  const rows=nodes.map(x=>({
    id:x.id,name:x.name,created_at:x.createdAt,updated_at:x.updatedAt,completed_at:x.completedAt||null,
    recovery_url:x.abandonedCheckoutUrl,
    customer:x.customer?{
      first_name:x.customer.firstName||"",
      last_name:x.customer.lastName||"",
      email:x.customer.email||""
    }:null,
    total:moneyAmount(x.totalPriceSet),
    currency:x.totalPriceSet?.shopMoney?.currencyCode||null,
    items:(x.lineItems?.nodes||[]).map(i=>({title:i.title,quantity:Number(i.quantity||0)}))
  }));
  const unresolved=rows.filter(x=>!x.completed_at);
  const recovered=rows.filter(x=>Boolean(x.completed_at));
  return {
    period_days:days,
    checkouts:rows,
    metrics:{
      total_records:rows.length,
      unresolved:unresolved.length,
      recovered:recovered.length,
      unresolved_value:Number(unresolved.reduce((s,x)=>s+Number(x.total||0),0).toFixed(2)),
      recovered_value:Number(recovered.reduce((s,x)=>s+Number(x.total||0),0).toFixed(2)),
      observed_recovery_rate:rows.length?Number((recovered.length/rows.length*100).toFixed(1)):0
    },
    note:"Shopify abandoned checkouts include both abandoned and recovered checkouts. Recovery rate here is only for the returned records in this analysis window."
  };
}

function pickMetaAction(actions=[], preferred=[]){
  for(const type of preferred){
    const row=(actions||[]).find(x=>x.action_type===type);
    if(row && Number.isFinite(Number(row.value)))return Number(row.value);
  }
  return 0;
}
async function metaAdsInsights(args={}){
  if(!metaAdsConfigured())throw new Error("Meta Ads is not configured.");
  const {days,since,until}=dateRangeForDays(args.days||30);
  const params=new URLSearchParams({
    access_token:META_ADS_ACCESS_TOKEN,
    level:"campaign",
    fields:"campaign_id,campaign_name,spend,impressions,clicks,actions,action_values",
    time_range:JSON.stringify({since,until}),
    limit:"100"
  });
  const url=`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${META_AD_ACCOUNT_ID}/insights?${params.toString()}`;
  const response=await fetchWithRetry(url,{}, {retries:3});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||`Meta Ads API error (${response.status})`);
  const purchaseTypes=["offsite_conversion.fb_pixel_purchase","omni_purchase","purchase"];
  const rows=(data.data||[]).map(x=>{
    const spend=Number(x.spend||0);
    const purchases=pickMetaAction(x.actions,purchaseTypes);
    const purchase_value=pickMetaAction(x.action_values,purchaseTypes);
    return {
      campaign_id:x.campaign_id||"",
      campaign_name:x.campaign_name||"",
      spend,impressions:Number(x.impressions||0),clicks:Number(x.clicks||0),
      purchases,purchase_value,
      cpc:Number(x.clicks||0)>0?spend/Number(x.clicks):0,
      roas:spend>0?purchase_value/spend:0
    };
  });
  const totals=rows.reduce((a,x)=>({
    spend:a.spend+x.spend,impressions:a.impressions+x.impressions,clicks:a.clicks+x.clicks,
    purchases:a.purchases+x.purchases,purchase_value:a.purchase_value+x.purchase_value
  }),{spend:0,impressions:0,clicks:0,purchases:0,purchase_value:0});
  return {
    configured:true,period_days:days,source:"meta_ads",campaigns:rows,
    metrics:{
      spend:Number(totals.spend.toFixed(2)),
      impressions:totals.impressions,
      clicks:totals.clicks,
      purchases:Number(totals.purchases.toFixed(2)),
      purchase_value:Number(totals.purchase_value.toFixed(2)),
      cpc:totals.clicks?Number((totals.spend/totals.clicks).toFixed(2)):0,
      reported_roas:totals.spend?Number((totals.purchase_value/totals.spend).toFixed(2)):0
    },
    note:"Meta purchase counts/value use the first available purchase action type from pixel purchase, omni purchase, or purchase to reduce obvious double-counting."
  };
}

async function googleAdsApi(query){
  if(!googleAdsConfigured())throw new Error("Google Ads is not configured.");
  const accessToken=await getGoogleAccessToken();
  const headers={
    "Authorization":`Bearer ${accessToken}`,
    "Content-Type":"application/json"
  };
  if(GOOGLE_ADS_LOGIN_CUSTOMER_ID)headers["login-customer-id"]=GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  const response=await fetchWithRetry(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${GOOGLE_ADS_CUSTOMER_ID}/googleAds:searchStream`,
    {method:"POST",headers,body:JSON.stringify({query})},
    {retries:3}
  );
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const msg=data?.error?.message||data?.[0]?.error?.message||`Google Ads API error (${response.status})`;
    throw new Error(msg);
  }
  return Array.isArray(data)?data:[];
}
async function googleAdsInsights(args={}){
  const {days,since,until}=dateRangeForDays(args.days||30);
  const query=`SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value
  FROM campaign
  WHERE segments.date BETWEEN '${since}' AND '${until}'
    AND campaign.status != 'REMOVED'
  ORDER BY metrics.cost_micros DESC
  LIMIT 100`;
  const chunks=await googleAdsApi(query);
  const results=chunks.flatMap(x=>x.results||[]);
  const rows=results.map(r=>{
    const spend=Number(r.metrics?.costMicros||0)/1_000_000;
    const conversions=Number(r.metrics?.conversions||0);
    const conversion_value=Number(r.metrics?.conversionsValue||0);
    return {
      campaign_id:r.campaign?.id||"",
      campaign_name:r.campaign?.name||"",
      status:r.campaign?.status||"",
      spend,impressions:Number(r.metrics?.impressions||0),clicks:Number(r.metrics?.clicks||0),
      conversions,conversion_value,
      cpc:Number(r.metrics?.clicks||0)>0?spend/Number(r.metrics.clicks):0,
      reported_roas:spend>0?conversion_value/spend:0
    };
  });
  const totals=rows.reduce((a,x)=>({
    spend:a.spend+x.spend,impressions:a.impressions+x.impressions,clicks:a.clicks+x.clicks,
    conversions:a.conversions+x.conversions,conversion_value:a.conversion_value+x.conversion_value
  }),{spend:0,impressions:0,clicks:0,conversions:0,conversion_value:0});
  return {
    configured:true,period_days:days,source:"google_ads",campaigns:rows,
    metrics:{
      spend:Number(totals.spend.toFixed(2)),impressions:totals.impressions,clicks:totals.clicks,
      conversions:Number(totals.conversions.toFixed(2)),
      conversion_value:Number(totals.conversion_value.toFixed(2)),
      cpc:totals.clicks?Number((totals.spend/totals.clicks).toFixed(2)):0,
      reported_roas:totals.spend?Number((totals.conversion_value/totals.spend).toFixed(2)):0
    },
    note:"Google Ads conversions and conversion value use the account's configured conversion actions and attribution settings."
  };
}

function calculateCommerceFunnel({storeHealth=null,abandoned=null,meta=null,google=null,days=30}={}){
  const shop=storeHealth?.metrics||{};
  const metaM=meta?.metrics||{};
  const googleM=google?.metrics||{};
  const abandonedM=abandoned?.metrics||{};
  const adSpend=Number(metaM.spend||0)+Number(googleM.spend||0);
  const shopifyValue=Number(shop.gross_order_value||0);
  const blendedRoas=adSpend>0?shopifyValue/adSpend:0;
  const issues=[];
  if(Number(abandonedM.unresolved||0)>0){
    issues.push({
      severity:Number(abandonedM.unresolved_value||0)>=Math.max(500,shopifyValue*.15)?"high":"medium",
      type:"abandoned_checkout_opportunity",
      message:`${abandonedM.unresolved} unresolved checkout${Number(abandonedM.unresolved)===1?"":"s"} represent ${Number(abandonedM.unresolved_value||0).toFixed(2)} in observed checkout value.`
    });
  }
  if(adSpend>0 && shopifyValue>0 && adSpend>shopifyValue){
    issues.push({severity:"high",type:"blended_paid_media_pressure",message:"Paid-media spend is greater than gross Shopify order value in the same analysis window."});
  }
  if(adSpend>0 && shopifyValue===0){
    issues.push({severity:"high",type:"paid_media_no_shopify_revenue",message:"Ad spend is present but the Shopify order sample shows no gross order value in the same window."});
  }
  return {
    period_days:Number(days||30),
    generated_at:new Date().toISOString(),
    metrics:{
      shopify_gross_order_value:Number(shopifyValue.toFixed(2)),
      shopify_orders:Number(shop.orders||0),
      ad_spend:Number(adSpend.toFixed(2)),
      meta_spend:Number(metaM.spend||0),
      google_spend:Number(googleM.spend||0),
      blended_roas:Number(blendedRoas.toFixed(2)),
      unresolved_checkouts:Number(abandonedM.unresolved||0),
      abandoned_checkout_value:Number(abandonedM.unresolved_value||0),
      observed_checkout_recovery_rate:Number(abandonedM.observed_recovery_rate||0)
    },
    issues,
    attribution_note:"Blended ROAS compares Shopify gross order value with combined connected ad-platform spend. It is directional, not attributed ROAS: platform attribution windows, organic/direct sales, taxes, refunds, and channel overlap can differ."
  };
}
async function commerceFunnelHealth(args={}){
  const days=Math.max(1,Math.min(365,Number(args.days||30)));
  const results=await Promise.allSettled([
    shopifyConfigured()?shopifyStoreHealth({days}):Promise.resolve(null),
    shopifyConfigured()?shopifyAbandonedCheckouts({days,limit:100}):Promise.resolve(null),
    metaAdsConfigured()?metaAdsInsights({days}):Promise.resolve(null),
    googleAdsConfigured()?googleAdsInsights({days}):Promise.resolve(null)
  ]);
  const value=i=>results[i].status==="fulfilled"?results[i].value:null;
  const errors=results.map((r,i)=>r.status==="rejected"?{source:["shopify","abandoned_checkouts","meta_ads","google_ads"][i],error:r.reason?.message||String(r.reason)}:null).filter(Boolean);
  const storeHealth=value(0),abandoned=value(1),meta=value(2),google=value(3);
  return {
    configured:{shopify:shopifyConfigured(),meta_ads:metaAdsConfigured(),google_ads:googleAdsConfigured()},
    ...calculateCommerceFunnel({storeHealth,abandoned,meta,google,days}),
    store_health:storeHealth,
    abandoned,
    meta_ads:meta,
    google_ads:google,
    errors
  };
}

function normalizeStoreExperiment(input={}) {
  const now=new Date().toISOString();
  const allowedStatus=new Set(["draft","ready","running","paused","won","lost","cancelled"]);
  const status=allowedStatus.has(String(input.status||"").toLowerCase()) ? String(input.status).toLowerCase() : "draft";
  return {
    id:String(input.id||crypto.randomUUID()),
    name:String(input.name||input.hypothesis||"Store experiment").trim().slice(0,180),
    hypothesis:String(input.hypothesis||"").trim().slice(0,1200),
    target:String(input.target||"homepage").trim().slice(0,300),
    primary_metric:String(input.primary_metric||"conversion rate").trim().slice(0,180),
    baseline:input.baseline==null?null:Number(input.baseline),
    variant_a:String(input.variant_a||"Current experience").trim().slice(0,3000),
    variant_b:String(input.variant_b||"Proposed change").trim().slice(0,3000),
    expected_impact:String(input.expected_impact||"").trim().slice(0,800),
    status,
    started_at:input.started_at||null,
    ended_at:input.ended_at||null,
    result:String(input.result||"").trim().slice(0,2000),
    created_at:input.created_at||now,
    updated_at:now
  };
}
function loadStoreExperiments(){
  const x=readJsonFileSafe(STORE_EXPERIMENTS_FILE,[]);
  return Array.isArray(x)?x.map(normalizeStoreExperiment):[];
}
function saveStoreExperiments(items){
  const safe=(Array.isArray(items)?items:[]).slice(0,500);
  writeJsonFileSafe(STORE_EXPERIMENTS_FILE,safe);
  return safe;
}
function upsertStoreExperiment(input={}){
  const all=loadStoreExperiments();
  const normalized=normalizeStoreExperiment(input);
  let i=input.id?all.findIndex(x=>x.id===input.id):-1;
  if(i>=0){
    all[i]=normalizeStoreExperiment({...all[i],...input,id:all[i].id,created_at:all[i].created_at});
    saveStoreExperiments(all);
    return all[i];
  }
  all.unshift(normalized);
  saveStoreExperiments(all);
  return normalized;
}

function sumRefundAmount(order={}){
  let total=0;
  for(const refund of (order.refunds||[])){
    for(const tx of (refund.transactions||[])){
      const amount=Number(tx.amount||0);
      if(Number.isFinite(amount)) total+=amount;
    }
  }
  return total;
}
function calculateStoreHealth(products=[],orders=[],days=30){
  const since=Date.now()-Math.max(1,Number(days||30))*86400000;
  const recent=(orders||[]).filter(o=>{
    const t=Date.parse(o.created_at||o.processed_at||"");
    return !Number.isFinite(t) || t>=since;
  });
  const completed=recent.filter(o=>String(o.cancelled_at||"")==="" && !["voided"].includes(String(o.financial_status||"").toLowerCase()));
  const revenue=completed.reduce((s,o)=>s+Number(o.total_price||o.current_total_price||0),0);
  const refunds=completed.reduce((s,o)=>s+sumRefundAmount(o),0);
  const aov=completed.length?revenue/completed.length:0;
  const productRows=(products||[]).map(p=>{
    const variants=Array.isArray(p.variants)?p.variants:[];
    const qty=variants.reduce((s,v)=>s+Math.max(0,Number(v.inventory_quantity||0)),0);
    const tracksInventory=variants.some(v=>v.inventory_management);
    const hasImage=Boolean(p.image||p.images?.length);
    const hasDescription=String(p.body_html||"").replace(/<[^>]+>/g,"").trim().length>=40;
    const prices=variants.map(v=>Number(v.price||0)).filter(Number.isFinite);
    return {
      id:p.id,title:p.title,handle:p.handle,status:p.status||"active",
      inventory_quantity:qty,tracks_inventory:tracksInventory,has_image:hasImage,
      has_description:hasDescription,min_price:prices.length?Math.min(...prices):0,
      vendor:p.vendor||"",product_type:p.product_type||""
    };
  });
  const issues=[];
  for(const p of productRows){
    if(p.tracks_inventory && p.inventory_quantity<=0)issues.push({severity:"high",type:"out_of_stock",product:p.title,message:`${p.title} appears out of stock.`});
    if(!p.has_image)issues.push({severity:"high",type:"missing_image",product:p.title,message:`${p.title} has no product image.`});
    if(!p.has_description)issues.push({severity:"medium",type:"thin_description",product:p.title,message:`${p.title} has a thin or missing product description.`});
    if(!p.min_price || p.min_price<=0)issues.push({severity:"high",type:"missing_price",product:p.title,message:`${p.title} has no valid price.`});
    if(!p.product_type)issues.push({severity:"low",type:"missing_type",product:p.title,message:`${p.title} is missing product type taxonomy.`});
  }
  const unfulfilled=recent.filter(o=>!o.cancelled_at && ["unfulfilled","partial",null,""].includes(o.fulfillment_status)).length;
  const unpaid=recent.filter(o=>["pending","authorized","partially_paid"].includes(String(o.financial_status||"").toLowerCase())).length;
  if(unfulfilled>=3)issues.unshift({severity:"medium",type:"fulfillment_queue",message:`${unfulfilled} recent orders are not fully fulfilled.`});
  if(unpaid>=2)issues.unshift({severity:"medium",type:"payment_queue",message:`${unpaid} recent orders are pending or not fully paid.`});
  if(refunds>0 && revenue>0 && refunds/revenue>=0.08)issues.unshift({severity:"high",type:"refund_rate",message:`Refund value is ${((refunds/revenue)*100).toFixed(1)}% of gross order value in the analyzed sample.`});

  const healthScore=Math.max(0,100
    - issues.filter(x=>x.severity==="high").length*12
    - issues.filter(x=>x.severity==="medium").length*5
    - issues.filter(x=>x.severity==="low").length*2
  );

  return {
    period_days:Number(days||30),
    generated_at:new Date().toISOString(),
    metrics:{
      orders:recent.length,
      gross_order_value:Number(revenue.toFixed(2)),
      refunds:Number(refunds.toFixed(2)),
      net_after_refunds:Number((revenue-refunds).toFixed(2)),
      aov:Number(aov.toFixed(2)),
      unfulfilled_orders:unfulfilled,
      payment_attention:unpaid,
      products:productRows.length,
      out_of_stock_products:productRows.filter(p=>p.tracks_inventory&&p.inventory_quantity<=0).length
    },
    health_score:healthScore,
    issues:issues.slice(0,50),
    products:productRows.slice(0,100),
    note:"This is an operational health snapshot from Shopify catalog/order data. It is not a full conversion funnel because storefront sessions and ad-platform attribution require additional analytics sources."
  };
}
async function shopifyStoreHealth(args={}){
  const days=Math.max(1,Math.min(365,Number(args.days||30)));
  const createdMin=new Date(Date.now()-days*86400000).toISOString();
  const [pd,od]=await Promise.all([
    shopifyApi(`/products.json?limit=250&status=active`),
    shopifyApi(`/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(createdMin)}`)
  ]);
  return calculateStoreHealth(pd.products||[],od.orders||[],days);
}
async function storefrontAudit(args={}){
  if(!browserlessConfigured())throw new Error("Browserless is not configured.");
  const rendered=await browserlessRender({url:args.url,waitForTimeout:args.waitForTimeout||1800});
  const raw=String(rendered.html||"");
  const text=raw.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  const titles=[...raw.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map(x=>x[1].replace(/<[^>]+>/g," ").trim());
  const h1=[...raw.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(x=>x[1].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
  const imgs=[...raw.matchAll(/<img\b[^>]*>/gi)].map(x=>x[0]);
  const missingAlt=imgs.filter(tag=>!/\balt\s*=\s*["'][^"']+["']/i.test(tag)).length;
  const links=(raw.match(/<a\b/gi)||[]).length;
  const buttons=(raw.match(/<button\b/gi)||[]).length;
  const forms=(raw.match(/<form\b/gi)||[]).length;
  const metaDesc=(raw.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)||[])[1]||"";
  return {
    url:args.url,
    title:titles[0]||"",
    h1_count:h1.length,
    h1:h1.slice(0,5),
    meta_description:metaDesc,
    image_count:imgs.length,
    images_missing_alt:missingAlt,
    link_count:links,
    button_count:buttons,
    form_count:forms,
    visible_text_length:text.length,
    text_excerpt:text.slice(0,12000),
    recommendations_hint:"Use this evidence with the store context to identify clarity, trust, mobile UX, merchandising, SEO, and conversion problems. Do not claim a conversion lift without an experiment."
  };
}

async function browserlessRender(args){const r=await fetchWithRetry(`${BROWSERLESS_URL}/content?token=${encodeURIComponent(BROWSERLESS_TOKEN)}`,{method:"POST",headers:{"Content-Type":"application/json","Cache-Control":"no-cache"},body:JSON.stringify({url:args.url,waitForTimeout:Math.max(0,Math.min(15000,Number(args.waitForTimeout||1500))),gotoOptions:{waitUntil:"networkidle2",timeout:30000}})},{retries:2});const html=await r.text();if(!r.ok)throw new Error(`Browserless render failed (${r.status})`);return{url:args.url,html:html.slice(0,200000)}}
async function browserlessAgentTask(args){const r=await fetchWithRetry(`${BROWSERLESS_URL}/agent/run?token=${encodeURIComponent(BROWSERLESS_TOKEN)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task:args.task,...(args.startUrl?{startUrl:args.startUrl}:{}),...(Array.isArray(args.allowedDomains)&&args.allowedDomains.length?{allowedDomains:args.allowedDomains.slice(0,20)}:{})})},{retries:2});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||`Browserless agent start failed (${r.status})`);const id=d.id||d.runId||d.run_id;if(!id)return d;for(let i=0;i<60;i++){await sleep(2000);const p=await fetchWithRetry(`${BROWSERLESS_URL}/agent/run/${encodeURIComponent(id)}?token=${encodeURIComponent(BROWSERLESS_TOKEN)}`,{},{retries:2});const x=await p.json().catch(()=>({}));if(!p.ok)throw new Error(x?.message||`Browserless poll failed (${p.status})`);const st=String(x.status||x.state||"").toLowerCase();if(["completed","complete","succeeded","success","failed","error","cancelled","canceled"].includes(st))return x}return{id,status:"timeout"}}


function browserDomainList(args={}) {
  const raw=Array.isArray(args.allowedDomains)?args.allowedDomains:[];
  const domains=[...new Set(raw.map(x=>String(x||"").trim().toLowerCase()).filter(Boolean))].slice(0,20);
  if(args.startUrl){
    try{
      const host=new URL(args.startUrl).hostname.toLowerCase();
      if(host && !domains.some(d=>host===d||host.endsWith(`.${d}`))) domains.unshift(host);
    }catch{}
  }
  return domains.slice(0,20);
}
function validateBrowserStartUrl(url=""){
  if(!url)return "";
  const u=new URL(String(url));
  if(!["http:","https:"].includes(u.protocol))throw new Error("Browser start URL must use http or https.");
  return u.toString();
}
async function browserResearchTask(args={}){
  const startUrl=validateBrowserStartUrl(args.startUrl||"");
  const allowedDomains=browserDomainList({...args,startUrl});
  const objective=String(args.task||"").trim();
  if(!objective)throw new Error("Browser research task is required.");
  const task=`READ-ONLY BROWSER MISSION

Objective:
${objective}

Rules:
- You may navigate pages, follow ordinary links, expand menus, paginate, and inspect rendered content.
- Do NOT sign in, create accounts, type into forms except a site's own search box when necessary for navigation, submit forms, send messages, upload files, accept contracts, add items to cart, start checkout, make reservations, purchase, publish, delete, or change account/store settings.
- Do NOT enter passwords, one-time codes, payment details, government IDs, private keys, API keys, or other secrets.
- Stay within the allowed domains.
- Collect concrete evidence and URLs/visible facts when available.
- Stop if the task would require a consequential action and report exactly what action is needed next.
- Return a concise result plus the page/state where you stopped.`;
  const result=await browserlessAgentTask({task,startUrl,allowedDomains});
  await audit("browser.research_task",{objective:objective.slice(0,1000),startUrl:startUrl||null,allowedDomains,status:result?.status||null});
  return {mode:"research",objective,start_url:startUrl||null,allowed_domains:allowedDomains,result};
}
async function browserActionTask(args={}){
  const startUrl=validateBrowserStartUrl(args.startUrl||"");
  const allowedDomains=browserDomainList({...args,startUrl});
  if(!allowedDomains.length)throw new Error("Browser action requires at least one allowed domain or a start URL.");
  const objective=String(args.task||"").trim();
  if(!objective)throw new Error("Browser action task is required.");
  const expectedChanges=String(args.expectedChanges||"").trim();
  const successCondition=String(args.successCondition||"").trim();
  const task=`APPROVED BROWSER ACTION

Objective:
${objective}

Expected changes approved by the user:
${expectedChanges||"Only the changes strictly necessary to complete the objective."}

Success condition:
${successCondition||"Complete the explicitly approved objective and verify the resulting page state."}

Safety rules:
- Stay strictly within the allowed domains.
- Perform only the action described above. Do not expand the scope because another action seems useful.
- Never enter or reveal passwords, one-time codes, payment card/bank details, private keys, API keys, government IDs, recovery codes, or other secrets.
- Do not purchase, transfer money, place a financial booking/order, publish public content, delete data, cancel services, change security settings, or agree to legal terms unless that exact consequential change is explicitly stated in the approved objective and expected changes.
- If the site asks for an unapproved consequential action or sensitive credential, STOP and report what is needed.
- Verify the final state before reporting success.
- Report actions performed, final state, and anything still unfinished.`;
  const result=await browserlessAgentTask({task,startUrl,allowedDomains});
  await audit("browser.action_task",{objective:objective.slice(0,1000),expectedChanges:expectedChanges.slice(0,1000),successCondition:successCondition.slice(0,1000),startUrl:startUrl||null,allowedDomains,status:result?.status||null});
  return {mode:"action",objective,expected_changes:expectedChanges,success_condition:successCondition,start_url:startUrl||null,allowed_domains:allowedDomains,result};
}

function githubConfigured() {
  return Boolean(GITHUB_TOKEN && GITHUB_REPO && GITHUB_REPO.includes("/"));
}

function agentToolDefinitions({ allowWeb = true } = {}) {
  const tools = [
    {
      type: "function",
      function: {
        name: "list_workspace_files",
        description: "List files in the agent's sandboxed workspace folder.",
        parameters: { type: "object", properties: {}, additionalProperties: false }
      }
    },
    {
      type: "function",
      function: {
        name: "read_workspace_file",
        description: "Read a UTF-8 text file from the sandboxed workspace folder.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path inside workspace." }
          },
          required: ["path"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "write_workspace_file",
        description: "Create or replace a text file inside the sandboxed workspace. This action requires human approval.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" }
          },
          required: ["path", "content"],
          additionalProperties: false
        }
      }
    }
  ];

  if (githubConfigured()) {
    tools.push(
      {
        type: "function",
        function: {
          name: "github_read_file",
          description: `Read a file from the configured GitHub repository ${GITHUB_REPO}.`,
          parameters: {
            type: "object",
            properties: {
              path: { type: "string" },
              ref: { type: "string", description: "Optional branch/tag/commit." }
            },
            required: ["path"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "github_create_issue",
          description: `Create an issue in ${GITHUB_REPO}. Requires human approval.`,
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" }
            },
            required: ["title", "body"],
            additionalProperties: false
          }
        }
      }
    );
  }


  if (googleConfigured()) {
    tools.push(
      {
        type: "function",
        function: {
          name: "gmail_search",
          description: "Search the connected Gmail mailbox. Read-only.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Gmail search query, e.g. from:alice newer_than:7d" },
              maxResults: { type: "integer", minimum: 1, maximum: 20 }
            },
            required: ["query"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "gmail_read",
          description: "Read a Gmail message by message ID. Read-only.",
          parameters: {
            type: "object",
            properties: { messageId: { type: "string" } },
            required: ["messageId"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "gmail_send",
          description: "Send an email from the connected Gmail account. Requires human approval.",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
              threadId: { type: "string" },
              inReplyTo: { type: "string" },
              references: { type: "string" }
            },
            required: ["to", "subject", "body"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "calendar_list",
          description: "List upcoming events from the connected primary Google Calendar. Read-only.",
          parameters: {
            type: "object",
            properties: {
              timeMin: { type: "string", description: "RFC3339 timestamp" },
              timeMax: { type: "string", description: "RFC3339 timestamp" },
              maxResults: { type: "integer", minimum: 1, maximum: 50 }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "calendar_create",
          description: "Create an event in the connected primary Google Calendar. Requires human approval.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string" },
              description: { type: "string" },
              location: { type: "string" },
              start: { type: "string" },
              end: { type: "string" },
              timeZone: { type: "string" },
              allDay: { type: "boolean" },
              attendees: { type: "array", items: { type: "string" } },
              sendUpdates: { type: "string", enum: ["all", "externalOnly", "none"] }
            },
            required: ["summary", "start", "end"],
            additionalProperties: false
          }
        }
      }
    );
  }

  if (NUITEE_API_KEY) {
    tools.push({
      type: "function",
      function: {
        name: "nuitee_search_hotels",
        description: "Search live Nuitee/LiteAPI hotel availability and rates. Read-only. Does not book.",
        parameters: {
          type: "object",
          properties: {
            checkin: { type: "string", description: "YYYY-MM-DD" },
            checkout: { type: "string", description: "YYYY-MM-DD" },
            currency: { type: "string" },
            guestNationality: { type: "string" },
            cityName: { type: "string" },
            countryCode: { type: "string" },
            iataCode: { type: "string" },
            aiSearch: { type: "string" },
            occupancies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  adults: { type: "integer" },
                  children: { type: "array", items: { type: "integer" } }
                },
                required: ["adults"],
                additionalProperties: false
              }
            },
            limit: { type: "integer", minimum: 1, maximum: 30 },
            maxRatesPerHotel: { type: "integer", minimum: 1, maximum: 5 }
          },
          required: ["checkin", "checkout"],
          additionalProperties: false
        }
      }
    });
  }


  tools.push({type:"function",function:{
    name:"create_store_concept",
    description:"Create a premium ecommerce store concept and local preview from a structured plan. This does NOT change Shopify and is safe to run automatically. Use this first when the user asks Atlas to build a store.",
    parameters:{type:"object",properties:{
      brand:{type:"object",properties:{name:{type:"string"},tagline:{type:"string"},description:{type:"string"},tone:{type:"string"}},required:["name"],additionalProperties:false},
      visual:{type:"object",properties:{style_prompt:{type:"string"},primary:{type:"string"},background:{type:"string"},accent:{type:"string"},text:{type:"string"}},additionalProperties:false},
      hero:{type:"object",properties:{eyebrow:{type:"string"},headline:{type:"string"},subheadline:{type:"string"},cta:{type:"string"}},additionalProperties:false},
      products:{type:"array",maxItems:20,items:{type:"object",properties:{
        title:{type:"string"},handle:{type:"string"},description_html:{type:"string"},price:{type:"number"},compare_at_price:{type:"number"},vendor:{type:"string"},product_type:{type:"string"},tags:{type:"array",items:{type:"string"}},images:{type:"array",items:{type:"string"}},source_url:{type:"string"},verified_source:{type:"boolean"},
        variants:{type:"array",items:{type:"object",properties:{title:{type:"string"},price:{type:"number"},compare_at_price:{type:"number"},options:{type:"object",additionalProperties:{type:"string"}}},additionalProperties:false}}
      },required:["title"],additionalProperties:false}},
      collections:{type:"array",maxItems:10,items:{type:"object",properties:{title:{type:"string"},handle:{type:"string"},description_html:{type:"string"},product_titles:{type:"array",items:{type:"string"}}},required:["title"],additionalProperties:false}},
      pages:{type:"array",maxItems:10,items:{type:"object",properties:{title:{type:"string"},handle:{type:"string"},body_html:{type:"string"}},required:["title"],additionalProperties:false}},
      launch_notes:{type:"string"}
    },required:["brand","products"],additionalProperties:false}
  }});

  if(slackConfigured())tools.push({type:"function",function:{name:"slack_history",description:"Read recent Slack channel messages.",parameters:{type:"object",properties:{channel:{type:"string"},limit:{type:"integer",minimum:1,maximum:100}},required:["channel"],additionalProperties:false}}},{type:"function",function:{name:"slack_send",description:"Post a Slack message.",parameters:{type:"object",properties:{channel:{type:"string"},text:{type:"string"}},required:["channel","text"],additionalProperties:false}}});
  if(shopifyConfigured())tools.push(
    {type:"function",function:{name:"shopify_list_products",description:"List Shopify products.",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:100}},additionalProperties:false}}},
    {type:"function",function:{name:"shopify_list_orders",description:"List recent Shopify orders.",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:100},status:{type:"string"}},additionalProperties:false}}},
    {type:"function",function:{name:"shopify_apply_store_draft",description:"Apply a Kairoq store concept to Shopify as DRAFT products, collections, and UNPUBLISHED pages. Requires approval. It does not publish the store or touch the live theme.",parameters:{type:"object",properties:{build_id:{type:"string"}},required:["build_id"],additionalProperties:false}}},
    {type:"function",function:{name:"shopify_list_themes",description:"List Shopify themes and their roles so Kairoq can find a safe non-live theme for preview work.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"shopify_store_health",description:"Analyze current Shopify products and recent orders for operational/revenue issues such as out-of-stock products, missing merchandising, fulfillment queue, payment attention and refund pressure. Read-only.",parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365}},additionalProperties:false}}},
    {type:"function",function:{name:"shopify_abandoned_checkouts",description:"Read Shopify abandoned/recovered checkout records in a time window, including observed checkout value and recovery URLs. Read-only. Never message a customer unless separately approved.",parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365},limit:{type:"integer",minimum:1,maximum:100}},additionalProperties:false}}},
    {type:"function",function:{name:"commerce_funnel_health",description:"Combine Shopify store health, abandoned checkout signals, and any connected Meta/Google Ads reporting into one directional funnel snapshot. Read-only.",parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365}},additionalProperties:false}}},
    {type:"function",function:{name:"create_store_experiment",description:"Create an internal ecommerce optimization experiment proposal. This does not change the storefront. Use it when evidence suggests a test worth running.",parameters:{type:"object",properties:{
      name:{type:"string"},hypothesis:{type:"string"},target:{type:"string"},primary_metric:{type:"string"},baseline:{type:["number","null"]},variant_a:{type:"string"},variant_b:{type:"string"},expected_impact:{type:"string"},status:{type:"string",enum:["draft","ready"]}
    },required:["name","hypothesis","target","primary_metric","variant_a","variant_b"],additionalProperties:false}}},
    {type:"function",function:{name:"list_store_experiments",description:"List ecommerce optimization experiments and their current status.",parameters:{type:"object",properties:{status:{type:"string"}},additionalProperties:false}}},
    {type:"function",function:{name:"update_store_experiment",description:"Update the status or result of an existing ecommerce experiment. This only changes internal Kairoq state.",parameters:{type:"object",properties:{id:{type:"string"},status:{type:"string",enum:["draft","ready","running","paused","won","lost","cancelled"]},result:{type:"string"}},required:["id"],additionalProperties:false}}},
    ...(SHOPIFY_THEME_WRITE_ENABLED?[{type:"function",function:{name:"shopify_apply_theme_overlay",description:"Apply the generated Kairoq homepage files to a NON-LIVE Shopify theme. Requires approval. Refuses to modify the MAIN live theme.",parameters:{type:"object",properties:{build_id:{type:"string"},theme_id:{type:"string"}},required:["build_id","theme_id"],additionalProperties:false}}}]:[])
  );
  if(metaAdsConfigured())tools.push({type:"function",function:{
    name:"meta_ads_insights",
    description:"Read Meta Ads campaign-level spend, impressions, clicks and reported purchase signals. Read-only.",
    parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365}},additionalProperties:false}
  }});
  if(googleAdsConfigured())tools.push({type:"function",function:{
    name:"google_ads_insights",
    description:"Read Google Ads campaign-level spend, impressions, clicks and configured conversion signals. Read-only.",
    parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365}},additionalProperties:false}
  }});

  if(browserlessConfigured())tools.push(
    {type:"function",function:{name:"browser_render",description:"Render a JavaScript-heavy URL in a real browser.",parameters:{type:"object",properties:{url:{type:"string"},waitForTimeout:{type:"integer",minimum:0,maximum:15000}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"storefront_audit",description:"Read-only storefront audit using a real rendered browser page. Returns page structure, visible text, title/H1/meta, image alt coverage, CTAs and forms for evidence-based conversion/SEO review.",parameters:{type:"object",properties:{url:{type:"string"},waitForTimeout:{type:"integer",minimum:0,maximum:15000}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"browser_research_task",description:"Run a managed READ-ONLY browser mission. It may navigate dynamic sites and inspect multiple pages automatically, but it must stop before consequential changes, messages, submissions, purchases, publishing, deletion, account changes, or sensitive credential entry. Use this when web search alone is not enough.",parameters:{type:"object",properties:{
      task:{type:"string",description:"The evidence or information Kairoq needs from the website."},
      startUrl:{type:"string",description:"Optional starting URL."},
      allowedDomains:{type:"array",items:{type:"string"},description:"Domains the browser may visit."}
    },required:["task"],additionalProperties:false}}},
    {type:"function",function:{name:"browser_action_task",description:"Run a managed browser mission that can click and type to complete an APPROVED website action. This always requires human approval. State the exact expected changes and success condition so the approval card is understandable.",parameters:{type:"object",properties:{
      task:{type:"string",description:"Exact website action to perform."},
      startUrl:{type:"string"},
      allowedDomains:{type:"array",items:{type:"string"},minItems:1},
      expectedChanges:{type:"string",description:"Concrete state changes that will happen if approved."},
      successCondition:{type:"string",description:"How Kairoq should verify the action succeeded."}
    },required:["task","expectedChanges","successCondition"],additionalProperties:false}}},
    {type:"function",function:{name:"browser_agent_task",description:"Legacy approval-gated managed browser action. Prefer browser_research_task for read-only missions and browser_action_task for website actions.",parameters:{type:"object",properties:{task:{type:"string"},startUrl:{type:"string"},allowedDomains:{type:"array",items:{type:"string"}}},required:["task"],additionalProperties:false}}}
  );
  tools.push(
    {type:"function",function:{name:"list_open_loops",description:"List unresolved outcomes Kairoq is responsible for following until completion.",parameters:{type:"object",properties:{include_done:{type:"boolean"}},additionalProperties:false}}},
    {type:"function",function:{name:"create_open_loop",description:"Create or update an internal open loop when a real-world outcome remains unresolved. This is internal state only and does not perform external actions.",parameters:{type:"object",properties:{
      title:{type:"string"},
      goal:{type:"string"},
      source:{type:"string"},
      source_ref:{type:"string"},
      status:{type:"string",enum:["open","waiting","approval","blocked"]},
      next_action:{type:"string"},
      waiting_on:{type:"string"},
      due_at:{type:["string","null"]},
      completion_signal:{type:"string"},
      money_value:{type:"number"},
      risk:{type:"string",enum:["low","medium","high"]},
      notes:{type:"string"}
    },required:["title","goal"],additionalProperties:false}}},
    {type:"function",function:{name:"update_open_loop",description:"Update an existing open loop, including marking it done only when there is evidence the outcome is complete.",parameters:{type:"object",properties:{
      id:{type:"string"},
      status:{type:"string",enum:["open","waiting","approval","blocked","done","cancelled"]},
      next_action:{type:"string"},
      waiting_on:{type:"string"},
      due_at:{type:["string","null"]},
      completion_signal:{type:"string"},
      money_value:{type:"number"},
      risk:{type:"string",enum:["low","medium","high"]},
      notes:{type:"string"}
    },required:["id"],additionalProperties:false}}}
  );

  tools.push(
    {type:"function",function:{name:"create_excel_workbook",description:"Create a real .xlsx workbook and save it as a Kairoq work product. Use formulas for calculated cells when appropriate.",parameters:{type:"object",properties:{
      title:{type:"string"},filename:{type:"string"},
      sheets:{type:"array",maxItems:20,items:{type:"object",properties:{
        name:{type:"string"},title:{type:"string"},
        headers:{type:"array",items:{type:"string"}},
        rows:{type:"array",items:{type:"array",items:{type:["string","number","boolean","null"]}}},
        formulas:{type:"array",items:{type:"object",properties:{cell:{type:"string"},formula:{type:"string"}},required:["cell","formula"],additionalProperties:false}},
        notes:{type:"array",items:{type:"string"}}
      },required:["name"],additionalProperties:false}}
    },required:["title","sheets"],additionalProperties:false}}},
    {type:"function",function:{name:"create_word_document",description:"Create a real .docx business document.",parameters:{type:"object",properties:{
      title:{type:"string"},filename:{type:"string"},subtitle:{type:"string"},
      sections:{type:"array",items:{type:"object",properties:{
        heading:{type:"string"},paragraphs:{type:"array",items:{type:"string"}},bullets:{type:"array",items:{type:"string"}},
        table_headers:{type:"array",items:{type:"string"}},table_rows:{type:"array",items:{type:"array",items:{type:["string","number","boolean","null"]}}}
      },additionalProperties:false}},
      source_notes:{type:"array",items:{type:"string"}}
    },required:["title","sections"],additionalProperties:false}}},
    {type:"function",function:{name:"create_powerpoint",description:"Create a real .pptx presentation with a clean Kairoq business layout.",parameters:{type:"object",properties:{
      title:{type:"string"},filename:{type:"string"},subtitle:{type:"string"},
      slides:{type:"array",maxItems:40,items:{type:"object",properties:{
        title:{type:"string"},subtitle:{type:"string"},body:{type:"string"},bullets:{type:"array",items:{type:"string"}},
        table_headers:{type:"array",items:{type:"string"}},table_rows:{type:"array",items:{type:"array",items:{type:["string","number","boolean","null"]}}}
      },required:["title"],additionalProperties:false}}
    },required:["title","slides"],additionalProperties:false}}},
    {type:"function",function:{name:"create_pdf_report",description:"Create a real .pdf report.",parameters:{type:"object",properties:{
      title:{type:"string"},filename:{type:"string"},
      sections:{type:"array",items:{type:"object",properties:{
        heading:{type:"string"},paragraphs:{type:"array",items:{type:"string"}},bullets:{type:"array",items:{type:"string"}},
        table_headers:{type:"array",items:{type:"string"}},table_rows:{type:"array",items:{type:"array",items:{type:["string","number","boolean","null"]}}}
      },additionalProperties:false}}
    },required:["title","sections"],additionalProperties:false}}},
    {type:"function",function:{name:"create_csv_file",description:"Create a .csv data file.",parameters:{type:"object",properties:{
      title:{type:"string"},filename:{type:"string"},headers:{type:"array",items:{type:"string"}},rows:{type:"array",items:{type:"array",items:{type:["string","number","boolean","null"]}}}
    },required:["title","headers","rows"],additionalProperties:false}}},
    {type:"function",function:{name:"list_work_products",description:"List files Kairoq has generated in Work Studio.",parameters:{type:"object",properties:{},additionalProperties:false}}}
  );

  tools.push(
    {type:"function",function:{name:"create_media_job",description:"Create a persistent local/free image or video generation job. The job becomes a Kairoq Outcome and stays open until the generated file is actually ready. This autonomous tool never uses premium paid providers.",parameters:{type:"object",properties:{kind:{type:"string",enum:["image","video"]},prompt:{type:"string"},image_size:{type:"string",enum:["square_hd","portrait_4_3","portrait_16_9","landscape_4_3","landscape_16_9"]},duration:{type:"integer",minimum:2,maximum:10},reference_image:{type:"string"}},required:["kind","prompt"],additionalProperties:false}}},
    {type:"function",function:{name:"list_media_jobs",description:"List persistent creative jobs and their current status/results.",parameters:{type:"object",properties:{},additionalProperties:false}}}
  );
  if(microsoftConfigured())tools.push(
    {type:"function",function:{name:"microsoft_onedrive_list",description:"List files in the Kairoq OneDrive folder. Read-only.",parameters:{type:"object",properties:{folder:{type:"string"},limit:{type:"integer",minimum:1,maximum:100}},additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_onedrive_upload_work_product",description:"Upload a Kairoq-generated work product to the user's OneDrive Kairoq folder. Requires approval.",parameters:{type:"object",properties:{work_product_id:{type:"string"},filename:{type:"string"}},additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_excel_read_range",description:"Read a range from a Kairoq XLSX work product already uploaded to OneDrive. Read-only.",parameters:{type:"object",properties:{work_product_id:{type:"string"},filename:{type:"string"},worksheet:{type:"string"},address:{type:"string"}},required:["worksheet","address"],additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_excel_update_range",description:"Update values/formulas/number format in a Kairoq XLSX work product already uploaded to OneDrive using Excel Online. Requires approval.",parameters:{type:"object",properties:{work_product_id:{type:"string"},filename:{type:"string"},worksheet:{type:"string"},address:{type:"string"},values:{type:"array",items:{type:"array"}},formulas:{type:"array",items:{type:"array"}},numberFormat:{type:"array",items:{type:"array"}}},required:["worksheet","address"],additionalProperties:false}}}
  );
  if(microsoftConfigured()&&MICROSOFT_ENABLE_OUTLOOK)tools.push(
    {type:"function",function:{name:"microsoft_outlook_search",description:"Search/list the signed-in user's Outlook mail. Read-only.",parameters:{type:"object",properties:{query:{type:"string"},limit:{type:"integer",minimum:1,maximum:50}},additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_outlook_read",description:"Read an Outlook message by ID. Read-only.",parameters:{type:"object",properties:{message_id:{type:"string"}},required:["message_id"],additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_outlook_send",description:"Send an Outlook email. Requires human approval.",parameters:{type:"object",properties:{to:{oneOf:[{type:"string"},{type:"array",items:{type:"string"}}]},cc:{type:"array",items:{type:"string"}},subject:{type:"string"},body:{type:"string"},html:{type:"boolean"}},required:["to","subject","body"],additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_calendar_list",description:"List Outlook/Microsoft 365 calendar events. Read-only.",parameters:{type:"object",properties:{start:{type:"string"},end:{type:"string"},limit:{type:"integer",minimum:1,maximum:100}},additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_calendar_create",description:"Create a Microsoft 365 calendar event. Requires human approval.",parameters:{type:"object",properties:{subject:{type:"string"},body:{type:"string"},start:{type:"string"},end:{type:"string"},time_zone:{type:"string"},location:{type:"string"},attendees:{type:"array",items:{type:"string"}}},required:["subject","start","end"],additionalProperties:false}}}
  );
  if(microsoftConfigured()&&MICROSOFT_ENABLE_TEAMS)tools.push(
    {type:"function",function:{name:"microsoft_teams_list",description:"List Microsoft Teams the signed-in work/school user belongs to. Read-only.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_teams_channels",description:"List channels in a Microsoft Team. Read-only.",parameters:{type:"object",properties:{team_id:{type:"string"}},required:["team_id"],additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_teams_send",description:"Send a message to a Microsoft Teams channel. Requires human approval.",parameters:{type:"object",properties:{team_id:{type:"string"},channel_id:{type:"string"},message:{type:"string"}},required:["team_id","channel_id","message"],additionalProperties:false}}}
  );
  if(microsoftSharePointConfigured())tools.push(
    {type:"function",function:{name:"microsoft_sharepoint_list",description:"List root files/folders in the configured SharePoint document library. Read-only.",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:100}},additionalProperties:false}}},
    {type:"function",function:{name:"microsoft_sharepoint_upload_work_product",description:"Upload a Kairoq-generated work product to the configured SharePoint document library. Requires approval.",parameters:{type:"object",properties:{work_product_id:{type:"string"},filename:{type:"string"}},additionalProperties:false}}}
  );

  if(messagingConfigured())tools.push({type:"function",function:{name:"message_send",description:"Send an approved outbound message through Telegram, WhatsApp, or SMS. Requires human approval.",parameters:{type:"object",properties:{channel:{type:"string",enum:["telegram","whatsapp","sms"]},to:{type:"string"},text:{type:"string"}},required:["channel","to","text"],additionalProperties:false}}});
  tools.push({type:"function",function:{name:"delegate_agent",description:"Delegate a bounded subtask to another specialist agent.",parameters:{type:"object",properties:{agentType:{type:"string",enum:["atlas","scout","forge","relay","orbit","compass","ledger","beacon","vault","rover","writer","closer","guardian"]},goal:{type:"string"}},required:["agentType","goal"],additionalProperties:false}}});

  if (AGENT_WEBHOOK_URL) {
    tools.push({
      type: "function",
      function: {
        name: "send_webhook",
        description: "Send a JSON payload to the single preconfigured webhook destination. Requires human approval.",
        parameters: {
          type: "object",
          properties: {
            payload: { type: "object", additionalProperties: true }
          },
          required: ["payload"],
          additionalProperties: false
        }
      }
    });
  }

  if (allowWeb) {
    tools.push(
      {
        type: "openrouter:web_search",
        parameters: {
          engine: "auto",
          max_results: 5,
          max_total_results: 10,
          search_context_size: "medium"
        }
      },
      { type: "openrouter:web_fetch" }
    );
  }

  return tools;
}

function toolNeedsApproval(name) {
  return new Set(["write_workspace_file", "github_create_issue", "send_webhook", "gmail_send", "calendar_create", "message_send", "shopify_apply_store_draft", "shopify_apply_theme_overlay", "browser_action_task", "browser_agent_task", "microsoft_onedrive_upload_work_product", "microsoft_excel_update_range", "microsoft_outlook_send", "microsoft_calendar_create", "microsoft_teams_send", "microsoft_sharepoint_upload_work_product"]).has(name);
}

async function requestHumanApproval({ name, args, sseRes }) {
  const id = crypto.randomUUID();
  writeSSE(sseRes, "approval_required", {
    id,
    tool: name,
    args,
    message: `Agent wants to run ${name}.`
  });

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(id);
      resolve({ approved: false, reason: "Approval timed out." });
    }, 10 * 60 * 1000);

    pendingApprovals.set(id, {
      resolve: (result) => {
        clearTimeout(timer);
        pendingApprovals.delete(id);
        resolve(result);
      }
    });
  });
}

async function executeAgentTool(name, args, context = {}) {
  if (name === "list_workspace_files") {
    return { files: listWorkspaceFilesRecursive() };
  }

  if (name === "read_workspace_file") {
    const full = safeWorkspacePath(args.path);
    if (!fs.existsSync(full)) throw new Error("Workspace file not found.");
    const stat = fs.statSync(full);
    if (!stat.isFile()) throw new Error("Path is not a file.");
    if (stat.size > 1_000_000) throw new Error("File is too large to read through this tool.");
    return { path: args.path, content: fs.readFileSync(full, "utf8") };
  }

  if (name === "write_workspace_file") {
    const full = safeWorkspacePath(args.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, String(args.content || ""), "utf8");
    return { ok: true, path: args.path, bytes: Buffer.byteLength(String(args.content || ""), "utf8") };
  }


  if (name === "gmail_search") return gmailSearch(args);
  if (name === "gmail_read") return gmailRead(args);
  if (name === "gmail_send") return gmailSend(args);
  if (name === "calendar_list") return calendarList(args);
  if (name === "calendar_create") return calendarCreate(args);
  if (name === "nuitee_search_hotels") return nuiteeSearchHotels(args);


  if(name==="create_store_concept"){
    const result=createStoreConcept(args);
    await audit("store.concept_created",{build_id:result.build_id,store_name:result.store_name,products:result.products});
    return result;
  }
  if(name==="slack_history"){const d=await slackApi("conversations.history",{channel:args.channel,limit:Math.max(1,Math.min(100,Number(args.limit||30)))});return{messages:(d.messages||[]).map(m=>({ts:m.ts,user:m.user,text:m.text}))}}
  if(name==="slack_send"){const d=await slackApi("chat.postMessage",{channel:args.channel,text:args.text});return{ok:true,channel:d.channel,ts:d.ts}}
  if(name==="shopify_list_products")return shopifyApi(`/products.json?limit=${Math.max(1,Math.min(100,Number(args.limit||25)))}`);
  if(name==="shopify_list_orders"){const l=Math.max(1,Math.min(100,Number(args.limit||25))),st=encodeURIComponent(args.status||"any");return shopifyApi(`/orders.json?status=${st}&limit=${l}`)}
  if(name==="shopify_store_health")return shopifyStoreHealth(args);
  if(name==="shopify_abandoned_checkouts")return shopifyAbandonedCheckouts(args);
  if(name==="commerce_funnel_health")return commerceFunnelHealth(args);
  if(name==="meta_ads_insights")return metaAdsInsights(args);
  if(name==="google_ads_insights")return googleAdsInsights(args);
  if(name==="create_store_experiment"){
    const exp=upsertStoreExperiment({...args,status:args.status||"draft"});
    upsertOpenLoop({
      title:`Review ecommerce test: ${exp.name}`,
      goal:`Decide whether to run the ${exp.name} experiment and record a measured result.`,
      source:"shopify",
      source_ref:exp.id,
      status:"approval",
      next_action:"Review the evidence and experiment variants, then approve or reject the test.",
      waiting_on:"store owner",
      completion_signal:"Experiment is completed with a measured result or intentionally cancelled.",
      risk:"low",
      notes:`Primary metric: ${exp.primary_metric}. Hypothesis: ${exp.hypothesis}`
    });
    await audit("store.experiment_created",{id:exp.id,name:exp.name,target:exp.target});
    return {ok:true,experiment:exp,note:"Experiment created as internal state only. The storefront was not changed."};
  }
  if(name==="list_store_experiments"){
    let items=loadStoreExperiments();
    if(args?.status)items=items.filter(x=>x.status===args.status);
    return {experiments:items};
  }
  if(name==="update_store_experiment"){
    const current=loadStoreExperiments().find(x=>x.id===args.id);
    if(!current)throw new Error("Store experiment not found.");
    const exp=upsertStoreExperiment({...current,...args,id:current.id});
    await audit("store.experiment_updated",{id:exp.id,name:exp.name,status:exp.status});
    return {ok:true,experiment:exp};
  }
  if(name==="shopify_apply_store_draft")return shopifyApplyStoreDraft(args);
  if(name==="shopify_list_themes")return shopifyListThemes();
  if(name==="shopify_apply_theme_overlay")return shopifyApplyThemeOverlay(args);
  if(name==="browser_render")return browserlessRender(args);
  if(name==="storefront_audit")return storefrontAudit(args);
  if(name==="browser_research_task")return browserResearchTask(args);
  if(name==="browser_action_task")return browserActionTask(args);
  if(name==="browser_agent_task")return browserlessAgentTask(args);

  if(name==="list_open_loops"){
    let loops=sortOpenLoops(loadOpenLoops());
    if(!args?.include_done)loops=loops.filter(x=>!["done","cancelled"].includes(x.status));
    return {loops:loops.slice(0,100),value_at_stake:loops.reduce((s,x)=>s+Number(x.money_value||0),0)};
  }
  if(name==="create_open_loop"){
    const loop=upsertOpenLoop({...args,source:args.source||"agent"});
    await audit("open_loop.agent_created",{id:loop.id,title:loop.title,status:loop.status});
    return {ok:true,loop};
  }
  if(name==="update_open_loop"){
    const loops=loadOpenLoops(),existing=loops.find(x=>x.id===args.id);
    if(!existing)throw new Error("Open loop not found.");
    const loop=upsertOpenLoop({...existing,...args,id:existing.id});
    await audit("open_loop.agent_updated",{id:loop.id,title:loop.title,status:loop.status});
    return {ok:true,loop};
  }

  if(name==="create_excel_workbook")return createXlsxWorkProduct(args);
  if(name==="create_word_document")return createDocxWorkProduct(args);
  if(name==="create_powerpoint")return createPptxWorkProduct(args);
  if(name==="create_pdf_report")return createPdfWorkProduct(args);
  if(name==="create_csv_file")return createCsvWorkProduct(args);
  if(name==="list_work_products")return {work_products:listWorkProducts().slice(0,100)};

  if(name==="microsoft_onedrive_list")return microsoftOneDriveList(args);
  if(name==="microsoft_onedrive_upload_work_product")return microsoftUploadWorkProduct(args);
  if(name==="microsoft_excel_read_range")return microsoftExcelReadRange(args);
  if(name==="microsoft_excel_update_range")return microsoftExcelUpdateRange(args);
  if(name==="microsoft_outlook_search")return microsoftOutlookSearch(args);
  if(name==="microsoft_outlook_read")return microsoftOutlookRead(args);
  if(name==="microsoft_outlook_send")return microsoftOutlookSend(args);
  if(name==="microsoft_calendar_list")return microsoftCalendarList(args);
  if(name==="microsoft_calendar_create")return microsoftCalendarCreate(args);
  if(name==="microsoft_teams_list")return microsoftTeamsList();
  if(name==="microsoft_teams_channels")return microsoftTeamsChannels(args);
  if(name==="microsoft_teams_send")return microsoftTeamsSend(args);
  if(name==="microsoft_sharepoint_list")return microsoftSharePointList(args);
  if(name==="microsoft_sharepoint_upload_work_product")return microsoftSharePointUploadWorkProduct(args);

  if(name==="create_media_job"){const job=createPersistentMediaJob(args);return {ok:true,job,note:"Creative generation was queued as a persistent Outcome using local/free routes only."};}
  if(name==="list_media_jobs")return {jobs:loadMediaJobs().slice(0,100)};

  if(name==="message_send"){
    const channel=String(args.channel||"").toLowerCase();
    if(channel==="telegram")return telegramSendMessage(args.to,args.text);
    if(channel==="whatsapp"||channel==="sms")return twilioSendMessage({channel,to:args.to,text:args.text});
    throw new Error("Unsupported messaging channel.");
  }

  if (name === "github_read_file") {
    if (!githubConfigured()) throw new Error("GitHub integration is not configured.");
    const [owner, repo] = GITHUB_REPO.split("/");
    const refQuery = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : "";
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${String(args.path).split("/").map(encodeURIComponent).join("/")}${refQuery}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "openrouter-private-ai"
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || `GitHub read failed (${response.status})`);
    if (data.type !== "file" || !data.content) throw new Error("GitHub path is not a readable file.");
    return {
      path: data.path,
      sha: data.sha,
      content: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8")
    };
  }

  if (name === "github_create_issue") {
    if (!githubConfigured()) throw new Error("GitHub integration is not configured.");
    const [owner, repo] = GITHUB_REPO.split("/");
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "openrouter-private-ai",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title: args.title, body: args.body })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || `GitHub issue creation failed (${response.status})`);
    return { ok: true, number: data.number, url: data.html_url, title: data.title };
  }

  if (name === "send_webhook") {
    if (!AGENT_WEBHOOK_URL) throw new Error("Webhook integration is not configured.");
    const response = await fetch(AGENT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args.payload || {})
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Webhook failed (${response.status}): ${text.slice(0, 300)}`);
    return { ok: true, status: response.status, response: text.slice(0, 1000) };
  }

  if(name==="delegate_agent"){const depth=Number(context.delegationDepth||0);if(depth>=MAX_DELEGATIONS)throw new Error("Maximum agent delegation depth reached.");return{agentType:args.agentType,result:await runDelegatedAgent({agentType:args.agentType||"atlas",goal:args.goal,model:context.model||"openrouter/free",memory:context.memory||"",delegationDepth:depth+1})}}

  throw new Error(`Unknown tool: ${name}`);
}


async function runDelegatedAgent({agentType,goal,model,memory,delegationDepth=1}){
 const persona=agentPersona(agentType),tools=agentToolDefinitions({allowWeb:true}).filter(t=>!["browser_agent_task","gmail_send","calendar_create","slack_send","github_create_issue","write_workspace_file","send_webhook","message_send"].includes(t?.function?.name));
 const messages=[{role:"system",content:`${persona}\nYou are a delegated specialist. Use read-only tools when useful. Complete only this subtask.`},{role:"user",content:`${memory}\n\nDELEGATED GOAL:\n${goal}`}],repeated=new Map();
 for(let i=0;i<Math.min(6,MAX_AGENT_TOOL_LOOPS);i++){const msg=await sendAgentToolTurn({model,messages,tools,usageContext:{kind:"delegation",agentType}}),calls=Array.isArray(msg.tool_calls)?msg.tool_calls:[];messages.push({role:"assistant",content:msg.content||"",...(calls.length?{tool_calls:calls}:{})});if(!calls.length)return msg.content||"(No delegated result.)";for(const call of calls){const name=call?.function?.name;let args={};try{args=JSON.parse(call?.function?.arguments||"{}")}catch{}const sig=`${name}:${JSON.stringify(args)}`;repeated.set(sig,(repeated.get(sig)||0)+1);if(repeated.get(sig)>2)throw new Error(`Delegated agent repeated ${name} too many times.`);const perm=await toolPermission(name);let result;if(perm!=="auto")result={ok:false,denied:true,reason:"Delegated agents only use Auto tools."};else try{result=await executeAgentTool(name,args,{model,memory,delegationDepth})}catch(e){result={ok:false,error:e.message}}messages.push({role:"tool",tool_call_id:call.id,name,content:JSON.stringify(result)})}}
 throw new Error("Delegated agent reached its loop limit.");
}

async function sendAgentToolTurn({ model, messages, tools, usageContext = {} }) {
  await enforceBudget();

  if(ZERO_COST_MODE){
    const localModel=await resolveLocalLlmModel({tools:true});
    if(localModel){
      try{
        const local=await localChatCompletion({model:localModel,messages,tools,temperature:0.15});
        return local.message;
      }catch(err){
        await audit("local_llm.agent_fallback",{model:localModel,error:err.message});
        if(!OPENROUTER_FREE_FALLBACK_ENABLED||!openRouterConfigured())throw err;
      }
    }
    if(!openRouterConfigured())throw new Error("No tool-capable free model route is available. Configure a local tool-capable model or OpenRouter free fallback.");
    const response=await fetchWithRetry(OR_CHAT,{
      method:"POST",
      headers:openRouterHeaders(),
      body:JSON.stringify({model:"openrouter/free",messages,tools,tool_choice:"auto",temperature:0.15,usage:{include:true}})
    },{retries:2});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error?.message||data?.message||`OpenRouter free agent call failed (${response.status})`);
    if(data.usage)await recordUsage(data.usage,{model:data.model||"openrouter/free",...usageContext});
    const message=data?.choices?.[0]?.message;
    if(!message)throw new Error("Free agent model returned no message.");
    return message;
  }

  const requested=model||"openrouter/free";
  if(requested!=="openrouter/free"&&!PAID_LLM_ENABLED)throw new Error("Paid LLMs are locked.");
  const response=await fetchWithRetry(OR_CHAT,{method:"POST",headers:openRouterHeaders(),body:JSON.stringify({model:requested,messages,tools,tool_choice:"auto",temperature:0.15,usage:{include:true}})},{retries:3});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){await audit("openrouter.error",{status:response.status,model:requested,error:data?.error?.message||data?.message});throw new Error(data?.error?.message||data?.message||`OpenRouter tool call failed (${response.status})`)}
  if(data.usage)await recordUsage(data.usage,{model:requested,...usageContext});
  const message=data?.choices?.[0]?.message;if(!message)throw new Error("Agent model returned no message.");return message;
}
async function runToolCallingLoop({ model, initialMessages, tools, sseRes, maxIterations = MAX_AGENT_TOOL_LOOPS }) {
  const messages = [...initialMessages];
  const repeated = new Map();

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    writeSSE(sseRes, "agent_status", { message: `Agent loop ${iteration + 1}/${maxIterations}…` });

    const message = await sendAgentToolTurn({ model, messages, tools });
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

    messages.push({
      role: "assistant",
      content: message.content || "",
      ...(calls.length ? { tool_calls: calls } : {})
    });

    if (!calls.length) {
      return { final: message.content || "(Agent completed without a text response.)", messages };
    }

    if (iteration === maxIterations - 1) {
      throw new Error("Agent reached its tool-iteration limit before finishing.");
    }

    for (const call of calls) {
      const name = call?.function?.name;
      let args = {};
      try { args = JSON.parse(call?.function?.arguments || "{}"); }
      catch { args = {}; }

      const signature = `${name}:${JSON.stringify(args)}`;
      const count = (repeated.get(signature) || 0) + 1;
      repeated.set(signature, count);
      if (count > 2) throw new Error(`Agent repeated the same tool call too many times: ${name}`);

      writeSSE(sseRes, "tool_requested", { tool: name, args });

      let result;
      try {
        const permission=await toolPermission(name);
        if(permission==="deny"){result={ok:false,denied:true,reason:"Denied by tool permission policy."};await audit("tool.denied",{tool:name,args})}
        else if(permission==="approve"){const approval=await requestHumanApproval({name,args,sseRes});await audit("tool.approval",{tool:name,args,approved:approval.approved===true});if(!approval.approved)result={ok:false,denied:true,reason:approval.reason||"User denied this action."};else result=await executeAgentTool(name,args,{model,memory:initialMessages.map(m=>m.content||"").join("\n\n"),delegationDepth:0})}
        else {result=await executeAgentTool(name,args,{model,memory:initialMessages.map(m=>m.content||"").join("\n\n"),delegationDepth:0});await audit("tool.executed",{tool:name,args,result})}
      } catch (err) {
        result = { ok: false, error: err.message || "Tool execution failed." };
      }

      writeSSE(sseRes, "tool_result", { tool: name, result });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: JSON.stringify(result)
      });
    }
  }

  throw new Error("Agent loop ended unexpectedly.");
}

function agentPersona(agentType) {
  const map = {
    atlas: "You are Kairoq, an outcome operator. Own the user's goal end-to-end. When Microsoft 365 is connected, use Microsoft read tools automatically when they help. Saving/uploading a file to OneDrive or SharePoint, updating Excel Online, sending Outlook mail, creating a calendar event, or posting to Teams changes external state and must go through approval. Prefer Kairoq-generated work products for Excel Online mutations so the system does not modify arbitrary user files. When the user asks for a spreadsheet, financial model, tracker, analysis workbook, Word document, proposal, report, PowerPoint/deck, PDF, or CSV, create the actual file with the matching Work Studio tool instead of merely describing how to make it. For calculated spreadsheet fields, use formulas rather than hard-coded derived values when practical. Keep the work product professional and structured. After creating it, give the user the generated file URL. When the user asks for an image, video, ad creative, product visual, or other media asset, use create_media_job when a local/free route is appropriate so rendering becomes a persistent Outcome rather than a fragile one-shot request. Check list_media_jobs when following up on creative work. When the goal involves the public web, decide the execution path yourself: use web search/fetch to discover relevant pages, browser_render for one dynamic page, browser_research_task for multi-page read-only navigation, and browser_action_task only when a website state must actually change. Do not ask the user to choose a browser tool. For consequential website actions, prepare the exact action, allowed domains, expected changes, and success condition, then let the approval gate ask once. After approval, continue the workflow and verify the resulting state. If a task remains blocked or waiting, create/update an outcome rather than pretending it is finished. Break complex work into concrete parts and use delegate_agent to assign bounded specialist subtasks when that materially improves quality. Synthesize specialist outputs, verify important results, and deliver one coherent final answer. Prefer action over commentary. When operating a Shopify store, behave like a commerce operator rather than a reporting bot. Use commerce_funnel_health when available to connect real Shopify revenue/checkout signals with Meta/Google ad spend. Treat blended ROAS as directional, not attributed ROAS. Use abandoned checkout recovery URLs only as evidence/context; never contact a customer or send recovery outreach without the user's approval.  Use shopify_store_health to find concrete issues, storefront_audit when a public storefront URL is available, and create_store_experiment when there is a defensible test to run. Never claim an experiment improved conversion unless there is measured evidence. Keep external storefront mutations approval-gated. When the user asks to build an ecommerce store, behave like a commerce operator: first create a store concept/preview with create_store_concept; do not pretend invented products or suppliers are verified. If real supplier URLs or catalog data are missing, label products as concept/draft. If Shopify is connected, use shopify_apply_store_draft only after approval to create DRAFT products, collections and UNPUBLISHED pages. Never publish or modify the live MAIN theme without explicit approval. Treat unresolved outcomes as open loops: create or update an open loop when money, a promise, a deadline, a follow-up, a waiting dependency, or another real-world outcome remains unfinished. Do not mark an outcome done merely because a message was sent; require evidence that the goal was achieved.",
    scout: "You are Scout, the Research & Intelligence specialist. Search broadly when useful, verify sources, compare competitors and markets, distinguish evidence from inference, and produce decision-useful findings.",
    forge: "You are Forge, the Engineering specialist. Diagnose technical requirements, design robust implementations, inspect code and GitHub when available, reason through edge cases, test your work, and return concrete code or patches.",
    relay: "You are Relay, the Communications specialist. Work across Gmail and Slack when available. Understand the thread and audience, prepare concise professional communication, and never claim a message was sent unless the tool confirms it.",
    orbit: "You are Orbit, the Calendar & Scheduling specialist. Inspect calendar context, reason about time zones and conflicts, propose practical meeting choices, and use approval-gated calendar actions when appropriate.",
    compass: "You are Compass, the Travel Operations specialist. Handle travel research, hotel inventory, itineraries, company travel constraints, and trip operations. Use live travel tools when available. Do not make financial bookings unless a dedicated approved transaction flow exists.",
    ledger: "You are Ledger, the Finance & Spend specialist. Analyze budgets, unit economics, pricing, invoices, spend, variances, and financial tradeoffs. Show calculations clearly and flag assumptions.",
    beacon: "You are Beacon, the Monitoring & Automation specialist. Design and interpret scheduled jobs, recurring checks, alerts, operational monitoring, and change detection. Keep background actions read-only unless explicit approval is available.",
    vault: "You are Vault, the Memory & Knowledge specialist. Organize durable company knowledge, project context, operating playbooks, decisions, preferences, and reusable instructions. Avoid turning temporary chatter into permanent facts.",
    rover: "You are Rover, the Browser Operator. Choose the cheapest capable web path automatically. Use browser_research_task for multi-page read-only navigation and browser_action_task for approved interactions. Stay inside allowed domains, never handle secrets, verify page state before and after acting, and stop at any unapproved consequential boundary.",
    writer: "You are Writer, the Writing & Documents specialist. Clarify audience and objective from context, create a strong structure, draft polished copy, and self-edit for precision and tone.",
    closer: "You are Closer, the Sales & Follow-up specialist. Work leads, outreach, follow-ups, objection handling, account research, and next-step strategy. Be commercially useful without inventing customer facts.",
    guardian: "You are Guardian, the Security & Governance specialist. Review permissions, approval gates, audit trails, access scope, secrets, automation risk, and production controls. Prefer least privilege and explicit verification.",
    general: "You are Kairoq, an outcome operator. Own the user's goal end-to-end. Break complex work into concrete parts and use delegate_agent to assign bounded specialist subtasks when that materially improves quality. Synthesize specialist outputs, verify important results, and deliver one coherent final answer. Prefer action over commentary. When the user asks to build an ecommerce store, behave like a commerce operator: first create a store concept/preview with create_store_concept; do not pretend invented products or suppliers are verified. If real supplier URLs or catalog data are missing, label products as concept/draft. If Shopify is connected, use shopify_apply_store_draft only after approval to create DRAFT products, collections and UNPUBLISHED pages. Never publish or modify the live MAIN theme without explicit approval. Treat unresolved outcomes as open loops: create or update an open loop when money, a promise, a deadline, a follow-up, a waiting dependency, or another real-world outcome remains unfinished. Do not mark an outcome done merely because a message was sent; require evidence that the goal was achieved.",
    research: "You are Scout, the Research & Intelligence specialist. Search broadly when useful, verify sources, compare competitors and markets, distinguish evidence from inference, and produce decision-useful findings.",
    coding: "You are Forge, the Engineering specialist. Diagnose technical requirements, design robust implementations, inspect code and GitHub when available, reason through edge cases, test your work, and return concrete code or patches.",
    business: "You are Ledger, the Finance & Spend specialist. Analyze budgets, unit economics, pricing, invoices, spend, variances, and financial tradeoffs. Show calculations clearly and flag assumptions.",
    writing: "You are Writer, the Writing & Documents specialist. Clarify audience and objective from context, create a strong structure, draft polished copy, and self-edit for precision and tone.",
  };
  return map[agentType] || map.atlas;
}

async function handleAgentRun(req, res) {
  let started = false;
  try {
    enforceRateLimit(req);
    await enforceBudget();
    const body = await getBody(req, 8_000_000);
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    if (!goal) return json(res, 400, { error: "Agent goal is required." });

    let model = typeof body.model === "string" && body.model ? body.model : "openrouter/free";
    if (model === "smart-auto") model = "openrouter/auto";

    const agentType = typeof body.agentType === "string" ? body.agentType : "atlas";
    const useWeb = body.webSearch !== false;
    const globalMemory = typeof body.globalMemory === "string" ? body.globalMemory : "";
    const projectMemory = typeof body.projectMemory === "string" ? body.projectMemory : "";
    const companyPlaybook = typeof body.companyPlaybook === "string" ? body.companyPlaybook : "";
    const projectName = typeof body.projectName === "string" ? body.projectName : "General";

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    started = true;

    const persona = agentPersona(agentType);
    const memory = [
      globalMemory ? `GLOBAL MEMORY:\n${globalMemory}` : "",
      projectMemory ? `PROJECT MEMORY (${projectName}):\n${projectMemory}` : "",
      companyPlaybook ? `COMPANY PLAYBOOK:\n${companyPlaybook}` : ""
    ].filter(Boolean).join("\n\n");

    const integrationSummary = [
      "Workspace files: available",
      githubConfigured() ? `GitHub: configured for ${GITHUB_REPO}` : "GitHub: not configured",
      googleConfigured() ? "Google Gmail/Calendar: configured (connection may still be required)" : "Google Gmail/Calendar: not configured",
      NUITEE_API_KEY ? "Nuitee/LiteAPI hotel search: configured" : "Nuitee/LiteAPI: not configured",
      slackConfigured() ? "Slack: configured" : "Slack: not configured",
      shopifyConfigured() ? `Shopify: configured for ${SHOPIFY_STORE_DOMAIN}` : "Shopify: not configured",
      browserlessConfigured() ? "Autonomous browser operator: configured (read-only missions automatic; state-changing missions approval-gated)" : "Autonomous browser operator: not configured",
      AGENT_WEBHOOK_URL ? "Webhook: configured" : "Webhook: not configured",
      telegramConfigured() ? "Telegram: configured" : "Telegram: not configured",
      twilioConfigured() ? "WhatsApp/SMS via Twilio: configured" : "WhatsApp/SMS via Twilio: not configured",
      useWeb ? "Web search/fetch: enabled" : "Web search/fetch: disabled"
    ].join("\n");

    const system = `${persona}

You are operating inside a tool-enabled personal AI workspace.
Use tools when they materially help complete the user's goal.
Act as the operator: choose search, browser, APIs, specialists, and files yourself rather than asking the user which tool to use.
For web work, prefer the cheapest capable path: web search/fetch → browser_render → browser_research_task. Escalate to browser_action_task only when the outcome requires changing website state.
Read-only tools may run automatically.
Any consequential write/action tool may pause for human approval; prepare a precise approval request, and after approval continue automatically.
Do not claim an action succeeded unless the tool result confirms it.
Do not ask the user to perform steps that you can perform with an available tool.
If authentication, a sensitive credential, payment, legal acceptance, or an unapproved consequential step is required, stop at that boundary and explain exactly what is needed.
Stop only when the outcome is complete or genuinely blocked.

AVAILABLE INTEGRATIONS:
${integrationSummary}`;

    writeSSE(res, "agent_status", { message: "Starting tool-enabled agent…" });

    const tools = agentToolDefinitions({ allowWeb: useWeb });
    const result = await runToolCallingLoop({
      model,
      tools,
      sseRes: res,
      maxIterations: Math.max(3, Math.min(MAX_AGENT_TOOL_LOOPS, Number(body.maxSteps || 6))),
      initialMessages: [
        { role: "system", content: system },
        { role: "user", content: `${memory}\n\nGOAL:\n${goal}` }
      ]
    });

    await addWorkflowCard({
      type: "agent_result",
      title: `${agentType} completed`,
      body: result.final,
      agent: agentType,
      status: "complete"
    }).catch(()=>{});
    writeSSE(res, "agent_final", { text: result.final });
    writeSSE(res, "done", { ok: true });
    return res.end();
  } catch (err) {
    if (started) {
      writeSSE(res, "error", { message: err.message || "Agent failed." });
      return res.end();
    }
    return json(res, 500, { error: err.message || "Agent failed." });
  }
}


async function handleAgentApproval(req, res) {
  try {
    const body = await getBody(req, 100_000);
    const id = typeof body.id === "string" ? body.id : "";
    const pending = pendingApprovals.get(id);
    if (!pending) return json(res, 404, { error: "Approval request not found or already resolved." });

    pending.resolve({
      approved: body.approved === true,
      reason: typeof body.reason === "string" ? body.reason : ""
    });

    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}



async function handlePermissionsGet(_req,res){try{return json(res,200,{permissions:await loadToolPermissions()})}catch(e){return json(res,500,{error:e.message})}}
async function handlePermissionsSave(req,res){try{const b=await getBody(req,500000),a=new Set(["auto","approve","deny"]),c={};for(const[n,m]of Object.entries(b.permissions||{}))if(a.has(m))c[n]=m;return json(res,200,{permissions:await saveToolPermissions(c)})}catch(e){return json(res,500,{error:e.message})}}
async function handleAuditList(_req,res){try{return json(res,200,{events:await getAuditEvents(250)})}catch(e){return json(res,500,{error:e.message})}}
async function handleBudgetStatus(_req,res){try{const t=await usageTotals();return json(res,200,{...t,daily_limit:DAILY_COST_LIMIT_USD,monthly_limit:MONTHLY_COST_LIMIT_USD,requests_per_minute:REQUESTS_PER_MINUTE})}catch(e){return json(res,500,{error:e.message})}}
async function handleDeadLetters(_req,res){return json(res,200,{failures:readJsonFileSafe(DEAD_LETTER_FILE,[]).slice(0,100)})}

async function handleJobsList(_req, res) {
  try {
    const jobs = await loadJobs();
    return json(res, 200, { jobs: jobs.sort((a,b) => String(a.next_run_at||"").localeCompare(String(b.next_run_at||""))) });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}

async function handleJobsCreate(req, res) {
  try {
    const body = await getBody(req, 1_000_000);
    const job = {
      id: crypto.randomUUID(),
      name: String(body.name || "Scheduled agent").slice(0, 120),
      goal: String(body.goal || "").trim(),
      agentType: String(body.agentType || "atlas"),
      model: String(body.model || "openrouter/free"),
      webSearch: body.webSearch !== false,
      projectName: String(body.projectName || "General"),
      globalMemory: String(body.globalMemory || ""),
      projectMemory: String(body.projectMemory || ""),
      companyPlaybook: String(body.companyPlaybook || ""),
      enabled: body.enabled !== false,
      retry: { maxAttempts: Math.max(1, Math.min(5, Number(body?.retry?.maxAttempts || 3))) },
      schedule: {
        frequency: ["hourly","daily","weekly"].includes(body?.schedule?.frequency) ? body.schedule.frequency : "daily",
        hour: Math.max(0, Math.min(23, Number(body?.schedule?.hour ?? 8))),
        minute: Math.max(0, Math.min(59, Number(body?.schedule?.minute ?? 0))),
        dayOfWeek: Math.max(0, Math.min(6, Number(body?.schedule?.dayOfWeek ?? 1)))
      },
      created_at: new Date().toISOString(),
      last_run_at: null,
      last_status: null
    };
    if (!job.goal) return json(res, 400, { error: "Job goal is required." });
    job.next_run_at = nextRunAt(job);
    await saveJob(job);
    return json(res, 200, { job });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}

async function handleJobsUpdate(req, res) {
  try {
    const body = await getBody(req, 1_000_000);
    const jobs = await loadJobs();
    const job = jobs.find(j => j.id === body.id);
    if (!job) return json(res, 404, { error: "Job not found." });

    if (typeof body.enabled === "boolean") job.enabled = body.enabled;
    if (typeof body.name === "string") job.name = body.name.slice(0,120);
    if (typeof body.goal === "string") job.goal = body.goal.trim();
    if (typeof body.model === "string") job.model = body.model;
    if (typeof body.agentType === "string") job.agentType = body.agentType;
    if (typeof body.webSearch === "boolean") job.webSearch = body.webSearch;
    if (body.schedule && typeof body.schedule === "object") {
      job.schedule = {
        ...job.schedule,
        ...body.schedule
      };
      job.next_run_at = nextRunAt(job);
    }
    await saveJob(job);
    return json(res, 200, { job });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}

async function handleJobsDelete(req, res) {
  try {
    const body = await getBody(req, 100_000);
    if (!body.id) return json(res, 400, { error: "Missing job id." });
    await deleteJob(body.id);
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}

async function handleJobsRunNow(req, res) {
  try {
    enforceRateLimit(req);
    await enforceBudget();
    const body = await getBody(req, 100_000);
    const jobs = await loadJobs();
    const job = jobs.find(j => j.id === body.id);
    if (!job) return json(res, 404, { error: "Job not found." });
    const run = await runScheduledJob(job, "manual");
    return json(res, 200, { run });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}

async function handleJobsHistory(req, res) {
  try {
    const u = new URL(req.url, process.env.SITE_URL || `http://localhost:${PORT}`);
    const jobId = u.searchParams.get("job_id");
    const runs = await loadRuns(jobId || null, 100);
    return json(res, 200, { runs });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}

async function handleGoogleConnect(_req, res) {
  if (!googleConfigured()) return json(res, 400, { error: "Google OAuth is not configured in .env." });

  const state = crypto.randomBytes(20).toString("hex");
  const secure = (process.env.SITE_URL || "").startsWith("https://");
  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events"
  ];
  if(GOOGLE_ADS_CUSTOMER_ID) scopes.push("https://www.googleapis.com/auth/adwords");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: scopes.join(" "),
    state
  });

  res.writeHead(302, {
    Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    "Set-Cookie": `google_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure ? "; Secure" : ""}`
  });
  res.end();
}

async function handleGoogleCallback(req, res) {
  try {
    const u = new URL(req.url, process.env.SITE_URL || `http://localhost:${PORT}`);
    const code = u.searchParams.get("code");
    const returnedState = u.searchParams.get("state");
    const cookies = parseCookies(req);
    if (!code || !returnedState || returnedState !== cookies.google_oauth_state) {
      throw new Error("Invalid Google OAuth callback state.");
    }

    const response = await fetchWithRetry("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    }, { retries: 2 });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error_description || data?.error || "Google token exchange failed.");

    const old = await connectorTokenLoad("google").catch(() => null);
    const token = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || old?.refresh_token || null,
      scope: data.scope,
      token_type: data.token_type,
      expires_at: Date.now() + Number(data.expires_in || 3600) * 1000
    };
    await connectorTokenSave("google", token);

    res.writeHead(302, {
      Location: "/?google=connected",
      "Set-Cookie": "google_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
    res.end();
  } catch (err) {
    res.writeHead(302, { Location: `/?google_error=${encodeURIComponent(err.message)}` });
    res.end();
  }
}


async function handleMicrosoftConnect(_req,res){
  if(!microsoftConfigured())return json(res,400,{error:"Microsoft OAuth is not configured in .env."});
  const state=crypto.randomBytes(20).toString("hex");
  const secure=(process.env.SITE_URL||"").startsWith("https://");
  const params=new URLSearchParams({
    client_id:MICROSOFT_CLIENT_ID,
    response_type:"code",
    redirect_uri:MICROSOFT_REDIRECT_URI,
    response_mode:"query",
    scope:microsoftScopes().join(" "),
    state,
    prompt:"select_account"
  });
  res.writeHead(302,{
    Location:`https://login.microsoftonline.com/${encodeURIComponent(MICROSOFT_TENANT)}/oauth2/v2.0/authorize?${params.toString()}`,
    "Set-Cookie":`microsoft_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure?"; Secure":""}`
  });
  res.end();
}
async function handleMicrosoftCallback(req,res){
  try{
    const u=new URL(req.url,process.env.SITE_URL||`http://localhost:${PORT}`);
    const code=u.searchParams.get("code"),returnedState=u.searchParams.get("state");
    const cookies=parseCookies(req);
    if(!code||!returnedState||returnedState!==cookies.microsoft_oauth_state)throw new Error("Invalid Microsoft OAuth callback state.");
    const endpoint=`https://login.microsoftonline.com/${encodeURIComponent(MICROSOFT_TENANT)}/oauth2/v2.0/token`;
    const response=await fetchWithRetry(endpoint,{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({
        client_id:MICROSOFT_CLIENT_ID,
        client_secret:MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri:MICROSOFT_REDIRECT_URI,
        grant_type:"authorization_code",
        scope:microsoftScopes().join(" ")
      })
    },{retries:2});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error_description||data?.error||"Microsoft token exchange failed.");
    const old=await connectorTokenLoad("microsoft").catch(()=>null);
    const token={
      access_token:data.access_token,
      refresh_token:data.refresh_token||old?.refresh_token||null,
      scope:data.scope||microsoftScopes().join(" "),
      token_type:data.token_type||"Bearer",
      expires_at:Date.now()+Number(data.expires_in||3600)*1000
    };
    await connectorTokenSave("microsoft",token);
    res.writeHead(302,{
      Location:"/?microsoft=connected",
      "Set-Cookie":"microsoft_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
    res.end();
  }catch(err){
    res.writeHead(302,{Location:`/?microsoft_error=${encodeURIComponent(err.message)}`});
    res.end();
  }
}

async function handleConnectorStatus(_req, res) {
  const googleToken = googleConfigured() ? await connectorTokenLoad("google").catch(() => null) : null;
  const googleScopes = String(googleToken?.scope || "").split(/\s+/).filter(Boolean);
  const microsoftToken = microsoftConfigured() ? await connectorTokenLoad("microsoft").catch(() => null) : null;
  const microsoftScopeList = String(microsoftToken?.scope || "").split(/\s+/).filter(Boolean);
  return json(res, 200, {
    google: {
      configured: googleConfigured(),
      connected: Boolean(googleToken?.refresh_token || googleToken?.access_token)
    },
    microsoft: {
      configured: microsoftConfigured(),
      connected: Boolean(microsoftToken?.refresh_token || microsoftToken?.access_token),
      scopes: microsoftScopeList,
      outlook_enabled: MICROSOFT_ENABLE_OUTLOOK,
      teams_enabled: MICROSOFT_ENABLE_TEAMS,
      sharepoint_enabled: microsoftSharePointConfigured(),
      onedrive_folder: MICROSOFT_ONEDRIVE_FOLDER
    },
    github: { configured: githubConfigured(), repo: GITHUB_REPO || null },
    nuitee: { configured: Boolean(NUITEE_API_KEY) },
    slack: { configured: slackConfigured() },
    shopify: { configured: shopifyConfigured(), store: SHOPIFY_STORE_DOMAIN || null, theme_write_enabled: SHOPIFY_THEME_WRITE_ENABLED },
    meta_ads: { configured: metaAdsConfigured(), account: META_AD_ACCOUNT_ID || null, version: META_GRAPH_VERSION },
    google_ads: { configured: Boolean(GOOGLE_ADS_CUSTOMER_ID && googleConfigured()), connected: Boolean(GOOGLE_ADS_CUSTOMER_ID && googleScopes.includes("https://www.googleapis.com/auth/adwords")), customer_id: GOOGLE_ADS_CUSTOMER_ID || null, api_version: GOOGLE_ADS_API_VERSION },
    browserless: { configured: browserlessConfigured() },
    notifications: { configured: Boolean(NOTIFY_WEBHOOK_URL) },
    webhook: { configured: Boolean(AGENT_WEBHOOK_URL) },
    telegram: { configured: telegramConfigured(), inbound: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_WEBHOOK_SECRET), allowed_chat: TELEGRAM_ALLOWED_CHAT_ID || null },
    twilio: { configured: twilioConfigured(), whatsapp: Boolean(TWILIO_WHATSAPP_FROM), sms: Boolean(TWILIO_SMS_FROM) },
    higgsfield: { configured: higgsfieldConfigured() },
    local_ai: { configured: Boolean(LOCAL_LLM_MODEL), base_url: LOCAL_LLM_BASE_URL, zero_cost_mode: ZERO_COST_MODE },
    encryption: { configured: Boolean(APP_ENCRYPTION_KEY) }
  });
}

async function handleLogin(req, res) {
  if (!authEnabled()) return json(res, 200, { ok: true, authRequired: false });
  const body = await getBody(req, 100_000);
  if (body.password !== process.env.APP_PASSWORD) {
    return json(res, 401, { error: "Incorrect password." });
  }
  const secure = (process.env.SITE_URL || "").startsWith("https://");
  const cookie = `${SESSION_COOKIE}=${sessionToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure ? "; Secure" : ""}`;
  return json(res, 200, { ok: true }, { "Set-Cookie": cookie });
}

async function handleChat(req, res) {
  let sseStarted=false;
  try{
    enforceRateLimit(req);
    await enforceBudget();
    const body=await getBody(req);
    const messages=normalizeMessages(body.messages);
    if(!messages.length)return json(res,400,{error:"No messages supplied."});

    const models=await getModels();
    const map=new Map(models.map(m=>[m.id,m]));
    let requestedModel=typeof body.model==="string"&&body.model?body.model:"openrouter/free";
    if(requestedModel==="smart-auto")requestedModel="openrouter/auto";
    const freeOnly=body.freeOnly!==false;
    const smartFallback=body.smartFallback!==false;
    const webSearch=body.webSearch===true;

    if(!ZERO_COST_MODE && requestedModel!=="openrouter/free" && !isLocalModelId(requestedModel) && !PAID_LLM_ENABLED){
      return json(res,403,{error:"Paid models are locked. Enable PAID_LLM_ENABLED=true only if you intentionally want paid inference."});
    }
    if(freeOnly && requestedModel!=="openrouter/free" && !isLocalModelId(requestedModel)){
      const info=map.get(requestedModel);
      if(!info?.isFree)return json(res,403,{error:`Free Only is ON. "${requestedModel}" is not currently confirmed as a zero-cost model.`});
    }

    const effort=["low","medium","high"].includes(body.reasoningEffort)?body.reasoningEffort:"medium";
    const purpose=typeof body.purpose==="string"?body.purpose:"general";
    const userSystem=typeof body.systemPrompt==="string"?body.systemPrompt.trim():"";
    const workspaceMemory=typeof body.workspaceMemory==="string"?body.workspaceMemory.trim():"";
    const projectMemory=typeof body.projectMemory==="string"?body.projectMemory.trim():"";
    const chatSummary=typeof body.chatSummary==="string"?body.chatSummary.trim():"";
    const customPresetPrompt=typeof body.customPresetPrompt==="string"?body.customPresetPrompt.trim():"";
    const presetSystem=purposePrompt(purpose);

    const memoryBlocks=[];
    if(workspaceMemory)memoryBlocks.push(`GLOBAL MEMORY (stable user/workspace context):\n${workspaceMemory}`);
    if(projectMemory)memoryBlocks.push(`PROJECT MEMORY (relevant to the currently selected project):\n${projectMemory}`);
    if(chatSummary)memoryBlocks.push(`CONVERSATION SUMMARY (older context from this chat):\n${chatSummary}`);
    const memorySystem=memoryBlocks.length?`The following memory is maintained by the application, not by this model. Use it when relevant, preserve continuity across model changes, and never invent facts beyond it.\n\n${memoryBlocks.join("\n\n")}`:"";
    const zeroCostSystem=ZERO_COST_MODE
      ?"ZERO COST MODE is active. Do not claim a paid external search or paid model was used. If current web information is required but no free/local web tool is available, say so rather than inventing current facts."
      :"";
    const system=[presetSystem,customPresetPrompt,memorySystem,zeroCostSystem,userSystem].filter(Boolean).join("\n\n");
    const finalMessages=system?[{role:"system",content:system},...messages]:messages;
    const temperature=Number.isFinite(Number(body.temperature))?Math.max(0,Math.min(2,Number(body.temperature))):0.7;

    res.writeHead(200,{
      "Content-Type":"text/event-stream; charset=utf-8",
      "Cache-Control":"no-cache, no-transform",
      "Connection":"keep-alive",
      "X-Accel-Buffering":"no"
    });
    sseStarted=true;

    if(ZERO_COST_MODE){
      const preferredLocal=isLocalModelId(requestedModel)&&requestedModel!=="local/auto"?stripLocalModelId(requestedModel):await resolveLocalLlmModel();
      if(preferredLocal){
        writeSSE(res,"status",{message:`Zero Cost · local ${preferredLocal}`});
        if(webSearch&&!OPENROUTER_WEB_SEARCH_ENABLED){
          writeSSE(res,"status",{message:`Zero Cost · local ${preferredLocal} · paid web search blocked`});
        }
        try{
          const result=await streamLocalLlm({messages:finalMessages,temperature,model:preferredLocal},res);
          writeSSE(res,"done",{ok:true,provider:"local",zeroCost:true});
          return res.end();
        }catch(localErr){
          if(localErr.afterPartial)throw localErr;
          await audit("local_llm.chat_fallback",{model:preferredLocal,error:localErr.message});
          if(!OPENROUTER_FREE_FALLBACK_ENABLED||!openRouterConfigured())throw localErr;
          writeSSE(res,"status",{message:"Local model unavailable — using OpenRouter free fallback…"});
        }
      }else if(openRouterConfigured()&&OPENROUTER_FREE_FALLBACK_ENABLED){
        writeSSE(res,"status",{message:"No local model detected — using OpenRouter free fallback…"});
      }else{
        throw new Error("Zero Cost mode needs either a local Ollama/llama.cpp model or an OpenRouter key for the free fallback.");
      }

      const common={
        messages:finalMessages,temperature,reasoning_effort:effort,
        stream:true,usage:{include:true}
      };
      // OpenRouter's web-search tool can incur separate charges, so it is off by default in Zero Cost mode.
      if(webSearch&&OPENROUTER_WEB_SEARCH_ENABLED){
        common.tools=[{type:"openrouter:web_search",parameters:{engine:"auto",max_results:5,max_total_results:10,search_context_size:effort==="high"?"medium":"low"}}];
      }
      try{
        const result=await streamOpenRouter({...common,model:"openrouter/free"},res);
        if(result.usage)await recordUsage(result.usage,{model:result.finalModel,kind:"chat_free"});
        writeSSE(res,"done",{ok:true,provider:"openrouter-free",zeroCost:true});
        return res.end();
      }catch(primaryErr){
        if(primaryErr.afterPartial)throw primaryErr;
        if(smartFallback){
          const fallbackModels=freeFallbacks(models,"",3);
          if(fallbackModels.length){
            writeSSE(res,"status",{message:"Free router busy — trying explicit free models…"});
            const result=await streamOpenRouter({...common,models:fallbackModels},res);
            if(result.usage)await recordUsage(result.usage,{model:result.finalModel,kind:"chat_free_fallback"});
            writeSSE(res,"done",{ok:true,fallbackUsed:true,zeroCost:true});
            return res.end();
          }
        }
        throw primaryErr;
      }
    }

    // Manual paid/free mode. Paid models still require explicit PAID_LLM_ENABLED=true.
    if(isLocalModelId(requestedModel)){
      const model=requestedModel==="local/auto"?await resolveLocalLlmModel():stripLocalModelId(requestedModel);
      writeSSE(res,"status",{message:`Local · ${model}`});
      const result=await streamLocalLlm({messages:finalMessages,temperature,model},res);
      writeSSE(res,"done",{ok:true,provider:"local",zeroCost:true});
      return res.end();
    }

    const common={messages:finalMessages,temperature,reasoning_effort:effort,stream:true,usage:{include:true}};
    if(webSearch&&OPENROUTER_WEB_SEARCH_ENABLED){
      common.tools=[{type:"openrouter:web_search",parameters:{engine:"auto",max_results:5,max_total_results:10,search_context_size:effort==="high"?"medium":"low"}}];
    }
    let payload={...common,model:requestedModel};
    if(freeOnly&&smartFallback&&requestedModel!=="openrouter/free"&&map.get(requestedModel)?.isFree){
      payload={...common,models:[requestedModel,...freeFallbacks(models,requestedModel,2)]};
    }
    writeSSE(res,"status",{message:requestedModel==="openrouter/free"?"OpenRouter free":"Paid models enabled"});
    const result=await streamOpenRouter(payload,res);
    if(result.usage)await recordUsage(result.usage,{model:result.finalModel,kind:"chat"});
    writeSSE(res,"done",{ok:true});
    return res.end();
  }catch(err){
    if(sseStarted){writeSSE(res,"error",{message:err.message||"Request failed"});return res.end()}
    return json(res,err.status||500,{error:err.message||"Server error"});
  }
}


const ALLOWED_FAL_IMAGE_MODELS = new Set([
  "fal-ai/flux/dev",
  "fal-ai/flux/schnell",
  "fal-ai/flux-2/flash",
  "fal-ai/fast-sdxl",
  "fal-ai/realistic-vision"
]);

function normalizeMediaProviderOrder(order = MEDIA_PROVIDER_ORDER) {
  const allowed = new Set(["localsd","wan2gp","selfhost","higgsfield","openrouter","pollinations","fal"]);
  const unique = [];
  for (const item of Array.isArray(order) ? order : []) {
    const p = String(item || "").trim().toLowerCase();
    if (allowed.has(p) && !unique.includes(p)) unique.push(p);
  }
  for (const p of ["localsd","wan2gp","selfhost","pollinations","higgsfield","openrouter","fal"]) if (!unique.includes(p)) unique.push(p);
  return unique;
}

function imageAspectRatio(imageSize) {
  const map = {
    square_hd: "1:1", square: "1:1",
    portrait_4_3: "3:4", portrait_16_9: "9:16",
    landscape_4_3: "4:3", landscape_16_9: "16:9"
  };
  return map[imageSize] || "1:1";
}

function pollinationsImageSize(imageSize) {
  const map = {
    square_hd: "1024x1024", square: "1024x1024",
    portrait_4_3: "768x1024", portrait_16_9: "576x1024",
    landscape_4_3: "1024x768", landscape_16_9: "1024x576"
  };
  return map[imageSize] || "1024x1024";
}

function extensionForMediaType(mediaType = "") {
  const t = String(mediaType).toLowerCase();
  if (t.includes("jpeg") || t.includes("jpg")) return ".jpg";
  if (t.includes("webp")) return ".webp";
  if (t.includes("svg")) return ".svg";
  if (t.includes("mp4")) return ".mp4";
  if (t.includes("webm")) return ".webm";
  return ".png";
}

function saveGeneratedMedia(buffer, mediaType = "image/png", prefix = "media") {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Generated media was empty.");
  const ext = extensionForMediaType(mediaType);
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`;
  const fullPath = path.join(GENERATED_MEDIA_DIR, filename);
  fs.writeFileSync(fullPath, buffer);
  return {
    filename,
    url: `/generated/${filename}`,
    media_type: mediaType,
    bytes: buffer.length
  };
}

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!m) throw new Error("Invalid image attachment.");
  return { mediaType: m[1], buffer: Buffer.from(m[2], "base64") };
}



function localSdConfigured(){
  return Boolean(LOCAL_SDCPP_ENABLED && LOCAL_SDCPP_BINARY && LOCAL_SDCPP_MODEL_PATH);
}
function wan2gpConfigured(){ return Boolean(WAN2GP_BASE_URL); }
function creativeDimensions(imageSize="square_hd", modelType="sd1"){
  const high=["sdxl","z-image","flux"].includes(String(modelType||"").toLowerCase());
  const base=high?1024:512, ar=imageAspectRatio(imageSize);
  const map={"1:1":[base,base],"16:9":[Math.round((base*16/9)/64)*64,base],"9:16":[base,Math.round((base*16/9)/64)*64],"4:3":[Math.round((base*4/3)/64)*64,base],"3:4":[base,Math.round((base*4/3)/64)*64]};
  return map[ar]||[base,base];
}
function runExecFile(file,args,options={}){
  return new Promise((resolve,reject)=>execFile(file,args,{...options,maxBuffer:16*1024*1024},(error,stdout,stderr)=>{if(error){error.stdout=stdout;error.stderr=stderr;return reject(error)}resolve({stdout,stderr})}));
}
async function generateImageLocalSd({prompt,imageSize,references=[]}){
  if(!localSdConfigured())throw new Error("Local sd.cpp is not configured.");
  if(references.length)throw new Error("Local sd.cpp route currently supports text-to-image only.");
  if(!fs.existsSync(LOCAL_SDCPP_BINARY))throw new Error("LOCAL_SDCPP_BINARY was not found.");
  if(!fs.existsSync(LOCAL_SDCPP_MODEL_PATH))throw new Error("LOCAL_SDCPP_MODEL_PATH was not found.");
  const [width,height]=creativeDimensions(imageSize,LOCAL_SDCPP_MODEL_TYPE);
  const outPath=path.join(GENERATED_MEDIA_DIR,`local-${Date.now()}-${crypto.randomBytes(5).toString("hex")}.png`);
  const modelFlag=["z-image","flux"].includes(LOCAL_SDCPP_MODEL_TYPE)?"--diffusion-model":"-m";
  const args=[modelFlag,LOCAL_SDCPP_MODEL_PATH,"-p",String(prompt||""),"-o",outPath,"--steps",String(LOCAL_SDCPP_STEPS),"-H",String(height),"-W",String(width),"--cfg-scale",String(LOCAL_SDCPP_CFG),"--sampling-method",LOCAL_SDCPP_SAMPLER,"--seed",String(Math.floor(Math.random()*2147483647))];
  if(LOCAL_SDCPP_MODEL_TYPE==="sdxl")args.push("--sd-version","sdxl");
  if(LOCAL_SDCPP_MODEL_TYPE==="flux")args.push("--flux");
  try{await runExecFile(LOCAL_SDCPP_BINARY,args,{timeout:10*60*1000})}catch(err){try{if(fs.existsSync(outPath))fs.unlinkSync(outPath)}catch{};throw new Error(`Local sd.cpp generation failed: ${String(err.stderr||err.message||"unknown error").slice(-1000)}`)}
  if(!fs.existsSync(outPath))throw new Error("Local sd.cpp completed but produced no image.");
  const stat=fs.statSync(outPath);
  return {provider:"Local sd.cpp",model:LOCAL_SDCPP_MODEL_NAME,images:[{url:`/generated/${path.basename(outPath)}`,media_type:"image/png",bytes:stat.size}],edited:false,local:true,usage:{cost:0}};
}
async function wan2gpApiNames(){
  if(!wan2gpConfigured())return [];
  for(const endpoint of ["/gradio_api/info","/info","/api"]){try{const r=await fetchWithRetry(`${WAN2GP_BASE_URL}${endpoint}`,{}, {retries:1});if(!r.ok)continue;const data=await r.json().catch(()=>null);if(!data)continue;const named=data.named_endpoints||data.unnamed_endpoints||data;if(named&&typeof named==="object"&&!Array.isArray(named)){const keys=Object.keys(named).filter(k=>k.startsWith("/")).map(k=>k.replace(/^\/+/,""));if(keys.length)return keys}}catch{}}
  try{const r=await fetchWithRetry(`${WAN2GP_BASE_URL}/config`,{}, {retries:1});const data=await r.json().catch(()=>({}));return (Array.isArray(data.dependencies)?data.dependencies:[]).map(x=>x.api_name).filter(x=>typeof x==="string"&&x&&x!=="false")}catch{return []}
}
async function pickWan2gpFn(preferred,type="image"){
  const names=await wan2gpApiNames();
  const aliases={qwen_image:["qwen_image","qwen","qwen_t2i","qwen_image_t2i"],flux:["flux","flux_dev","flux_1_dev","flux1_dev","flux_image"],wan22_t2v:["wan22_t2v","wan_2_2_t2v","wan22_text2video","wan_t2v","wan2_2_t2v","t2v"],wan22_i2v:["wan22_i2v","wan_2_2_i2v","wan22_image2video","wan_i2v","wan2_2_i2v","i2v"],ltx_video:["ltx_video","ltx","ltx_t2v","ltxv","ltx_2","ltx2"],hunyuan_video:["hunyuan_video","hunyuan","hunyuan_t2v","hyvideo","hy_video"]};
  for(const a of (aliases[preferred]||[preferred]))if(names.includes(a))return a;
  if(!names.length)return preferred;
  const family=String(preferred||"").split("_")[0].replace(/[0-9]/g,"");const hint=type==="video"?/(video|t2v|i2v|v2v)/i:/(image|t2i|txt2img|flux|qwen)/i;
  return names.find(n=>n.toLowerCase().includes(family)&&hint.test(n))||names.find(n=>n.toLowerCase().includes(family))||preferred;
}
async function uploadDataUrlToWan2gp(dataUrl){
  const {mediaType,buffer}=decodeDataUrl(dataUrl),form=new FormData(),name=`input${extensionForMediaType(mediaType)}`;form.append("files",new Blob([buffer],{type:mediaType}),name);
  const r=await fetchWithRetry(`${WAN2GP_BASE_URL}/upload?upload_id=${crypto.randomBytes(6).toString("hex")}`,{method:"POST",body:form},{retries:1});if(!r.ok)throw new Error(`Wan2GP upload failed (${r.status}).`);const data=await r.json().catch(()=>null),remotePath=Array.isArray(data)?data[0]:data;if(!remotePath||typeof remotePath!=="string")throw new Error("Wan2GP upload returned no file path.");
  return {path:remotePath,url:`${WAN2GP_BASE_URL}/file=${remotePath.replace(/^\/+/,'')}`,orig_name:name,mime_type:mediaType,meta:{_type:"gradio.FileData"}};
}
async function wan2gpCall(fn,payload,{onEventId}={}){
  const start=await fetchWithRetry(`${WAN2GP_BASE_URL}/gradio_api/call/${encodeURIComponent(fn)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)},{retries:1});const started=await start.json().catch(()=>({}));if(!start.ok)throw new Error(started?.detail||started?.message||`Wan2GP start failed (${start.status}).`);const eventId=started.event_id||started.eventId;if(!eventId)throw new Error("Wan2GP returned no event id.");if(onEventId)onEventId(eventId);
  const stream=await fetchWithRetry(`${WAN2GP_BASE_URL}/gradio_api/call/${encodeURIComponent(fn)}/${encodeURIComponent(eventId)}`,{}, {retries:1});if(!stream.ok)throw new Error(`Wan2GP result stream failed (${stream.status}).`);const reader=stream.body.getReader(),decoder=new TextDecoder();let buffer="";
  while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const blocks=buffer.split("\n\n");buffer=blocks.pop()||"";for(const block of blocks){const em=/event:\s*(\S+)/.exec(block),dm=/data:\s*([\s\S]*)$/.exec(block);if(!em)continue;const evt=em[1],raw=(dm?.[1]||"").trim();if(["complete","process_completes"].includes(evt)){let data;try{data=JSON.parse(raw)}catch{throw new Error("Wan2GP returned malformed completion data.")}return {event_id:eventId,data:Array.isArray(data)?data:(data.data||data)}}if(["error","process_error"].includes(evt))throw new Error(`Wan2GP generation error: ${raw.slice(0,500)}`)}}
  throw new Error("Wan2GP stream ended before completion.");
}
function wanOutputUrl(result){const first=Array.isArray(result?.data)?result.data[0]:result?.data;if(!first)return "";if(typeof first==="string")return /^https?:\/\//i.test(first)?first:`${WAN2GP_BASE_URL}/file=${first.replace(/^\/+/,'')}`;if(first.url)return /^https?:\/\//i.test(first.url)?first.url:`${WAN2GP_BASE_URL}${String(first.url).startsWith("/")?"":"/"}${first.url}`;if(first.path)return `${WAN2GP_BASE_URL}/file=${String(first.path).replace(/^\/+/,'')}`;return ""}
async function mirrorRemoteMedia(url,prefix,fallbackType){const r=await fetchWithRetry(url,{}, {retries:2});if(!r.ok)throw new Error(`Could not copy generated media (${r.status}).`);const type=r.headers.get("content-type")||fallbackType,buffer=Buffer.from(await r.arrayBuffer());return saveGeneratedMedia(buffer,type,prefix)}
async function generateImageWan2gp({prompt,imageSize,references=[],onEventId}){if(!wan2gpConfigured())throw new Error("Wan2GP is not configured.");if(references.length)throw new Error("Wan2GP image editing is not enabled in this build.");const fn=await pickWan2gpFn(WAN2GP_IMAGE_MODEL,"image"),[width,height]=creativeDimensions(imageSize,"sdxl"),payload={data:[String(prompt||""),"",width,height,30,4,Math.floor(Math.random()*2147483647),null]},result=await wan2gpCall(fn,payload,{onEventId}),url=wanOutputUrl(result);if(!url)throw new Error("Wan2GP returned no image URL.");const saved=await mirrorRemoteMedia(url,"wan2gp-image","image/png");return {provider:"Wan2GP",model:fn,images:[saved],edited:false,local_network:true,usage:{cost:0},event_id:result.event_id}}
async function generateVideoWan2gp({prompt,duration=4,referenceImage="",onEventId}){if(!wan2gpConfigured())throw new Error("Wan2GP is not configured.");const preferred=referenceImage?WAN2GP_IMAGE_TO_VIDEO_MODEL:WAN2GP_VIDEO_MODEL,fn=await pickWan2gpFn(preferred,"video");let imageDescriptor=null;if(referenceImage)imageDescriptor=/^data:image\//i.test(referenceImage)?await uploadDataUrlToWan2gp(referenceImage):referenceImage;const [width,height]=creativeDimensions("landscape_16_9","sdxl"),payload={data:[String(prompt||""),"",width,height,25,5,Math.floor(Math.random()*2147483647),imageDescriptor]},result=await wan2gpCall(fn,payload,{onEventId}),url=wanOutputUrl(result);if(!url)throw new Error("Wan2GP returned no video URL.");const saved=await mirrorRemoteMedia(url,"wan2gp-video","video/mp4");return {provider:"Wan2GP",model:fn,video:saved,duration:Number(duration||4),source_image:!!referenceImage,local_network:true,usage:{cost:0},event_id:result.event_id}}

function selfHostHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  if (SELF_HOST_MEDIA_API_KEY) headers.Authorization = `Bearer ${SELF_HOST_MEDIA_API_KEY}`;
  return headers;
}

async function generateImageSelfHost({ prompt, imageSize, numImages, references = [] }) {
  if (!SELF_HOST_MEDIA_BASE_URL) throw new Error("Self-hosted media endpoint is not configured.");
  const editing = references.length > 0;
  const model = editing ? QWEN_IMAGE_EDIT_MODEL : QWEN_IMAGE_MODEL;
  const endpoint = `${SELF_HOST_MEDIA_BASE_URL}${editing ? "/v1/images/edits" : "/v1/images/generations"}`;

  const body = {
    model,
    prompt,
    n: Math.max(1, Math.min(4, Number(numImages || 1))),
    size: pollinationsImageSize(imageSize),
    response_format: "b64_json"
  };
  if (editing) body.images = references.slice(0,4);

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: selfHostHeaders(),
    body: JSON.stringify(body)
  }, { retries: 2 });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.error || data?.message || `Self-hosted image request failed (${response.status}).`);

  const saved = [];
  for (const item of Array.isArray(data.data) ? data.data : []) {
    if (item?.b64_json) {
      saved.push(saveGeneratedMedia(Buffer.from(item.b64_json, "base64"), item.media_type || "image/png", "image"));
    } else if (item?.url) {
      saved.push({ url: item.url, media_type: item.media_type || "image/png", remote: true });
    }
  }
  if (!saved.length) throw new Error("Self-hosted image server returned no image.");

  return {
    provider: "Self-hosted",
    model,
    images: saved,
    usage: data.usage || null,
    edited: editing
  };
}

async function generateVideoSelfHost({ prompt, duration = 4, referenceImage = "" }) {
  if (!SELF_HOST_MEDIA_BASE_URL) throw new Error("Self-hosted media endpoint is not configured.");
  const editing = !!referenceImage;
  const model = editing ? WAN_IMAGE_TO_VIDEO_MODEL : WAN_VIDEO_MODEL;
  const endpoint = `${SELF_HOST_MEDIA_BASE_URL}/v1/videos/generations`;

  const body = {
    model,
    prompt,
    duration: Math.max(2, Math.min(10, Number(duration || 4))),
    response_format: "b64_json"
  };
  if (referenceImage) body.image = referenceImage;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: selfHostHeaders(),
    body: JSON.stringify(body)
  }, { retries: 1 });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.error || data?.message || `Self-hosted video request failed (${response.status}).`);

  if (data?.data?.[0]?.b64_json) {
    const saved = saveGeneratedMedia(Buffer.from(data.data[0].b64_json, "base64"), data.data[0].media_type || "video/mp4", "video");
    return { provider:"Self-hosted", model, video:saved, duration:body.duration, source_image:editing, usage:data.usage||null };
  }
  const url = data?.data?.[0]?.url || data?.url;
  if (!url) throw new Error("Self-hosted video server returned no video.");

  return {
    provider: "Self-hosted",
    model,
    video: { url, media_type: data?.data?.[0]?.media_type || "video/mp4", remote:true },
    duration: body.duration,
    source_image: editing,
    usage: data.usage || null
  };
}

function higgsfieldConfigured(){return Boolean(HIGGSFIELD_CREDENTIALS)}
function mediaProviderOrderForBudget(mode="cheap"){
  const m=String(mode||"cheap").toLowerCase();
  if(m==="free") return ["localsd","wan2gp","selfhost","pollinations","openrouter","fal"];
  if(m==="best") return ["higgsfield","openrouter","wan2gp","selfhost","localsd","pollinations","fal"];
  if(m==="balanced") return ["localsd","wan2gp","selfhost","higgsfield","openrouter","pollinations","fal"];
  return ["localsd","wan2gp","selfhost","pollinations","higgsfield","openrouter","fal"];
}
async function higgsfieldSubmitAndWait(model,input,{timeoutMs=180000}={}){
  if(!higgsfieldConfigured())throw new Error("Higgsfield is not configured.");
  const headers={Authorization:`Key ${HIGGSFIELD_CREDENTIALS}`,"Content-Type":"application/json"};
  let r=await fetchWithRetry(`https://api.higgsfield.ai/${model}`,{method:"POST",headers,body:JSON.stringify(input)},{retries:2});
  let data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.detail||data?.error?.message||data?.message||`Higgsfield request failed (${r.status}).`);
  if(data.images||data.video||data.output||data.result)return data;
  const statusUrl=data.status_url||data.statusUrl;
  if(!statusUrl)throw new Error("Higgsfield returned no status URL.");
  const started=Date.now();let delay=1800;
  while(Date.now()-started<timeoutMs){
    await sleep(delay);delay=Math.min(5000,Math.round(delay*1.2));
    r=await fetchWithRetry(statusUrl,{headers:{Authorization:`Key ${HIGGSFIELD_CREDENTIALS}`}},{retries:2});
    data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.message||`Higgsfield status failed (${r.status}).`);
    const status=String(data.status||data.state||"").toLowerCase();
    if(["completed","complete","succeeded","success"].includes(status))return data.result||data.output||data;
    if(["failed","error","nsfw","canceled","cancelled"].includes(status))throw new Error(data?.error?.message||data?.message||`Higgsfield generation ${status}.`);
  }
  throw new Error("Higgsfield generation timed out.");
}
function absoluteGeneratedUrl(relative){
  const site=String(process.env.SITE_URL||"").replace(/\/$/,"");
  if(!site||/^http:\/\/localhost/i.test(site))throw new Error("A public HTTPS SITE_URL is required for reference-image generation through Higgsfield.");
  return `${site}${relative}`;
}
function publicizeReferenceImage(reference){
  if(/^https?:\/\//i.test(reference))return reference;
  if(/^data:image\//i.test(reference)){
    const decoded=decodeDataUrl(reference);const saved=saveGeneratedMedia(decoded.buffer,decoded.mediaType,"reference");return absoluteGeneratedUrl(saved.url);
  }
  throw new Error("Unsupported reference image.");
}
function higgsfieldAssetUrl(asset){return typeof asset==="string"?asset:(asset?.url||asset?.file_url||asset?.cdn_url||asset?.href||"")}
async function generateImageHiggsfield({prompt,imageSize,references=[]}){
  if(references.length)throw new Error("Higgsfield image edit is not configured in this build; another provider will be tried.");
  const data=await higgsfieldSubmitAndWait(HIGGSFIELD_IMAGE_MODEL,{prompt,resolution:"1k",aspect_ratio:imageAspectRatio(imageSize),prompt_extend:true,enable_thinking:true,prompt_extend_mode:"direct"},{timeoutMs:180000});
  const raw=Array.isArray(data.images)?data.images:(Array.isArray(data.data)?data.data:[]);const images=raw.map(x=>({url:higgsfieldAssetUrl(x),remote:true})).filter(x=>x.url);
  if(!images.length)throw new Error("Higgsfield returned no image.");
  return {provider:"Higgsfield",model:HIGGSFIELD_IMAGE_MODEL,images,usage:data.usage||null,cost:data.cost||data.price||null,edited:false};
}
async function generateVideoHiggsfield({prompt,duration=4,referenceImage=""}){
  const usingRef=Boolean(referenceImage); const model=usingRef?HIGGSFIELD_IMAGE_TO_VIDEO_MODEL:HIGGSFIELD_VIDEO_MODEL;
  const input={prompt,duration:Math.max(4,Math.min(30,Number(duration||5))),resolution:"720p",generate_audio:true};
  if(usingRef)input.image_url=publicizeReferenceImage(referenceImage); else input.aspect_ratio="16:9";
  const data=await higgsfieldSubmitAndWait(model,input,{timeoutMs:360000});
  const raw=data.video||data.output?.video||data.data?.video||data.file; const url=higgsfieldAssetUrl(raw)||higgsfieldAssetUrl(data.output)||data.url||"";
  if(!url)throw new Error("Higgsfield returned no video.");
  return {provider:"Higgsfield",model,video:url,video_asset:{url,media_type:"video/mp4",remote:true},duration:input.duration,source_image:usingRef,usage:data.usage||null,cost:data.cost||data.price||null};
}

async function generateImageOpenRouter({ prompt, imageSize, numImages, references = [] }) {
  const editing = references.length > 0;
  const model = editing ? OPENROUTER_IMAGE_EDIT_MODEL : OPENROUTER_IMAGE_MODEL;
  const body = {
    model,
    prompt,
    n: Math.max(1, Math.min(4, Number(numImages || 1))),
    aspect_ratio: imageAspectRatio(imageSize)
  };
  if (editing) {
    body.input_references = references.slice(0, 4).map(url => ({
      type: "image_url",
      image_url: { url }
    }));
  }

  const response = await fetchWithRetry("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify(body)
  }, { retries: 2 });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `OpenRouter image request failed (${response.status}).`);

  const saved = [];
  for (const item of Array.isArray(data.data) ? data.data : []) {
    if (!item?.b64_json) continue;
    const mediaType = item.media_type || "image/png";
    saved.push(saveGeneratedMedia(Buffer.from(item.b64_json, "base64"), mediaType, "image"));
  }
  if (!saved.length) throw new Error("OpenRouter returned no image bytes.");

  return {
    provider: "OpenRouter",
    model,
    images: saved,
    usage: data.usage || null,
    edited: editing
  };
}

async function generateImagePollinations({ prompt, imageSize, references = [] }) {
  if (!POLLINATIONS_API_KEY) throw new Error("Pollinations is not configured.");
  const body = {
    model: POLLINATIONS_IMAGE_MODEL,
    prompt,
    n: 1,
    size: pollinationsImageSize(imageSize),
    response_format: "b64_json"
  };
  if (references.length) body.image = references.slice(0, 4);

  const response = await fetchWithRetry("https://gen.pollinations.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${POLLINATIONS_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, { retries: 2 });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.error || data?.message || `Pollinations image request failed (${response.status}).`);

  const saved = [];
  for (const item of Array.isArray(data.data) ? data.data : []) {
    if (item?.b64_json) {
      saved.push(saveGeneratedMedia(Buffer.from(item.b64_json, "base64"), item.media_type || "image/png", "image"));
    } else if (item?.url) {
      saved.push({ url: item.url, media_type: item.media_type || "image/png", remote: true });
    }
  }
  if (!saved.length) throw new Error("Pollinations returned no image.");

  return {
    provider: "Pollinations",
    model: POLLINATIONS_IMAGE_MODEL,
    images: saved,
    usage: data.usage || null,
    edited: references.length > 0
  };
}

async function generateImageFal({ prompt, imageSize, numImages, references = [] }) {
  if (!FAL_KEY) throw new Error("fal.ai is not configured.");
  if (references.length) throw new Error("fal fallback is disabled for image-edit requests; use OpenRouter or Pollinations.");

  const requestedModel = String(process.env.FAL_IMAGE_MODEL || IMAGE_MODEL || "fal-ai/flux/dev").trim();
  const model = ALLOWED_FAL_IMAGE_MODELS.has(requestedModel) ? requestedModel : "fal-ai/flux/dev";
  const response = await fetchWithRetry(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      image_size: imageSize || "square_hd",
      num_images: Math.max(1, Math.min(4, Number(numImages || 1))),
      enable_safety_checker: true
    })
  }, { retries: 2 });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || data?.error || data?.message || `fal.ai image request failed (${response.status}).`);

  const images = Array.isArray(data.images) ? data.images.map((img, idx) => ({
    url: img.url,
    width: img.width || null,
    height: img.height || null,
    content_type: img.content_type || null,
    index: idx
  })).filter(x => x.url) : [];
  if (!images.length) throw new Error("fal.ai returned no images.");

  return { provider: "fal.ai", model, images, seed: data.seed || null, usage: null, edited: false };
}

async function handleImageGenerate(req, res) {
  try {
    const body = await getBody(req, 12_000_000);
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return json(res, 400, { error: "Prompt is required." });

    const imageSize = String(body.image_size || "square_hd");
    const numImages = Math.max(1, Math.min(4, Number(body.num_images || 1)));
    const references = (Array.isArray(body.references) ? body.references : [])
      .map(x => String(x || ""))
      .filter(x => /^data:image\/|^https?:\/\//i.test(x))
      .slice(0, 4);

    const attempts = [];
    for (const provider of mediaProviderOrderForBudget(body.budget_mode || "cheap")) {
      if (provider === "localsd" && localSdConfigured()) { try { const out=await generateImageLocalSd({prompt,imageSize,references}); await audit("image.generated",{provider:"localsd",model:out.model,prompt:prompt.slice(0,1000),cost:0}); return json(res,200,out); } catch(err) { attempts.push({provider:"localsd",error:err.message}); } }
      if (provider === "wan2gp" && wan2gpConfigured()) { try { const out=await generateImageWan2gp({prompt,imageSize,references}); await audit("image.generated",{provider:"wan2gp",model:out.model,prompt:prompt.slice(0,1000),cost:0}); return json(res,200,out); } catch(err) { attempts.push({provider:"wan2gp",error:err.message}); } }
      if (provider === "selfhost" && SELF_HOST_MEDIA_BASE_URL) {
        try {
          const out = await generateImageSelfHost({ prompt, imageSize, numImages, references });
          await audit("image.generated", { provider, model: out.model, prompt: prompt.slice(0,1000), edited: references.length > 0, usage: out.usage });
          return json(res, 200, out);
        } catch (err) { attempts.push({ provider, error: err.message }); }
      }
      if (provider === "higgsfield" && higgsfieldConfigured()) {
        try {
          const out = await generateImageHiggsfield({ prompt, imageSize, numImages, references });
          await audit("image.generated", { provider, model: out.model, prompt: prompt.slice(0,1000), cost:out.cost||null });
          return json(res, 200, out);
        } catch (err) { attempts.push({ provider, error: err.message }); }
      }
      if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
        try {
          const out = await generateImageOpenRouter({ prompt, imageSize, numImages, references });
          await audit("image.generated", { provider, model: out.model, prompt: prompt.slice(0,1000), edited: references.length > 0, usage: out.usage });
          return json(res, 200, out);
        } catch (err) { attempts.push({ provider, error: err.message }); }
      }
      if (provider === "pollinations" && POLLINATIONS_API_KEY) {
        try {
          const out = await generateImagePollinations({ prompt, imageSize, references });
          await audit("image.generated", { provider, model: out.model, prompt: prompt.slice(0,1000), edited: references.length > 0, usage: out.usage });
          return json(res, 200, out);
        } catch (err) { attempts.push({ provider, error: err.message }); }
      }
      if (provider === "fal" && FAL_KEY) {
        try {
          const out = await generateImageFal({ prompt, imageSize, numImages, references });
          await audit("image.generated", { provider, model: out.model, prompt: prompt.slice(0,1000) });
          return json(res, 200, out);
        } catch (err) { attempts.push({ provider, error: err.message }); }
      }
    }

    const configured = {
      localsd: localSdConfigured(),
      wan2gp: wan2gpConfigured(),
      selfhost: !!SELF_HOST_MEDIA_BASE_URL,
      higgsfield: higgsfieldConfigured(),
      openrouter: !!process.env.OPENROUTER_API_KEY,
      pollinations: !!POLLINATIONS_API_KEY,
      fal: !!FAL_KEY
    };
    return json(res, 502, {
      error: "No image provider completed the request.",
      configured,
      attempts
    });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || "Image generation failed." });
  }
}

async function uploadDataUrlToPollinations(dataUrl) {
  if (!POLLINATIONS_API_KEY) throw new Error("Pollinations is required for image-to-video.");
  const { mediaType, buffer } = decodeDataUrl(dataUrl);
  const form = new FormData();
  const ext = extensionForMediaType(mediaType);
  form.append("file", new Blob([buffer], { type: mediaType }), `source${ext}`);
  const response = await fetchWithRetry("https://media.pollinations.ai/upload", {
    method: "POST",
    headers: { "Authorization": `Bearer ${POLLINATIONS_API_KEY}` },
    body: form
  }, { retries: 2 });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) throw new Error(`Pollinations media upload failed (${response.status}).`);

  if (contentType.includes("application/json")) {
    const data = await response.json();
    const url = data.url || data.media_url || data.href || data.id && `https://media.pollinations.ai/${data.id}`;
    if (url) return url;
  }

  const link = response.headers.get("link") || "";
  const match = /<([^>]+)>;\s*rel="enclosure"/i.exec(link);
  if (match) return match[1];

  const text = await response.text().catch(() => "");
  if (/^https?:\/\//.test(text.trim())) return text.trim();
  throw new Error("Pollinations upload returned no media URL.");
}

async function generateVideoPollinations({ prompt, duration = 4, referenceImage = "" }) {
  if (!POLLINATIONS_API_KEY) throw new Error("Video generation requires POLLINATIONS_API_KEY.");
  let imageUrl = "";
  if (referenceImage) {
    imageUrl = /^data:image\//i.test(referenceImage)
      ? await uploadDataUrlToPollinations(referenceImage)
      : referenceImage;
  }

  const query = new URLSearchParams({
    model: POLLINATIONS_VIDEO_MODEL,
    duration: String(Math.max(2, Math.min(10, Number(duration || 4))))
  });
  if (imageUrl) query.set("image", imageUrl);

  const url = `https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}?${query.toString()}`;
  const response = await fetchWithRetry(url, {
    method: "GET",
    headers: { "Authorization": `Bearer ${POLLINATIONS_API_KEY}` }
  }, { retries: 1 });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Pollinations video request failed (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") || "video/mp4";
  const buffer = Buffer.from(await response.arrayBuffer());
  const saved = saveGeneratedMedia(buffer, contentType.includes("video/") ? contentType : "video/mp4", "video");

  return {
    provider: "Pollinations",
    model: POLLINATIONS_VIDEO_MODEL,
    video: saved,
    duration: Math.max(2, Math.min(10, Number(duration || 4))),
    source_image: !!referenceImage
  };
}

async function handleVideoGenerate(req, res) {
  try {
    const body = await getBody(req, 12_000_000);
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return json(res, 400, { error: "Prompt is required." });

    const referenceImage = String(body.reference_image || "").trim();
    const attempts = [];
    const order = mediaProviderOrderForBudget(body.budget_mode || "cheap");

    for (const provider of order) {
      if (provider === "wan2gp" && wan2gpConfigured()) { try { const out=await generateVideoWan2gp({prompt,duration:body.duration||4,referenceImage}); await audit("video.generated",{provider:"wan2gp",model:out.model,prompt:prompt.slice(0,1000),duration:out.duration,source_image:out.source_image,cost:0}); return json(res,200,out); } catch(err) { attempts.push({provider:"wan2gp",error:err.message}); } }
      if (provider === "selfhost" && SELF_HOST_MEDIA_BASE_URL) {
        try {
          const out = await generateVideoSelfHost({ prompt, duration: body.duration || 4, referenceImage });
          await audit("video.generated", { provider:"selfhost", model:out.model, prompt:prompt.slice(0,1000), duration:out.duration, source_image:out.source_image, usage:out.usage });
          return json(res,200,out);
        } catch(err) { attempts.push({provider:"selfhost",error:err.message}); }
      }

      if (provider === "pollinations" && POLLINATIONS_API_KEY) {
        try {
          const out = await generateVideoPollinations({ prompt, duration: body.duration || 4, referenceImage });
          await audit("video.generated", { provider:"pollinations", model:out.model, prompt:prompt.slice(0,1000), duration:out.duration, source_image:out.source_image });
          return json(res,200,out);
        } catch(err) { attempts.push({provider:"pollinations",error:err.message}); }
      }

      if (provider === "higgsfield" && higgsfieldConfigured()) {
        try {
          const out = await generateVideoHiggsfield({ prompt, duration: body.duration || 5, referenceImage });
          await audit("video.generated", { provider:"higgsfield", model:out.model, prompt:prompt.slice(0,1000), duration:out.duration, source_image:out.source_image, cost:out.cost||null });
          return json(res,200,out);
        } catch(err) { attempts.push({provider:"higgsfield",error:err.message}); }
      }
    }

    return json(res, 503, {
      error: "No video provider is configured or available.",
      configured: {
        wan2gp: wan2gpConfigured(),
        selfhost: !!SELF_HOST_MEDIA_BASE_URL,
        higgsfield: higgsfieldConfigured(),
        pollinations: !!POLLINATIONS_API_KEY
      },
      attempts
    });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || "Video generation failed." });
  }
}



/* ------------------------------------------------------------------
   Kairoq Work Studio — zero-dependency Office/PDF generation.
   Produces real OOXML .xlsx/.docx/.pptx files, plus PDF/CSV.
------------------------------------------------------------------- */
function xmlEsc(v=""){
  return String(v ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
function xmlText(v=""){
  return xmlEsc(String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,""));
}
function safeWorkFilename(name,title,ext){
  const base=String(name||title||"Kairoq-file")
    .replace(/\.[A-Za-z0-9]+$/,"")
    .replace(/[^A-Za-z0-9._ -]+/g,"")
    .trim().replace(/\s+/g,"-").slice(0,100) || "Kairoq-file";
  return `${base}.${ext}`;
}
function crc32(buf){
  if(!crc32.table){
    const table=[];
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      table[n]=c>>>0;
    }
    crc32.table=table;
  }
  let c=0xFFFFFFFF;
  for(const b of buf)c=crc32.table[(c^b)&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function dosTimeDate(d=new Date()){
  const year=Math.max(1980,d.getFullYear());
  const time=(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2);
  const date=((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  return {time,date};
}
function makeZip(entries){
  const locals=[],centrals=[];
  let offset=0;
  const {time,date}=dosTimeDate();
  for(const e of entries){
    const name=Buffer.from(e.name.replace(/\\/g,"/"));
    const raw=Buffer.isBuffer(e.data)?e.data:Buffer.from(String(e.data),"utf8");
    const compressed=zlib.deflateRawSync(raw,{level:6});
    const crc=crc32(raw);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4);
    local.writeUInt16LE(0,6); local.writeUInt16LE(8,8);
    local.writeUInt16LE(time,10); local.writeUInt16LE(date,12);
    local.writeUInt32LE(crc,14); local.writeUInt32LE(compressed.length,18);
    local.writeUInt32LE(raw.length,22); local.writeUInt16LE(name.length,26);
    local.writeUInt16LE(0,28);
    locals.push(local,name,compressed);

    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4);
    central.writeUInt16LE(20,6); central.writeUInt16LE(0,8);
    central.writeUInt16LE(8,10); central.writeUInt16LE(time,12);
    central.writeUInt16LE(date,14); central.writeUInt32LE(crc,16);
    central.writeUInt32LE(compressed.length,20); central.writeUInt32LE(raw.length,24);
    central.writeUInt16LE(name.length,28); central.writeUInt16LE(0,30);
    central.writeUInt16LE(0,32); central.writeUInt16LE(0,34);
    central.writeUInt16LE(0,36); central.writeUInt32LE(0,38);
    central.writeUInt32LE(offset,42);
    centrals.push(central,name);
    offset += local.length+name.length+compressed.length;
  }
  const centralStart=offset;
  const centralBuf=Buffer.concat(centrals);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(0,4); end.writeUInt16LE(0,6);
  end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(centralBuf.length,12); end.writeUInt32LE(centralStart,16);
  end.writeUInt16LE(0,20);
  return Buffer.concat([...locals,centralBuf,end]);
}
function colName(n){
  let s="";
  while(n>0){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26)}
  return s;
}
function workUrl(filename){return `/generated/work-products/${encodeURIComponent(filename)}`}
function recordWorkProduct(input){
  const records=readJsonFileSafe(WORK_PRODUCTS_FILE,[]);
  const rec={
    id:String(input.id||crypto.randomUUID()),
    kind:String(input.kind||"file"),
    title:String(input.title||input.filename||"Work product").slice(0,200),
    filename:String(input.filename||""),
    url:String(input.url||""),
    size:Number(input.size||0),
    created_at:input.created_at||new Date().toISOString(),
    outcome_id:input.outcome_id||null,
    notes:String(input.notes||"").slice(0,2000)
  };
  const list=Array.isArray(records)?records:[];
  list.unshift(rec);
  writeJsonFileSafe(WORK_PRODUCTS_FILE,list.slice(0,300));
  return rec;
}
function createWorkOutcome(kind,title){
  return upsertOpenLoop({
    title:`Create ${kind.toUpperCase()}: ${String(title||"work product").slice(0,90)}`,
    goal:`Create a usable ${kind.toUpperCase()} work product and make the file available.`,
    source:"work_studio",
    status:"waiting",
    next_action:"Generate and validate the requested file.",
    waiting_on:"Kairoq Work Studio",
    completion_signal:"The generated file exists and is available to open/download.",
    risk:"low"
  });
}
function finishWorkOutcome(loop,rec){
  upsertOpenLoop({
    ...loop,status:"done",next_action:"",waiting_on:"",
    completion_signal:`${rec.filename} is available.`,
    notes:`Generated ${rec.kind.toUpperCase()} file: ${rec.url}`,
    completed_at:new Date().toISOString()
  });
}
function finalizeWorkFile(kind,title,filename,buffer,notes=""){
  const out=path.join(WORK_PRODUCTS_DIR,filename);
  fs.writeFileSync(out,buffer);
  const loop=createWorkOutcome(kind,title);
  const rec=recordWorkProduct({
    kind,title,filename,url:workUrl(filename),
    size:buffer.length,outcome_id:loop.id,notes
  });
  finishWorkOutcome(loop,rec);
  return {ok:true,work_product:rec};
}
function normalizeGrid(rows,maxRows=1000,maxCols=50){
  return (Array.isArray(rows)?rows:[]).slice(0,maxRows).map(r=>
    (Array.isArray(r)?r:[r]).slice(0,maxCols).map(v=>{
      if(v===null||v===undefined)return "";
      if(typeof v==="number"||typeof v==="boolean")return v;
      return String(v).slice(0,20000);
    })
  );
}
function xlsxCell(ref,value,style=0,formula=""){
  if(formula){
    return `<c r="${ref}" s="${style}"><f>${xmlText(String(formula).replace(/^=/,""))}</f></c>`;
  }
  if(typeof value==="number" && Number.isFinite(value))return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  if(typeof value==="boolean")return `<c r="${ref}" s="${style}" t="b"><v>${value?1:0}</v></c>`;
  const text=String(value??"");
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`;
}
function createXlsxWorkProduct(spec={}){
  const title=String(spec.title||"Kairoq Workbook").slice(0,200);
  const filename=safeWorkFilename(spec.filename,title,"xlsx");
  let sheets=Array.isArray(spec.sheets)?spec.sheets:[];
  if(!sheets.length)sheets=[{name:"Sheet1",title,headers:spec.headers||[],rows:spec.rows||[],formulas:spec.formulas||[]}];
  sheets=sheets.slice(0,20);

  const entries=[];
  const contentOverrides=[];
  const wbSheets=[];
  const wbRels=[
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
  ];

  sheets.forEach((sheet,i)=>{
    const id=i+1, relId=i+2;
    const name=String(sheet.name||`Sheet${id}`).replace(/[\[\]:*?/\\]/g," ").slice(0,31)||`Sheet${id}`;
    const headers=(Array.isArray(sheet.headers)?sheet.headers:[]).slice(0,50).map(String);
    const rows=normalizeGrid(sheet.rows||[]);
    const formulaMap=new Map((Array.isArray(sheet.formulas)?sheet.formulas:[]).map(x=>[String(x.cell||"").toUpperCase(),String(x.formula||"")]));
    const maxCols=Math.max(1,headers.length,...rows.map(r=>r.length));
    const lastCol=colName(maxCols);
    const sheetTitle=String(sheet.title||title).slice(0,250);
    const rowXml=[];
    rowXml.push(`<row r="1" ht="26" customHeight="1">${xlsxCell("A1",sheetTitle,1)}</row>`);
    if(headers.length){
      rowXml.push(`<row r="3" ht="21" customHeight="1">${headers.map((h,c)=>xlsxCell(`${colName(c+1)}3`,h,2)).join("")}</row>`);
    }
    rows.forEach((row,ri)=>{
      const r=ri+4;
      const cells=[];
      for(let c=0;c<maxCols;c++){
        const ref=`${colName(c+1)}${r}`;
        const formula=formulaMap.get(ref)||"";
        cells.push(xlsxCell(ref,row[c]??"",0,formula));
      }
      rowXml.push(`<row r="${r}">${cells.join("")}</row>`);
    });
    // Formula cells outside written rows
    for(const [ref,formula] of formulaMap.entries()){
      const m=/^([A-Z]+)(\d+)$/.exec(ref);
      if(!m)continue;
      const rr=Number(m[2]);
      if(rr>=4 && rr<4+rows.length)continue;
      rowXml.push(`<row r="${rr}">${xlsxCell(ref,"",0,formula)}</row>`);
    }
    const notes=(Array.isArray(sheet.notes)?sheet.notes:[]).slice(0,20);
    let noteRows="";
    let noteStart=4+rows.length+2;
    notes.forEach((n,idx)=>{
      noteRows+=`<row r="${noteStart+idx}">${xlsxCell(`A${noteStart+idx}`,n,3)}</row>`;
    });
    const cols=Array.from({length:maxCols},(_,c)=>`<col min="${c+1}" max="${c+1}" width="${c===0?24:16}" customWidth="1"/>`).join("");
    const merges=`<mergeCells count="1"><mergeCell ref="A1:${lastCol}1"/></mergeCells>`;
    const filter=headers.length?`<autoFilter ref="A3:${lastCol}${Math.max(3,3+rows.length)}"/>`:"";
    const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols>
<sheetData>${rowXml.join("")}${noteRows}</sheetData>${merges}${filter}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
</worksheet>`;
    entries.push({name:`xl/worksheets/sheet${id}.xml`,data:xml});
    contentOverrides.push(`<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    wbSheets.push(`<sheet name="${xmlEsc(name)}" sheetId="${id}" r:id="rId${relId}"/>`);
    wbRels.push(`<Relationship Id="rId${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`);
  });

  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Aptos"/></font>
<font><b/><sz val="18"/><color rgb="FF111827"/><name val="Aptos Display"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF111827"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FFD0D5DD"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  entries.push(
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentOverrides.join("")}</Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${wbSheets.join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`},
    {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join("")}</Relationships>`},
    {name:"xl/styles.xml",data:styles}
  );
  return finalizeWorkFile("xlsx",title,filename,makeZip(entries),`Sheets: ${sheets.length}`);
}
function docxRun(text,bold=false,size=22,color="111827"){
  return `<w:r><w:rPr>${bold?"<w:b/>":""}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;
}
function docxParagraph(text,style="",opts={}){
  const pPr=style?`<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`:"";
  return `<w:p>${pPr}${docxRun(text,!!opts.bold,opts.size||22,opts.color||"111827")}</w:p>`;
}
function docxTable(headers=[],rows=[]){
  const all=[headers,...rows].filter(r=>Array.isArray(r)&&r.length);
  if(!all.length)return "";
  const grid=Array.from({length:Math.max(...all.map(r=>r.length))},()=>`<w:gridCol w:w="2200"/>`).join("");
  const tr=all.map((row,ri)=>`<w:tr>${row.map(v=>`<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/>${ri===0?'<w:shd w:fill="111827"/>':""}</w:tcPr><w:p>${docxRun(String(v??""),ri===0,20,ri===0?"FFFFFF":"111827")}</w:p></w:tc>`).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D0D5DD"/><w:left w:val="single" w:sz="4" w:color="D0D5DD"/><w:bottom w:val="single" w:sz="4" w:color="D0D5DD"/><w:right w:val="single" w:sz="4" w:color="D0D5DD"/><w:insideH w:val="single" w:sz="4" w:color="EAECF0"/><w:insideV w:val="single" w:sz="4" w:color="EAECF0"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${tr}</w:tbl>`;
}
function createDocxWorkProduct(spec={}){
  const title=String(spec.title||"Kairoq Document").slice(0,200);
  const filename=safeWorkFilename(spec.filename,title,"docx");
  const sections=(Array.isArray(spec.sections)?spec.sections:[]).slice(0,50);
  let body=docxParagraph(title,"Title");
  if(spec.subtitle)body+=docxParagraph(String(spec.subtitle),"Subtitle");
  body+=`<w:p/>`;
  for(const s of sections){
    if(s.heading)body+=docxParagraph(String(s.heading),"Heading1");
    for(const p of (Array.isArray(s.paragraphs)?s.paragraphs:[]).slice(0,50))body+=docxParagraph(String(p));
    for(const b of (Array.isArray(s.bullets)?s.bullets:[]).slice(0,50))body+=docxParagraph(`• ${String(b)}`);
    body+=docxTable(
      (Array.isArray(s.table_headers)?s.table_headers:[]).slice(0,20),
      normalizeGrid(s.table_rows||[],200,20)
    );
    body+=`<w:p/>`;
  }
  if(Array.isArray(spec.source_notes)&&spec.source_notes.length){
    body+=docxParagraph("Sources / Notes","Heading1");
    for(const n of spec.source_notes.slice(0,30))body+=docxParagraph(String(n));
  }
  const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="111827"/></w:rPr><w:pPr><w:spacing w:after="180"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="24"/><w:color w:val="667085"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="111827"/></w:rPr><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr></w:style>
</w:styles>`;
  const entries=[
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:"word/document.xml",data:document},
    {name:"word/styles.xml",data:styles},
    {name:"word/_rels/document.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`}
  ];
  return finalizeWorkFile("docx",title,filename,makeZip(entries),`Sections: ${sections.length}`);
}
function pptxTextShape(id,name,text,x,y,cx,cy,opts={}){
  const paragraphs=(Array.isArray(text)?text:[text]).filter(x=>String(x??"").length).map((t,i)=>{
    const bullet=opts.bullets?`<a:buChar char="•"/>`:`<a:buNone/>`;
    return `<a:p><a:pPr marL="${opts.bullets?285750:0}" indent="${opts.bullets?-142875:0}">${bullet}</a:pPr><a:r><a:rPr lang="en-US" sz="${Math.round((opts.fontSize||20)*100)}" b="${opts.bold?1:0}"><a:solidFill><a:srgbClr val="${opts.color||"111827"}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${xmlText(t)}</a:t></a:r><a:endParaRPr lang="en-US" sz="${Math.round((opts.fontSize||20)*100)}"/></a:p>`;
  }).join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xmlEsc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${paragraphs||"<a:p/>"}</p:txBody></p:sp>`;
}
function pptxSlideXml(slide,index){
  let shapes=`<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
  shapes+=pptxTextShape(2,"Title",slide.title||`Slide ${index}`,685800,457200,10820400,914400,{fontSize:28,bold:true});
  if(slide.subtitle)shapes+=pptxTextShape(3,"Subtitle",slide.subtitle,685800,1371600,10820400,548640,{fontSize:15,color:"667085"});
  if(slide.body)shapes+=pptxTextShape(4,"Body",slide.body,685800,2057400,10820400,2743200,{fontSize:18});
  if(Array.isArray(slide.bullets)&&slide.bullets.length)shapes+=pptxTextShape(5,"Bullets",slide.bullets.slice(0,12),685800,2057400,10820400,3657600,{fontSize:19,bullets:true});
  if(Array.isArray(slide.table_headers)&&slide.table_headers.length){
    const rows=[slide.table_headers,...normalizeGrid(slide.table_rows||[],12,6)];
    const lines=rows.map((r,ri)=>`${ri===0?"":""}${r.join("   |   ")}`);
    shapes+=pptxTextShape(6,"Table",lines,685800,2057400,10820400,3657600,{fontSize:14,color:"344054"});
  }
  shapes+=pptxTextShape(20,"Footer",`Kairoq  •  ${index}`,685800,6426200,10820400,274320,{fontSize:9,color:"98A2B3"});
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}
function createPptxWorkProduct(spec={}){
  const title=String(spec.title||"Kairoq Presentation").slice(0,200);
  const filename=safeWorkFilename(spec.filename,title,"pptx");
  let slides=Array.isArray(spec.slides)?spec.slides.slice(0,40):[];
  if(!slides.length)slides=[{title,subtitle:String(spec.subtitle||"Created by Kairoq")}];
  else slides=[{title,subtitle:String(spec.subtitle||"Created by Kairoq")},...slides];
  const entries=[];
  const overrides=[];
  const sldIds=[];
  const presRels=[
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`
  ];
  slides.forEach((s,i)=>{
    const n=i+1,rid=i+2;
    entries.push({name:`ppt/slides/slide${n}.xml`,data:pptxSlideXml(s,n)});
    entries.push({name:`ppt/slides/_rels/slide${n}.xml.rels`,data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`});
    overrides.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    sldIds.push(`<p:sldId id="${256+i}" r:id="rId${rid}"/>`);
    presRels.push(`<Relationship Id="rId${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`);
  });
  const master=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="111827" accent2="475467" accent3="667085" accent4="98A2B3" accent5="D0D5DD" accent6="EAECF0" bg1="FFFFFF" bg2="F9FAFB" folHlink="954F72" hlink="0563C1" tx1="111827" tx2="475467"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
  const layout=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const theme=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Kairoq"><a:themeElements><a:clrScheme name="Kairoq"><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="475467"/></a:dk2><a:lt2><a:srgbClr val="F9FAFB"/></a:lt2><a:accent1><a:srgbClr val="111827"/></a:accent1><a:accent2><a:srgbClr val="4F46E5"/></a:accent2><a:accent3><a:srgbClr val="0EA5E9"/></a:accent3><a:accent4><a:srgbClr val="10B981"/></a:accent4><a:accent5><a:srgbClr val="F59E0B"/></a:accent5><a:accent6><a:srgbClr val="F43F5E"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Kairoq"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="Kairoq"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  entries.push(
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${overrides.join("")}</Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`},
    {name:"ppt/presentation.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${sldIds.join("")}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`},
    {name:"ppt/_rels/presentation.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels.join("")}</Relationships>`},
    {name:"ppt/slideMasters/slideMaster1.xml",data:master},
    {name:"ppt/slideMasters/_rels/slideMaster1.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`},
    {name:"ppt/slideLayouts/slideLayout1.xml",data:layout},
    {name:"ppt/slideLayouts/_rels/slideLayout1.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`},
    {name:"ppt/theme/theme1.xml",data:theme}
  );
  return finalizeWorkFile("pptx",title,filename,makeZip(entries),`Slides: ${slides.length}`);
}
function pdfEsc(s){return String(s??"").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").replace(/[^\x20-\x7E]/g,"?")}
function wrapPdfText(text,width=88){
  const words=String(text??"").split(/\s+/),lines=[];let line="";
  for(const w of words){
    const next=line?`${line} ${w}`:w;
    if(next.length>width && line){lines.push(line);line=w}else line=next;
  }
  if(line)lines.push(line);
  return lines.length?lines:[""];
}
function createPdfBuffer(title,sections=[]){
  const lines=[{t:title,size:20,bold:true},""];
  for(const s of sections){
    if(s.heading){lines.push({t:String(s.heading),size:15,bold:true},"")}
    for(const p of (Array.isArray(s.paragraphs)?s.paragraphs:[])){
      wrapPdfText(p,92).forEach(x=>lines.push(x)); lines.push("");
    }
    for(const b of (Array.isArray(s.bullets)?s.bullets:[])){
      wrapPdfText(`- ${b}`,88).forEach(x=>lines.push(x));
    }
    const headers=Array.isArray(s.table_headers)?s.table_headers:[];
    const rows=normalizeGrid(s.table_rows||[],100,8);
    if(headers.length){
      lines.push(headers.join(" | "));
      lines.push("-".repeat(Math.min(100,headers.join(" | ").length)));
      rows.forEach(r=>wrapPdfText(r.join(" | "),100).forEach(x=>lines.push(x)));
      lines.push("");
    }
  }
  const chunks=[]; for(let i=0;i<lines.length;i+=46)chunks.push(lines.slice(i,i+46));
  const objs=[null];
  const fontRegular=objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`)-1;
  const fontBold=objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`)-1;
  const pagesId=objs.push("")-1;
  const pageIds=[];
  for(const pageLines of chunks){
    let y=760,content="BT\n";
    for(const item of pageLines){
      if(item===""){y-=10;continue}
      const obj=typeof item==="object"?item:{t:item,size:11,bold:false};
      const size=obj.size||11;
      content+=`/${obj.bold?"F2":"F1"} ${size} Tf 50 ${y} Td (${pdfEsc(obj.t)}) Tj\n`;
      y-=size+6;
    }
    content+="ET";
    const streamId=objs.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`)-1;
    const pageId=objs.push(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${streamId} 0 R >>`)-1;
    pageIds.push(pageId);
  }
  objs[pagesId]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const catalog=objs.push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)-1;
  let out="%PDF-1.4\n",offsets=[0];
  for(let i=1;i<objs.length;i++){offsets[i]=Buffer.byteLength(out);out+=`${i} 0 obj\n${objs[i]}\nendobj\n`}
  const xref=Buffer.byteLength(out);
  out+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for(let i=1;i<objs.length;i++)out+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  out+=`trailer\n<< /Size ${objs.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out,"binary");
}
function createPdfWorkProduct(spec={}){
  const title=String(spec.title||"Kairoq Report").slice(0,200);
  const filename=safeWorkFilename(spec.filename,title,"pdf");
  const sections=(Array.isArray(spec.sections)?spec.sections:[]).slice(0,60);
  return finalizeWorkFile("pdf",title,filename,createPdfBuffer(title,sections),`Sections: ${sections.length}`);
}
function createCsvWorkProduct(spec={}){
  const title=String(spec.title||"Kairoq Data").slice(0,200);
  const filename=safeWorkFilename(spec.filename,title,"csv");
  const rows=[Array.isArray(spec.headers)?spec.headers:[],...normalizeGrid(spec.rows||[],5000,100)].filter(r=>r.length);
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv=rows.map(r=>r.map(q).join(",")).join("\r\n")+"\r\n";
  return finalizeWorkFile("csv",title,filename,Buffer.from(csv,"utf8"),`Rows: ${Math.max(0,rows.length-1)}`);
}
function listWorkProducts(){
  const x=readJsonFileSafe(WORK_PRODUCTS_FILE,[]);
  return Array.isArray(x)?x:[];
}
async function handleWorkProductsList(_req,res){
  return json(res,200,{work_products:listWorkProducts().slice(0,100)});
}



function safeSlug(value="listing"){
  return String(value||"listing").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)||"listing";
}
function stripHtmlText(html=""){
  return String(html||"")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g," ").trim();
}
function htmlMeta(html,name){
  const esc=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pats=[
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']*)["'][^>]*>`,`i`),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${esc}["'][^>]*>`,`i`)
  ];
  for(const p of pats){const m=String(html).match(p);if(m)return m[1].trim()}
  return "";
}
function htmlTitle(html){const m=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);return m?stripHtmlText(m[1]):""}
function extractListingImages(html,baseUrl){
  const found=[];
  const og=htmlMeta(html,"og:image"); if(og)found.push(og);
  const rx=/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi; let m;
  while((m=rx.exec(String(html)))&&found.length<24)found.push(m[1]);
  const out=[];
  for(const raw of found){
    try{const u=new URL(raw,baseUrl);if(!/^https?:$/i.test(u.protocol))continue;const s=u.toString();if(!out.includes(s))out.push(s)}catch{}
    if(out.length>=12)break;
  }
  return out;
}
function isBlockedListingHost(hostname=""){
  const h=String(hostname||"").toLowerCase().replace(/^\[|\]$/g,"");
  if(!h||h==="localhost"||h.endsWith(".local")||h.endsWith(".internal"))return true;
  if(/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h))return true;
  const m=h.match(/^172\.(\d+)\./); if(m&&Number(m[1])>=16&&Number(m[1])<=31)return true;
  if(h==="::1"||h.startsWith("fc")||h.startsWith("fd")||h.startsWith("fe80:"))return true;
  return false;
}
async function fetchPublicListingPage(rawUrl){
  let current=new URL(String(rawUrl||"").trim());
  if(!/^https?:$/i.test(current.protocol))throw new Error("Listing URL must use http or https.");
  for(let hop=0;hop<4;hop++){
    if(isBlockedListingHost(current.hostname))throw new Error("Private or local URLs are not allowed.");
    const r=await fetch(current.toString(),{method:"GET",redirect:"manual",headers:{"User-Agent":"Mozilla/5.0 KairoqListingBot/1.0","Accept":"text/html,application/xhtml+xml"},signal:AbortSignal.timeout(15000)});
    if([301,302,303,307,308].includes(r.status)){
      const loc=r.headers.get("location"); if(!loc)throw new Error("Listing page redirected without a location.");
      current=new URL(loc,current); continue;
    }
    if(!r.ok)throw new Error(`Could not open listing page (${r.status}).`);
    const ct=r.headers.get("content-type")||""; if(!ct.includes("text/html"))throw new Error("Listing URL did not return an HTML page.");
    return {html:(await r.text()).slice(0,3_000_000),url:current.toString()};
  }
  throw new Error("Too many listing redirects.");
}
function normalizeListing(input={}){
  const now=new Date().toISOString();
  const amenities=Array.isArray(input.amenities)?input.amenities:String(input.amenities||"").split(/[,\n]/);
  const images=Array.isArray(input.images)?input.images:[];
  return {
    id:String(input.id||crypto.randomUUID()),
    source_url:String(input.source_url||"").slice(0,4000),
    title:String(input.title||"Untitled property").trim().slice(0,220),
    address:String(input.address||"").trim().slice(0,500),
    city:String(input.city||"").trim().slice(0,120),
    country:String(input.country||"").trim().slice(0,100),
    bedrooms:String(input.bedrooms||"").trim().slice(0,40),
    bathrooms:String(input.bathrooms||"").trim().slice(0,40),
    sleeps:String(input.sleeps||"").trim().slice(0,40),
    monthly_rate:String(input.monthly_rate||input.rate||"").trim().slice(0,100),
    currency:String(input.currency||"CAD").trim().slice(0,12),
    minimum_stay:String(input.minimum_stay||"").trim().slice(0,100),
    parking:String(input.parking||"").trim().slice(0,300),
    laundry:String(input.laundry||"").trim().slice(0,300),
    wifi:String(input.wifi||"").trim().slice(0,300),
    supplier:String(input.supplier||"").trim().slice(0,200),
    amenities:amenities.map(x=>String(x).trim()).filter(Boolean).slice(0,60),
    notes:String(input.notes||"").trim().slice(0,8000),
    neighbourhood_facts:String(input.neighbourhood_facts||"").trim().slice(0,6000),
    images:images.map(x=>String(x||"")).filter(Boolean).slice(0,30),
    source_snapshot:String(input.source_snapshot||"").slice(0,15000),
    generated:input.generated&&typeof input.generated==="object"?input.generated:{},
    status:String(input.status||"draft").slice(0,40),
    created_at:input.created_at||now,
    updated_at:now
  };
}
function loadListings(){const x=readJsonFileSafe(LISTINGS_FILE,[]);return Array.isArray(x)?x.map(normalizeListing):[]}
function saveListings(items){writeJsonFileSafe(LISTINGS_FILE,(Array.isArray(items)?items:[]).slice(0,1000))}
function saveListingImageDataUrl(listingId,dataUrl,index=0){
  if(!/^data:image\//i.test(String(dataUrl||"")))return String(dataUrl||"");
  const parsed=decodeDataUrl(String(dataUrl));
  const ext=extensionForMediaType(parsed.mediaType)||".jpg";
  const dir=path.join(LISTINGS_DIR,String(listingId));fs.mkdirSync(dir,{recursive:true});
  const filename=`photo-${String(index+1).padStart(2,"0")}${ext}`;fs.writeFileSync(path.join(dir,filename),parsed.buffer);
  return `/generated/listings/${encodeURIComponent(String(listingId))}/${encodeURIComponent(filename)}`;
}
function upsertListing(input={}){
  const items=loadListings(); const id=String(input.id||crypto.randomUUID());
  const existing=items.find(x=>x.id===id);
  const rawImages=Array.isArray(input.images)?input.images:(existing?.images||[]);
  const persisted=rawImages.map((img,i)=>/^data:image\//i.test(String(img||""))?saveListingImageDataUrl(id,img,i):String(img||"")).filter(Boolean);
  const item=normalizeListing({...existing,...input,id,images:persisted,created_at:existing?.created_at||input.created_at});
  const idx=items.findIndex(x=>x.id===id); if(idx>=0)items[idx]=item;else items.unshift(item);saveListings(items);return item;
}
function factualListingContext(listing){
  return JSON.stringify({
    title:listing.title,address:listing.address,city:listing.city,country:listing.country,
    bedrooms:listing.bedrooms,bathrooms:listing.bathrooms,sleeps:listing.sleeps,monthly_rate:listing.monthly_rate,currency:listing.currency,
    minimum_stay:listing.minimum_stay,parking:listing.parking,laundry:listing.laundry,wifi:listing.wifi,supplier:listing.supplier,
    amenities:listing.amenities,notes:listing.notes,neighbourhood_facts:listing.neighbourhood_facts,source_snapshot:listing.source_snapshot
  });
}
async function generateListingSalesCopy(listing){
  const messages=[
    {role:"system",content:"You create accurate furnished-housing sales content. Use ONLY facts in the supplied property record. Never invent amenities, distances, landmarks, transit times, views, availability, rates, policies, or neighbourhood facts. If a fact is missing, omit it. Return strict JSON with keys short_description, long_description, amenity_highlights (array), neighbourhood_section, email_subject, email_body, proposal_intro, reel_script, property_video_script."},
    {role:"user",content:`Property record:\n${factualListingContext(listing)}\n\nWrite polished corporate-housing sales content. The neighbourhood section may use only neighbourhood_facts from the record.`}
  ];
  try{
    const out=await callFreeLlmJSON({messages,temperature:0.25});
    return {
      short_description:String(out.short_description||"").slice(0,1800),
      long_description:String(out.long_description||"").slice(0,6000),
      amenity_highlights:(Array.isArray(out.amenity_highlights)?out.amenity_highlights:[]).map(x=>String(x)).slice(0,20),
      neighbourhood_section:String(out.neighbourhood_section||"").slice(0,3000),
      email_subject:String(out.email_subject||"").slice(0,300),
      email_body:String(out.email_body||"").slice(0,5000),
      proposal_intro:String(out.proposal_intro||"").slice(0,3000),
      reel_script:String(out.reel_script||"").slice(0,3000),
      property_video_script:String(out.property_video_script||"").slice(0,4000)
    };
  }catch{
    const facts=[listing.bedrooms?`${listing.bedrooms} bedroom`:"",listing.bathrooms?`${listing.bathrooms} bathroom`:"",listing.city||""].filter(Boolean).join(" · ");
    const am=listing.amenities.slice(0,10);
    return {
      short_description:[listing.title,facts].filter(Boolean).join(" — "),
      long_description:`${listing.title}${listing.address?` at ${listing.address}`:""}. ${am.length?`Highlights include ${am.join(", ")}.`:""}`.trim(),
      amenity_highlights:am,
      neighbourhood_section:listing.neighbourhood_facts||"",
      email_subject:`Furnished housing option: ${listing.title}`,
      email_body:`Please find a furnished housing option for review: ${listing.title}.${listing.address?` ${listing.address}.`:""}`,
      proposal_intro:`${listing.title}${facts?` · ${facts}`:""}`,
      reel_script:`Show the real property photos with subtle camera motion. Do not alter architecture, furniture, views, or amenities. Highlight only: ${am.join(", ")||"the supplied property details"}.`,
      property_video_script:`Create a clean corporate-housing property overview using only the supplied real images. Preserve the exact unit appearance and avoid adding or removing physical features.`
    };
  }
}
function listingPdfSpec(listing,copy){
  const details=[
    listing.address&&`Address: ${listing.address}`,
    listing.city&&`City: ${listing.city}`,
    listing.bedrooms&&`Bedrooms: ${listing.bedrooms}`,
    listing.bathrooms&&`Bathrooms: ${listing.bathrooms}`,
    listing.sleeps&&`Sleeps: ${listing.sleeps}`,
    listing.monthly_rate&&`Rate: ${listing.currency||""} ${listing.monthly_rate}`,
    listing.minimum_stay&&`Minimum stay: ${listing.minimum_stay}`,
    listing.parking&&`Parking: ${listing.parking}`,
    listing.laundry&&`Laundry: ${listing.laundry}`,
    listing.wifi&&`Wi-Fi: ${listing.wifi}`
  ].filter(Boolean);
  return {
    title:listing.title,
    filename:`${safeSlug(listing.title)}-property-sheet.pdf`,
    sections:[
      {heading:"Property summary",paragraphs:[copy.short_description||copy.long_description||listing.notes||""]},
      {heading:"Details",bullets:details},
      {heading:"Amenities",bullets:(copy.amenity_highlights?.length?copy.amenity_highlights:listing.amenities)},
      ...(copy.neighbourhood_section?[{heading:"Neighbourhood",paragraphs:[copy.neighbourhood_section]}]:[]),
      {heading:"Source & accuracy",paragraphs:["Prepared from the property information supplied to Kairoq. Generated content must be reviewed before client distribution; no unverified amenities or property features should be added."]}
    ]
  };
}
function listingVideoReference(listing){return listing.images.find(x=>/^https?:\/\//i.test(x))||listing.images.find(x=>String(x).startsWith("/generated/"))||""}
function localPublicAssetToDataUrl(url){
  if(!String(url||"").startsWith("/generated/"))return url;
  const safe=decodeURIComponent(String(url)).replace(/^\/+/,"");
  const abs=path.resolve(PUBLIC_DIR,safe.replace(/^public\//,"")); if(!abs.startsWith(PUBLIC_DIR)||!fs.existsSync(abs))return "";
  const ext=path.extname(abs).toLowerCase(); const mime=ext===".png"?"image/png":ext===".webp"?"image/webp":"image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(abs).toString("base64")}`;
}
async function ensureListingSalesCopy(listing){
  const existing=listing?.generated?.copy;
  if(existing?.short_description||existing?.long_description)return existing;
  return await generateListingSalesCopy(listing);
}
function listingBrandFooter(){
  return `${LISTING_BRAND.name} · ${LISTING_BRAND.website.replace(/^https?:\/\//,'')} · ${LISTING_BRAND.phone} · ${LISTING_BRAND.email}`;
}
async function makeListingSalesReady(listing){
  const copy=await generateListingSalesCopy(listing);
  const brandedSpec=listingPdfSpec(listing,copy);
  brandedSpec.title=`${LISTING_BRAND.name} | ${listing.title}`;
  brandedSpec.sections.unshift({heading:LISTING_BRAND.tagline,paragraphs:[`Prepared by ${LISTING_BRAND.name} for corporate and extended-stay housing review.`]});
  brandedSpec.sections.push({heading:"The PlanURstay Standard",bullets:LISTING_BRAND.standards});
  brandedSpec.sections.push({heading:"Contact",paragraphs:[listingBrandFooter()]});
  const pdf=createPdfWorkProduct(brandedSpec).work_product;
  return upsertListing({...listing,generated:{...listing.generated,copy,property_sheet:pdf,sales_ready_at:new Date().toISOString(),brand:LISTING_BRAND},status:"sales-ready"});
}
async function createListingPropertyVideo(listing){
  const copy=await ensureListingSalesCopy(listing);
  const generated={...listing.generated,copy,brand:LISTING_BRAND};
  const ref=listingVideoReference(listing);
  if(!ref)throw new Error("Add at least one property photo before creating a property video.");
  const refValue=localPublicAssetToDataUrl(ref);
  const guard="Use the supplied real property image as the factual source. Preserve architecture, room layout, windows, furniture, fixtures, finishes, view, and visible amenities exactly. Do not invent, remove, renovate, restage, add people, or materially alter the property. Camera movement only; presentation may improve but property facts must not change.";
  try{
    const reelPrompt=`${guard} Create a polished 9:16-style furnished-housing social reel with subtle realistic camera movement, premium but truthful presentation, and no fake property features. ${copy.reel_script||""}`;
    generated.reel=await runStudioVideoGeneration({prompt:reelPrompt,duration:6,reference_image:refValue,budget_mode:higgsfieldConfigured()?"best":"balanced"});
    delete generated.reel_error;
  }catch(err){generated.reel_error=err.message}
  try{
    const propertyPrompt=`${guard} Create a clean 16:9 corporate-housing property overview clip with slow cinematic movement and restrained professional styling. ${copy.property_video_script||""}`;
    generated.property_video=await runStudioVideoGeneration({prompt:propertyPrompt,duration:8,reference_image:refValue,budget_mode:higgsfieldConfigured()?"best":"balanced"});
    delete generated.property_video_error;
  }catch(err){generated.property_video_error=err.message}
  if(!generated.reel && !generated.property_video){
    throw new Error(generated.property_video_error||generated.reel_error||"Property video generation failed.");
  }
  generated.video_generated_at=new Date().toISOString();
  return upsertListing({...listing,generated,status:listing.status==="draft"?"sales-ready":listing.status});
}
function normalizeProposalClient(input={}){
  return {
    company:String(input.company||input.client_company||"").trim().slice(0,240),
    contact:String(input.contact||input.client_name||"").trim().slice(0,200),
    guest:String(input.guest||input.guest_name||"").trim().slice(0,200),
    arrival:String(input.arrival||"").trim().slice(0,80),
    departure:String(input.departure||"").trim().slice(0,80),
    quoted_rate:String(input.quoted_rate||"").trim().slice(0,120),
    notes:String(input.notes||"").trim().slice(0,3000)
  };
}
async function createListingClientProposal(listing,clientInput={}){
  const client=normalizeProposalClient(clientInput);
  const copy=await ensureListingSalesCopy(listing);
  const label=client.company||client.contact||client.guest||"Client";
  const stay=[client.arrival&&`Arrival: ${client.arrival}`,client.departure&&`Departure: ${client.departure}`,client.guest&&`Guest: ${client.guest}`,client.quoted_rate&&`Quoted rate: ${client.quoted_rate}`].filter(Boolean);
  const details=[
    listing.address&&`Address: ${listing.address}`,
    listing.city&&`City: ${listing.city}`,
    listing.bedrooms&&`Bedrooms: ${listing.bedrooms}`,
    listing.bathrooms&&`Bathrooms: ${listing.bathrooms}`,
    listing.minimum_stay&&`Minimum stay: ${listing.minimum_stay}`,
    listing.parking&&`Parking: ${listing.parking}`,
    listing.laundry&&`Laundry: ${listing.laundry}`,
    listing.wifi&&`Wi-Fi: ${listing.wifi}`
  ].filter(Boolean);
  const proposal=createPdfWorkProduct({
    title:`${LISTING_BRAND.name} | Proposal for ${label}`,
    filename:`${safeSlug(label)}-${safeSlug(listing.title)}-proposal.pdf`,
    sections:[
      {heading:`Prepared for ${label}`,paragraphs:[client.contact?`Attention: ${client.contact}`:"",LISTING_BRAND.tagline].filter(Boolean)},
      ...(stay.length?[{heading:"Stay requirements",bullets:stay}]:[]),
      {heading:"Recommended furnished accommodation",paragraphs:[copy.proposal_intro||copy.short_description||listing.title]},
      {heading:listing.title,paragraphs:[copy.long_description||copy.short_description||""],bullets:details},
      {heading:"Amenity highlights",bullets:(copy.amenity_highlights?.length?copy.amenity_highlights:listing.amenities)},
      ...(copy.neighbourhood_section?[{heading:"Neighbourhood",paragraphs:[copy.neighbourhood_section]}]:[]),
      {heading:"The PlanURstay Standard",bullets:LISTING_BRAND.standards},
      ...(client.notes?[{heading:"Client notes",paragraphs:[client.notes]}]:[]),
      {heading:"Next step",paragraphs:[`Contact ${LISTING_BRAND.name} to confirm availability and final stay terms. ${listingBrandFooter()}`]},
      {heading:"Accuracy note",paragraphs:["This proposal is prepared from supplied property facts. Availability, pricing, taxes, fees, and final terms should be confirmed before booking."]}
    ]
  }).work_product;
  const generated={...listing.generated,copy,client_proposal:{...proposal,client,created_at:new Date().toISOString()},brand:LISTING_BRAND};
  return upsertListing({...listing,generated,status:listing.status==="draft"?"sales-ready":listing.status});
}
async function generateListingSalesPack(listing,{video=true}={}){
  let current=await makeListingSalesReady(listing);
  if(video){
    try{current=await createListingPropertyVideo(current)}catch(err){current=upsertListing({...current,generated:{...current.generated,property_video_error:err.message}})}
  }
  return current;
}
async function handleListingsList(_req,res){return json(res,200,{listings:loadListings(),brand:LISTING_BRAND})}
async function handleListingSave(req,res){try{const body=await getBody(req,30_000_000);return json(res,200,{listing:upsertListing(body)})}catch(err){return json(res,400,{error:err.message})}}
async function handleListingImportUrl(req,res){
  try{
    const body=await getBody(req,500_000); const raw=String(body.url||"").trim(); if(!raw)return json(res,400,{error:"Listing URL is required."});
    const page=await fetchPublicListingPage(raw); const title=htmlMeta(page.html,"og:title")||htmlTitle(page.html); const description=htmlMeta(page.html,"og:description")||htmlMeta(page.html,"description");
    const images=extractListingImages(page.html,page.url); const text=stripHtmlText(page.html).slice(0,14000);
    let extracted={};
    try{
      extracted=await callFreeLlmJSON({messages:[
        {role:"system",content:"Extract furnished-property facts from the supplied listing page text. Never infer missing values. Return strict JSON with title,address,city,country,bedrooms,bathrooms,sleeps,monthly_rate,currency,minimum_stay,parking,laundry,wifi,amenities(array),notes. Use empty strings/array when not explicit."},
        {role:"user",content:`URL: ${page.url}\nTitle: ${title}\nDescription: ${description}\nPage text:\n${text}`}
      ],temperature:0});
    }catch{}
    return json(res,200,{source_url:page.url,title:extracted.title||title||"",description,images,snapshot:text,extracted});
  }catch(err){return json(res,400,{error:err.message||"Could not import listing URL."})}
}
async function handleListingMakeSalesReady(req,res){
  try{const body=await getBody(req,500_000),id=String(body.id||"");const listing=loadListings().find(x=>x.id===id);if(!listing)return json(res,404,{error:"Listing not found."});const result=await makeListingSalesReady(listing);return json(res,200,{listing:result})}catch(err){return json(res,500,{error:err.message||"Could not make listing sales-ready."})}
}
async function handleListingPropertyVideo(req,res){
  try{const body=await getBody(req,500_000),id=String(body.id||"");const listing=loadListings().find(x=>x.id===id);if(!listing)return json(res,404,{error:"Listing not found."});const result=await createListingPropertyVideo(listing);return json(res,200,{listing:result})}catch(err){return json(res,500,{error:err.message||"Could not create property video."})}
}
async function handleListingClientProposal(req,res){
  try{const body=await getBody(req,750_000),id=String(body.id||"");const listing=loadListings().find(x=>x.id===id);if(!listing)return json(res,404,{error:"Listing not found."});const result=await createListingClientProposal(listing,body.client||body);return json(res,200,{listing:result})}catch(err){return json(res,500,{error:err.message||"Could not create client proposal."})}
}
async function handleListingGeneratePack(req,res){
  try{const body=await getBody(req,500_000),id=String(body.id||"");const listing=loadListings().find(x=>x.id===id);if(!listing)return json(res,404,{error:"Listing not found."});const result=await generateListingSalesPack(listing,{video:body.video!==false});return json(res,200,{listing:result})}catch(err){return json(res,500,{error:err.message||"Could not generate sales pack."})}
}


function xmlDecode(value=""){
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function stripTags(value=""){return xmlDecode(String(value).replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim()}
function rssTag(block,tag){const m=String(block).match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,`i`));return m?stripTags(m[1]):""}
function pursuitScore(text=""){
  const t=String(text).toLowerCase(); let score=28; const reasons=[];
  const rules=[
    [/(contract awarded|wins? contract|selected for|project awarded|construction begins|mobiliz)/,28,"project/contract award"],
    [/(relocat|headquarters move|office opening|new office|expansion|expands into)/,24,"relocation or expansion"],
    [/(hiring|hire [0-9]|jobs|workforce|employees|staffing|recruit)/,18,"workforce growth"],
    [/(intern|graduate program|training cohort|consultants|crew|workers)/,14,"group-housing pattern"],
    [/(fire|flood|disaster|displaced|restoration|insurance)/,20,"displacement/insurance demand"],
    [/(toronto|mississauga|ontario|canada|new york|dallas|houston|san francisco)/,8,"target-market geography"],
    [/(temporary|extended stay|accommodation|housing|lodging)/,12,"explicit accommodation signal"]
  ];
  for(const [re,pts,label] of rules){if(re.test(t)){score+=pts;reasons.push(label)}}
  return {score:Math.max(1,Math.min(99,score)),reasons:[...new Set(reasons)].slice(0,5)};
}
function normalizePursuit(input={}){
  const now=new Date().toISOString(), evidence=Array.isArray(input.evidence)?input.evidence.slice(0,20):[];
  const scoring=pursuitScore([input.company,input.signal,input.headline,input.summary,...evidence.map(x=>x.title||x.summary||"")].join(" "));
  return {id:String(input.id||crypto.randomUUID()),company:String(input.company||input.source||"Potential account").trim().slice(0,240),headline:String(input.headline||input.signal||"").trim().slice(0,800),signal:String(input.signal||"").trim().slice(0,240),geography:String(input.geography||"").trim().slice(0,240),source_url:String(input.source_url||"").trim().slice(0,4000),source:String(input.source||"").trim().slice(0,240),published_at:String(input.published_at||"").trim().slice(0,120),score:Number(input.score||scoring.score),score_reasons:Array.isArray(input.score_reasons)?input.score_reasons:scoring.reasons,status:String(input.status||"new"),owner:String(input.owner||"").slice(0,160),next_action:String(input.next_action||"").slice(0,1000),follow_up_at:String(input.follow_up_at||"").slice(0,120),brief:input.brief&&typeof input.brief==="object"?input.brief:null,evidence,created_at:input.created_at||now,updated_at:now};
}
function loadPursuits(){const x=readJsonFileSafe(PURSUITS_FILE,[]);return Array.isArray(x)?x.map(normalizePursuit):[]}
function savePursuits(items){writeJsonFileSafe(PURSUITS_FILE,(Array.isArray(items)?items:[]).slice(0,1500))}
function upsertPursuit(input={}){const item=normalizePursuit(input),items=loadPursuits(),i=items.findIndex(x=>x.id===item.id);if(i>=0)items[i]={...items[i],...item,created_at:items[i].created_at};else items.unshift(item);savePursuits(items);return item}
function extractCompanyFromHeadline(title="",source=""){
  let t=String(title).replace(/\s+-\s+[^-]{2,80}$/," ").trim();
  t=t.replace(/^(breaking|exclusive|update):\s*/i,"");
  const patterns=[/^([^:]{2,90}):/,/^(.{2,80}?)\s+(?:wins?|awarded|opens?|expands?|launches?|hires?|plans?|selected|secures?)\b/i];
  for(const re of patterns){const m=t.match(re);if(m&&m[1])return m[1].trim().replace(/^\W+|\W+$/g,"").slice(0,120)}
  return String(source||"Potential account").slice(0,120);
}
async function googleNewsSignals(query,limit=12){
  const url=`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-CA&gl=CA&ceid=CA:en`;
  const response=await fetchWithRetry(url,{headers:{"User-Agent":"Mozilla/5.0 Kairoq-Pursuit/1.0"},signal:AbortSignal.timeout(15000)},{retries:1});
  if(!response.ok)throw new Error(`Public news search failed (${response.status})`); const xml=await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,Math.max(1,Math.min(30,limit))).map(m=>{const b=m[1];return{title:rssTag(b,"title"),link:rssTag(b,"link"),published_at:rssTag(b,"pubDate"),source:rssTag(b,"source"),summary:rssTag(b,"description")}}).filter(x=>x.title&&x.link);
}
async function discoverPursuits({geography="Canada",market="corporate housing",signals="",limit=18}={}){
  const signalText=String(signals||"contract awarded OR new office OR expansion OR hiring OR relocation OR construction project OR interns OR displaced").trim();
  const query=`${geography} (${signalText})`;
  const rows=await googleNewsSignals(query,Math.max(8,Math.min(30,Number(limit)||18)));
  const seen=new Set(), out=[];
  for(const row of rows){const key=(row.title+row.link).toLowerCase();if(seen.has(key))continue;seen.add(key);const scoring=pursuitScore(`${row.title} ${row.summary} ${geography}`);out.push(normalizePursuit({company:extractCompanyFromHeadline(row.title,row.source),headline:row.title,signal:scoring.reasons[0]||"public demand signal",geography,source_url:row.link,source:row.source,published_at:row.published_at,score:scoring.score,score_reasons:scoring.reasons,evidence:[{title:row.title,url:row.link,source:row.source,published_at:row.published_at,summary:row.summary}]}))}
  const existing=loadPursuits(), urls=new Set(existing.map(x=>x.source_url).filter(Boolean));for(const x of out){if(!urls.has(x.source_url)){existing.unshift(x);urls.add(x.source_url)}}savePursuits(existing);return out.sort((a,b)=>b.score-a.score);
}
async function createPursuitBrief(item){
  const evidence=(item.evidence||[]).map(x=>`- ${x.title||x.summary||""} ${x.source?`(${x.source})`:""}`).join("\n");
  let brief=null;
  try{brief=await callFreeLlmJSON({messages:[{role:"system",content:"You are a corporate-housing sales pursuit analyst. Use only supplied evidence. Never invent headcount, project dates, housing demand, contacts, budgets, or contract values. Return JSON: why_now,likely_housing_need,confidence (low|medium|high),questions_to_verify(array),recommended_angle,next_action,outreach_subject,outreach_email. Clearly label inference as inference."},{role:"user",content:`Account: ${item.company}\nGeography: ${item.geography}\nSignal: ${item.headline}\nEvidence:\n${evidence}`}],temperature:0.1})}catch{}
  if(!brief)brief={why_now:item.headline||item.signal,likely_housing_need:"Possible temporary-housing need. Verify workforce count, dates, location and duration before qualifying.",confidence:item.score>=70?"medium":"low",questions_to_verify:["How many employees or contractors will be mobilized?","What are the start/end dates?","Which worksite or office location?","Who owns relocation, travel, procurement or project HR?"],recommended_angle:"Offer flexible furnished housing near the worksite with consolidated support; do not assume demand until verified.",next_action:"Identify the mobility, procurement, project HR or travel owner and verify the demand signal.",outreach_subject:`Temporary housing support for ${item.company}`,outreach_email:`Hi — I noticed the recent development involving ${item.company}. PlanURstay supports companies with flexible furnished apartments for relocating employees, project teams and extended stays across Canada and the U.S. If this initiative creates temporary accommodation needs, I’d be happy to share options and coverage.\n\nBest,\nPlanURstay`};
  return upsertPursuit({...item,brief,next_action:brief.next_action||item.next_action});
}
async function handlePursuitList(_req,res){const items=loadPursuits().sort((a,b)=>b.score-a.score);return json(res,200,{pursuits:items,summary:{total:items.length,hot:items.filter(x=>x.score>=70&&!["won","lost"].includes(x.status)).length,followups:items.filter(x=>x.status==="follow-up").length}})}
// Pursuit discovery scans public news signals and preserves evidence.
async function handlePursuitDiscover(req,res){try{const body=await getBody(req,500_000);const pursuits=await discoverPursuits(body);return json(res,200,{pursuits,count:pursuits.length,source:"public-news-signals"})}catch(err){return json(res,500,{error:err.message||"Could not discover opportunities."})}}
async function handlePursuitSave(req,res){try{const body=await getBody(req,500_000);return json(res,200,{pursuit:upsertPursuit(body)})}catch(err){return json(res,400,{error:err.message})}}
async function handlePursuitBrief(req,res){try{const body=await getBody(req,500_000),id=String(body.id||"");const item=loadPursuits().find(x=>x.id===id);if(!item)return json(res,404,{error:"Pursuit not found."});return json(res,200,{pursuit:await createPursuitBrief(item)})}catch(err){return json(res,500,{error:err.message||"Could not create pursuit brief."})}}
async function handlePursuitStatus(req,res){try{const body=await getBody(req,500_000),id=String(body.id||"");const item=loadPursuits().find(x=>x.id===id);if(!item)return json(res,404,{error:"Pursuit not found."});return json(res,200,{pursuit:upsertPursuit({...item,status:String(body.status||item.status),next_action:String(body.next_action||item.next_action),follow_up_at:String(body.follow_up_at||item.follow_up_at)})})}catch(err){return json(res,400,{error:err.message})}}


function arrivalEscapeHtml(value=""){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function normalizeArrivalBrief(input={}){
  const now=new Date().toISOString();
  const photos=Array.isArray(input.photos)?input.photos:[];
  return {
    id:String(input.id||crypto.randomUUID()),
    share_token:String(input.share_token||crypto.randomBytes(18).toString("hex")),
    guest_name:String(input.guest_name||"").trim().slice(0,160),
    guest_email:String(input.guest_email||"").trim().slice(0,240),
    property_name:String(input.property_name||"").trim().slice(0,240),
    address:String(input.address||"").trim().slice(0,500),
    arrival:String(input.arrival||"").trim().slice(0,80),
    departure:String(input.departure||"").trim().slice(0,80),
    language:String(input.language||"English").trim().slice(0,80),
    entrance:String(input.entrance||"").trim().slice(0,2000),
    parking:String(input.parking||"").trim().slice(0,2000),
    access:String(input.access||"").trim().slice(0,3000),
    wifi:String(input.wifi||"").trim().slice(0,2000),
    thermostat:String(input.thermostat||"").trim().slice(0,2000),
    laundry:String(input.laundry||"").trim().slice(0,2000),
    garbage:String(input.garbage||"").trim().slice(0,2000),
    amenities:String(input.amenities||"").trim().slice(0,3000),
    support_phone:String(input.support_phone||LISTING_BRAND.phone).trim().slice(0,100),
    support_email:String(input.support_email||LISTING_BRAND.email).trim().slice(0,240),
    notes:String(input.notes||"").trim().slice(0,5000),
    photos:photos.map(x=>String(x||"")).filter(Boolean).slice(0,12),
    guide:input.guide&&typeof input.guide==="object"?input.guide:{},
    welcome_video:input.welcome_video&&typeof input.welcome_video==="object"?input.welcome_video:null,
    share_url:String(input.share_url||""),
    status:String(input.status||"draft").slice(0,40),
    viewed_at:input.viewed_at||null,
    acknowledged_at:input.acknowledged_at||null,
    created_at:input.created_at||now,
    updated_at:now
  };
}
function loadArrivalBriefs(){const x=readJsonFileSafe(ARRIVALBRIEFS_FILE,[]);return Array.isArray(x)?x.map(normalizeArrivalBrief):[]}
function saveArrivalBriefs(items){writeJsonFileSafe(ARRIVALBRIEFS_FILE,(Array.isArray(items)?items:[]).slice(0,2000))}
function saveArrivalPhotoDataUrl(id,dataUrl,index=0){
  if(!/^data:image\//i.test(String(dataUrl||"")))return String(dataUrl||"");
  const parsed=decodeDataUrl(String(dataUrl));const ext=extensionForMediaType(parsed.mediaType)||".jpg";
  const dir=path.join(ARRIVALBRIEFS_DIR,String(id));fs.mkdirSync(dir,{recursive:true});
  const filename=`arrival-${String(index+1).padStart(2,"0")}${ext}`;fs.writeFileSync(path.join(dir,filename),parsed.buffer);
  return `/generated/arrivalbrief/${encodeURIComponent(String(id))}/${encodeURIComponent(filename)}`;
}
function upsertArrivalBrief(input={}){
  const items=loadArrivalBriefs();const existing=items.find(x=>x.id===String(input.id||""));
  let item=normalizeArrivalBrief({...existing,...input,share_token:existing?.share_token||input.share_token});
  item.photos=item.photos.map((x,i)=>saveArrivalPhotoDataUrl(item.id,x,i));
  const idx=items.findIndex(x=>x.id===item.id);if(idx>=0)items[idx]=item;else items.unshift(item);saveArrivalBriefs(items);return item;
}
function arrivalFacts(item){
  return [
    ["Entrance",item.entrance],["Parking",item.parking],["Keys & access",item.access],["Wi-Fi",item.wifi],
    ["Thermostat",item.thermostat],["Laundry",item.laundry],["Garbage & recycling",item.garbage],["Amenities",item.amenities]
  ].filter(([,v])=>String(v||"").trim()).map(([title,body])=>({title,body:String(body).trim()}));
}
async function buildArrivalGuide(item){
  const facts=arrivalFacts(item);let guide={language:item.language||"English",welcome:`Welcome${item.guest_name?`, ${item.guest_name}`:""}. Here is everything you need for a smooth arrival.`,steps:facts,closing:`Need help? Contact ${LISTING_BRAND.name} at ${item.support_phone||LISTING_BRAND.phone}.`};
  try{
    const supplied=JSON.stringify({language:item.language,property_name:item.property_name,address:item.address,arrival:item.arrival,entrance:item.entrance,parking:item.parking,access:item.access,wifi:item.wifi,thermostat:item.thermostat,laundry:item.laundry,garbage:item.garbage,amenities:item.amenities,support_phone:item.support_phone,support_email:item.support_email});
    const ai=await callFreeLlmJSON({messages:[{role:"system",content:"Create a concise mobile arrival guide for a furnished-housing guest. Use ONLY supplied facts. Never invent access steps, codes, parking, amenities, building details, distances, or policies. Translate the guide into the requested language when possible. Return strict JSON: language,welcome,steps(array of {title,body}),closing. Preserve numbers/codes exactly."},{role:"user",content:supplied}],temperature:0.1});
    if(ai&&Array.isArray(ai.steps))guide={language:String(ai.language||item.language||"English"),welcome:String(ai.welcome||guide.welcome),steps:ai.steps.slice(0,12).map(x=>({title:String(x.title||"Step"),body:String(x.body||"")})).filter(x=>x.body),closing:String(ai.closing||guide.closing)};
  }catch{}
  return guide;
}
function arrivalSharePath(item){return `/generated/arrivalbrief/${encodeURIComponent(item.id)}/${encodeURIComponent(item.share_token)}/index.html`}
function arrivalShareUrl(item){const rel=arrivalSharePath(item);const site=String(process.env.SITE_URL||"").replace(/\/$/,"");return site?`${site}${rel}`:rel}
function renderArrivalBriefHtml(item){
  const guide=item.guide||{};const steps=Array.isArray(guide.steps)?guide.steps:arrivalFacts(item);
  const photoHtml=(item.photos||[]).slice(0,8).map((src,i)=>`<img src="${arrivalEscapeHtml(src)}" alt="Arrival reference ${i+1}">`).join("");
  const videoUrl=item.welcome_video?.video_asset?.url||item.welcome_video?.video||"";
  const stepsHtml=steps.map((x,i)=>`<section class="step"><div class="n">${i+1}</div><div><h2>${arrivalEscapeHtml(x.title)}</h2><p>${arrivalEscapeHtml(x.body)}</p></div></section>`).join("");
  const supportPhone=arrivalEscapeHtml(item.support_phone||LISTING_BRAND.phone),supportEmail=arrivalEscapeHtml(item.support_email||LISTING_BRAND.email);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${arrivalEscapeHtml(LISTING_BRAND.name)} ArrivalBrief</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f7f8;color:#17202a;font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:760px;margin:auto;padding:22px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:24px;box-shadow:0 14px 40px #0000000d}.brand{display:flex;align-items:center;gap:14px;margin-bottom:20px}.brand img{max-width:150px;max-height:46px}.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280}.hero h1{font-size:30px;line-height:1.1;margin:6px 0 8px}.hero p{color:#59616b;margin:0}.meta{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.pill{background:#f0f4f4;border-radius:999px;padding:7px 11px;font-size:13px}.gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:18px 0}.gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px}.gallery img:first-child{grid-column:1/-1;aspect-ratio:16/9}.welcome-video{width:100%;border-radius:16px;margin:16px 0;background:#111}.step{display:flex;gap:14px;padding:18px 0;border-top:1px solid #eceff1}.n{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:grid;place-items:center;background:#142c2d;color:#fff;font-weight:700}.step h2{font-size:17px;margin:2px 0 4px}.step p{white-space:pre-wrap;margin:0;color:#4b5563}.help{margin-top:18px;padding:18px;background:#eef5f3;border-radius:16px}.actions{display:grid;gap:10px;margin-top:18px}.btn{border:0;border-radius:12px;padding:14px 16px;font-weight:700;text-align:center;text-decoration:none;cursor:pointer}.primary{background:#142c2d;color:white}.secondary{background:#edf0f1;color:#17202a}.privacy{font-size:12px;color:#7a828b;margin-top:18px}@media(max-width:560px){.wrap{padding:10px}.card{padding:18px;border-radius:18px}.hero h1{font-size:25px}}</style></head><body><main class="wrap"><div class="card"><div class="brand"><img src="${arrivalEscapeHtml(LISTING_BRAND.logo_url)}" alt="${arrivalEscapeHtml(LISTING_BRAND.name)}"><div><div class="eyebrow">ArrivalBrief</div><strong>${arrivalEscapeHtml(LISTING_BRAND.name)}</strong></div></div><div class="hero"><div class="eyebrow">Your arrival guide</div><h1>${arrivalEscapeHtml(guide.welcome||`Welcome${item.guest_name?`, ${item.guest_name}`:""}`)}</h1><p>${arrivalEscapeHtml(item.property_name||item.address||"Furnished accommodation")}</p></div><div class="meta">${item.arrival?`<span class="pill">Arrival · ${arrivalEscapeHtml(item.arrival)}</span>`:""}${item.departure?`<span class="pill">Departure · ${arrivalEscapeHtml(item.departure)}</span>`:""}${item.language?`<span class="pill">${arrivalEscapeHtml(item.language)}</span>`:""}</div>${videoUrl?`<video class="welcome-video" controls playsinline src="${arrivalEscapeHtml(videoUrl)}"></video>`:""}${photoHtml?`<div class="gallery">${photoHtml}</div>`:""}<div>${stepsHtml}</div><div class="help"><strong>Need help?</strong><p>${arrivalEscapeHtml(guide.closing||"")}</p><div class="actions"><a class="btn secondary" href="tel:${supportPhone}">Call ${supportPhone}</a><a class="btn secondary" href="mailto:${supportEmail}">Email support</a><button id="settled" class="btn primary">✓ I'm settled in</button></div></div><p id="thanks" class="privacy">This private arrival link may contain property access information. Do not forward it.</p></div></main><script>document.getElementById('settled').addEventListener('click',async()=>{const b=document.getElementById('settled');b.disabled=true;try{const r=await fetch('/api/arrivalbrief/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:${JSON.stringify(item.share_token)}})});if(!r.ok)throw new Error();b.textContent='✓ Confirmed — enjoy your stay';document.getElementById('thanks').textContent='PlanURstay has been notified that you are settled in.'}catch{b.disabled=false;b.textContent='Try again'}})</script></body></html>`;
}
function writeArrivalSharePage(item){
  const dir=path.join(ARRIVALBRIEFS_DIR,String(item.id),String(item.share_token));fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,"index.html"),renderArrivalBriefHtml(item),"utf8");return arrivalShareUrl(item);
}
async function generateArrivalBrief(item){
  const guide=await buildArrivalGuide(item);let next=upsertArrivalBrief({...item,guide,status:"ready"});
  const share_url=writeArrivalSharePage(next);next=upsertArrivalBrief({...next,share_url});return next;
}
async function createArrivalWelcomeVideo(item){
  if(!higgsfieldConfigured())throw new Error("Higgsfield is not configured. Add HF_CREDENTIALS locally before creating the optional welcome clip.");
  const prompt=`Create a warm, premium 5-second furnished-housing arrival welcome clip for ${LISTING_BRAND.name}. Modern abstract apartment-lobby mood, calm camera movement, professional hospitality feel, no people required, no readable text, no addresses, no access codes, no unit numbers, no guest names, and do not depict or imply the guest's actual property.`;
  const welcome_video=await generateVideoHiggsfield({prompt,duration:5,referenceImage:""});
  let next=upsertArrivalBrief({...item,welcome_video});const share_url=writeArrivalSharePage(next);next=upsertArrivalBrief({...next,share_url});return next;
}
async function handleArrivalBriefList(_req,res){const items=loadArrivalBriefs().sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));return json(res,200,{arrivalbriefs:items,brand:LISTING_BRAND,higgsfield_configured:higgsfieldConfigured()})}
async function handleArrivalBriefSave(req,res){try{const body=await getBody(req,20_000_000);return json(res,200,{arrivalbrief:upsertArrivalBrief(body)})}catch(err){return json(res,400,{error:err.message})}}
async function handleArrivalBriefGenerate(req,res){try{const body=await getBody(req,500_000),id=String(body.id||"");const item=loadArrivalBriefs().find(x=>x.id===id);if(!item)return json(res,404,{error:"ArrivalBrief not found."});return json(res,200,{arrivalbrief:await generateArrivalBrief(item)})}catch(err){return json(res,500,{error:err.message||"Could not generate ArrivalBrief."})}}
async function handleArrivalBriefWelcomeVideo(req,res){try{const body=await getBody(req,500_000),id=String(body.id||"");const item=loadArrivalBriefs().find(x=>x.id===id);if(!item)return json(res,404,{error:"ArrivalBrief not found."});return json(res,200,{arrivalbrief:await createArrivalWelcomeVideo(item)})}catch(err){return json(res,500,{error:err.message||"Could not create welcome clip."})}}
async function handleArrivalBriefAck(req,res){try{const body=await getBody(req,100_000),token=String(body.token||"");const item=loadArrivalBriefs().find(x=>x.share_token===token);if(!item)return json(res,404,{error:"ArrivalBrief not found."});const updated=upsertArrivalBrief({...item,acknowledged_at:new Date().toISOString(),status:"settled"});return json(res,200,{ok:true,acknowledged_at:updated.acknowledged_at})}catch(err){return json(res,400,{error:err.message})}}

function normalizeStudioAvatar(input={}){
  const now=new Date().toISOString();
  return {
    id:String(input.id||crypto.randomUUID()),
    name:String(input.name||"Untitled avatar").slice(0,120),
    look:String(input.look||input.description||"").slice(0,4000),
    personality:String(input.personality||"").slice(0,1000),
    voice:String(input.voice||"").slice(0,200),
    image_url:String(input.image_url||"").slice(0,4000),
    reference_image:String(input.reference_image||"").slice(0,12_000_000),
    prompt_seed:String(input.prompt_seed||"").slice(0,4000),
    tags:Array.isArray(input.tags)?input.tags.map(x=>String(x).slice(0,80)).slice(0,12):[],
    created_at:input.created_at||now,
    updated_at:now
  };
}
function loadStudioAvatars(){const x=readJsonFileSafe(STUDIO_AVATARS_FILE,[]);return Array.isArray(x)?x:[]}
function saveStudioAvatars(items){writeJsonFileSafe(STUDIO_AVATARS_FILE,items.slice(0,500))}
function upsertStudioAvatar(input={}){const items=loadStudioAvatars(),item=normalizeStudioAvatar(input),i=items.findIndex(x=>x.id===item.id);if(i>=0)items[i]=item;else items.unshift(item);saveStudioAvatars(items);return item}

function normalizeStudioProject(input={}){
  const now=new Date().toISOString();
  return {
    id:String(input.id||crypto.randomUUID()),
    name:String(input.name||"Untitled project").slice(0,160),
    description:String(input.description||"").slice(0,3000),
    cover_image:String(input.cover_image||"").slice(0,4000),
    created_at:input.created_at||now,
    updated_at:now
  };
}
function loadStudioProjects(){const x=readJsonFileSafe(STUDIO_PROJECTS_FILE,[]);if(Array.isArray(x)&&x.length)return x;const seed=[normalizeStudioProject({id:'default-project',name:'Studio Inbox',description:'Default project for creative work.'})];saveStudioProjects(seed);return seed}
function saveStudioProjects(items){writeJsonFileSafe(STUDIO_PROJECTS_FILE,items.slice(0,200))}
function upsertStudioProject(input={}){const items=loadStudioProjects(),item=normalizeStudioProject(input),i=items.findIndex(x=>x.id===item.id);if(i>=0)items[i]=item;else items.unshift(item);saveStudioProjects(items);return item}

function normalizeStudioPrompt(input={}){
  const now=new Date().toISOString();
  return {
    id:String(input.id||crypto.randomUUID()),
    title:String(input.title||"Untitled prompt").slice(0,160),
    prompt:String(input.prompt||"").slice(0,8000),
    category:String(input.category||"General").slice(0,80),
    created_at:input.created_at||now,
    updated_at:now
  };
}
function loadStudioLibrary(){const x=readJsonFileSafe(STUDIO_LIBRARY_FILE,[]);return Array.isArray(x)?x:[]}
function saveStudioLibrary(items){writeJsonFileSafe(STUDIO_LIBRARY_FILE,items.slice(0,500))}
function upsertStudioPrompt(input={}){const items=loadStudioLibrary(),item=normalizeStudioPrompt(input),i=items.findIndex(x=>x.id===item.id);if(i>=0)items[i]=item;else items.unshift(item);saveStudioLibrary(items);return item}

function normalizeStudioHistoryItem(input={}){
  const now=new Date().toISOString();
  return {
    id:String(input.id||crypto.randomUUID()),
    project_id:input.project_id?String(input.project_id):'default-project',
    avatar_id:input.avatar_id?String(input.avatar_id):null,
    mode:String(input.mode||'create').slice(0,80),
    title:String(input.title||'Untitled generation').slice(0,200),
    kind:String(input.kind||'image')==='video'?'video':'image',
    prompt:String(input.prompt||'').slice(0,8000),
    image_size:String(input.image_size||'square_hd').slice(0,80),
    duration:Math.max(0,Math.min(60,Number(input.duration||0))),
    estimated_cost:Number(input.estimated_cost||0),
    provider:input.provider?String(input.provider):null,
    model:input.model?String(input.model):null,
    output:input.output||null,
    created_at:input.created_at||now,
    updated_at:now
  };
}
function loadStudioHistory(){const x=readJsonFileSafe(STUDIO_HISTORY_FILE,[]);return Array.isArray(x)?x:[]}
function saveStudioHistory(items){writeJsonFileSafe(STUDIO_HISTORY_FILE,items.slice(0,1000))}
function upsertStudioHistoryItem(input={}){const items=loadStudioHistory(),item=normalizeStudioHistoryItem(input),i=items.findIndex(x=>x.id===item.id);if(i>=0)items[i]=item;else items.unshift(item);saveStudioHistory(items);return item}

function estimateStudioCost({kind='image', duration=4, budget_mode='balanced', references=[], wants_avatar=false}={}){
  const freeImage = localSdConfigured() || wan2gpConfigured() || !!SELF_HOST_MEDIA_BASE_URL || !!POLLINATIONS_API_KEY;
  const freeVideo = wan2gpConfigured() || !!SELF_HOST_MEDIA_BASE_URL || !!POLLINATIONS_API_KEY;
  if (String(budget_mode||'').toLowerCase()==='free') return 0;
  if (kind==='image') {
    if (freeImage) return 0;
    if (higgsfieldConfigured()) return references?.length ? 0.08 : 0.06;
    if (process.env.OPENROUTER_API_KEY) return references?.length ? 0.07 : 0.05;
    if (!!FAL_KEY) return 0.04;
    return 0;
  }
  if (freeVideo) return 0;
  const d=Math.max(2,Math.min(10,Number(duration||4)));
  if (higgsfieldConfigured()) return Number((0.12 * d).toFixed(2));
  return Number((0.08 * d).toFixed(2));
}

async function runStudioImageGeneration({prompt,image_size='square_hd',references=[],budget_mode='balanced'}={}){
  const imageSize=String(image_size||'square_hd');
  const refs=(Array.isArray(references)?references:[]).map(x=>String(x||'')).filter(Boolean).slice(0,4);
  const numImages=1;
  const attempts=[];
  for (const provider of mediaProviderOrderForBudget(budget_mode || 'cheap')) {
    if (provider === 'localsd' && localSdConfigured()) { try { return await generateImageLocalSd({prompt,imageSize,references:refs}); } catch(err) { attempts.push({provider,error:err.message}); } }
    if (provider === 'wan2gp' && wan2gpConfigured()) { try { return await generateImageWan2gp({prompt,imageSize,references:refs}); } catch(err) { attempts.push({provider,error:err.message}); } }
    if (provider === 'selfhost' && SELF_HOST_MEDIA_BASE_URL) { try { return await generateImageSelfHost({prompt,imageSize,numImages,references:refs}); } catch(err) { attempts.push({provider,error:err.message}); } }
    if (provider === 'higgsfield' && higgsfieldConfigured()) { try { return await generateImageHiggsfield({prompt,imageSize,numImages,references:refs}); } catch(err) { attempts.push({provider,error:err.message}); } }
    if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) { try { return await generateImageOpenRouter({prompt,imageSize,numImages,references:refs}); } catch(err) { attempts.push({provider,error:err.message}); } }
    if (provider === 'pollinations' && POLLINATIONS_API_KEY) { try { return await generateImagePollinations({prompt,imageSize,references:refs}); } catch(err) { attempts.push({provider,error:err.message}); } }
    if (provider === 'fal' && FAL_KEY) { try { return await generateImageFal({prompt,imageSize,numImages,references:refs}); } catch(err) { attempts.push({provider,error:err.message}); } }
  }
  const err=new Error('No image provider completed the request.');
  err.attempts=attempts;
  throw err;
}
async function runStudioVideoGeneration({prompt,duration=4,reference_image='',budget_mode='balanced'}={}){
  const attempts=[];
  const ref=String(reference_image||'').trim();
  for (const provider of mediaProviderOrderForBudget(budget_mode || 'cheap')) {
    if (provider === 'wan2gp' && wan2gpConfigured()) { try { return await generateVideoWan2gp({prompt,duration,referenceImage:ref}); } catch(err) { attempts.push({provider,error:err.message}); } }
    if (provider === 'selfhost' && SELF_HOST_MEDIA_BASE_URL) { try { return await generateVideoSelfHost({prompt,duration,referenceImage:ref}); } catch(err) { attempts.push({provider,error:err.message}); } }
    if (provider === 'pollinations' && POLLINATIONS_API_KEY) { try { return await generateVideoPollinations({prompt,duration,referenceImage:ref}); } catch(err) { attempts.push({provider,error:err.message}); } }
    if (provider === 'higgsfield' && higgsfieldConfigured()) { try { return await generateVideoHiggsfield({prompt,duration,referenceImage:ref}); } catch(err) { attempts.push({provider,error:err.message}); } }
  }
  const err=new Error('No video provider completed the request.');
  err.attempts=attempts;
  throw err;
}

async function handleStudioEstimate(req,res){
  try{
    const body=req.method==='GET'?{}:await getBody(req,500_000);
    const item={kind:String(body.kind||'image'),duration:Number(body.duration||4),budget_mode:String(body.budget_mode||'balanced'),references:Array.isArray(body.references)?body.references:[],wants_avatar:!!body.avatar_id};
    return json(res,200,{estimated_cost:estimateStudioCost(item),currency:'USD'});
  }catch(err){return json(res,400,{error:err.message||'Could not estimate cost.'})}
}
async function handleStudioStatus(_req,res){
  const media={image:(await (async()=>({providers:{localsd:{configured:localSdConfigured()},wan2gp:{configured:wan2gpConfigured()},selfhost:{configured:!!SELF_HOST_MEDIA_BASE_URL},higgsfield:{configured:higgsfieldConfigured()},openrouter:{configured:!!process.env.OPENROUTER_API_KEY},pollinations:{configured:!!POLLINATIONS_API_KEY},fal:{configured:!!FAL_KEY}}}))()), video:{providers:{wan2gp:{configured:wan2gpConfigured()},selfhost:{configured:!!SELF_HOST_MEDIA_BASE_URL},higgsfield:{configured:higgsfieldConfigured()},pollinations:{configured:!!POLLINATIONS_API_KEY}}}};
  return json(res,200,{ok:true,providers:media,counts:{avatars:loadStudioAvatars().length,projects:loadStudioProjects().length,prompts:loadStudioLibrary().length,history:loadStudioHistory().length}})
}
async function handleStudioAvatarsList(_req,res){return json(res,200,{avatars:loadStudioAvatars()})}
async function handleStudioAvatarsUpsert(req,res){try{const body=await getBody(req,12_000_000);const avatar=upsertStudioAvatar(body);return json(res,200,{avatar})}catch(err){return json(res,400,{error:err.message})}}
async function handleStudioProjectsList(_req,res){return json(res,200,{projects:loadStudioProjects()})}
async function handleStudioProjectsUpsert(req,res){try{const body=await getBody(req,500_000);const project=upsertStudioProject(body);return json(res,200,{project})}catch(err){return json(res,400,{error:err.message})}}
async function handleStudioLibraryList(_req,res){return json(res,200,{items:loadStudioLibrary()})}
async function handleStudioLibraryUpsert(req,res){try{const body=await getBody(req,500_000);const item=upsertStudioPrompt(body);return json(res,200,{item})}catch(err){return json(res,400,{error:err.message})}}
async function handleStudioHistoryList(_req,res){return json(res,200,{history:loadStudioHistory()})}
async function handleStudioGenerate(req,res){
  try{
    const body=await getBody(req,14_000_000);
    const kind=String(body.kind||'image').toLowerCase()==='video'?'video':'image';
    const prompt=String(body.prompt||'').trim();
    if(!prompt)return json(res,400,{error:'Prompt is required.'});
    const budget_mode=String(body.budget_mode||'balanced');
    const project_id=String(body.project_id||'default-project');
    const avatar_id=body.avatar_id?String(body.avatar_id):null;
    const title=String(body.title||`${kind==='video'?'Video':'Image'} generation`).slice(0,200);
    const estimated_cost=estimateStudioCost({kind,duration:body.duration,budget_mode,references:body.references,wants_avatar:!!avatar_id});
    let result;
    if(kind==='image') result=await runStudioImageGeneration({prompt,image_size:body.image_size||'square_hd',references:Array.isArray(body.references)?body.references:[],budget_mode});
    else result=await runStudioVideoGeneration({prompt,duration:body.duration||4,reference_image:body.reference_image||'',budget_mode});
    const history=upsertStudioHistoryItem({project_id,avatar_id,mode:body.mode||'create',title,kind,prompt,image_size:body.image_size||'square_hd',duration:body.duration||0,estimated_cost,provider:result.provider||null,model:result.model||null,output:result});
    return json(res,200,{ok:true,result,history});
  }catch(err){return json(res,500,{error:err.message||'Studio generation failed.',attempts:err.attempts||[]})}
}

function normalizeMediaJob(input={}){const now=new Date().toISOString(),kind=String(input.kind||"image").toLowerCase()==="video"?"video":"image",statuses=new Set(["queued","running","done","error","interrupted","cancelled"]);return{id:String(input.id||crypto.randomUUID()),kind,prompt:String(input.prompt||"").slice(0,8000),budget_mode:"free",image_size:String(input.image_size||"square_hd"),duration:Math.max(2,Math.min(10,Number(input.duration||4))),reference_image:String(input.reference_image||"").slice(0,12_000_000),status:statuses.has(input.status)?input.status:"queued",provider:input.provider?String(input.provider):null,model:input.model?String(input.model):null,progress:Math.max(0,Math.min(1,Number(input.progress||0))),event_id:input.event_id?String(input.event_id):null,output:input.output||null,error:input.error?String(input.error):null,attempts:Math.max(0,Number(input.attempts||0)),outcome_id:input.outcome_id?String(input.outcome_id):null,created_at:input.created_at||now,updated_at:now,completed_at:input.completed_at||null}}
function loadMediaJobs(){const x=readJsonFileSafe(MEDIA_JOBS_FILE,[]);return Array.isArray(x)?x:[]}
function saveMediaJobs(items){writeJsonFileSafe(MEDIA_JOBS_FILE,items.slice(0,500))}
function upsertMediaJob(input){const jobs=loadMediaJobs(),job=normalizeMediaJob(input),i=jobs.findIndex(x=>x.id===job.id);if(i>=0)jobs[i]=job;else jobs.unshift(job);saveMediaJobs(jobs);return job}
function updateMediaJob(id,patch={}){const current=loadMediaJobs().find(x=>x.id===id);if(!current)throw new Error("Media job not found.");return upsertMediaJob({...current,...patch,id,created_at:current.created_at})}
function syncMediaOutcome(job){let loop=job.outcome_id?loadOpenLoops().find(x=>x.id===job.outcome_id):null;if(!loop){loop=upsertOpenLoop({title:`Create ${job.kind}: ${job.prompt.slice(0,70)||"creative asset"}`,goal:`Produce the requested ${job.kind} and keep ownership until the generated file is available.`,source:"creative_engine",source_ref:job.id,status:"waiting",next_action:"Render the creative asset.",waiting_on:"creative engine",completion_signal:"Generated media file is saved and available.",risk:"low",notes:"Local/free creative route"});job=updateMediaJob(job.id,{outcome_id:loop.id})}if(job.status==="done")upsertOpenLoop({...loop,status:"done",next_action:"",waiting_on:"",completion_signal:`Generated ${job.kind} is available.`,notes:`Completed with ${job.provider||"creative engine"} / ${job.model||"model"}.`,completed_at:new Date().toISOString()});else if(["error","interrupted"].includes(job.status))upsertOpenLoop({...loop,status:"blocked",next_action:"Retry the creative generation.",waiting_on:"creative engine",notes:`${job.status}: ${job.error||"Generation did not complete."}`});else upsertOpenLoop({...loop,status:"waiting",next_action:"Wait for rendering to finish.",waiting_on:job.provider||"creative engine"});return job}
const activeMediaJobs=new Set();
async function generateImageForJob(job){if(localSdConfigured())return generateImageLocalSd({prompt:job.prompt,imageSize:job.image_size,references:[]});if(wan2gpConfigured())return generateImageWan2gp({prompt:job.prompt,imageSize:job.image_size,references:[],onEventId:id=>updateMediaJob(job.id,{event_id:id,provider:"Wan2GP"})});if(SELF_HOST_MEDIA_BASE_URL)return generateImageSelfHost({prompt:job.prompt,imageSize:job.image_size,numImages:1,references:[]});throw new Error("No local/free image provider is configured. Configure local sd.cpp, Wan2GP, or SELF_HOST_MEDIA_BASE_URL.")}
async function generateVideoForJob(job){if(wan2gpConfigured())return generateVideoWan2gp({prompt:job.prompt,duration:job.duration,referenceImage:job.reference_image,onEventId:id=>updateMediaJob(job.id,{event_id:id,provider:"Wan2GP"})});if(SELF_HOST_MEDIA_BASE_URL)return generateVideoSelfHost({prompt:job.prompt,duration:job.duration,referenceImage:job.reference_image});throw new Error("No local/free video provider is configured. Configure Wan2GP or SELF_HOST_MEDIA_BASE_URL.")}
async function runMediaJob(id){if(activeMediaJobs.has(id))return;const current=loadMediaJobs().find(x=>x.id===id);if(!current||["done","cancelled"].includes(current.status))return;activeMediaJobs.add(id);let job=updateMediaJob(id,{status:"running",progress:.05,error:null,attempts:Number(current.attempts||0)+1});syncMediaOutcome(job);try{const out=job.kind==="video"?await generateVideoForJob(job):await generateImageForJob(job);job=updateMediaJob(id,{status:"done",progress:1,provider:out.provider||job.provider,model:out.model||job.model,output:out,error:null,event_id:out.event_id||job.event_id,completed_at:new Date().toISOString()});syncMediaOutcome(job);await audit("media.job_completed",{id:job.id,kind:job.kind,provider:job.provider,model:job.model});await notify(`Creative ready: ${job.kind}`,job.prompt.slice(0,300),{media_job_id:job.id}).catch(()=>{})}catch(err){job=updateMediaJob(id,{status:"error",error:err.message||"Generation failed.",progress:0});syncMediaOutcome(job);await audit("media.job_failed",{id:job.id,kind:job.kind,error:job.error})}finally{activeMediaJobs.delete(id)}}
function createPersistentMediaJob(input={}){const prompt=String(input.prompt||"").trim();if(!prompt)throw new Error("Prompt is required.");let job=upsertMediaJob({...input,prompt,status:"queued",budget_mode:"free"});job=syncMediaOutcome(job);setTimeout(()=>runMediaJob(job.id).catch(()=>{}),25);return job}
function recoverMediaJobs(){const jobs=loadMediaJobs();let changed=false;for(let i=0;i<jobs.length;i++){if(jobs[i].status==="running"){jobs[i]=normalizeMediaJob({...jobs[i],status:"interrupted",error:"Kairoq restarted while this generation was running."});changed=true}else if(jobs[i].status==="queued")setTimeout(()=>runMediaJob(jobs[i].id).catch(()=>{}),250)}if(changed)saveMediaJobs(jobs);for(const j of jobs.filter(x=>x.status==="interrupted"))syncMediaOutcome(j)}
async function handleMediaJobsList(_req,res){return json(res,200,{jobs:loadMediaJobs().slice(0,100)})}
async function handleMediaJobCreate(req,res){try{const body=await getBody(req,12_000_000),job=createPersistentMediaJob({kind:body.kind,prompt:body.prompt,image_size:body.image_size||"square_hd",duration:body.duration||4,reference_image:body.reference_image||""});return json(res,200,{job})}catch(err){return json(res,400,{error:err.message})}}
async function handleMediaJobRetry(req,res){try{const body=await getBody(req,100_000),current=loadMediaJobs().find(x=>x.id===body.id);if(!current)return json(res,404,{error:"Media job not found."});const job=updateMediaJob(current.id,{status:"queued",error:null,progress:0,event_id:null,completed_at:null});syncMediaOutcome(job);setTimeout(()=>runMediaJob(job.id).catch(()=>{}),25);return json(res,200,{job})}catch(err){return json(res,400,{error:err.message})}}

async function handleMediaStatus(_req, res) {
  return json(res, 200, {
    image: {
      order: normalizeMediaProviderOrder(),
      providers: {
        localsd: { configured: localSdConfigured(), model: LOCAL_SDCPP_MODEL_NAME, model_type: LOCAL_SDCPP_MODEL_TYPE },
        wan2gp: { configured: wan2gpConfigured(), base_url: WAN2GP_BASE_URL || null, model: WAN2GP_IMAGE_MODEL },
        selfhost: { configured: !!SELF_HOST_MEDIA_BASE_URL, base_url: SELF_HOST_MEDIA_BASE_URL || null, model: QWEN_IMAGE_MODEL, edit_model: QWEN_IMAGE_EDIT_MODEL },
        higgsfield: { configured:higgsfieldConfigured(), model:HIGGSFIELD_IMAGE_MODEL },
        openrouter: { configured: !!process.env.OPENROUTER_API_KEY, model: OPENROUTER_IMAGE_MODEL, edit_model: OPENROUTER_IMAGE_EDIT_MODEL },
        pollinations: { configured: !!POLLINATIONS_API_KEY, model: POLLINATIONS_IMAGE_MODEL },
        fal: { configured: !!FAL_KEY, model: process.env.FAL_IMAGE_MODEL || IMAGE_MODEL }
      }
    },
    video: {
      providers: {
        wan2gp: { configured: wan2gpConfigured(), base_url: WAN2GP_BASE_URL || null, model: WAN2GP_VIDEO_MODEL, image_to_video_model: WAN2GP_IMAGE_TO_VIDEO_MODEL },
        selfhost: { configured: !!SELF_HOST_MEDIA_BASE_URL, base_url: SELF_HOST_MEDIA_BASE_URL || null, model: WAN_VIDEO_MODEL, image_to_video_model: WAN_IMAGE_TO_VIDEO_MODEL },
        higgsfield: { configured:higgsfieldConfigured(), model:HIGGSFIELD_VIDEO_MODEL, image_to_video_model:HIGGSFIELD_IMAGE_TO_VIDEO_MODEL },
        pollinations: { configured: !!POLLINATIONS_API_KEY, model: POLLINATIONS_VIDEO_MODEL }
      }
    }
  });
}


async function handleModels(_req, res) {
  try {
    const models = await getModels();
    return json(res, 200, { models });
  } catch (err) {
    return json(res, 500, { error: err.message || "Could not load models." });
  }
}

async function handleUsage(_req,res){
  if(ZERO_COST_MODE){
    const localModels=await getLocalLlmModels();
    return json(res,200,{
      zero_cost:true,
      local:{configured:localModels.length>0,models:localModels},
      openrouter_free_fallback:Boolean(openRouterConfigured()&&OPENROUTER_FREE_FALLBACK_ENABLED),
      paid_llm_enabled:PAID_LLM_ENABLED,
      paid_web_search_enabled:OPENROUTER_WEB_SEARCH_ENABLED,
      data:{usage:0,limit:0}
    });
  }
  try{
    if(!openRouterConfigured())return json(res,200,{data:{usage:0,limit:0},openrouter:false});
    const response=await fetch(OR_KEY,{headers:openRouterHeaders()});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return json(res,response.status,{error:data?.error?.message||"Could not load key usage."});
    return json(res,200,data);
  }catch(err){return json(res,500,{error:err.message||"Could not load usage."})}
}
async function handleLlmStatus(_req,res){
  const localModels=await getLocalLlmModels();
  return json(res,200,{
    zero_cost_mode:ZERO_COST_MODE,
    paid_llm_enabled:PAID_LLM_ENABLED,
    local:{
      reachable:localModels.length>0,
      base_url:LOCAL_LLM_BASE_URL,
      selected_model:LOCAL_LLM_MODEL||localModels[0]||null,
      tool_model:LOCAL_LLM_TOOL_MODEL||LOCAL_LLM_MODEL||localModels[0]||null,
      models:localModels
    },
    openrouter:{
      configured:openRouterConfigured(),
      free_fallback:OPENROUTER_FREE_FALLBACK_ENABLED,
      paid_web_search_enabled:OPENROUTER_WEB_SEARCH_ENABLED
    }
  });
}

function serveStatic(req, res) {
  const pathname = (req.url || "/").split("?")[0];
  const urlPath = pathname === "/" ? "/index.html" : pathname;
  let decoded;
  try { decoded = decodeURIComponent(urlPath); }
  catch { res.writeHead(400); return res.end("Bad request"); }

  const relative = path.normalize(decoded).replace(/^([/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, relative);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".pdf": "application/pdf",
      ".csv": "text/csv; charset=utf-8",
      ".ico": "image/x-icon"
    };
    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";

  if (req.method === "GET" && url === "/health") {
    return json(res, 200, { ok: true, service: SITE_NAME });
  }

  if (req.method === "POST" && url === "/api/channels/telegram/webhook") return handleTelegramWebhook(req,res);
  if (req.method === "POST" && url === "/api/channels/twilio/inbound") return handleTwilioInbound(req,res);

  if (req.method === "GET" && url === "/api/session") {
    return json(res, 200, { authenticated: isAuthenticated(req), authRequired: authEnabled() });
  }
  if (req.method === "GET" && url.startsWith("/api/google/callback")) {
    return handleGoogleCallback(req, res);
  }

  if (req.method === "GET" && url === "/api/google/connect") {
    if (!isAuthenticated(req)) return json(res, 401, { error: "Authentication required." });
    return handleGoogleConnect(req, res);
  }
  if (req.method === "GET" && url.startsWith("/api/microsoft/callback")) {
    return handleMicrosoftCallback(req, res);
  }
  if (req.method === "GET" && url === "/api/microsoft/connect") {
    if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."});
    return handleMicrosoftConnect(req,res);
  }

  if (req.method === "GET" && url === "/api/connectors/status") {
    if (!isAuthenticated(req)) return json(res, 401, { error: "Authentication required." });
    return handleConnectorStatus(req, res);
  }


  if(req.method==="GET"&&url==="/api/permissions"){if(!isAuthenticated(req))return json(res,401,{error:"Authentication required."});return handlePermissionsGet(req,res)}
  if(req.method==="POST"&&url==="/api/permissions"){if(!isAuthenticated(req))return json(res,401,{error:"Authentication required."});return handlePermissionsSave(req,res)}
  if(req.method==="GET"&&url==="/api/audit"){if(!isAuthenticated(req))return json(res,401,{error:"Authentication required."});return handleAuditList(req,res)}
  if(req.method==="GET"&&url==="/api/budget/status"){if(!isAuthenticated(req))return json(res,401,{error:"Authentication required."});return handleBudgetStatus(req,res)}
  if(req.method==="GET"&&url==="/api/dead-letters"){if(!isAuthenticated(req))return json(res,401,{error:"Authentication required."});return handleDeadLetters(req,res)}

  if (req.method === "GET" && url === "/api/jobs") {
    if (!isAuthenticated(req)) return json(res, 401, { error: "Authentication required." });
    return handleJobsList(req, res);
  }
  if (req.method === "POST" && url === "/api/jobs/create") {
    if (!isAuthenticated(req)) return json(res, 401, { error: "Authentication required." });
    return handleJobsCreate(req, res);
  }
  if (req.method === "POST" && url === "/api/jobs/update") {
    if (!isAuthenticated(req)) return json(res, 401, { error: "Authentication required." });
    return handleJobsUpdate(req, res);
  }
  if (req.method === "POST" && url === "/api/jobs/delete") {
    if (!isAuthenticated(req)) return json(res, 401, { error: "Authentication required." });
    return handleJobsDelete(req, res);
  }
  if (req.method === "POST" && url === "/api/jobs/run-now") {
    if (!isAuthenticated(req)) return json(res, 401, { error: "Authentication required." });
    return handleJobsRunNow(req, res);
  }
  if (req.method === "GET" && url.startsWith("/api/jobs/history")) {
    if (!isAuthenticated(req)) return json(res, 401, { error: "Authentication required." });
    return handleJobsHistory(req, res);
  }


  if (req.method === "POST" && url === "/api/login") {
    try { return await handleLogin(req, res); }
    catch (err) { return json(res, 500, { error: err.message }); }
  }

  if (url.startsWith("/api/") && !isAuthenticated(req)) {
    return json(res, 401, { error: "Authentication required." });
  }

  if (req.method === "GET" && url === "/api/models") return handleModels(req, res);
  if (req.method === "GET" && url === "/api/usage") return handleUsage(req, res);
  if (req.method === "GET" && url === "/api/llm/status") return handleLlmStatus(req,res);
  if (req.method === "GET" && url === "/api/cloud/status") return handleCloudStatus(req, res);
  if (req.method === "GET" && url === "/api/cloud/load") return handleCloudLoad(req, res);
  if (req.method === "POST" && url === "/api/cloud/save") return handleCloudSave(req, res);
  if (req.method === "POST" && url === "/api/memory/extract") return handleMemoryExtract(req, res);
  if (req.method === "GET" && url.startsWith("/api/loops")) return handleOpenLoopsList(req, res);
  if (req.method === "POST" && url === "/api/loops/create") return handleOpenLoopCreate(req, res);
  if (req.method === "POST" && url === "/api/loops/update") return handleOpenLoopUpdate(req, res);
  if (req.method === "POST" && url === "/api/loops/extract") return handleOpenLoopsExtract(req, res);
  if (req.method === "GET" && url.startsWith("/api/commerce/funnel-health")) {
    try {
      const parsed=new URL(req.url, `http://localhost:${PORT}`);
      const days=Math.max(1,Math.min(365,Number(parsed.searchParams.get("days")||30)));
      return json(res,200,await commerceFunnelHealth({days}));
    } catch(err) {
      return json(res,500,{error:err.message||"Commerce funnel health failed."});
    }
  }
  if (req.method === "GET" && url.startsWith("/api/shopify/store-health")) {
    if(!shopifyConfigured()) return json(res, 200, { configured:false });
    try {
      const parsed=new URL(req.url, `http://localhost:${PORT}`);
      const days=Math.max(1,Math.min(365,Number(parsed.searchParams.get("days")||30)));
      const health=await shopifyStoreHealth({days});
      return json(res,200,{configured:true,...health});
    } catch(err) {
      return json(res,500,{configured:true,error:err.message||"Store health failed."});
    }
  }
  if (req.method === "GET" && url.startsWith("/api/store-experiments")) {
    const items=loadStoreExperiments();
    return json(res,200,{experiments:items});
  }
  if (req.method === "POST" && url === "/api/agent/run") return handleAgentRun(req, res);
  if (req.method === "POST" && url === "/api/agent/approve") return handleAgentApproval(req, res);
  if (req.method === "POST" && url === "/api/images/generate") {
    if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."});
    return handleImageGenerate(req, res);
  }
  if (req.method === "POST" && url === "/api/videos/generate") {
    if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."});
    return handleVideoGenerate(req, res);
  }
  if (req.method === "GET" && url === "/api/arrivalbrief") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleArrivalBriefList(req,res); }
  if (req.method === "POST" && url === "/api/arrivalbrief/save") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleArrivalBriefSave(req,res); }
  if (req.method === "POST" && url === "/api/arrivalbrief/generate") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleArrivalBriefGenerate(req,res); }
  if (req.method === "POST" && url === "/api/arrivalbrief/welcome-video") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleArrivalBriefWelcomeVideo(req,res); }
  if (req.method === "POST" && url === "/api/arrivalbrief/ack") return handleArrivalBriefAck(req,res);
  if (req.method === "GET" && url === "/api/pursuit") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handlePursuitList(req,res); }
  if (req.method === "POST" && url === "/api/pursuit/discover") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handlePursuitDiscover(req,res); }
  if (req.method === "POST" && url === "/api/pursuit/save") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handlePursuitSave(req,res); }
  if (req.method === "POST" && url === "/api/pursuit/brief") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handlePursuitBrief(req,res); }
  if (req.method === "POST" && url === "/api/pursuit/status") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handlePursuitStatus(req,res); }
  if (req.method === "GET" && url === "/api/listings") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleListingsList(req,res); }
  if (req.method === "POST" && url === "/api/listings/save") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleListingSave(req,res); }
  if (req.method === "POST" && url === "/api/listings/import-url") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleListingImportUrl(req,res); }
  if (req.method === "POST" && url === "/api/listings/generate-pack") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleListingGeneratePack(req,res); }
  if (req.method === "POST" && url === "/api/listings/make-sales-ready") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleListingMakeSalesReady(req,res); }
  if (req.method === "POST" && url === "/api/listings/property-video") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleListingPropertyVideo(req,res); }
  if (req.method === "POST" && url === "/api/listings/client-proposal") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleListingClientProposal(req,res); }
  if (req.method === "GET" && url === "/api/studio/status") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioStatus(req,res); }
  if (req.method === "GET" && url === "/api/studio/avatars") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioAvatarsList(req,res); }
  if (req.method === "POST" && url === "/api/studio/avatars") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioAvatarsUpsert(req,res); }
  if (req.method === "GET" && url === "/api/studio/projects") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioProjectsList(req,res); }
  if (req.method === "POST" && url === "/api/studio/projects") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioProjectsUpsert(req,res); }
  if (req.method === "GET" && url === "/api/studio/library") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioLibraryList(req,res); }
  if (req.method === "POST" && url === "/api/studio/library") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioLibraryUpsert(req,res); }
  if (req.method === "GET" && url === "/api/studio/history") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioHistoryList(req,res); }
  if (req.method === "POST" && url === "/api/studio/estimate") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioEstimate(req,res); }
  if (req.method === "POST" && url === "/api/studio/generate") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleStudioGenerate(req,res); }
  if (req.method === "GET" && url === "/api/media/status") {
    if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."});
    return handleMediaStatus(req, res);
  }
  if (req.method === "GET" && url === "/api/work-products") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleWorkProductsList(req,res); }
  if (req.method === "GET" && url === "/api/media/jobs") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleMediaJobsList(req,res); }
  if (req.method === "POST" && url === "/api/media/jobs/create") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleMediaJobCreate(req,res); }
  if (req.method === "POST" && url === "/api/media/jobs/retry") { if (!isAuthenticated(req)) return json(res,401,{error:"Authentication required."}); return handleMediaJobRetry(req,res); }
  if (req.method === "POST" && url === "/api/chat/stream") return handleChat(req, res);
  if (req.method === "GET") return serveStatic(req, res);

  res.writeHead(405);
  res.end("Method not allowed");
});

server.on("error", err => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try: PORT=${PORT + 1} node server.js`);
    process.exit(1);
  }
  throw err;
});

if (process.env.NODE_ENV !== "test") {
  recoverMediaJobs();
  setTimeout(() => schedulerTick().catch(()=>{}), 5_000);
  setInterval(() => schedulerTick().catch(()=>{}), 60_000);
  server.listen(PORT, () => {
    console.log(`${SITE_NAME} running at http://localhost:${PORT}`);
    console.log(`Free Only defaults to ON.`);
    console.log(authEnabled() ? "Password protection: ON" : "Password protection: OFF (set APP_PASSWORD for deployment)");
    if (!APP_ENCRYPTION_KEY) console.warn("Warning: APP_ENCRYPTION_KEY is not set; persisted connector credentials are not encrypted at rest.");
  });
}

module.exports = {
  encryptJson, decryptJson, sanitizeAuditData, nextRunAt, safeWorkspacePath,
  DEFAULT_TOOL_PERMISSIONS, toolNeedsApproval, cleanModel, agentPersona, normalizeMediaProviderOrder, imageAspectRatio, pollinationsImageSize, generateImageSelfHost, generateVideoSelfHost, normalizeOpenLoop, openLoopPriorityScore, normalizeShopifyStorePlan, renderStorePreview, calculateStoreHealth, normalizeStoreExperiment, calculateCommerceFunnel, mediaProviderOrderForBudget, normalizeMediaJob, localSdConfigured, wan2gpConfigured, createXlsxWorkProduct, createDocxWorkProduct, createPptxWorkProduct, createPdfWorkProduct, createCsvWorkProduct, listWorkProducts, microsoftScopes, microsoftConfigured, microsoftSharePointConfigured, getLocalLlmModels, resolveLocalLlmModel, callFreeLlmText, freeFallbacks, likelyConsequentialMessage, pursuitScore, normalizePursuit, extractCompanyFromHeadline, normalizeArrivalBrief, arrivalFacts, renderArrivalBriefHtml
};
