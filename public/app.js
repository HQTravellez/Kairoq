const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const AGENT_COLORS = {"atlas": {"color": "#F8FAFC", "accent": "#111827", "label": "Pearl"}, "scout": {"color": "#38BDF8", "accent": "#0369A1", "label": "Sky blue"}, "forge": {"color": "#6366F1", "accent": "#3730A3", "label": "Indigo"}, "relay": {"color": "#06B6D4", "accent": "#0E7490", "label": "Cyan"}, "orbit": {"color": "#A78BFA", "accent": "#6D28D9", "label": "Lavender"}, "compass": {"color": "#FB923C", "accent": "#C2410C", "label": "Orange"}, "ledger": {"color": "#10B981", "accent": "#047857", "label": "Emerald"}, "beacon": {"color": "#FACC15", "accent": "#A16207", "label": "Yellow"}, "vault": {"color": "#8B5CF6", "accent": "#5B21B6", "label": "Purple"}, "rover": {"color": "#2563EB", "accent": "#1D4ED8", "label": "Electric blue"}, "writer": {"color": "#F472B6", "accent": "#BE185D", "label": "Pink"}, "closer": {"color": "#22C55E", "accent": "#15803D", "label": "Green"}, "guardian": {"color": "#1E40AF", "accent": "#1E3A8A", "label": "Deep blue"}};
const AGENT_TEAM = {"atlas": {"glyph": "◆", "name": "Kairoq", "role": "Outcome Operator", "description": "Owns outcomes, coordinates specialists, and stays on unfinished work until it is done."}, "scout": {"glyph": "◉", "name": "Scout", "role": "Research & Intelligence", "description": "Researches the web, competitors, markets, and evidence."}, "forge": {"glyph": "⬢", "name": "Forge", "role": "Engineering", "description": "Codes, debugs, reviews GitHub, and designs implementations."}, "relay": {"glyph": "⇄", "name": "Relay", "role": "Communications", "description": "Handles Gmail, Slack, replies, follow-ups, and messaging."}, "orbit": {"glyph": "◎", "name": "Orbit", "role": "Calendar & Scheduling", "description": "Checks calendars, plans meetings, and coordinates time."}, "compass": {"glyph": "◇", "name": "Compass", "role": "Travel Operations", "description": "Handles travel research, Nuitee, itineraries, and trip logic."}, "ledger": {"glyph": "▣", "name": "Ledger", "role": "Finance & Spend", "description": "Analyzes costs, budgets, invoices, margins, and spend."}, "beacon": {"glyph": "✦", "name": "Beacon", "role": "Monitoring & Bots", "description": "Monitors recurring work, alerts, scheduled jobs, and changes."}, "vault": {"glyph": "⬡", "name": "Vault", "role": "Memory & Knowledge", "description": "Maintains project context, company playbooks, and knowledge."}, "rover": {"glyph": "△", "name": "Rover", "role": "Browser Operator", "description": "Uses browser tools to inspect and operate web workflows."}, "writer": {"glyph": "✎", "name": "Writer", "role": "Writing & Documents", "description": "Drafts, rewrites, structures, and polishes content."}, "closer": {"glyph": "➤", "name": "Closer", "role": "Sales & Follow-up", "description": "Works leads, outreach, follow-ups, and conversion tasks."}, "guardian": {"glyph": "◈", "name": "Guardian", "role": "Security & Governance", "description": "Reviews permissions, approvals, risk, and audit activity."}};


const messagesEl = $("#messages");
const promptEl = $("#prompt");
const sendBtn = $("#sendBtn");
const stopBtn = $("#stopBtn");
const modelSelect = $("#modelSelect");
const effortSelect = $("#effortSelect");
const purposeSelect = $("#purposeSelect");
const freeOnlyEl = $("#freeOnly");
const smartFallbackEl = $("#smartFallback");
const webSearchEl = $("#webSearch");
const freePill = $("#freePill");
const statusBar = $("#statusBar");
const modelBadge = $("#modelBadge");
const historyList = $("#historyList");
const attachmentTray = $("#attachmentTray");

let allModels = [];
let busy = false;
let abortController = null;
let attachments = [];
let currentModelFilter = "all";

let chats = JSON.parse(localStorage.getItem("or-final-chats") || "[]");
let currentChatId = localStorage.getItem("or-final-current") || null;
let settings = JSON.parse(localStorage.getItem("or-final-settings") || '{"systemPrompt":"","temperature":0.7,"responsePace":"natural"}');
let routing = JSON.parse(localStorage.getItem("or-final-routing") || '{"freeOnly":true,"smartFallback":true,"webSearch":false}');
let ui = JSON.parse(localStorage.getItem("or-final-ui") || '{"effort":"low","purpose":"general","preset":"quick","lastModel":"local/auto"}');
let favorites = JSON.parse(localStorage.getItem("or-final-favorites") || "[]");
let memoryStore = JSON.parse(localStorage.getItem("or-memory-store") || '{"global":[],"projects":{"General":[]},"settings":{"autoMemory":true,"autoSummarize":true}}');
let workspaceMemory = (memoryStore.global || []).join("\n");
let currentProject = localStorage.getItem("or-current-project") || "General";
let customPresets = JSON.parse(localStorage.getItem("or-perfect-custom-presets") || "[]");
let activeCustomPreset = null;
let cloudMemoryConfigured = false;
let selectedAgentType = "atlas";
let currentApproval = null;
let imageMode = false;
let videoMode = false;
let mainView = localStorage.getItem("pai-main-view") || "chat";
let simpleMode = JSON.parse(localStorage.getItem("pai-simple-mode") || "true");
let spendMode = localStorage.getItem("pai-spend-mode") || "cheap";

let streamIsActive = false;
let userPausedAutoScroll = false;

const RESPONSE_PACE = {
  relaxed: { cps: 60, interval: 38 },
  natural: { cps: 105, interval: 34 },
  fast:    { cps: 300, interval: 24 },
  instant: { cps: Infinity, interval: 0 }
};

function currentResponsePace(){
  const pace=String(settings.responsePace||"natural");
  return RESPONSE_PACE[pace] ? pace : "natural";
}

function isMessagesNearBottom(threshold=120){
  if(!messagesEl)return true;
  return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < threshold;
}

function updateLatestButton(){
  const btn=$("#jumpLatestBtn");
  if(!btn)return;
  btn.classList.toggle("hidden", !streamIsActive || !userPausedAutoScroll);
}

function setAutoFollow(enabled){
  userPausedAutoScroll=!enabled;
  autoScrollEnabled=enabled;
  updateLatestButton();
}

function followLatest(force=false){
  if(!messagesEl)return;
  if(force || (!userPausedAutoScroll && isMessagesNearBottom(220))){
    messagesEl.scrollTop=messagesEl.scrollHeight;
    autoScrollEnabled=true;
    userPausedAutoScroll=false;
  }
  updateLatestButton();
}

function createSmoothTextRenderer(renderFn){
  let pending="";
  let visible="";
  let timer=null;
  let doneRequested=false;
  let finishResolve=null;

  const finishIfReady=()=>{
    if(doneRequested && !pending.length && timer===null && finishResolve){
      const resolve=finishResolve;
      finishResolve=null;
      resolve(visible);
    }
  };

  const tick=()=>{
    timer=null;
    const pace=currentResponsePace();

    if(pace==="instant"){
      if(pending){
        visible+=pending;
        pending="";
        renderFn(visible);
      }
      finishIfReady();
      return;
    }

    if(pending){
      const cfg=RESPONSE_PACE[pace];
      let cps=cfg.cps;

      // Very long answers gently catch up instead of making the reader wait forever.
      if(pending.length>3500)cps*=4;
      else if(pending.length>1600)cps*=2.5;
      else if(pending.length>700)cps*=1.65;

      let take=Math.max(1,Math.round(cps*cfg.interval/1000));
      let end=Math.min(pending.length,take);

      // Avoid a jittery letter-by-letter look when a nearby word boundary exists.
      if(end<pending.length && end<32){
        const probe=pending.slice(0,Math.min(pending.length,end+10));
        const boundary=probe.search(/[\s,.;:!?)]/);
        if(boundary>=Math.max(1,end-2))end=boundary+1;
      }

      visible+=pending.slice(0,end);
      pending=pending.slice(end);
      renderFn(visible);
    }

    if(pending.length){
      schedule();
    }else{
      finishIfReady();
    }
  };

  const schedule=()=>{
    if(timer!==null)return;
    const pace=currentResponsePace();
    if(pace==="instant"){
      tick();
      return;
    }
    timer=setTimeout(tick,RESPONSE_PACE[pace].interval);
  };

  return {
    push(text){
      pending+=String(text||"");
      schedule();
    },
    finish(){
      doneRequested=true;
      if(!pending.length && timer===null)return Promise.resolve(visible);
      return new Promise(resolve=>{
        finishResolve=resolve;
        schedule();
      });
    },
    flush(){
      if(timer!==null){
        clearTimeout(timer);
        timer=null;
      }
      if(pending){
        visible+=pending;
        pending="";
        renderFn(visible);
      }
      doneRequested=true;
      if(finishResolve){
        const resolve=finishResolve;
        finishResolve=null;
        resolve(visible);
      }
      return visible;
    },
    get visible(){return visible}
  };
}


const PRESETS = {
  quick:    { effort:"low", purpose:"general", web:false, model:"openrouter/free" },
  smart:    { effort:"medium", purpose:"general", web:false, model:"openrouter/free" },
  deep:     { effort:"high", purpose:"general", web:false, model:"openrouter/free" },
  coding:   { effort:"medium", purpose:"coding", web:false, model:null },
  research: { effort:"medium", purpose:"research", web:true, model:null },
  writing:  { effort:"medium", purpose:"writing", web:false, model:null },
  vision:   { effort:"medium", purpose:"vision", web:false, model:null }
};


function spendModeLabel(mode=spendMode){
  return ({free:"free first",cheap:"cheap first",balanced:"balanced",best:"best quality"})[mode] || "cheap first";
}

function updateSpendModeUI(){
  const el=$("#spendModeSelect");
  if(el) el.value=spendMode;
  const hint=$("#atlasBudgetHint");
  if(hint){
    hint.textContent = spendMode === "free"
      ? "Kairoq will prefer free/community or self-hosted routes before anything paid."
      : spendMode === "cheap"
        ? "Kairoq will prefer the cheapest route that can still finish the job well."
        : spendMode === "balanced"
          ? "Kairoq will balance quality, cost and speed automatically."
          : "Kairoq will prefer the strongest available route, even if it costs more.";
  }
}

function applyShellMode(){
  document.body.classList.toggle("simple-mode", !!simpleMode);
  document.body.classList.toggle("advanced-mode", !simpleMode);
  const btn=$("#shellModeBtn");
  if(btn){
    btn.textContent = simpleMode ? "Advanced" : "Simple";
    btn.classList.toggle("active", !simpleMode);
  }
}



function setMainView(view="command"){
  if(view==="command") document.body.classList.remove("history-focus");
  mainView = ["chat","command","studio"].includes(view) ? view : "command";
  localStorage.setItem("pai-main-view", mainView);
  $(".main").dataset.view = mainView;
  document.body.classList.remove("nav-open");
  $("#sidebarToggle")?.setAttribute("aria-expanded", "false");

  const command = $("#commandCenter");
  const messages = $("#messages");
  const studio = $("#studioView");
  command?.classList.toggle("hidden", mainView !== "command");
  messages?.classList.toggle("hidden", mainView !== "chat");
  studio?.classList.toggle("hidden", mainView !== "studio");

  $("#commandCenterBtn")?.classList.toggle("active", mainView === "command");
  $("#chatViewBtn")?.classList.toggle("active", mainView === "chat");
  $("#studioNavBtn")?.classList.toggle("active", mainView === "studio");
  $("#studioSideBtn")?.classList.toggle("active", mainView === "studio");

  if($("#mainViewTitle")) $("#mainViewTitle").textContent = mainView === "command" ? "Today" : mainView === "studio" ? "Studio" : (getChat()?.title || "Ask Kairoq");
  if($("#mainViewSubtitle")) $("#mainViewSubtitle").textContent = mainView === "command"
    ? "What needs to happen?"
    : mainView === "studio" ? "Create images, videos, avatars, and UGC from one place."
    : `${AGENT_TEAM[selectedAgentType]?.name || "Kairoq"} · ${currentProject}`;

  if(!imageMode && !videoMode && promptEl){
    promptEl.placeholder = mainView === "studio"
      ? "Studio is open above — or ask Kairoq anything here."
      : "How can I help you today?";
  }

  if(mainView === "command") refreshCommandCenter();
  else if(mainView === "studio") window.refreshStudio?.();
  else requestAnimationFrame(()=>followLatest(true));
}

function workflowNeedsAttention(card){
  const s=String(card?.status||"").toLowerCase();
  return /approval|attention|failed|blocked|error|review/.test(s);
}
function workflowIsActive(card){
  const s=String(card?.status||"open").toLowerCase();
  return !/complete|completed|done|closed|cancelled/.test(s);
}
function prettyRelativeTime(value){
  const t=Date.parse(value||"");
  if(!Number.isFinite(t))return "";
  const mins=Math.max(0,Math.floor((Date.now()-t)/60000));
  if(mins<1)return "just now";
  if(mins<60)return `${mins}m ago`;
  const hrs=Math.floor(mins/60);
  if(hrs<24)return `${hrs}h ago`;
  const days=Math.floor(hrs/24);
  return `${days}d ago`;
}
async function ccFetch(url){
  try{
    const res=await fetch(url);
    if(!res.ok)return null;
    return await res.json();
  }catch{return null}
}


function formatLoopMoney(value){
  const n=Number(value||0);
  if(!Number.isFinite(n)||n<=0)return "$0";
  return new Intl.NumberFormat(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
}
function loopDueLabel(loop){
  if(!loop?.due_at)return "";
  const t=Date.parse(loop.due_at);
  if(!Number.isFinite(t))return "";
  const diff=Math.ceil((t-Date.now())/86400000);
  if(diff<0)return `${Math.abs(diff)}d overdue`;
  if(diff===0)return "due today";
  if(diff===1)return "due tomorrow";
  return `due in ${diff}d`;
}
function loopStatusClass(status){
  return ["blocked","approval"].includes(status)?"urgent":status==="waiting"?"waiting":"";
}
async function loadOpenLoops(){
  return await ccFetch("/api/loops");
}
function renderOpenLoops(data){
  const host=$("#openLoopsList");
  if(!host)return;
  const loops=Array.isArray(data?.loops)?data.loops:[];
  if($("#loopCount"))$("#loopCount").textContent=String(data?.counts?.active??loops.length);
  if($("#loopOverdueCount"))$("#loopOverdueCount").textContent=String(data?.counts?.overdue??0);
  if($("#loopValue"))$("#loopValue").textContent=formatLoopMoney(data?.value_at_stake||0);

  host.innerHTML="";
  loops.slice(0,8).forEach(loop=>{
    const row=document.createElement("div");
    row.className=`open-loop-row ${loopStatusClass(loop.status)}`;
    const due=loopDueLabel(loop);
    row.innerHTML=`
      <div class="open-loop-main">
        <div class="open-loop-title-row">
          <strong>${escapeHTML(loop.title||"Outcome")}</strong>
          <span class="open-loop-status">${escapeHTML(loop.status||"open")}</span>
        </div>
        <small>${escapeHTML(loop.goal||loop.next_action||"")}</small>
        <div class="open-loop-meta">
          ${loop.waiting_on?`<span>Waiting on ${escapeHTML(loop.waiting_on)}</span>`:""}
          ${due?`<span>${escapeHTML(due)}</span>`:""}
          ${Number(loop.money_value||0)>0?`<span>${escapeHTML(formatLoopMoney(loop.money_value))} at stake</span>`:""}
          <span>${escapeHTML(loop.risk||"medium")} risk</span>
        </div>
      </div>
      <div class="open-loop-buttons">
        <button class="loop-finish">Own it</button>
        <button class="loop-done">✓</button>
      </div>`;
    row.querySelector(".loop-finish").onclick=()=>{
      selectedAgentType="atlas";
      updateAgentIdentityUI?.();
      setMainView("chat");
      promptEl.value=`Own this outcome until it is actually complete. Outcome: ${loop.title}. Goal: ${loop.goal}. Current next action: ${loop.next_action||"decide the best next action"}.`;
      resizePrompt();promptEl.focus();
    };
    row.querySelector(".loop-done").onclick=async()=>{
      const res=await fetch("/api/loops/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:loop.id,status:"done",notes:`Marked done by user at ${new Date().toISOString()}`})});
      if(res.ok)refreshOpenLoops();
    };
    host.appendChild(row);
  });

  if(!loops.length){
    host.innerHTML=`<div class="cc-clear-state compact"><span>✓</span><strong>Nothing unresolved</strong><small>Ask “What am I forgetting?” and Kairoq will look for unfinished business.</small></div>`;
  }
}
async function refreshOpenLoops(){
  const data=await loadOpenLoops();
  if(data)renderOpenLoops(data);
}


function moneyCompact(value){
  const n=Number(value||0);
  if(!Number.isFinite(n))return "—";
  return new Intl.NumberFormat(undefined,{style:"currency",currency:"USD",maximumFractionDigits:n>=1000?0:2}).format(n);
}
function renderStoreHealth(data){
  const empty=$("#storeHealthEmpty"),content=$("#storeHealthContent");
  if(!empty||!content)return;
  if(!data?.configured){
    empty.classList.remove("hidden");
    empty.textContent="Connect Shopify to see live store health.";
    content.classList.add("hidden");
    return;
  }
  if(data.error){
    empty.classList.remove("hidden");
    empty.textContent=`Store check failed: ${data.error}`;
    content.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");content.classList.remove("hidden");
  const m=data.metrics||{};
  $("#storeHealthScore").textContent=String(data.health_score??"—");
  $("#storeRevenue").textContent=moneyCompact(m.gross_order_value);
  $("#storeOrders").textContent=String(m.orders??0);
  $("#storeAov").textContent=moneyCompact(m.aov);
  $("#storeIssueCount").textContent=String((data.issues||[]).length);

  const host=$("#storeIssueList");
  host.innerHTML="";
  const issues=(data.issues||[]).slice(0,5);
  if(!issues.length){
    host.innerHTML=`<div class="cc-clear-state compact"><span>✓</span><strong>No obvious operational issues</strong><small>Kairoq can still audit the storefront and propose conversion tests.</small></div>`;
    return;
  }
  issues.forEach(x=>{
    const row=document.createElement("div");
    row.className=`store-issue ${x.severity||"low"}`;
    row.innerHTML=`<span>${x.severity==="high"?"!":x.severity==="medium"?"•":"·"}</span><div><strong>${escapeHTML((x.type||"issue").replaceAll("_"," "))}</strong><small>${escapeHTML(x.message||"")}</small></div>`;
    host.appendChild(row);
  });
}
async function refreshStoreHealth(){
  const data=await ccFetch("/api/shopify/store-health?days=30");
  if(data)renderStoreHealth(data);
}


function renderCommerceFunnel(data){
  if(!data)return;
  const m=data.metrics||{};
  if($("#growthAdSpend"))$("#growthAdSpend").textContent=moneyCompact(m.ad_spend);
  if($("#growthBlendedRoas"))$("#growthBlendedRoas").textContent=Number(m.ad_spend||0)>0?`${Number(m.blended_roas||0).toFixed(2)}×`:"—";
  if($("#growthAbandonedValue"))$("#growthAbandonedValue").textContent=moneyCompact(m.abandoned_checkout_value);
  if($("#growthAbandonedCount"))$("#growthAbandonedCount").textContent=String(m.unresolved_checkouts??0);
  const sources=[];
  if(data.configured?.shopify)sources.push("Shopify");
  if(data.configured?.meta_ads)sources.push("Meta Ads");
  if(data.configured?.google_ads)sources.push("Google Ads");
  const note=$("#growthSourceNote");
  if(note){
    if(data.errors?.length){
      note.textContent=`Using ${sources.join(" + ")||"available data"}. ${data.errors.length} source${data.errors.length===1?"":"s"} returned an error. Blended ROAS is directional, not attributed ROAS.`;
    }else if(Number(m.ad_spend||0)>0){
      note.textContent=`Using ${sources.join(" + ")}. Blended ROAS is directional: Shopify gross order value ÷ connected ad spend; channel attribution can overlap.`;
    }else{
      note.textContent=sources.length>1?`Using ${sources.join(" + ")}. No connected ad spend was returned for this window.`:"Connect Meta Ads or Google Ads to compare acquisition spend with Shopify outcomes.";
    }
  }
}
async function refreshCommerceFunnel(){
  const data=await ccFetch("/api/commerce/funnel-health?days=30");
  if(data)renderCommerceFunnel(data);
  return data;
}
function askAtlasStoreGrowth(){
  selectedAgentType="atlas";
  updateAgentIdentityUI?.();
  setMainView("chat");
  promptEl.value="Operate my Shopify store like an owner. First run commerce_funnel_health for the last 30 days so you can connect Shopify revenue and abandoned checkouts with any connected Meta/Google ad spend. Then run a Shopify store health analysis. If a public storefront URL is available in context, audit the storefront too. Identify the 3 highest-value problems or opportunities. For any claim about performance, distinguish evidence from hypothesis. Create internal experiments for the strongest test ideas, keep unresolved issues as outcomes, and do not modify the live storefront without asking me for approval.";
  resizePrompt();promptEl.focus();
}
async function scanCurrentChatForLoops(){
  const chat=getChat();
  const messages=(chat?.messages||[]).slice(-20).map(m=>({role:m.role,content:m.contentText||m.content||""}));
  if(!messages.length){
    setStatus("There is no current conversation to scan.",true);
    return;
  }
  setStatus("Kairoq is looking for unfinished outcomes…");
  const res=await fetch("/api/loops/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages,model:"openrouter/free"})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){setStatus(data.error||"Could not scan for outcomes.",true);return}
  await refreshOpenLoops();
  await refreshStoreHealth();
  await refreshCommerceFunnel();
  setStatus(data.loops?.length?`Found ${data.loops.length} outcome${data.loops.length===1?"":"s"}.`:"No strong unfinished outcomes found.");
}
async function addOpenLoopManually(){
  const title=window.prompt("What outcome is still unfinished?");
  if(!title)return;
  const goal=window.prompt("What must become true before this is finished?",title) || title;
  const res=await fetch("/api/loops/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,goal,source:"manual",status:"open",risk:"medium"})});
  if(res.ok)await refreshOpenLoops();
}
function connectedConnectorCount(data={}){
  let count=0;
  if(data.google?.connected) count++;
  if(data.microsoft?.connected) count++;
  ["github","nuitee","slack","shopify","meta_ads","google_ads","browserless","notifications","webhook","telegram","twilio","local_ai"].forEach(k=>{
    if(data[k]?.configured)count++;
  });
  return count;
}
function commandCenterAgentIds(){
  const mode=currentVerticalMode?.() || "personal";
  const modeAgents={
    personal:["atlas","relay","scout","orbit","beacon","vault"],
    travel:["atlas","compass","relay","orbit","ledger","beacon"],
    housing:["atlas","ledger","relay","scout","closer","beacon"],
    shopify:["atlas","closer","writer","scout","ledger","beacon"],
    sales:["atlas","closer","relay","writer","scout","orbit"],
    software:["atlas","forge","guardian","scout","beacon","vault"]
  };
  return modeAgents[mode] || modeAgents.personal;
}
function renderAtlasCapabilities(connectorData={}){
  const host=$("#atlasCapabilityList");
  if(!host) return;
  const items=[];
  const push=(label, state, good=false)=>items.push({label,state,good});
  push("Chat", "always on", true);
  push("Memory", memoryStore?.settings ? "ready" : "local only", true);
  push("Images", "internal generation", true);
  push("Video", "internal generation", true);
  if(connectorData.local_ai?.zero_cost_mode) push("AI", connectorData.local_ai?.configured ? "local-first · $0 API" : "free cloud fallback", true);
  if(connectorData.google?.connected) push("Google", "connected", true); else push("Google", "not connected");
  if(connectorData.microsoft?.connected) push("Microsoft 365", `connected${connectorData.microsoft?.teams_enabled?" · Teams":""}${connectorData.microsoft?.sharepoint_enabled?" · SharePoint":""}`, true);
  if(connectorData.github?.configured) push("GitHub", "configured", true);
  if(connectorData.shopify?.configured) push("Shopify", "configured", true);
  if(connectorData.meta_ads?.configured) push("Meta Ads", "reporting connected", true);
  if(connectorData.google_ads?.connected) push("Google Ads", "reporting connected", true);
  if(connectorData.slack?.configured) push("Slack", "configured", true);
  if(connectorData.nuitee?.configured) push("Travel inventory", "configured", true);
  if(connectorData.browserless?.configured) push("Web Operator", "search · inspect · act with approval", true);
  if(connectorData.notifications?.configured) push("Notifications", "configured", true);
  if(connectorData.telegram?.configured) push("Telegram", "message Kairoq", true);
  if(connectorData.twilio?.whatsapp) push("WhatsApp", "message Kairoq", true);
  if(connectorData.twilio?.sms) push("SMS", "message Kairoq", true);
  if(connectorData.higgsfield?.configured) push("Higgsfield", "media ready", true);

  host.innerHTML = items.map(item=>`<div class="atlas-capability ${item.good?"good":""}"><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.state)}</small></div>`).join("");
}

function renderCommandCenterAgents(){
  const host=$("#ccAgentGrid");
  if(!host)return;
  host.innerHTML="";
  commandCenterAgentIds().forEach(id=>{
    const meta=AGENT_TEAM[id]||AGENT_TEAM.atlas;
    const colors=AGENT_COLORS[id]||AGENT_COLORS.atlas;
    const btn=document.createElement("button");
    btn.className="cc-agent";
    btn.style.setProperty("--cc-agent-color",colors.color);
    btn.innerHTML=`
      <span class="cc-agent-glyph">${meta.glyph}</span>
      <span class="cc-agent-copy"><strong>${escapeHTML(meta.name)}</strong><small>${escapeHTML(meta.role)}</small></span>
      <span class="cc-agent-status">Ready</span>`;
    btn.onclick=()=>{
      selectedAgentType=id;
      updateAgentIdentityUI?.();
      $("#agentDialog")?.showModal();
    };
    host.appendChild(btn);
  });
}
function renderCcPriority(cards=[], failures=[]){
  const host=$("#ccPriorityList");
  if(!host)return;
  const priority=cards.filter(workflowNeedsAttention);
  const active=cards.filter(c=>workflowIsActive(c) && !workflowNeedsAttention(c));
  const items=[...priority,...active].slice(0,6);
  host.innerHTML="";

  if(failures.length){
    const f=failures[0];
    const row=document.createElement("button");
    row.className="cc-priority-row urgent";
    row.innerHTML=`
      <span class="cc-priority-dot"></span>
      <span class="cc-priority-main"><strong>Automation needs attention</strong><small>${escapeHTML(f.job_name||f.job_id||"Scheduled bot")} · ${escapeHTML(f.error||"run failed")}</small></span>
      <span class="cc-priority-status">Failed</span>`;
    row.onclick=()=>{$("#opsBtn")?.click()};
    host.appendChild(row);
  }

  items.forEach(card=>{
    const meta=AGENT_TEAM[card.agent]||AGENT_TEAM.atlas;
    const row=document.createElement("button");
    const needs=workflowNeedsAttention(card);
    row.className=`cc-priority-row${needs?" urgent":""}`;
    row.innerHTML=`
      <span class="cc-priority-dot"></span>
      <span class="cc-priority-main">
        <strong>${escapeHTML(card.title||"Workflow")}</strong>
        <small>${meta.glyph} ${escapeHTML(meta.name)} · ${escapeHTML(card.body||"")}</small>
      </span>
      <span class="cc-priority-status">${escapeHTML(card.status||"open")}</span>`;
    row.onclick=()=>{$("#workflowsBtn")?.click()};
    host.appendChild(row);
  });

  if(!host.children.length){
    host.innerHTML=`<div class="cc-clear-state"><span>✓</span><strong>You're caught up</strong><small>No workflows currently need your attention.</small></div>`;
  }
}
function renderCcActivity(cards=[]){
  const host=$("#ccRecentActivity");
  if(!host)return;
  host.innerHTML="";
  cards.slice(0,6).forEach(card=>{
    const meta=AGENT_TEAM[card.agent]||AGENT_TEAM.atlas;
    const row=document.createElement("div");
    row.className="cc-activity-row";
    row.innerHTML=`
      <span class="cc-activity-glyph">${meta.glyph}</span>
      <span class="cc-activity-copy">
        <strong>${escapeHTML(card.title||"Workflow update")}</strong>
        <small>${escapeHTML(meta.name)} · ${escapeHTML(card.status||"open")} · ${escapeHTML(prettyRelativeTime(card.created_at))}</small>
      </span>`;
    host.appendChild(row);
  });
  if(!cards.length){
    host.innerHTML=`<div class="cc-clear-state compact"><span>✦</span><strong>No activity yet</strong><small>Run an agent or create a scheduled bot to start building your activity feed.</small></div>`;
  }
}
function renderAtlasChannels(data={}){
  const host=$("#atlasChannelStatus"); if(!host)return;
  const channels=[
    {name:"Telegram",ready:!!data.telegram?.configured,detail:data.telegram?.configured?"Ready — Bot API":"Add TELEGRAM_BOT_TOKEN"},
    {name:"WhatsApp",ready:!!data.twilio?.whatsapp,detail:data.twilio?.whatsapp?"Ready via Twilio":"Add Twilio WhatsApp sender"},
    {name:"SMS",ready:!!data.twilio?.sms,detail:data.twilio?.sms?"Ready via Twilio":"Add Twilio SMS sender"}
  ];
  host.innerHTML=channels.map(c=>`<div class="atlas-channel ${c.ready?"ready":""}"><span>${c.ready?"✓":"○"}</span><div><strong>${c.name}</strong><small>${c.detail}</small></div></div>`).join("");
}


function formatBytes(n){
  const x=Number(n||0);
  if(x<1024)return `${x} B`;
  if(x<1024*1024)return `${(x/1024).toFixed(1)} KB`;
  return `${(x/1024/1024).toFixed(1)} MB`;
}
function workKindLabel(kind){
  return ({xlsx:"Excel",docx:"Word",pptx:"PowerPoint",pdf:"PDF",csv:"CSV"})[kind]||String(kind||"File").toUpperCase();
}
function renderWorkProducts(items=[]){
  const host=$("#workProductsList");
  if(!host)return;
  if(!items.length){host.innerHTML='<div class="cc-empty">No work files yet.</div>';return}
  host.innerHTML=items.slice(0,8).map(x=>`
    <a class="work-product-row" href="${escapeHTML(x.url||"#")}" download="${escapeHTML(x.filename||"")}" target="_blank" rel="noopener">
      <span class="work-product-icon">${escapeHTML(String(x.kind||"file").toUpperCase())}</span>
      <span class="work-product-main"><strong>${escapeHTML(x.title||x.filename||"Work file")}</strong><small>${escapeHTML(x.filename||"")} · ${formatBytes(x.size)}</small></span>
      <span class="work-product-open">Open ↓</span>
    </a>
  `).join("");
}
async function refreshWorkProducts(){
  try{
    const r=await fetch("/api/work-products");
    if(!r.ok)return;
    const data=await r.json();
    renderWorkProducts(data.work_products||[]);
  }catch{}
}

async function refreshCommandCenter(){
  refreshWorkProducts();
  if(!$("#commandCenter"))return;
  renderCommandCenterAgents();

  const [state, jobsData, connectorData, failuresData] = await Promise.all([
    loadProductState().catch(()=>localProductState()),
    ccFetch("/api/jobs"),
    ccFetch("/api/connectors/status"),
    ccFetch("/api/dead-letters")
  ]);

  const cards=Array.isArray(state?.workflow_cards) ? state.workflow_cards : [];
  const jobs=Array.isArray(jobsData?.jobs) ? jobsData.jobs : [];
  const failures=Array.isArray(failuresData?.failures) ? failuresData.failures : [];

  const attention=cards.filter(workflowNeedsAttention).length + failures.length;
  const active=cards.filter(workflowIsActive).length;
  const botCount=jobs.filter(j=>j.enabled!==false).length;
  const connectorCount=connectedConnectorCount(connectorData||{});
  renderAtlasCapabilities(connectorData||{});
  renderAtlasChannels(connectorData||{});
  updateSpendModeUI();

  if($("#ccAttentionCount"))$("#ccAttentionCount").textContent=String(attention);
  if($("#ccActiveCount"))$("#ccActiveCount").textContent=String(active);
  if($("#ccBotCount"))$("#ccBotCount").textContent=String(botCount);
  if($("#ccConnectorCount"))$("#ccConnectorCount").textContent=String(connectorCount);

  renderCcPriority(cards,failures);
  renderCcActivity(cards);
  await refreshOpenLoops();
  if($("#ccLastUpdated"))$("#ccLastUpdated").textContent=`Updated ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
}
function useCommandPrompt(button){
  const prompt=button.dataset.prompt||"";
  const agent=button.dataset.agent||"atlas";
  selectedAgentType=agent;
  updateAgentIdentityUI?.();
  if(button.dataset.media==="image") setImageMode(true);
  else if(button.dataset.media==="video") setVideoMode(true);
  else { setImageMode(false); setVideoMode(false); }
  promptEl.value=prompt;
  resizePrompt();
  promptEl.focus();
}

function splitMemoryLines(text){
  return [...new Set(String(text||"").split(/\n+/).map(s=>s.trim().replace(/^[-•]\s*/,"")).filter(Boolean))].slice(0,200);
}
function memoryLinesToText(lines){
  return (Array.isArray(lines)?lines:[]).map(x=>`- ${x}`).join("\n");
}
function getProjectMemoryText(){
  return memoryLinesToText(memoryStore.projects?.[currentProject] || []);
}
function getChatSummary(){
  return getChat()?.summary || "";
}
function mergeMemory(existingLines, additions){
  const seen=new Set((existingLines||[]).map(x=>x.toLowerCase()));
  const out=[...(existingLines||[])];
  for(const item of additions||[]){
    const clean=String(item||"").trim().replace(/^[-•]\s*/,"");
    if(clean && !seen.has(clean.toLowerCase())){
      seen.add(clean.toLowerCase());
      out.push(clean);
    }
  }
  return out.slice(-200);
}
function ensureProject(name){
  const n=String(name||"").trim() || "General";
  memoryStore.projects ||= {};
  if(!memoryStore.projects[n]) memoryStore.projects[n]=[];
  return n;
}
function renderProjects(){
  ensureProject(currentProject);
  const sel=$("#projectSelect");
  sel.innerHTML="";
  Object.keys(memoryStore.projects||{}).sort().forEach(name=>sel.appendChild(option(name,name)));
  sel.value=currentProject;
}

function saveAll(){
  localStorage.setItem("or-final-chats", JSON.stringify(chats.slice(0,60)));
  if(currentChatId) localStorage.setItem("or-final-current", currentChatId);
  localStorage.setItem("or-final-settings", JSON.stringify(settings));
  localStorage.setItem("or-final-routing", JSON.stringify(routing));
  localStorage.setItem("or-final-ui", JSON.stringify(ui));
  localStorage.setItem("or-final-favorites", JSON.stringify(favorites));
  memoryStore.global = splitMemoryLines(workspaceMemory);
  localStorage.setItem("or-memory-store", JSON.stringify(memoryStore));
  localStorage.setItem("or-current-project", currentProject);
  localStorage.setItem("or-perfect-custom-presets", JSON.stringify(customPresets));
}

function setStatus(text="", error=false){
  statusBar.textContent = text;
  statusBar.classList.toggle("error", error);
}

function getChat(){ return chats.find(c=>c.id===currentChatId) || null; }

function newChat(){
  currentChatId = crypto.randomUUID();
  chats.unshift({ id:currentChatId, title:"New chat", createdAt:Date.now(), messages:[] });
  saveAll();
  renderHistory();
  renderChat();
}

function ensureChat(){
  if(!getChat()) newChat();
  return getChat();
}

function cleanText(value){
  return String(value || "")
    .replace(/\*\*/g,"")
    .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
    .replace(/&amp;/g,"&")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">")
    .replace(/&quot;/g,'"')
    .replace(/&#039;/g,"'")
    .replace(/\s+/g," ")
    .trim();
}

function modelInfo(id){
  if(!id) return {id:"",name:"Unknown",provider:"",isFree:false};
  if(id==="smart-auto") return {id,name:"Smart Auto",provider:"OpenRouter",isFree:false,supportsVision:true,supportsReasoning:true,context_length:null};
  const exact = allModels.find(m=>m.id===id);
  const [providerRaw,...rest]=id.split("/");
  const provider = cleanText(providerRaw).replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  let name = exact?.name ? cleanText(exact.name) : rest.join("/");
  name = name.replace(/^.*?:\s*/,"").replace(/\(free\)$/i,"").replace(/:free$/i,"").trim();
  if(!name) name = rest.join("/").replace(/:free$/i,"").replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  return {
    id,
    name,
    provider,
    isFree: !!exact?.isFree || id.endsWith(":free"),
    supportsVision: !!exact?.supportsVision,
    supportsReasoning: !!exact?.supportsReasoning,
    context_length: exact?.context_length || null
  };
}

function money(n){
  const v=Number(n);
  if(!Number.isFinite(v)) return "";
  if(v===0) return "$0";
  if(v<0.001) return `$${v.toFixed(6)}`;
  return `$${v.toFixed(4)}`;
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function renderMarkdown(markdown=""){
  let text=String(markdown??"")
    .replace(/\r\n?/g,"\n")
    .replace(/\\\|/g,"|")
    .replace(/\\-/g,"-")
    .replace(/\\>/g,">")
    .replace(/\\#/g,"#")
    .replace(/\\\*/g,"*")
    .replace(/&lt;br\s*\/?&gt;/gi,"<br>")
    .replace(/<br\s*\/?>/gi,"\n");

  const esc=s=>String(s??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  const codeBlocks=[];
  text=text.replace(/```([\w+-]*)\n?([\s\S]*?)```/g,(_,lang,code)=>{
    const idx=codeBlocks.length;
    codeBlocks.push({lang:String(lang||"").trim(),code:String(code||"").replace(/\n$/,"")});
    return `\n@@CODEBLOCK_${idx}@@\n`;
  });

  const lines=text.split("\n");
  const out=[];
  let i=0;
  let paragraph=[];
  let listType=null;
  let listItems=[];

  const inline=(s)=>{
    let x=esc(s);
    const codes=[];
    x=x.replace(/`([^`]+)`/g,(_,c)=>{
      const idx=codes.length;
      codes.push(`<code>${esc(c)}</code>`);
      return `@@INLINECODE_${idx}@@`;
    });
    // Render saved /generated assets as real media; escape and restrict paths first.
    x=x.replace(/!\[([^\]]*)\]\((\/generated\/[a-zA-Z0-9_./%-]+\.(?:png|jpe?g|webp|gif))\)/gi,(_,alt,url)=>{
      const safeUrl=url.replace(/&/g,"&amp;").replace(/"/g,"&quot;");
      return '<a class="generated-media-link" href="'+safeUrl+'" target="_blank" rel="noopener noreferrer"><img class="generated-media-image" loading="lazy" src="'+safeUrl+'" alt="'+alt+'"></a>';
    });
    x=x.replace(/\[\[VIDEO:(\/generated\/[a-zA-Z0-9_./%-]+\.mp4)\]\]/gi,(_,url)=>'<video class="generated-media-video" src="'+url+'" controls playsinline preload="metadata"></video>');
    x=x
      .replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")
      .replace(/__([^_]+)__/g,"<strong>$1</strong>")
      .replace(/~~([^~]+)~~/g,"<del>$1</del>")
      .replace(/(^|[^\*])\*([^*\n]+)\*/g,"$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    codes.forEach((v,idx)=>{x=x.replace(`@@INLINECODE_${idx}@@`,v)});
    return x;
  };

  const flushParagraph=()=>{
    if(!paragraph.length)return;
    const joined=paragraph.join(" ").replace(/\s+/g," ").trim();
    if(joined)out.push(`<p>${inline(joined)}</p>`);
    paragraph=[];
  };
  const flushList=()=>{
    if(!listType||!listItems.length){listType=null;listItems=[];return}
    out.push(`<${listType}>${listItems.map(x=>`<li>${inline(x)}</li>`).join("")}</${listType}>`);
    listType=null;listItems=[];
  };
  const isTableSeparator=(line)=>{
    const cells=line.trim().replace(/^\||\|$/g,"").split("|").map(x=>x.trim());
    return cells.length>=2 && cells.every(c=>/^:?-{3,}:?$/.test(c));
  };
  const splitTableRow=(line)=>line.trim().replace(/^\||\|$/g,"").split("|").map(x=>x.trim());
  const alignFor=(cell)=>{
    const c=cell.trim();
    if(/^:-+:$/.test(c))return "center";
    if(/^-+:$/.test(c))return "right";
    if(/^:-+$/.test(c))return "left";
    return "";
  };

  while(i<lines.length){
    const raw=lines[i];
    const line=raw.trim();

    if(/^@@CODEBLOCK_\d+@@$/.test(line)){
      flushParagraph();flushList();
      const idx=Number(line.match(/\d+/)[0]);
      const block=codeBlocks[idx]||{lang:"",code:""};
      out.push(`<div class="md-code-wrap"><div class="md-code-head"><span>${esc(block.lang||"code")}</span><button class="copy-code" type="button">Copy</button></div><pre><code>${esc(block.code)}</code></pre></div>`);
      i++;continue;
    }

    if(!line){
      flushParagraph();flushList();i++;continue;
    }

    // Markdown table: header row + separator row
    if(line.includes("|") && i+1<lines.length && isTableSeparator(lines[i+1])){
      flushParagraph();flushList();
      const headers=splitTableRow(raw);
      const separators=splitTableRow(lines[i+1]);
      const aligns=separators.map(alignFor);
      const rows=[];
      i+=2;
      while(i<lines.length && lines[i].trim() && lines[i].includes("|")){
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      const thead=`<thead><tr>${headers.map((h,idx)=>`<th${aligns[idx]?` style="text-align:${aligns[idx]}"`:""}>${inline(h)}</th>`).join("")}</tr></thead>`;
      const tbody=rows.length?`<tbody>${rows.map(r=>`<tr>${headers.map((_,idx)=>`<td${aligns[idx]?` style="text-align:${aligns[idx]}"`:""}>${inline(r[idx]??"")}</td>`).join("")}</tr>`).join("")}</tbody>`:"";
      out.push(`<div class="md-table-wrap"><table class="md-table">${thead}${tbody}</table></div>`);
      continue;
    }

    const h=line.match(/^(#{1,6})\s+(.+)$/);
    if(h){
      flushParagraph();flushList();
      const level=Math.min(6,h[1].length);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;continue;
    }

    if(/^---+$/.test(line)||/^\*\*\*+$/.test(line)){
      flushParagraph();flushList();out.push("<hr>");i++;continue;
    }

    if(/^>\s?/.test(line)){
      flushParagraph();flushList();
      const quote=[];
      while(i<lines.length && /^>\s?/.test(lines[i].trim())){
        quote.push(lines[i].trim().replace(/^>\s?/,""));
        i++;
      }
      out.push(`<blockquote>${quote.map(q=>`<p>${inline(q)}</p>`).join("")}</blockquote>`);
      continue;
    }

    const ol=line.match(/^(\d+)[.)]\s+(.+)$/);
    const ul=line.match(/^[-*+•]\s+(.+)$/);
    if(ol||ul){
      flushParagraph();
      const wanted=ol?"ol":"ul";
      if(listType && listType!==wanted)flushList();
      listType=wanted;
      listItems.push((ol?ol[2]:ul[1]).trim());
      i++;continue;
    }

    paragraph.push(line);
    i++;
  }

  flushParagraph();
  flushList();

  return out.join("\n");
}

function bindCodeButtons(root=document){
  root.querySelectorAll(".copy-code").forEach(btn=>{
    if(btn.dataset.bound)return;
    btn.dataset.bound="1";
    btn.addEventListener("click",async()=>{
      const code=btn.closest(".md-code-wrap")?.querySelector("pre code")?.textContent||"";
      try{
        await navigator.clipboard.writeText(code);
        const old=btn.textContent;
        btn.textContent="Copied";
        setTimeout(()=>btn.textContent=old,1200);
      }catch{}
    });
  });
}

function addAnswerBadge(box, modelId, usage){
  const info=modelInfo(modelId);
  const wrap=document.createElement("div");
  wrap.className="answer-badge";

  const n=document.createElement("span"); n.className="badge-chip model-name"; n.textContent=info.name; wrap.appendChild(n);
  if(info.provider){ const p=document.createElement("span");p.className="badge-chip";p.textContent=info.provider;wrap.appendChild(p); }
  const f=document.createElement("span");f.className=`badge-chip ${info.isFree?"free":"paid"}`;f.textContent=info.isFree?"FREE":"PAID";wrap.appendChild(f);

  if(usage?.cost!==undefined){
    const c=document.createElement("span");c.className="badge-chip cost";c.textContent=`Cost ${money(usage.cost)}`;wrap.appendChild(c);
  }
  const inTok=usage?.prompt_tokens ?? usage?.input_tokens;
  const outTok=usage?.completion_tokens ?? usage?.output_tokens;
  if(Number.isFinite(inTok)||Number.isFinite(outTok)){
    const t=document.createElement("span");t.className="badge-chip";t.textContent=`${inTok||0} in · ${outTok||0} out`;wrap.appendChild(t);
  }

  box.appendChild(wrap);
}

function addAnswerActions(box,msgIndex){
  const actions=document.createElement("div");actions.className="answer-actions";
  const copy=document.createElement("button");copy.textContent="Copy";
  copy.onclick=async()=>{await navigator.clipboard.writeText(getChat()?.messages?.[msgIndex]?.content||"");copy.textContent="Copied";setTimeout(()=>copy.textContent="Copy",1200)};
  const regen=document.createElement("button");regen.textContent="Regenerate";
  regen.onclick=()=>regenerate(msgIndex);
  actions.append(copy,regen);
  box.appendChild(actions);
}

function appendMessage(msg,index,scroll=true){
  const row=document.createElement("div");row.className=`message-row ${msg.role}`;
  const box=document.createElement("div");box.className="message";
  if(msg.role==="assistant"){
    const content=document.createElement("div");content.className="assistant-content";content.innerHTML=renderMarkdown(msg.content);box.appendChild(content);bindCodeButtons(content);
    if(msg.model) addAnswerBadge(box,msg.model,msg.usage);
    addAnswerActions(box,index);
  }else{
    box.textContent=msg.contentText || (typeof msg.content==="string"?msg.content:"[Attachment message]");
  }
  row.appendChild(box);messagesEl.appendChild(row);
  if(scroll) requestAnimationFrame(()=>followLatest(false));
  return row;
}

function welcome(){
  const w=document.createElement("div");w.className="welcome";
  w.innerHTML=`<div class="orb">✦</div><h1>What would you like to work on?</h1><p>Make space for your next idea.</p><div class="suggestions"><button>Draft an email</button><button>Research a company</button><button>Plan my content</button><button>Find new leads</button></div>`;
  w.querySelectorAll(".suggestions button").forEach(b=>b.onclick=()=>{promptEl.value=b.textContent;resizePrompt();promptEl.focus()});
  return w;
}

function renderChat(){
  messagesEl.innerHTML="";
  if(mainView==="chat"){
    if($("#mainViewTitle"))$("#mainViewTitle").textContent=getChat()?.title||"Ask Kairoq";
    if($("#mainViewSubtitle"))$("#mainViewSubtitle").textContent=`${AGENT_TEAM[selectedAgentType]?.name||"Kairoq"} · ${currentProject}`;
  }
  const msgs=getChat()?.messages || [];
  if(!msgs.length){messagesEl.appendChild(welcome());return;}
  msgs.forEach((m,i)=>appendMessage(m,i,false));
  requestAnimationFrame(()=>followLatest(true));
}

function renderHistory(){
  historyList.innerHTML="";
  chats.slice(0,40).forEach(chat=>{
    const row=document.createElement("div");row.className="history-item";
    const open=document.createElement("button");open.className="history-open";open.textContent=chat.title||"New chat";
    open.onclick=()=>{currentChatId=chat.id;saveAll();renderChat();setMainView("chat")};
    const menu=document.createElement("button");menu.className="history-menu";menu.textContent="⋯";
    menu.onclick=()=>{
      const action=prompt("Type 'rename' or 'delete'");
      if(action==="rename"){
        const name=prompt("New chat name",chat.title||"");
        if(name){chat.title=name.trim();saveAll();renderHistory();}
      }else if(action==="delete"){
        chats=chats.filter(c=>c.id!==chat.id);
        if(currentChatId===chat.id) currentChatId=chats[0]?.id||null;
        if(!currentChatId)newChat();else{saveAll();renderHistory();renderChat();}
      }
    };
    row.append(open,menu);historyList.appendChild(row);
  });
}

function option(value,label){
  const o=document.createElement("option");o.value=value;o.textContent=label;return o;
}

function fillModelSelect(){
  const previous=ui.lastModel||"openrouter/free";
  modelSelect.innerHTML="";
  modelSelect.appendChild(option("openrouter/free","⚡ Free Auto"));
  modelSelect.appendChild(option("smart-auto","✦ Smart Auto"));

  const fav = allModels.filter(m=>favorites.includes(m.id));
  const free = allModels.filter(m=>m.isFree).sort((a,b)=>a.name.localeCompare(b.name));
  const anthropic = allModels.filter(m=>m.id.startsWith("anthropic/")).sort((a,b)=>a.name.localeCompare(b.name));
  const google = allModels.filter(m=>m.id.startsWith("google/")).sort((a,b)=>a.name.localeCompare(b.name));
  const openai = allModels.filter(m=>m.id.startsWith("openai/")).sort((a,b)=>a.name.localeCompare(b.name));
  const others = allModels.filter(m=>!m.isFree&&!m.id.startsWith("anthropic/")&&!m.id.startsWith("google/")&&!m.id.startsWith("openai/")).slice(0,120);

  function group(label,arr){
    if(!arr.length)return;
    const g=document.createElement("optgroup");g.label=label;
    arr.forEach(m=>g.appendChild(option(m.id,`${cleanText(m.name)}${m.isFree?" · FREE":""}`)));
    modelSelect.appendChild(g);
  }
  group("★ Favorites",fav);
  group("Free models",free);
  group("Claude / Anthropic",anthropic);
  group("Gemini / Google",google);
  group("OpenAI",openai);
  group("Other models",others);

  if([...modelSelect.options].some(o=>o.value===previous)) modelSelect.value=previous;
  else modelSelect.value="openrouter/free";
  updateModelUI();
}

function updateModelUI(){
  if(freeOnlyEl.checked && ["smart-auto","openrouter/auto"].includes(modelSelect.value)) modelSelect.value="openrouter/free";
  ui.lastModel=modelSelect.value;saveAll();
  const info=modelInfo(modelSelect.value);
  modelBadge.textContent=modelSelect.value==="openrouter/free"?"⚡ Free Auto":modelSelect.value==="smart-auto"?"✦ Smart Auto":`${info.name}${info.isFree?" · FREE":""}`;
  $("#favoriteBtn").classList.toggle("active",favorites.includes(modelSelect.value));
  $("#favoriteBtn").textContent=favorites.includes(modelSelect.value)?"★":"☆";
}

function renderModelResults(){
  const q=$("#modelSearch").value.trim().toLowerCase();
  const host=$("#modelResults");host.innerHTML="";
  let models=[{id:"openrouter/free",name:"Free Auto",isFree:true,supportsVision:true,supportsReasoning:true,context_length:null},...allModels];

  if(currentModelFilter==="free")models=models.filter(m=>m.isFree);
  if(currentModelFilter==="vision")models=models.filter(m=>m.supportsVision);
  if(currentModelFilter==="reasoning")models=models.filter(m=>m.supportsReasoning);
  if(currentModelFilter==="favorites")models=models.filter(m=>favorites.includes(m.id));
  if(q)models=models.filter(m=>`${m.name} ${m.id}`.toLowerCase().includes(q));

  models.slice(0,250).forEach(m=>{
    const b=document.createElement("button");b.className="model-result";
    const left=document.createElement("div");
    left.innerHTML=`<div class="model-result-name">${escapeHTML(cleanText(m.name||m.id))}</div><div class="model-result-id">${escapeHTML(m.id)}</div>`;
    const meta=document.createElement("div");meta.className="model-result-meta";
    meta.textContent=[m.isFree?"FREE":"PAID",m.supportsVision?"VISION":"",m.supportsReasoning?"REASONING":""].filter(Boolean).join(" · ");
    b.append(left,meta);
    b.onclick=()=>{modelSelect.value=m.id;updateModelUI();$("#modelDialog").close()};
    host.appendChild(b);
  });
}


function renderCustomPresets(){
  let host=document.querySelector(".custom-preset-row");
  if(!host){
    host=document.createElement("div");
    host.className="custom-preset-row";
    const presetList=document.querySelector("#presetList");
    presetList.insertAdjacentElement("afterend",host);
  }
  host.innerHTML="";
  customPresets.slice(0,4).forEach(p=>{
    const b=document.createElement("button");
    b.textContent="★ "+p.name;
    b.onclick=()=>{
      activeCustomPreset=p;
      effortSelect.value=p.effort||"medium";
      purposeSelect.value=p.purpose||"general";
      ui.effort=effortSelect.value;
      ui.purpose=purposeSelect.value;
      saveAll();
      setStatus(`Custom preset: ${p.name}`);
    };
    host.appendChild(b);
  });
  const add=document.createElement("button");
  add.textContent="+ Preset";
  add.onclick=()=>$("#presetDialog").showModal();
  host.appendChild(add);
}

function chooseRecommended(type){
  let candidates=[...allModels];
  if(type==="bestfree") candidates=candidates.filter(m=>m.isFree);
  if(type==="vision") candidates=candidates.filter(m=>m.supportsVision);
  if(type==="reasoning") candidates=candidates.filter(m=>m.supportsReasoning);
  if(type==="coding"){
    const keys=["coder","coding","qwen","deepseek","devstral"];
    candidates=candidates.filter(m=>keys.some(k=>(m.name+" "+m.id).toLowerCase().includes(k)));
  }
  if(type==="fast"){
    const keys=["flash","mini","small","lite","fast"];
    const filtered=candidates.filter(m=>keys.some(k=>(m.name+" "+m.id).toLowerCase().includes(k)));
    if(filtered.length)candidates=filtered;
  }
  if(type==="premium") candidates=candidates.filter(m=>!m.isFree);

  candidates.sort((a,b)=>{
    if(type==="bestfree"||type==="reasoning"||type==="vision") return (b.context_length||0)-(a.context_length||0);
    return (a.name||a.id).localeCompare(b.name||b.id);
  });

  const pick=candidates[0];
  if(pick){
    if(freeOnlyEl.checked && !pick.isFree){
      freeOnlyEl.checked=false;
      updateRouting();
    }
    modelSelect.value=pick.id;
    updateModelUI();
    setStatus(`${type} recommendation: ${cleanText(pick.name)}`);
  }else{
    setStatus(`No ${type} model found in the current catalog`,true);
  }
}

// Memory center
$("#workspaceBtn").onclick=()=>{
  workspaceMemory=memoryLinesToText(memoryStore.global||[]);
  $("#workspaceMemory").value=workspaceMemory;
  $("#projectMemory").value=getProjectMemoryText();
  $("#chatSummaryBox").value=getChatSummary();
  $("#autoMemory").checked=memoryStore.settings?.autoMemory!==false;
  $("#autoSummarize").checked=memoryStore.settings?.autoSummarize!==false;
  $$(".memory-tab").forEach(b=>b.classList.toggle("active",b.dataset.memoryTab==="global"));
  $("#memoryGlobalPane").classList.remove("hidden");
  $("#memoryProjectPane").classList.add("hidden");
  $("#memorySummaryPane").classList.add("hidden");
  $("#workspaceDialog").showModal();
};
$("#closeWorkspace").onclick=()=>$("#workspaceDialog").close();
$$(".memory-tab").forEach(b=>b.onclick=()=>{
  const tab=b.dataset.memoryTab;
  $$(".memory-tab").forEach(x=>x.classList.toggle("active",x===b));
  $("#memoryGlobalPane").classList.toggle("hidden",tab!=="global");
  $("#memoryProjectPane").classList.toggle("hidden",tab!=="project");
  $("#memorySummaryPane").classList.toggle("hidden",tab!=="summary");
});
$("#saveWorkspace").onclick=()=>{
  memoryStore.global=splitMemoryLines($("#workspaceMemory").value);
  ensureProject(currentProject);
  memoryStore.projects[currentProject]=splitMemoryLines($("#projectMemory").value);
  const chat=getChat();
  if(chat)chat.summary=$("#chatSummaryBox").value.trim();
  memoryStore.settings ||= {};
  memoryStore.settings.autoMemory=$("#autoMemory").checked;
  memoryStore.settings.autoSummarize=$("#autoSummarize").checked;
  workspaceMemory=memoryLinesToText(memoryStore.global);
  saveAll();
  $("#workspaceDialog").close();
  setStatus("Memory saved");
};
$("#refreshMemoryNow").onclick=async()=>{
  await updateMemoryFromCurrentChat(true);
  $("#workspaceMemory").value=memoryLinesToText(memoryStore.global||[]);
  $("#projectMemory").value=getProjectMemoryText();
  $("#chatSummaryBox").value=getChatSummary();
};
$("#projectSelect").onchange=()=>{
  currentProject=$("#projectSelect").value;
  saveAll();
  setStatus(`Project: ${currentProject}`);
};
$("#newProjectBtn").onclick=()=>{
  const name=prompt("Project name");
  if(!name)return;
  currentProject=ensureProject(name);
  saveAll();
  renderProjects();
  setStatus(`Created project: ${currentProject}`);
};

// Compare
$("#compareBtn").onclick=()=>{
  populateCompareSelects();
  $("#comparePrompt").value=promptEl.value.trim();
  $("#compareResults").innerHTML="";
  $("#compareDialog").showModal();
};
$("#closeCompare").onclick=()=>$("#compareDialog").close();
$("#runCompare").onclick=async()=>{
  const prompt=$("#comparePrompt").value.trim();
  if(!prompt)return;
  const host=$("#compareResults");host.innerHTML="";
  const models=[$("#compareModelA").value,$("#compareModelB").value,$("#compareModelC").value];
  const cards=models.map(()=>{const d=document.createElement("div");d.className="compare-result";host.appendChild(d);return d});
  await Promise.all(models.map((m,i)=>compareOne(m,prompt,cards[i])));
};
$$("[data-reco]").forEach(b=>b.onclick=()=>chooseRecommended(b.dataset.reco));

// Custom presets
$("#closePresetDialog").onclick=()=>$("#presetDialog").close();
$("#saveCustomPreset").onclick=()=>{
  const name=$("#presetName").value.trim();
  if(!name)return;
  const preset={id:crypto.randomUUID(),name,prompt:$("#presetPrompt").value.trim(),effort:$("#presetEffort").value,purpose:$("#presetPurpose").value};
  customPresets=[preset,...customPresets].slice(0,12);
  saveAll();renderCustomPresets();$("#presetDialog").close();
  $("#presetName").value="";$("#presetPrompt").value="";
  setStatus(`Preset saved: ${name}`);
};
renderCustomPresets();
renderProjects();

// Cloud memory
$("#syncMemoryNow").onclick=async()=>{
  try{
    if(!cloudMemoryConfigured){setStatus("Cloud memory is not configured",true);return}
    await cloudSave(true);
  }catch(err){setStatus(err.message,true)}
};

// Agent + connectors + bots + ops
$("#composerMascot").onclick=()=>{updateAgentIdentityUI();populateAgentModels();$("#agentRun").classList.add("hidden");$("#agentDialog").showModal();};
$("#agentQuickBtn").onclick=()=>{updateAgentIdentityUI();populateAgentModels();$("#agentRun").classList.add("hidden");$("#agentDialog").showModal();};
$("#agentBtn").onclick=()=>{updateAgentIdentityUI();populateAgentModels();$("#agentRun").classList.add("hidden");$("#agentDialog").showModal();};
$("#closeAgent").onclick=()=>$("#agentDialog").close();
$$(".agent-type").forEach(b=>b.onclick=()=>{selectedAgentType=b.dataset.agent;updateAgentIdentityUI();});
$("#runAgent").onclick=runAgent;
$("#connectorsBtn").onclick=()=>{loadConnectorStatus();$("#connectorsDialog").showModal()};
$("#botsBtn").onclick=()=>{populateBotModels();loadBots();loadBotRuns();$("#botsDialog").showModal()};
$("#opsBtn").onclick=()=>{loadOps();$("#opsDialog").showModal()};

$("#templatesBtn").onclick=openTemplates;
$("#closeTemplates").onclick=()=>$("#templatesDialog").close();
$("#playbookBtn").onclick=openPlaybook;
$("#closePlaybook").onclick=()=>$("#playbookDialog").close();
$("#savePlaybook").onclick=savePlaybookFromForm;
$("#workflowsBtn").onclick=()=>{loadWorkflowCards();$("#workflowsDialog").showModal()};
$("#closeWorkflows").onclick=()=>$("#workflowsDialog").close();
$("#seedDemoWorkflows").onclick=seedDemoWorkflowCards;
$("#clearWorkflows").onclick=clearWorkflowCards;
$("#skipOnboarding").onclick=async()=>{await persistProductState({onboarding_complete:true});$("#onboardingDialog").close()};
$("#onboardingNext").onclick=nextOnboarding;
$("#onboardingBack").onclick=prevOnboarding;

$("#closeOps").onclick=()=>$("#opsDialog").close();
$("#savePermissions").onclick=savePermissions;
$("#refreshAudit").onclick=loadAudit;
$("#closeBots").onclick=()=>$("#botsDialog").close();
$("#createBot").onclick=createBot;
$("#closeConnectors").onclick=()=>$("#connectorsDialog").close();
$("#connectGoogle").onclick=()=>{window.location.href="/api/google/connect"};
$("#connectMicrosoft").onclick=()=>{window.location.href="/api/microsoft/connect"};
$("#approveAction").onclick=()=>resolveApproval(true);
$("#denyApproval").onclick=()=>resolveApproval(false);

updateAgentIdentityUI();
setMascotState('idle');

memoryStore.global ||= [];
initializeProductLayer();
memoryStore.projects ||= {"General":[]};
memoryStore.settings ||= {autoMemory:true,autoSummarize:true};
ensureProject(currentProject);
workspaceMemory=memoryLinesToText(memoryStore.global);

function applyPreset(name){
  const p=PRESETS[name];if(!p)return;
  ui.preset=name;ui.effort=p.effort;ui.purpose=p.purpose;
  effortSelect.value=p.effort;purposeSelect.value=p.purpose;webSearchEl.checked=p.web;
  routing.webSearch=p.web;
  if(p.model){modelSelect.value=p.model;updateModelUI();}
  $$(".preset").forEach(b=>b.classList.toggle("active",b.dataset.preset===name));
  saveAll();
  setStatus(`${name[0].toUpperCase()+name.slice(1)} preset selected`);
}

function resizePrompt(){promptEl.style.height="auto";promptEl.style.height=Math.min(promptEl.scrollHeight,180)+"px"}

function renderAttachments(){
  attachmentTray.innerHTML="";
  attachments.forEach((a,i)=>{
    const el=document.createElement("div");el.className="attachment";
    if(a.kind==="image"){const img=document.createElement("img");img.src=a.data;el.appendChild(img)}
    const name=document.createElement("div");name.className="attachment-name";name.textContent=a.name;el.appendChild(name);
    const x=document.createElement("button");x.textContent="×";x.onclick=()=>{attachments.splice(i,1);renderAttachments()};el.appendChild(x);
    attachmentTray.appendChild(el);
  });
}

async function handleFiles(files){
  for(const file of [...files].slice(0,6)){
    if(file.size>5_000_000){setStatus(`${file.name} is over 5 MB`,true);continue}
    if(file.type.startsWith("image/")){
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      attachments.push({kind:"image",name:file.name,type:file.type,data});
    }else{
      const text=await file.text();
      attachments.push({kind:"text",name:file.name,type:file.type||"text/plain",text:text.slice(0,120000)});
    }
  }
  renderAttachments();
}

function buildUserMessage(text){
  const parts=[];
  let display=text;
  const textAttachments=attachments.filter(a=>a.kind==="text");
  const imageAttachments=attachments.filter(a=>a.kind==="image");

  let promptText=text;
  for(const a of textAttachments){
    promptText += `\n\n--- Attached file: ${a.name} ---\n${a.text}\n--- End file ---`;
  }

  if(imageAttachments.length){
    parts.push({type:"text",text:promptText||"Please analyze the attached image(s)."});
    imageAttachments.forEach(a=>parts.push({type:"image_url",image_url:{url:a.data}}));
    return {role:"user",content:parts,contentText:display||`[${imageAttachments.length} image attachment(s)]`};
  }
  return {role:"user",content:promptText,contentText:display||textAttachments.map(a=>`[${a.name}]`).join(" ")};
}


function populateCompareSelects(){
  const ids=["compareModelA","compareModelB","compareModelC"];
  const preferred=[
    "openrouter/free",
    "smart-auto",
    favorites[0] || "openrouter/free"
  ];
  ids.forEach((id,idx)=>{
    const sel=$("#"+id);
    sel.innerHTML="";
    sel.appendChild(option("openrouter/free","Free Auto"));
    sel.appendChild(option("smart-auto","Smart Auto"));
    allModels.slice(0,250).forEach(m=>sel.appendChild(option(m.id,cleanText(m.name)+(m.isFree?" · FREE":""))));
    if([...sel.options].some(o=>o.value===preferred[idx])) sel.value=preferred[idx];
  });
}

async function compareOne(model,prompt,host){
  host.innerHTML=`<h3>${escapeHTML(modelInfo(model).name)}</h3><div class="compare-body">Thinking…</div>`;
  const body=host.querySelector(".compare-body");
  let text="";
  try{
    const res=await fetch("/api/chat/stream",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model,
        messages:[{role:"user",content:prompt}],
        systemPrompt:settings.systemPrompt||"",
        temperature:Number(settings.temperature??0.7),
        freeOnly:freeOnlyEl.checked,
        smartFallback:smartFallbackEl.checked,
        webSearch:false,
        reasoningEffort:effortSelect.value,
        purpose:purposeSelect.value,
        workspaceMemory,
        projectMemory:getProjectMemoryText(),
      companyPlaybook: await getCompanyPlaybookText(),
        chatSummary:getChatSummary(),
        customPresetPrompt:activeCustomPreset?.prompt || ""
      })
    });
    if(!res.ok){
      const data=await res.json().catch(()=>({}));
      throw new Error(data.error||`Request failed (${res.status})`);
    }
    await readSSE(res,(event,data)=>{
      if(event==="token"){text+=data.text||"";body.textContent=text}
      if(event==="error")throw new Error(data.message||"Comparison failed");
    });
    if(!text)body.textContent="(No text returned)";
  }catch(err){
    body.textContent=`Error: ${err.message}`;
  }
}

async function readSSE(response,onEvent){
  const reader=response.body.getReader();const decoder=new TextDecoder();let buffer="";
  while(true){
    const {value,done}=await reader.read();if(done)break;
    buffer+=decoder.decode(value,{stream:true});
    const blocks=buffer.split("\n\n");buffer=blocks.pop()||"";
    for(const block of blocks){
      let event="message",data=null;
      for(const line of block.split("\n")){
        if(line.startsWith("event:"))event=line.slice(6).trim();
        if(line.startsWith("data:")){try{data=JSON.parse(line.slice(5).trim())}catch{}}
      }
      if(data)onEvent(event,data);
    }
  }
}


function isLikelyImageRequest(text){
  const t=String(text||"").toLowerCase();
  const action=/\b(create|generate|make|draw|design|render|visualize|edit|change|remove|replace|retouch|restyle)\b/.test(t);
  const object=/\b(image|picture|photo|portrait|avatar|poster|logo|ad creative|illustration|mascot|sticker|scene|character|influencer|model shot)\b/.test(t);
  return action && object;
}

function isLikelyVideoRequest(text){
  const t=String(text||"").toLowerCase();
  return /\b(create|generate|make|animate|turn|convert)\b/.test(t)
    && /\b(video|clip|animation|reel|motion|animate this|image to video)\b/.test(t);
}

function setImageMode(on){
  imageMode=!!on;
  if(imageMode) videoMode=false;
  const btn=$("#imageModeBtn");
  const vbtn=$("#videoModeBtn");
  if(btn){
    btn.classList.toggle("active",imageMode);
    btn.title=imageMode?"Image mode ON":"Generate or edit image";
  }
  if(vbtn)vbtn.classList.remove("active");
  if(promptEl){
    promptEl.placeholder=imageMode
      ? (attachments.some(a=>a.kind==="image") ? "Describe the edit you want…" : "Describe the image you want…")
      : "Message your AI…";
  }
  setMascotState?.(imageMode?"thinking":"idle");
}

function setVideoMode(on){
  videoMode=!!on;
  if(videoMode) imageMode=false;
  const btn=$("#videoModeBtn");
  const ibtn=$("#imageModeBtn");
  if(btn){
    btn.classList.toggle("active",videoMode);
    btn.title=videoMode?"Video mode ON":"Generate or animate video";
  }
  if(ibtn)ibtn.classList.remove("active");
  if(promptEl){
    promptEl.placeholder=videoMode
      ? (attachments.some(a=>a.kind==="image") ? "Describe how this image should animate…" : "Describe the video you want…")
      : "Message your AI…";
  }
  setMascotState?.(videoMode?"thinking":"idle");
}

function imageSizeForPurpose(){
  const purpose=purposeSelect?.value||"general";
  if(purpose==="vision")return "square_hd";
  if(purpose==="business")return "landscape_16_9";
  if(purpose==="writing")return "portrait_4_3";
  return "square_hd";
}

function generatedImagesMarkdown(data){
  const imgs=(data.images||[]).map((img,i)=>`![Generated image ${i+1}](${img.url})`).join("\n\n");
  const edited=data.edited?"Edited":"Generated";
  const provider=`${data.provider||"media provider"} / ${data.model||"image model"}`;
  const cost=Number(data?.usage?.cost);
  const costText=Number.isFinite(cost)?`\n\nCost: \`${money(cost)}\``:"";
  return `**${edited} with ${provider}.**\n\n${imgs}${costText}`;
}

function generatedVideoMarkdown(data){
  const url=data?.video?.url;
  if(!url)return "**Video generated, but no playable URL was returned.**";
  return `**Video generated with ${data.provider||"media provider"} / ${data.model||"video model"}.**\n\n[[VIDEO:${url}]]`;
}

function currentImageReferences(){
  return attachments.filter(a=>a.kind==="image").map(a=>a.data).slice(0,4);
}

async function generateImageFromPrompt(raw){
  setMainView("chat");
  const chat=ensureChat();
  const refs=currentImageReferences();
  const userMsg={role:"user",content:raw,contentText:raw+(refs.length?` [${refs.length} image reference${refs.length>1?"s":""}]`:"")};
  chat.messages.push(userMsg);
  if(chat.messages.filter(m=>m.role==="user").length===1)chat.title=(raw||"Image generation").slice(0,44);
  saveAll();renderChat();

  promptEl.value="";resizePrompt();
  busy=true;sendBtn.disabled=true;stopBtn.classList.remove("hidden");
  setStatus(refs.length?"Editing image…":"Generating image…");
  setMascotState?.("working");

  const tempMsg={role:"assistant",content:refs.length?"Editing image…":"Generating image…",model:"media/image",usage:null};
  const tempIndex=chat.messages.length;
  const row=appendMessage(tempMsg,tempIndex);
  const box=row.querySelector(".message");
  box.innerHTML=`<div class="assistant-content">${refs.length?"Editing image…":"Generating image…"}</div>`;
  const contentEl=box.querySelector(".assistant-content");

  try{
    const res=await fetch("/api/images/generate",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({prompt:raw,image_size:imageSizeForPurpose(),num_images:1,references:refs,budget_mode:spendMode})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Image request failed (${res.status})`);
    const md=generatedImagesMarkdown(data);
    contentEl.innerHTML=renderMarkdown(md);bindCodeButtons(contentEl);
    const finalMsg={role:"assistant",content:md,model:data.model||"media/image",usage:data.usage||{cost:null}};
    chat.messages.push(finalMsg);
    addAnswerBadge(box,`${data.provider||"Media"} · ${finalMsg.model}`,finalMsg.usage);
    addAnswerActions(box,chat.messages.length-1);
    saveAll();renderHistory?.();loadWorkflowCards?.();
    setMascotState?.("success");
    setStatus(refs.length?"Image edited":"Image generated");
    attachments=[];renderAttachments?.();
    if(imageMode)setImageMode(false);
  }catch(err){
    contentEl.textContent=`Error: ${err.message}`;
    setStatus(err.message,true);
    setMascotState?.("error");
  }finally{
    busy=false;sendBtn.disabled=false;stopBtn.classList.add("hidden");promptEl.focus();
    setTimeout(()=>{if(!busy&&!statusBar.classList.contains("error"))setStatus("")},2600);
  }
}

async function generateVideoFromPrompt(raw){
  setMainView("chat");
  const chat=ensureChat();
  const ref=currentImageReferences()[0]||"";
  const userMsg={role:"user",content:raw,contentText:raw+(ref?" [image-to-video]":"")};
  chat.messages.push(userMsg);
  if(chat.messages.filter(m=>m.role==="user").length===1)chat.title=(raw||"Video generation").slice(0,44);
  saveAll();renderChat();

  promptEl.value="";resizePrompt();
  busy=true;sendBtn.disabled=true;stopBtn.classList.remove("hidden");
  setStatus(ref?"Animating image…":"Generating video…");
  setMascotState?.("working");

  const tempMsg={role:"assistant",content:ref?"Animating image…":"Generating video…",model:"media/video",usage:null};
  const tempIndex=chat.messages.length;
  const row=appendMessage(tempMsg,tempIndex);
  const box=row.querySelector(".message");
  box.innerHTML=`<div class="assistant-content">${ref?"Animating image…":"Generating video…"}</div>`;
  const contentEl=box.querySelector(".assistant-content");

  try{
    const res=await fetch("/api/videos/generate",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({prompt:raw,duration:4,reference_image:ref,budget_mode:spendMode})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Video request failed (${res.status})`);
    const md=generatedVideoMarkdown(data);
    contentEl.innerHTML=renderMarkdown(md);bindCodeButtons(contentEl);
    const finalMsg={role:"assistant",content:md,model:data.model||"media/video",usage:{cost:null}};
    chat.messages.push(finalMsg);
    addAnswerBadge(box,`${data.provider||"Media"} · ${finalMsg.model}`,finalMsg.usage);
    addAnswerActions(box,chat.messages.length-1);
    saveAll();renderHistory?.();loadWorkflowCards?.();
    setMascotState?.("success");
    setStatus(ref?"Image animated":"Video generated");
    attachments=[];renderAttachments?.();
    if(videoMode)setVideoMode(false);
  }catch(err){
    contentEl.textContent=`Error: ${err.message}`;
    setStatus(err.message,true);
    setMascotState?.("error");
  }finally{
    busy=false;sendBtn.disabled=false;stopBtn.classList.add("hidden");promptEl.focus();
    setTimeout(()=>{if(!busy&&!statusBar.classList.contains("error"))setStatus("")},2600);
  }
}

async function send(regenerateFrom=null){
  setMainView("chat");
  const raw=promptEl.value.trim();
  if(busy || (!raw && !attachments.length))return;
  if(regenerateFrom===null && (videoMode || isLikelyVideoRequest(raw))){
    return generateVideoFromPrompt(raw);
  }
  if(regenerateFrom===null && (imageMode || isLikelyImageRequest(raw))){
    return generateImageFromPrompt(raw);
  }

  const chat=ensureChat();
  const userMsg=buildUserMessage(raw);

  if(regenerateFrom===null){
    chat.messages.push(userMsg);
    if(chat.messages.filter(m=>m.role==="user").length===1)chat.title=(raw||"Attachment chat").slice(0,44);
  }

  const outgoing=chat.messages.map(m=>({role:m.role,content:m.content}));
  saveAll();renderChat();

  promptEl.value="";resizePrompt();
  const usedAttachments=[...attachments];attachments=[];renderAttachments();

  busy=true;sendBtn.disabled=true;stopBtn.classList.remove("hidden");abortController=new AbortController();setStatus("Connecting…");

  const tempMsg={role:"assistant",content:"",model:"",usage:null};
  const tempIndex=chat.messages.length;
  const row=appendMessage(tempMsg,tempIndex);
  const box=row.querySelector(".message");
  box.innerHTML='<div class="assistant-content"></div>';
  const contentEl=box.querySelector(".assistant-content");
  const cursor=document.createElement("span");cursor.className="cursor";box.appendChild(cursor);

  let text="";let finalModel="";let usage=null;let streamError=null;let smoothRenderer=null;

  try{
    const response=await fetch("/api/chat/stream",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      signal:abortController.signal,
      body:JSON.stringify({
        model:modelSelect.value||"openrouter/free",
        messages:outgoing,
        systemPrompt:settings.systemPrompt||"",
        temperature:Number(settings.temperature??0.7),
        freeOnly:freeOnlyEl.checked,
        smartFallback:smartFallbackEl.checked,
        webSearch:webSearchEl.checked,
        reasoningEffort:effortSelect.value,
        purpose:purposeSelect.value,
        workspaceMemory,
        projectMemory:getProjectMemoryText(),
        chatSummary:getChatSummary(),
        customPresetPrompt:activeCustomPreset?.prompt || ""
      })
    });

    if(response.status===401){await checkSession(true);throw new Error("Please unlock the app.")}
    if(!response.ok){
      const data=await response.json().catch(()=>({}));
      throw new Error(data.error||`Request failed (${response.status})`);
    }

    streamIsActive=true;
    setAutoFollow(true);
    followLatest(true);

    smoothRenderer=createSmoothTextRenderer(visibleText=>{
      contentEl.innerHTML=renderMarkdown(visibleText);
      bindCodeButtons(contentEl);
      if(!userPausedAutoScroll)followLatest(false);
    });

    await readSSE(response,(event,data)=>{
      if(event==="token"){
        const token=data.text||"";
        text+=token;
        smoothRenderer.push(token);
      }
      if(event==="status")setStatus(data.message||"");
      if(event==="meta"){finalModel=data.model||finalModel;usage=data.usage||usage}
      if(event==="error"){streamError=data.message||"Request failed";setStatus(streamError,true)}
      if(event==="done")setStatus(data.fallbackUsed?"Answered using free fallback":"Complete");
    });

    await smoothRenderer.finish();

    if(streamError && !text)throw new Error(streamError);
    cursor.remove();
    if(!text)text="(No text returned)";
    contentEl.innerHTML=renderMarkdown(text);bindCodeButtons(contentEl);

    const finalMsg={role:"assistant",content:text,model:finalModel||modelSelect.value,usage};
    chat.messages.push(finalMsg);
    addAnswerBadge(box,finalMsg.model,usage);
    addAnswerActions(box,chat.messages.length-1);
    saveAll();renderHistory();loadUsage();

    if(memoryStore.settings?.autoMemory !== false){
      updateMemoryFromCurrentChat(false);
    }

  }catch(err){
    if(smoothRenderer)smoothRenderer.flush();
    cursor.remove();
    if(err.name==="AbortError"){setStatus("Stopped");if(text){chat.messages.push({role:"assistant",content:text,model:finalModel||modelSelect.value,usage});saveAll();}}
    else{setStatus(err.message,true);contentEl.textContent=text||`Error: ${err.message}`;}
    if(!text && usedAttachments.length)attachments=usedAttachments;
  }finally{
    streamIsActive=false;
    updateLatestButton();
    busy=false;sendBtn.disabled=false;stopBtn.classList.add("hidden");abortController=null;promptEl.focus();
    setTimeout(()=>{if(!busy&&!statusBar.classList.contains("error"))setStatus("")},2200);
  }
}

async function regenerate(index){
  const chat=getChat();if(!chat||busy)return;
  let userIndex=index-1;
  while(userIndex>=0&&chat.messages[userIndex].role!=="user")userIndex--;
  if(userIndex<0)return;
  chat.messages=chat.messages.slice(0,userIndex+1);
  saveAll();renderChat();
  await send(userIndex+1);
}



function exportMemoryState(){
  return {
    version: 1,
    memoryStore,
    currentProject,
    customPresets,
    favorites,
    settings,
    routing,
    ui
  };
}

function importMemoryState(state){
  if(!state || typeof state!=="object")return;
  if(state.memoryStore)memoryStore=state.memoryStore;
  if(state.currentProject)currentProject=state.currentProject;
  if(Array.isArray(state.customPresets))customPresets=state.customPresets;
  if(Array.isArray(state.favorites))favorites=state.favorites;
  if(state.settings)settings=state.settings;
  if(state.routing)routing=state.routing;
  if(state.ui)ui=state.ui;

  memoryStore.global ||= [];
  memoryStore.projects ||= {"General":[]};
  ensureProject(currentProject);
  workspaceMemory=memoryLinesToText(memoryStore.global);
  saveAll();
  renderProjects();
  renderCustomPresets();
  if(allModels.length)fillModelSelect();
}

async function checkCloudMemory(){
  try{
    const res=await fetch("/api/cloud/status");
    const data=await res.json();
    cloudMemoryConfigured=!!data.configured;
    $("#cloudMemoryStatus").textContent=cloudMemoryConfigured?"Connected":"Not configured";
    $("#syncMemoryNow").disabled=!cloudMemoryConfigured;
    return cloudMemoryConfigured;
  }catch{
    $("#cloudMemoryStatus").textContent="Unavailable";
    return false;
  }
}

async function cloudLoad(){
  if(!cloudMemoryConfigured)return;
  const res=await fetch("/api/cloud/load");
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||"Cloud load failed");
  if(data.state){
    importMemoryState(data.state);
    setStatus("Cloud memory loaded");
  }
}

async function cloudSave(show=true){
  if(!cloudMemoryConfigured)return;
  const res=await fetch("/api/cloud/save",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({state:exportMemoryState()})
  });
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||"Cloud save failed");
  if(show)setStatus("Memory synced to cloud");
}

async function updateMemoryFromCurrentChat(showStatus=true){
  const chat=getChat();
  if(!chat || chat.messages.length<2) return;

  if(showStatus)setStatus("Updating persistent memory…");

  try{
    const recent=chat.messages.slice(-12).map(m=>({role:m.role,content:m.content}));
    const res=await fetch("/api/memory/extract",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        projectName:currentProject,
        existingGlobal:memoryLinesToText(memoryStore.global||[]),
        existingProject:getProjectMemoryText(),
        messages:recent,
        memoryModel:"openrouter/free"
      })
    });
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Memory update failed");

    memoryStore.global=mergeMemory(memoryStore.global||[],data.global_additions||[]);
    ensureProject(currentProject);
    memoryStore.projects[currentProject]=mergeMemory(memoryStore.projects[currentProject]||[],data.project_additions||[]);

    if(memoryStore.settings?.autoSummarize !== false && data.chat_summary){
      chat.summary=data.chat_summary.trim();
    }

    workspaceMemory=memoryLinesToText(memoryStore.global||[]);
    saveAll();
    if(cloudMemoryConfigured){
      cloudSave(false).catch(()=>{});
    }

    if(showStatus)setStatus("Persistent memory updated");
  }catch(err){
    if(showStatus)setStatus(`Memory update: ${err.message}`,true);
  }
}




function populateBotModels(){
  const sel=$("#botModel");
  sel.innerHTML="";
  sel.appendChild(option("openrouter/free","Free Auto"));
  if(!freeOnlyEl.checked)sel.appendChild(option("smart-auto","Smart Auto"));
  allModels.filter(m=>m.supportsTools).slice(0,180).forEach(m=>{
    if(freeOnlyEl.checked && !m.isFree)return;
    sel.appendChild(option(m.id,cleanText(m.name)+(m.isFree?" · FREE":"")));
  });
}

function formatJobSchedule(job){
  const s=job.schedule||{};
  const hh=String(s.hour??8).padStart(2,"0");
  const mm=String(s.minute??0).padStart(2,"0");
  if(s.frequency==="hourly")return `Hourly at :${mm}`;
  if(s.frequency==="weekly"){
    const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return `Weekly ${days[s.dayOfWeek??1]} ${hh}:${mm}`;
  }
  return `Daily ${hh}:${mm}`;
}

async function loadBots(){
  try{
    const res=await fetch("/api/jobs");
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Could not load bots");
    renderBots(data.jobs||[]);
  }catch(err){
    $("#botsList").innerHTML=`<div class="run-card">Error: ${escapeHTML(err.message)}</div>`;
  }
}

function renderBots(jobs){
  const host=$("#botsList");
  host.innerHTML="";
  if(!jobs.length){
    host.innerHTML='<div class="run-card">No scheduled bots yet.</div>';
    return;
  }
  jobs.forEach(job=>{
    const card=document.createElement("div");
    card.className="bot-card";
    card.innerHTML=`
      <div class="bot-head">
        <div>
          <div class="bot-name">${escapeHTML(job.name)}</div>
          <div class="bot-meta">${escapeHTML(formatJobSchedule(job))} · Next: ${escapeHTML(job.next_run_at||"—")}</div>
        </div>
        <div class="${job.enabled?"bot-enabled":"bot-disabled"}">${job.enabled?"ON":"OFF"}</div>
      </div>
      <div class="bot-goal">${escapeHTML(job.goal)}</div>
      <div class="bot-actions">
        <button data-action="run">Run now</button>
        <button data-action="toggle">${job.enabled?"Disable":"Enable"}</button>
        <button data-action="history">History</button>
        <button data-action="delete">Delete</button>
      </div>`;
    card.querySelector('[data-action="run"]').onclick=()=>runBotNow(job.id);
    card.querySelector('[data-action="toggle"]').onclick=()=>updateBot(job.id,{enabled:!job.enabled});
    card.querySelector('[data-action="history"]').onclick=()=>loadBotRuns(job.id);
    card.querySelector('[data-action="delete"]').onclick=()=>deleteBot(job.id);
    host.appendChild(card);
  });
}

async function createBot(){
  const name=$("#botName").value.trim()||"Scheduled bot";
  const goal=$("#botGoal").value.trim();
  if(!goal){setStatus("Bot goal is required",true);return}
  const [hour,minute]=($("#botTime").value||"08:00").split(":").map(Number);

  const payload={
    name,
    goal,
    agentType:$("#botAgentType").value,
    model:$("#botModel").value||"openrouter/free",
    webSearch:$("#botWeb").checked,
    projectName:currentProject,
    globalMemory:memoryLinesToText(memoryStore.global||[]),
    projectMemory:getProjectMemoryText(),
    enabled:true,
    schedule:{
      frequency:$("#botFrequency").value,
      dayOfWeek:Number($("#botDay").value),
      hour:Number(hour||0),
      minute:Number(minute||0)
    }
  };

  const res=await fetch("/api/jobs/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const data=await res.json();
  if(!res.ok){setStatus(data.error||"Could not create bot",true);return}
  $("#botGoal").value="";
  setStatus("Scheduled bot created");
  await loadBots();
  await loadBotRuns();
}

async function updateBot(id,patch){
  const res=await fetch("/api/jobs/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...patch})});
  const data=await res.json();
  if(!res.ok){setStatus(data.error||"Could not update bot",true);return}
  await loadBots();
}

async function deleteBot(id){
  if(!confirm("Delete this scheduled bot?"))return;
  const res=await fetch("/api/jobs/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
  const data=await res.json();
  if(!res.ok){setStatus(data.error||"Could not delete bot",true);return}
  await loadBots();await loadBotRuns();
}

async function runBotNow(id){
  setStatus("Running bot…");
  const res=await fetch("/api/jobs/run-now",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
  const data=await res.json();
  if(!res.ok){setStatus(data.error||"Bot run failed",true);return}
  setStatus(data.run?.status==="complete"?"Bot run complete":"Bot run finished with an error",data.run?.status!=="complete");
  await loadBots();await loadBotRuns(id);
}

async function loadBotRuns(jobId=null){
  const url=jobId?`/api/jobs/history?job_id=${encodeURIComponent(jobId)}`:"/api/jobs/history";
  try{
    const res=await fetch(url);
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Could not load runs");
    const host=$("#botsRuns");host.innerHTML="";
    if(!(data.runs||[]).length){host.innerHTML='<div class="run-card">No runs yet.</div>';return}
    (data.runs||[]).slice(0,50).forEach(run=>{
      const card=document.createElement("div");card.className="run-card";
      card.innerHTML=`
        <div class="bot-name">${escapeHTML(run.job_name||"Bot run")}</div>
        <div class="run-meta">${escapeHTML(run.created_at||"")} · <span class="run-status ${escapeHTML(run.status||"")}">${escapeHTML(run.status||"")}</span></div>
        <div class="run-output">${escapeHTML(run.output||"")}</div>`;
      host.appendChild(card);
    });
  }catch(err){
    $("#botsRuns").innerHTML=`<div class="run-card">Error: ${escapeHTML(err.message)}</div>`;
  }
}


let currentToolPermissions = {};

async function loadOps(){
  await Promise.all([loadBudgetStatus(),loadPermissions(),loadAudit(),loadDeadLetters()]);
}

async function loadBudgetStatus(){
  try{
    const res=await fetch("/api/budget/status");
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Budget status failed");
    const dailyPct=data.daily_limit>0?Math.min(100,(data.daily/data.daily_limit)*100):0;
    const monthPct=data.monthly_limit>0?Math.min(100,(data.monthly/data.monthly_limit)*100):0;
    $("#budgetSummary").innerHTML=`
      Today: <strong>$${Number(data.daily||0).toFixed(4)}</strong> / $${Number(data.daily_limit||0).toFixed(2)} (${dailyPct.toFixed(0)}%)<br>
      Month: <strong>$${Number(data.monthly||0).toFixed(4)}</strong> / $${Number(data.monthly_limit||0).toFixed(2)} (${monthPct.toFixed(0)}%)<br>
      API rate: ${data.requests_per_minute} requests/minute`;
  }catch(err){$("#budgetSummary").textContent=`Error: ${err.message}`}
}

async function loadPermissions(){
  try{
    const res=await fetch("/api/permissions");
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Could not load permissions");
    currentToolPermissions=data.permissions||{};
    const host=$("#permissionsTable");host.innerHTML="";
    Object.entries(currentToolPermissions).sort(([a],[b])=>a.localeCompare(b)).forEach(([name,mode])=>{
      const row=document.createElement("div");row.className="permission-row";
      row.innerHTML=`<div class="permission-name">${escapeHTML(name)}</div>
        <select data-tool="${escapeHTML(name)}">
          <option value="auto">Auto</option>
          <option value="approve">Ask</option>
          <option value="deny">Deny</option>
        </select>`;
      row.querySelector("select").value=mode;
      host.appendChild(row);
    });
  }catch(err){$("#permissionsTable").textContent=`Error: ${err.message}`}
}

async function savePermissions(){
  const permissions={};
  $$("#permissionsTable select[data-tool]").forEach(sel=>permissions[sel.dataset.tool]=sel.value);
  const res=await fetch("/api/permissions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({permissions})});
  const data=await res.json();
  if(!res.ok){setStatus(data.error||"Could not save permissions",true);return}
  currentToolPermissions=data.permissions||permissions;
  setStatus("Tool permissions saved");
  await loadAudit();
}

async function loadAudit(){
  try{
    const res=await fetch("/api/audit");
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Audit load failed");
    const host=$("#auditList");host.innerHTML="";
    if(!(data.events||[]).length){host.innerHTML='<div class="audit-event">No audit events yet.</div>';return}
    (data.events||[]).slice(0,100).forEach(ev=>{
      const d=document.createElement("div");d.className="audit-event";
      d.innerHTML=`<div class="audit-type">${escapeHTML(ev.type||"event")}</div>
        <div class="audit-time">${escapeHTML(ev.at||"")}</div>
        <div class="audit-data">${escapeHTML(JSON.stringify(ev.data||{},null,2))}</div>`;
      host.appendChild(d);
    });
  }catch(err){$("#auditList").textContent=`Error: ${err.message}`}
}

async function loadDeadLetters(){
  try{
    const res=await fetch("/api/dead-letters");
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Failure queue failed");
    const failures=data.failures||[];
    if(!failures.length){$("#deadLetterSummary").textContent="No dead-letter failures.";return}
    const recent=failures.slice(0,5).map(f=>`${f.job_name||f.job_id}: ${f.error||"failed"}`).join("\n");
    $("#deadLetterSummary").textContent=`${failures.length} retained failure(s)\n${recent}`;
  }catch(err){$("#deadLetterSummary").textContent=`Error: ${err.message}`}
}

async function loadConnectorStatus(){
  try{
    const res=await fetch("/api/connectors/status");
    if(!res.ok)throw new Error("Could not refresh connection status");
    const data=await res.json();

    $("#googleConnectorStatus").textContent = !data.google?.configured
      ? "Not configured — add Google OAuth credentials in Railway Variables"
      : data.google?.connected
        ? "Connected — Gmail + Calendar available to agents"
        : "Configured but not connected";

    $("#connectGoogle").disabled = !data.google?.configured;
    $("#connectGoogle").textContent = data.google?.connected ? "Reconnect Google" : "Connect Google";

    if($("#microsoftConnectorStatus")){
      $("#microsoftConnectorStatus").textContent=!data.microsoft?.configured
        ? "Not configured — add Microsoft OAuth credentials in Railway Variables"
        : data.microsoft?.connected
          ? `Connected — OneDrive + Office${data.microsoft?.outlook_enabled?" + Outlook/Calendar":""}${data.microsoft?.teams_enabled?" + Teams":""}${data.microsoft?.sharepoint_enabled?" + SharePoint":""}`
          : "Configured but not connected";
    }
    if($("#connectMicrosoft")){
      $("#connectMicrosoft").disabled=!data.microsoft?.configured;
      $("#connectMicrosoft").textContent=data.microsoft?.connected?"Reconnect Microsoft":"Connect Microsoft";
    }

    $("#githubConnectorStatus").textContent = data.github?.configured
      ? `Configured${data.github?.repo ? " — "+data.github.repo : ""}`
      : "Not configured";

    $("#nuiteeConnectorStatus").textContent = data.nuitee?.configured
      ? "Configured — live hotel search available"
      : "Not configured";

    $("#slackConnectorStatus").textContent = data.slack?.configured ? "Configured — read + approval-gated send" : "Not configured";
    if($("#telegramConnectorStatus"))$("#telegramConnectorStatus").textContent=data.telegram?.configured?"Configured — send Kairoq messages from Telegram":"Not configured";
    if($("#twilioConnectorStatus"))$("#twilioConnectorStatus").textContent=data.twilio?.configured?`Configured${data.twilio?.whatsapp?" · WhatsApp":""}${data.twilio?.sms?" · SMS":""}`:"Not configured";
    if($("#higgsfieldConnectorStatus"))$("#higgsfieldConnectorStatus").textContent=data.higgsfield?.configured?"Configured — optional premium image/video provider":"Not configured";
    $("#shopifyConnectorStatus").textContent = data.shopify?.configured ? `Configured${data.shopify?.store?" — "+data.shopify.store:""}` : "Not configured";
    if($("#metaAdsConnectorStatus"))$("#metaAdsConnectorStatus").textContent=data.meta_ads?.configured?`Configured — ad account ${data.meta_ads?.account||""}`:"Not configured";
    if($("#googleAdsConnectorStatus"))$("#googleAdsConnectorStatus").textContent=!data.google_ads?.configured?"Not configured":data.google_ads?.connected?`Connected — customer ${data.google_ads?.customer_id||""}`:"Configured — reconnect Google to grant Ads reporting scope";
    $("#browserlessConnectorStatus").textContent = data.browserless?.configured ? "Configured — rendered pages + approval-gated browser agent" : "Not configured";
    $("#notificationsConnectorStatus").textContent = data.notifications?.configured ? "Configured — bot completion/failure delivery enabled" : "Not configured";
    if($("#localAiConnectorStatus"))$("#localAiConnectorStatus").textContent=data.local_ai?.configured
      ? `Configured — ${data.local_ai?.base_url||"local endpoint"} · Zero Cost mode ${data.local_ai?.zero_cost_mode?"ON":"OFF"}`
      : `Not explicitly pinned — Kairoq will auto-detect ${data.local_ai?.base_url||"Ollama"}`;
    $("#encryptionConnectorStatus").textContent = data.encryption?.configured ? "Enabled — persisted OAuth credentials encrypted" : "NOT SET — add APP_ENCRYPTION_KEY before production";

    $("#webhookConnectorStatus").textContent = data.webhook?.configured
      ? "Configured"
      : "Not configured";
  }catch{document.querySelectorAll("#connectorsDialog .connector-row small").forEach(el=>el.textContent="Unable to check status — try Refresh status");}
}




const PRODUCT_MODES = {
  personal: { label:"Personal AI OS", agent:"atlas" },
  travel: { label:"Travellez Mode", agent:"compass" },
  housing: { label:"PlanURstay Mode", agent:"ledger" },
  shopify: { label:"Shopify Store", agent:"closer" },
  sales: { label:"Sales Team", agent:"closer" },
  software: { label:"Software Team", agent:"forge" }
};

const AGENT_TEMPLATES = [
  {
    id:"morning-brief", mode:"personal", agent:"atlas", cadence:"daily",
    title:"Morning Brief",
    desc:"Summarize priority emails, calendar, open workflows, and what needs attention.",
    goal:"Every morning, review recent important context, calendar items, workflow cards, and open tasks. Give me a short briefing with action items and anything needing approval."
  },
  {
    id:"open-loop-sweep", mode:"personal", agent:"atlas", cadence:"daily",
    title:"Outcome Sweep",
    desc:"Find unfinished promises, money, follow-ups, deadlines, and dependencies and keep them alive until completion.",
    goal:"Review recent Gmail, calendar context, existing outcomes, and other available read-only sources. Identify unresolved outcomes worth tracking. Create or update internal outcomes for money owed, promises, deadlines, waiting dependencies, missed follow-ups, expiring credits, or unresolved customer/travel/operational issues. Be conservative and do not create generic tasks."
  },
  {
    id:"inbox-triage", mode:"personal", agent:"relay", cadence:"daily",
    title:"Inbox Triage",
    desc:"Find important emails, group them by urgency, and draft suggested replies.",
    goal:"Review recent Gmail messages. Identify urgent items, business opportunities, payment issues, and messages needing a reply. Draft suggested replies but do not send."
  },
  {
    id:"calendar-prep", mode:"personal", agent:"orbit", cadence:"daily",
    title:"Calendar Prep",
    desc:"Prepare for today's meetings and flag conflicts or missing follow-ups.",
    goal:"Review today's calendar. Summarize each meeting, preparation needed, conflicts, and follow-ups I should send."
  },
  {
    id:"travellez-request", mode:"travel", agent:"compass", cadence:"manual",
    title:"Travel Request Handler",
    desc:"Turn a business travel request into compliant trip options and approval notes.",
    goal:"Handle a business travel request. Check company travel rules from the playbook, search travel/hotel options when tools are available, compare compliant options, and prepare an approval-ready trip brief."
  },
  {
    id:"travellez-disruption", mode:"travel", agent:"beacon", cadence:"hourly",
    title:"Trip Monitor",
    desc:"Watch for travel issues and prepare recovery actions.",
    goal:"Monitor travel-related messages and open trip workflows. Detect itinerary changes, cancellations, hotel issues, or approval blockers. Prepare recovery options and clearly mark anything needing approval."
  },
  {
    id:"housing-market", mode:"housing", agent:"scout", cadence:"weekly",
    title:"Housing Market Brief",
    desc:"Weekly U.S./Canada corporate housing and relocation market brief.",
    goal:"Research consequential developments in U.S. and Canadian corporate and temporary housing for relocation clients. Highlight market shifts, buyer/supplier changes, and what PlanURstay should act on."
  },
  {
    id:"housing-quote", mode:"housing", agent:"ledger", cadence:"manual",
    title:"Housing Quote Builder",
    desc:"Prepare supplier comparison, pricing, margin, and client quote logic.",
    goal:"Prepare a temporary housing quote. Use the playbook to apply pricing rules, compare inventory/supplier assumptions, calculate margin, flag risks, and draft the client-ready quote notes."
  },
  {
    id:"shopify-ops", mode:"shopify", agent:"atlas", cadence:"daily",
    title:"Store Operator",
    desc:"Run the store health check, find issues and growth opportunities, and keep unresolved work alive.",
    goal:"Operate the Shopify store like an owner using read-only tools. Run commerce_funnel_health and shopify_store_health. Review material product, fulfillment, payment, refund, and merchandising issues. If a public storefront URL is available, use storefront_audit. Create or update outcomes for unresolved issues. Create internal store experiments only when there is evidence for a useful test. Do not claim a lift without measured results and do not change the live store."
  },
  {
    id:"sales-followup", mode:"sales", agent:"closer", cadence:"daily",
    title:"Sales Follow-up",
    desc:"Find leads and draft follow-up messages.",
    goal:"Review recent sales-related emails/messages and open opportunities. Identify prospects needing follow-up, draft concise outreach, and mark approval-required sends."
  },
  {
    id:"competitor-research", mode:"sales", agent:"scout", cadence:"weekly",
    title:"Competitor Research",
    desc:"Track competitor moves, pricing, content, and positioning.",
    goal:"Research competitors relevant to the selected business mode. Summarize new positioning, pricing, partnerships, product changes, and recommended actions."
  },
  {
    id:"github-review", mode:"software", agent:"forge", cadence:"manual",
    title:"Code Review",
    desc:"Review repo files, issues, bugs, and implementation plans.",
    goal:"Review the configured GitHub project or supplied code context. Find implementation risks, bugs, missing tests, and propose concrete fixes."
  },
  {
    id:"security-check", mode:"software", agent:"guardian", cadence:"weekly",
    title:"Security Check",
    desc:"Review permissions, audit events, failed jobs, and risky automations.",
    goal:"Review audit log, tool permissions, failed jobs, and connector configuration. Flag security risks and recommend least-privilege changes."
  }
];

function localProductState(){
  try{return JSON.parse(localStorage.getItem("pai_product_state")||"{}")}catch{return {}}
}
function saveLocalProductState(patch){
  const state={...localProductState(),...patch,updated_at:new Date().toISOString()};
  localStorage.setItem("pai_product_state",JSON.stringify(state));
  return state;
}
function playbookToText(pb){
  const s=pb?.sections||{};
  return Object.entries(s).filter(([,v])=>String(v||"").trim()).map(([k,v])=>`${k.replaceAll("_"," ").toUpperCase()}:\n${v}`).join("\n\n");
}
async function loadProductState(){
  let state=localProductState();
  try{
    const res=await fetch("/api/product-state");
    if(res.ok){
      const data=await res.json();
      state={...state,...(data.state||{})};
      localStorage.setItem("pai_product_state",JSON.stringify(state));
    }
  }catch{}
  return state;
}
async function persistProductState(patch){
  const state=saveLocalProductState(patch);
  try{await fetch("/api/product-state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({state})})}catch{}
  return state;
}
function currentVerticalMode(){
  return $("#verticalMode")?.value || localProductState().vertical_mode || "personal";
}
function verticalModeLabel(){
  return PRODUCT_MODES[currentVerticalMode()]?.label || "Personal AI OS";
}

function applyVerticalMode(mode){
  const cfg=PRODUCT_MODES[mode]||PRODUCT_MODES.personal;
  if($("#verticalMode"))$("#verticalMode").value=mode;
  selectedAgentType=cfg.agent||"atlas";
  updateAgentIdentityUI();
  renderTemplates(mode);
  persistProductState({vertical_mode:mode});
}

function applyDemoMode(on){
  document.body.classList.toggle("demo-mode",!!on);
  let banner=$("#demoBanner");
  if(!banner){
    banner=document.createElement("div");
    banner.id="demoBanner";
    banner.className="demo-banner";
    banner.textContent="Demo mode is on: templates use sample data, and workflow examples are safe to show.";
    document.querySelector(".sidebar")?.insertBefore(banner, document.querySelector(".sidebar")?.children?.[2] || null);
  }
  banner.classList.toggle("active",!!on);
  if($("#demoModeToggle"))$("#demoModeToggle").checked=!!on;
  persistProductState({demo_mode:!!on});
}

async function openOnboarding(){
  onboardingStep=1;
  renderOnboardingStep();
  $("#onboardingDialog").showModal();
}
let onboardingStep=1;
function renderOnboardingStep(){
  $$(".onboarding-step").forEach(x=>x.classList.toggle("active",Number(x.dataset.step)===onboardingStep));
  const body=$("#onboardingBody");
  const mode=currentVerticalMode();
  const stepContent={
    1:`<strong>Model key</strong><br>Your OpenRouter key stays server-side in <code>.env</code>. If chat works, this step is done.<br><br><button class="secondary-btn" onclick="loadUsage()">Check usage</button>`,
    2:`<strong>Choose your product mode</strong><br>Current mode: <b>${escapeHTML(verticalModeLabel())}</b>. This changes templates, default agent, and playbook focus.`,
    3:`<strong>Company Playbook</strong><br>Add approval rules, tone, travel policy, suppliers, pricing rules, and things the agents should never do.<br><br><button class="secondary-btn" onclick="openPlaybook()">Open Playbook</button>`,
    4:`<strong>Connect apps</strong><br>Use Connectors for Gmail, Calendar, GitHub, Nuitee, Slack, Shopify, and Browserless. Consequential actions still ask for approval.<br><br><button class="secondary-btn" onclick="loadConnectorStatus();document.querySelector('#connectorsDialog').showModal()">Open Connectors</button>`,
    5:`<strong>Create your first bot</strong><br>Start from a template such as Morning Brief, Inbox Triage, Travel Request Handler, or Housing Market Brief.<br><br><button class="secondary-btn" onclick="openTemplates()">Open Templates</button>`
  };
  body.innerHTML=stepContent[onboardingStep]||"";
  $("#onboardingBack").disabled=onboardingStep===1;
  $("#onboardingNext").textContent=onboardingStep===5?"Finish":"Next";
}
async function nextOnboarding(){
  if(onboardingStep<5){onboardingStep++;renderOnboardingStep();return}
  await persistProductState({onboarding_complete:true});
  $("#onboardingDialog").close();
}
function prevOnboarding(){if(onboardingStep>1){onboardingStep--;renderOnboardingStep()}}

function templateModeList(){
  return ["personal","travel","housing","shopify","sales","software"];
}
function openTemplates(){
  renderTemplateTabs();
  renderTemplates(currentVerticalMode());
  $("#templatesDialog").showModal();
}
function renderTemplateTabs(){
  const host=$("#templateModeTabs"); if(!host)return;
  host.innerHTML="";
  templateModeList().forEach(mode=>{
    const b=document.createElement("button");
    b.className="mode-tab";
    b.textContent=PRODUCT_MODES[mode]?.label||mode;
    b.onclick=()=>{applyVerticalMode(mode);renderTemplateTabs();renderTemplates(mode)};
    b.classList.toggle("active",mode===currentVerticalMode());
    host.appendChild(b);
  });
}
function renderTemplates(mode=currentVerticalMode()){
  const host=$("#templateGrid"); if(!host)return;
  host.innerHTML="";
  const list=AGENT_TEMPLATES.filter(t=>t.mode===mode || t.mode==="personal");
  list.forEach(t=>{
    const c=AGENT_COLORS[t.agent]||AGENT_COLORS.atlas;
    const meta=AGENT_TEAM[t.agent]||AGENT_TEAM.atlas;
    const card=document.createElement("div");
    card.className="template-card";
    card.style.setProperty("--agent-color",c.color);
    card.style.setProperty("--agent-accent",c.accent);
    card.innerHTML=`
      <div class="template-head">
        <div class="template-avatar"><img src="/assets/mascot-ghost.png" alt=""></div>
        <div>
          <div class="template-title">${escapeHTML(t.title)}</div>
          <div class="template-meta">${meta.glyph} ${meta.name} · ${escapeHTML(t.cadence)}</div>
        </div>
      </div>
      <div class="template-desc">${escapeHTML(t.desc)}</div>
      <div class="template-actions">
        <button data-action="chat">Use in chat</button>
        <button data-action="bot" class="primary-mini">Create bot</button>
      </div>`;
    card.querySelector('[data-action="chat"]').onclick=()=>useTemplateInChat(t);
    card.querySelector('[data-action="bot"]').onclick=()=>createBotFromTemplate(t);
    host.appendChild(card);
  });
}
function demoSuffix(){
  if(!($("#demoModeToggle")?.checked))return "";
  return `\n\nUse demo-safe assumptions and sample data where live connectors are unavailable. Do not claim real account access unless tools confirm it.`;
}
function useTemplateInChat(t){
  selectedAgentType=t.agent;
  updateAgentIdentityUI();
  $("#prompt").value=t.goal + demoSuffix();
  $("#templatesDialog").close();
  setStatus(`${t.title} loaded into chat`);
}
async function createBotFromTemplate(t){
  const [hour,minute]= t.cadence==="hourly" ? [0,0] : [8,0];
  const payload={
    name:t.title,
    goal:t.goal+demoSuffix(),
    agentType:t.agent,
    model:$("#botModel")?.value||"openrouter/free",
    webSearch:true,
    projectName:currentProject,
    globalMemory:memoryLinesToText(memoryStore.global||[]),
    projectMemory:getProjectMemoryText(),
    companyPlaybook: await getCompanyPlaybookText(),
    enabled:true,
    schedule:{frequency:t.cadence==="weekly"?"weekly":t.cadence==="hourly"?"hourly":"daily",dayOfWeek:1,hour,minute},
    retry:{maxAttempts:3}
  };
  const res=await fetch("/api/jobs/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){setStatus(data.error||"Could not create bot",true);return}
  $("#templatesDialog").close();
  setStatus(`${t.title} bot created`);
  addLocalWorkflowCard({title:`Bot created: ${t.title}`,body:t.goal,agent:t.agent,status:"open",type:"template"});
  await loadBots?.();
}

async function loadPlaybook(){
  let pb=null;
  try{
    const res=await fetch("/api/playbook");
    if(res.ok){pb=(await res.json()).playbook}
  }catch{}
  if(!pb){
    try{pb=JSON.parse(localStorage.getItem("pai_company_playbook")||"null")}catch{}
  }
  pb ||= {sections:{}};
  return pb;
}
async function savePlaybookFromForm(){
  const sections={};
  ["company_overview","tone_of_voice","approval_rules","travel_policy","housing_policy","suppliers","pricing_rules","escalation_rules","never_do"].forEach(k=>{
    sections[k]=$(`#pb_${k}`)?.value||"";
  });
  const playbook={vertical_mode:currentVerticalMode(),sections,updated_at:new Date().toISOString()};
  localStorage.setItem("pai_company_playbook",JSON.stringify(playbook));
  const res=await fetch("/api/playbook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({playbook})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){setStatus(data.error||"Could not save playbook",true);return}
  setStatus("Company Playbook saved");
  addLocalWorkflowCard({title:"Company Playbook updated",body:"Agents will include the latest operating rules as context.",agent:"vault",status:"complete",type:"playbook"});
}
async function openPlaybook(){
  const pb=await loadPlaybook();
  const s=pb.sections||{};
  Object.keys(s).forEach(k=>{const el=$(`#pb_${k}`); if(el)el.value=s[k]||""});
  $("#playbookDialog").showModal();
}
async function getCompanyPlaybookText(){
  const pb=await loadPlaybook();
  return playbookToText(pb);
}

async function addServerWorkflowCard(card){
  try{await fetch("/api/workflows/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({card})})}catch{}
}
function addLocalWorkflowCard(card){
  const state=localProductState();
  const next={id:crypto.randomUUID?.()||String(Date.now()),created_at:new Date().toISOString(),...card};
  state.workflow_cards=[next,...(state.workflow_cards||[])].slice(0,100);
  localStorage.setItem("pai_product_state",JSON.stringify(state));
  addServerWorkflowCard(next);
  renderWorkflowCards(state.workflow_cards);
  return next;
}
async function loadWorkflowCards(){
  let state=localProductState();
  try{
    const res=await fetch("/api/product-state");
    if(res.ok){
      const data=await res.json();
      state={...state,...(data.state||{})};
      localStorage.setItem("pai_product_state",JSON.stringify(state));
    }
  }catch{}
  renderWorkflowCards(state.workflow_cards||[]);
}
function renderWorkflowCards(cards=[]){
  const host=$("#workflowCards"); if(!host)return;
  host.innerHTML="";
  if(!cards.length){host.innerHTML='<div class="workflow-card"><div class="workflow-card-title">No workflow cards yet</div><div class="workflow-card-body">Run an agent, create a bot, or load demo cards.</div></div>';return}
  cards.forEach(card=>{
    const colors=AGENT_COLORS[card.agent]||AGENT_COLORS.atlas;
    const meta=AGENT_TEAM[card.agent]||AGENT_TEAM.atlas;
    const el=document.createElement("div");
    el.className="workflow-card";
    el.style.setProperty("--agent-color",colors.color);
    el.innerHTML=`
      <div class="workflow-card-title">${escapeHTML(card.title||"Workflow")}</div>
      <div class="workflow-card-meta">${meta.glyph} ${meta.name} · ${escapeHTML(card.type||"workflow")} · ${escapeHTML(card.created_at||"")}</div>
      <div class="workflow-card-body">${escapeHTML(card.body||"")}</div>
      <span class="workflow-card-status">${escapeHTML(card.status||"open")}</span>`;
    host.appendChild(el);
  });
}
function seedDemoWorkflowCards(){
  const mode=currentVerticalMode();
  const demo=[
    {title:"Email found → Draft reply",body:"Relay found a client email asking for updated pricing. Draft reply is ready and needs approval before sending.",agent:"relay",status:"approval needed",type:"demo"},
    {title:"Travel request → Options",body:"Compass prepared 3 hotel options near the meeting location, with policy notes and estimated savings.",agent:"compass",status:"ready",type:"demo"},
    {title:"Market change → Action item",body:"Scout detected a competitor pricing change. Ledger should review margin impact.",agent:"scout",status:"open",type:"demo"},
    {title:"Bot completed → Brief",body:"Beacon completed the morning brief and found 4 items needing attention.",agent:"beacon",status:"complete",type:"demo"}
  ];
  const state=localProductState();
  state.workflow_cards=[...demo.map(x=>({id:crypto.randomUUID?.()||String(Math.random()),created_at:new Date().toISOString(),...x})),...(state.workflow_cards||[])].slice(0,100);
  localStorage.setItem("pai_product_state",JSON.stringify(state));
  persistProductState(state);
  renderWorkflowCards(state.workflow_cards);
  if(mainView==="command") refreshCommandCenter();
}
async function clearWorkflowCards(){
  const state=localProductState(); state.workflow_cards=[];
  localStorage.setItem("pai_product_state",JSON.stringify(state));
  try{await fetch("/api/workflows/clear",{method:"POST"})}catch{}
  renderWorkflowCards([]);
  if(mainView==="command") refreshCommandCenter();
}

async function initializeProductLayer(){
  const state=await loadProductState();
  if($("#verticalMode")){
    $("#verticalMode").value=state.vertical_mode||state.vertical_mode==="personal" ? state.vertical_mode : "personal";
    $("#verticalMode").onchange=()=>applyVerticalMode($("#verticalMode").value);
  }
  applyDemoMode(!!state.demo_mode);
  if($("#demoModeToggle"))$("#demoModeToggle").onchange=()=>applyDemoMode($("#demoModeToggle").checked);
  if(!state.onboarding_complete && !localStorage.getItem("pai_onboarding_seen")){
    localStorage.setItem("pai_onboarding_seen","1");
    setTimeout(openOnboarding,650);
  }
}


function setMascotAgent(agentId=selectedAgentType){
  const meta=AGENT_TEAM[agentId] || AGENT_TEAM.atlas;
  const colors=AGENT_COLORS[agentId] || AGENT_COLORS.atlas;
  document.documentElement.style.setProperty("--agent-color", colors.color);
  document.documentElement.style.setProperty("--agent-accent", colors.accent);

  ["#agentMascotHero","#composerMascot","#approvalMascot"].forEach(sel=>{
    const el=$(sel);
    if(el){
      el.dataset.agent=agentId;
      el.style.setProperty("--agent-color", colors.color);
      el.style.setProperty("--agent-accent", colors.accent);
      if(el.title!==undefined)el.title=meta.name;
    }
  });

  if($("#agentQuickBtn")){
    $("#agentQuickBtn").style.setProperty("--agent-color", colors.color);
    $("#agentQuickBtn").style.setProperty("--agent-accent", colors.accent);
  }
}

function setMascotState(state="idle"){
  ["#agentMascotHero","#composerMascot"].forEach(sel=>{
    const el=$(sel);
    if(el)el.dataset.state=state;
  });
}

function setApprovalMascotState(state="waiting"){
  const el=$("#approvalMascot");
  if(el)el.dataset.state=state;
}

function activeAgentMeta(){
  return AGENT_TEAM[selectedAgentType] || AGENT_TEAM.atlas;
}
function updateAgentIdentityUI(){
  const meta=activeAgentMeta();
  const colors=AGENT_COLORS[selectedAgentType] || AGENT_COLORS.atlas;
  setMascotAgent(selectedAgentType);
  if($("#agentQuickGlyph"))$("#agentQuickGlyph").textContent=meta.glyph;
  if($("#agentQuickName"))$("#agentQuickName").textContent=meta.name;
  if($("#runAgent"))$("#runAgent").textContent=`Run ${meta.glyph} ${meta.name}`;
  $$(".agent-type").forEach(x=>{
    const c=AGENT_COLORS[x.dataset.agent] || AGENT_COLORS.atlas;
    x.style.setProperty("--agent-color", c.color);
    x.style.setProperty("--agent-accent", c.accent);
    x.classList.toggle("active",x.dataset.agent===selectedAgentType);
  });
}
function agentLabel(id){
  const meta=AGENT_TEAM[id]||AGENT_TEAM.atlas;
  return `${meta.glyph} ${meta.name}`;
}

function populateAgentModels(){
  const sel=$("#agentModel");
  sel.innerHTML="";
  sel.appendChild(option("openrouter/free","Free Auto"));
  sel.appendChild(option("smart-auto","Smart Auto"));
  const preferred=allModels
    .filter(m=>m.supportsTools)
    .slice(0,180);
  preferred.forEach(m=>sel.appendChild(option(m.id,cleanText(m.name)+(m.isFree?" · FREE":""))));
  sel.value=freeOnlyEl.checked?"openrouter/free":"smart-auto";
}


function approvalToolLabel(tool=""){
  return ({gmail_send:"Send email",calendar_create:"Create calendar event",slack_send:"Send Slack message",message_send:"Send message",browser_agent_task:"Operate browser",github_create_issue:"Create GitHub issue",write_workspace_file:"Write file",send_webhook:"Send webhook"})[tool] || tool.replaceAll("_"," ");
}
function showApprovalCard(data){
  currentApproval=data;
  const meta=activeAgentMeta();
  $("#approvalCard").classList.remove("hidden");
  $("#approvalTitle").textContent=`${meta.glyph} ${meta.name} needs your approval`;
  $("#approvalTool").innerHTML=`<strong>${escapeHTML(approvalToolLabel(data.tool||"action"))}</strong><small>Kairoq will only continue if you approve this action.</small>`;
  $("#approvalArgs").textContent=JSON.stringify(data.args||{},null,2);
  setMascotState("waiting");
  addLocalWorkflowCard({title:`Approval: ${approvalToolLabel(data.tool||"action")}`,body:JSON.stringify(data.args||{}),agent:selectedAgentType,status:"approval needed",type:"approval"});
}

async function resolveApproval(approved){
  if(!currentApproval)return;
  const id=currentApproval.id;
  $("#approvalCard").classList.add("hidden");
  setMascotState(approved ? "working" : "idle");
  currentApproval=null;

  try{
    const res=await fetch("/api/agent/approve",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        id,
        approved,
        reason:approved?"Approved by user":"Denied by user"
      })
    });
    if(!res.ok){
      const data=await res.json().catch(()=>({}));
      throw new Error(data.error||"Could not resolve approval");
    }
  }catch(err){
    $("#agentStatus").textContent=`Approval error: ${err.message}`;
  }
}

async function runAgent(){
  const goal=$("#agentGoal").value.trim();
  if(!goal)return;

  $("#agentRun").classList.remove("hidden");
  updateAgentIdentityUI();
  setMascotState("thinking");
  $("#agentStatus").textContent="Starting…";
  $("#agentPlan").textContent="";
  $("#agentStepsOut").innerHTML="";
  $("#agentFinal").textContent="";
  $("#approvalCard").classList.add("hidden");
  currentApproval=null;
  $("#runAgent").disabled=true;

  try{
    const model=$("#agentModel").value;
    if(freeOnlyEl.checked && model==="smart-auto"){
      throw new Error("Smart Auto may use paid models. Choose Free Auto or turn Free Only off.");
    }

    const res=await fetch("/api/agent/run",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        goal,
        agentType:selectedAgentType,
        model,
        maxSteps:Number($("#agentSteps").value),
        webSearch:$("#agentWeb").checked,
        projectName:currentProject,
        globalMemory:memoryLinesToText(memoryStore.global||[]),
        projectMemory:getProjectMemoryText()
      })
    });

    if(!res.ok){
      const data=await res.json().catch(()=>({}));
      throw new Error(data.error||`Agent failed (${res.status})`);
    }

    await readSSE(res,(event,data)=>{
      if(event==="agent_status"){const m=activeAgentMeta();$("#agentStatus").textContent=`${m.glyph} ${m.name} · ${data.message||""}`; const msg=(data.message||"").toLowerCase(); if(msg.includes("plan"))setMascotState("thinking"); else if(msg.includes("approval"))setMascotState("waiting"); else setMascotState("working");}
      if(event==="approval_required"){showApprovalCard(data);$("#agentStatus").textContent=`Waiting for approval · ${approvalToolLabel(data.tool||"")}`;}
      if(event==="tool_requested"){
        const d=document.createElement("div");d.className="agent-step tool-step running";d.innerHTML=`<strong>Working</strong><span>${escapeHTML(approvalToolLabel(data.tool||"tool"))}</span>`;$("#agentStepsOut").appendChild(d);
      }
      if(event==="tool_result"){
        const d=document.createElement("div");d.className=`agent-step tool-step ${data.result?.ok===false?"failed":"done"}`;d.innerHTML=`<strong>${data.result?.ok===false?"Needs attention":"Done"}</strong><span>${escapeHTML(approvalToolLabel(data.tool||"tool"))}</span>`;$("#agentStepsOut").appendChild(d);
      }
      if(event==="agent_plan")$("#agentPlan").textContent=data.text||"";
      if(event==="agent_step"){
        const d=document.createElement("div");
        d.className="agent-step";
        d.textContent=`Step ${data.step}\\n${data.text||""}`;
        $("#agentStepsOut").appendChild(d);
      }
      if(event==="agent_final"){
        const m=activeAgentMeta();
        setMascotState("talking");
        $("#agentFinal").dataset.agent=`${m.glyph} ${m.name}`;
        $("#agentFinal").style.setProperty("--agent-accent",(AGENT_COLORS[selectedAgentType]||AGENT_COLORS.atlas).accent);
        $("#agentFinal").textContent=data.text||"";
        addLocalWorkflowCard({title:`${m.name} completed`,body:data.text||"",agent:selectedAgentType,status:"complete",type:"agent"});
      }
      if(event==="error")throw new Error(data.message||"Agent failed");
    });

    $("#agentStatus").textContent="Complete";
    setMascotState("success");
    setTimeout(()=>setMascotState("idle"),1200);
  }catch(err){
    setMascotState("error");
    $("#agentStatus").textContent=`Error: ${err.message}`;
  }finally{
    $("#runAgent").disabled=false;
  }
}

async function loadModels(){
  setStatus("Loading model catalog…");
  try{
    const res=await fetch("/api/models");
    if(res.status===401){await checkSession(true);return}
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Could not load models");
    allModels=data.models||[];
    fillModelSelect();
    populateAgentModels();
    populateBotModels();
    setStatus(`${allModels.filter(m=>m.local).length} local · ${allModels.filter(m=>m.isFree&&!m.local).length} cloud-free models available`);
  }catch(err){setStatus(err.message,true)}
  setTimeout(()=>{if(!busy&&!statusBar.classList.contains("error"))setStatus("")},1800);
}

async function loadUsage(){
  try{
    const res=await fetch("/api/usage");if(!res.ok)return;
    const data=await res.json();
    if(data.zero_cost){
      $("#usageMini").textContent=data.local?.configured?"AI: Local · $0":"AI: Free fallback · $0";
      return;
    }
    const d=data?.data||data;
    const usage=d?.usage ?? d?.usage_daily ?? null;
    const limit=d?.limit ?? null;
    $("#usageMini").textContent = usage!==null ? `Usage: ${money(usage)}${limit!==null?` / ${money(limit)}`:""}` : "Usage: available in OpenRouter";
  }catch{}
}

async function checkSession(force=false){
  try{
    const res=await fetch("/api/session");const data=await res.json();
    const overlay=$("#loginOverlay");
    overlay.classList.toggle("hidden",!data.authRequired||data.authenticated);
    if((!data.authRequired||data.authenticated)&&force){loadModels();loadUsage()}
    return data.authenticated||!data.authRequired;
  }catch{return true}
}

$("#loginForm").onsubmit=async e=>{
  e.preventDefault();
  const res=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:$("#loginPassword").value})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){$("#loginError").textContent=data.error||"Could not unlock";return}
  $("#loginOverlay").classList.add("hidden");$("#loginPassword").value="";$("#loginError").textContent="";loadModels();loadUsage();
};

$("#commandCenterBtn").onclick=()=>setMainView("command");
$("#outcomesNavBtn").onclick=()=>{
  setMainView("command");
  requestAnimationFrame(()=>$("#openLoopsList")?.closest(".open-loops-panel")?.scrollIntoView({behavior:"smooth",block:"start"}));
};
$("#historyNavBtn").onclick=()=>{
  setMainView("chat");
  document.body.classList.add("history-focus");
  requestAnimationFrame(()=>historyList?.scrollIntoView({behavior:"smooth",block:"start"}));
};
$("#chatViewBtn").onclick=()=>setMainView("chat");
$("#studioNavBtn")?.addEventListener("click",()=>setMainView("studio"));
$("#studioSideBtn")?.addEventListener("click",()=>setMainView("studio"));
$("#newChat").onclick=()=>{document.body.classList.remove("history-focus");newChat();setMainView("chat")};

$("#ccRefresh").onclick=refreshCommandCenter;
$("#finishItBtn").onclick=scanCurrentChatForLoops;
$("#scanLoopsBtn").onclick=scanCurrentChatForLoops;
$("#addLoopBtn").onclick=addOpenLoopManually;
$("#storeAnalyzeBtn").onclick=async()=>{ setStatus("Checking Shopify store health…"); await refreshStoreHealth(); setStatus("Store health updated."); };
$("#storeImproveBtn").onclick=askAtlasStoreGrowth;
$("#growthRefreshBtn").onclick=async()=>{setStatus("Refreshing commerce funnel…");await refreshCommerceFunnel();setStatus("Growth intelligence updated.");};
$("#workProductsRefreshBtn")?.addEventListener("click",async()=>{await refreshWorkProducts();setStatus("Work files updated.");});
$("#ccOpenWorkflows").onclick=()=>$("#workflowsBtn")?.click();
$("#ccPriorityOpen").onclick=()=>$("#workflowsBtn")?.click();
$("#ccTeamOpen").onclick=()=>$("#agentBtn")?.click();
if($("#atlasOpenConnectors"))$("#atlasOpenConnectors").onclick=()=>$("#connectorsBtn")?.click();
$$("[data-cc-open]").forEach(btn=>btn.onclick=()=>{
  const target=btn.dataset.ccOpen;
  if(target==="workflows")$("#workflowsBtn")?.click();
  if(target==="bots")$("#botsBtn")?.click();
  if(target==="connectors")$("#connectorsBtn")?.click();
});
$$(".cc-quick").forEach(btn=>btn.onclick=()=>useCommandPrompt(btn));
$("#clearChats").onclick=()=>{if(confirm("Delete all local chats?")){chats=[];currentChatId=null;newChat()}};
$("#attachBtn").onclick=()=>$("#fileInput").click();
$("#imageModeBtn").onclick=()=>setImageMode(!imageMode);
$("#videoModeBtn").onclick=()=>setVideoMode(!videoMode);
$("#fileInput").onchange=e=>{handleFiles(e.target.files);e.target.value=""};
$("#sendBtn").onclick=()=>send();
$("#stopBtn").onclick=()=>abortController?.abort();
promptEl.addEventListener("input",resizePrompt);
promptEl.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});

freeOnlyEl.checked=routing.freeOnly!==false;
smartFallbackEl.checked=routing.smartFallback!==false;
webSearchEl.checked=routing.webSearch===true;
effortSelect.value=ui.effort||"low";
purposeSelect.value=ui.purpose||"general";

function updateRouting(){
  routing={freeOnly:freeOnlyEl.checked,smartFallback:smartFallbackEl.checked,webSearch:webSearchEl.checked};
  freePill.textContent=routing.freeOnly?"FREE ONLY":"PAID ALLOWED";
  freePill.classList.toggle("off",!routing.freeOnly);
  saveAll();
}
freeOnlyEl.onchange=()=>{updateRouting();if(freeOnlyEl.checked&&!modelInfo(modelSelect.value).isFree&&modelSelect.value!=="openrouter/free"){modelSelect.value="openrouter/free";updateModelUI();setStatus("Paid model blocked — switched to Free Auto")}else setStatus(freeOnlyEl.checked?"Paid models blocked":"Paid models allowed")};
smartFallbackEl.onchange=updateRouting;
webSearchEl.onchange=()=>{updateRouting();setStatus(webSearchEl.checked?"Web search enabled — may incur tool charges":"Web search off")};
effortSelect.onchange=()=>{ui.effort=effortSelect.value;saveAll()};
purposeSelect.onchange=()=>{ui.purpose=purposeSelect.value;saveAll()};
$("#shellModeBtn").onclick=()=>{simpleMode=!simpleMode;localStorage.setItem("pai-simple-mode", JSON.stringify(simpleMode));applyShellMode()};
const spendModeSelect2=$("#spendModeSelect");
if(spendModeSelect2) spendModeSelect2.onchange=()=>{spendMode=spendModeSelect2.value;localStorage.setItem("pai-spend-mode", spendMode);updateSpendModeUI()};
$$(".atlas-chip").forEach(btn=>btn.onclick=()=>useCommandPrompt(btn));
modelSelect.onchange=updateModelUI;

$$(".preset").forEach(b=>b.onclick=()=>applyPreset(b.dataset.preset));

$("#favoriteBtn").onclick=()=>{
  const id=modelSelect.value;if(id==="openrouter/free")return;
  favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];
  saveAll();fillModelSelect();
};

$("#settingsBtn").onclick=()=>{
  $("#systemPrompt").value=settings.systemPrompt||"";
  $("#temperature").value=String(settings.temperature??0.7);
  $("#temperatureValue").textContent=$("#temperature").value;
  if($("#responsePace"))$("#responsePace").value=currentResponsePace();
  $("#settingsDialog").showModal();
};
$("#temperature").oninput=e=>$("#temperatureValue").textContent=e.target.value;
$("#saveSettings").onclick=()=>{settings={systemPrompt:$("#systemPrompt").value,temperature:Number($("#temperature").value),responsePace:$("#responsePace")?.value||"natural"};saveAll()};

$("#modelSearchBtn").onclick=()=>{$("#modelDialog").showModal();$("#modelSearch").value="";currentModelFilter="all";$$(".filter-chip").forEach(b=>b.classList.toggle("active",b.dataset.filter==="all"));renderModelResults();setTimeout(()=>$("#modelSearch").focus(),20)};
$("#closeModelDialog").onclick=()=>$("#modelDialog").close();
$("#modelSearch").oninput=renderModelResults;
$$(".filter-chip").forEach(b=>b.onclick=()=>{currentModelFilter=b.dataset.filter;$$(".filter-chip").forEach(x=>x.classList.toggle("active",x===b));renderModelResults()});

updateRouting();
if(!currentChatId&&chats.length)currentChatId=chats[0].id;
if(!getChat())newChat();else{renderHistory();renderChat()}
setMainView(["chat","studio"].includes(mainView) ? mainView : "command");
applyPreset(ui.preset||"quick");
checkSession().then(async ok=>{
  if(ok){
    await checkCloudMemory();
    if(cloudMemoryConfigured){
      try{await cloudLoad()}catch(err){setStatus(err.message,true)}
    }
    loadModels();
    loadUsage();
    loadConnectorStatus();
    refreshCommandCenter();
  }
});


// v12.4 premium UI safety: reset dialog scroll on open and prevent stale horizontal scroll.
function resetDialogScroll(dialog){
  if(!dialog)return;
  requestAnimationFrame(()=>{
    dialog.scrollLeft=0;
    const card=dialog.querySelector(".model-dialog-card,.settings-card");
    if(card){card.scrollTop=0;card.scrollLeft=0;}
  });
}
["agentDialog","opsDialog","templatesDialog","playbookDialog","workflowsDialog","onboardingDialog","connectorsDialog","modelDialog","settingsDialog","memoryDialog","presetDialog","compareDialog","botsDialog"].forEach(id=>{
  const d=document.getElementById(id);
  if(d){
    const originalShow=d.showModal?.bind(d);
    if(originalShow && !d.__premiumPatched){
      d.showModal=()=>{originalShow();resetDialogScroll(d);};
      d.__premiumPatched=true;
    }
  }
});


// v13.8 — calm chat scrolling.
// Follow the live answer only while the reader remains near the bottom.
// If the reader scrolls upward, streaming never drags the page back down.
function getMessageScroller(){
  return document.querySelector("#messages,.messages,.chat-messages,.thread,.conversation");
}

let autoScrollEnabled = true;

function stickChatToBottom(force=false){
  const scroller=getMessageScroller();
  if(!scroller)return;
  if(force || (!userPausedAutoScroll && isMessagesNearBottom(220))){
    scroller.scrollTop=scroller.scrollHeight;
  }
  updateLatestButton();
}

function installStickyChatObserver(){
  const scroller=getMessageScroller();
  if(!scroller || scroller.__stickyInstalled)return;
  scroller.__stickyInstalled=true;

  scroller.addEventListener("wheel",e=>{
    if(e.deltaY<0)setAutoFollow(false);
  },{passive:true});

  scroller.addEventListener("touchmove",()=>{
    if(!isMessagesNearBottom(120))setAutoFollow(false);
  },{passive:true});

  scroller.addEventListener("scroll",()=>{
    if(isMessagesNearBottom(120)){
      setAutoFollow(true);
    }else{
      setAutoFollow(false);
    }
  },{passive:true});

  $("#jumpLatestBtn")?.addEventListener("click",()=>{
    setAutoFollow(true);
    scroller.scrollTo({top:scroller.scrollHeight,behavior:"smooth"});
  });

  window.addEventListener("resize",()=>stickChatToBottom(false));
  stickChatToBottom(true);
}

requestAnimationFrame(installStickyChatObserver);
setTimeout(installStickyChatObserver,500);


// v12.8 — show which media backend is currently available.
async function refreshMediaStatus(){
  try{
    const res=await fetch("/api/media/status");
    if(!res.ok)return;
    const data=await res.json();
    const imageProviders=data?.image?.providers||{};
    const videoProviders=data?.video?.providers||{};
    const imageBackend=imageProviders.selfhost?.configured
      ? `Qwen self-hosted (${imageProviders.selfhost.model})`
      : imageProviders.higgsfield?.configured
        ? `Higgsfield (${imageProviders.higgsfield.model})`
      : imageProviders.openrouter?.configured
        ? `OpenRouter (${imageProviders.openrouter.model})`
        : imageProviders.pollinations?.configured
          ? `Pollinations (${imageProviders.pollinations.model})`
          : imageProviders.fal?.configured
            ? `fal.ai (${imageProviders.fal.model})`
            : "No image provider";

    const videoBackend=videoProviders.selfhost?.configured
      ? `Wan self-hosted (${videoProviders.selfhost.model})`
      : videoProviders.higgsfield?.configured
        ? `Higgsfield (${videoProviders.higgsfield.model})`
      : videoProviders.pollinations?.configured
        ? `Pollinations (${videoProviders.pollinations.model})`
        : "No video provider";

    if($("#imageModeBtn"))$("#imageModeBtn").title=`Generate/edit image · ${imageBackend}`;
    if($("#videoModeBtn"))$("#videoModeBtn").title=`Generate/animate video · ${videoBackend}`;
  }catch{}
}
setTimeout(refreshMediaStatus,700);


// ---- Studio V1 ----
let studioState={avatars:[],projects:[],library:[],history:[],listings:[],pursuits:[],pursuitSummary:{},arrivalbriefs:[],arrivalStatus:{},tours:[],tourRooms:[],agents:{sales:{settings:{},leads:[],summary:{}},marketing:{settings:{},items:[],integrations:[]}},status:null,tab:'salesAgent'};
let tourDraftId='';
let tourDraftPhotos=[];
let listingDraftId='';
let listingDraftImages=[];
let arrivalDraftId='';
let arrivalDraftPhotos=[];
let studioDraftAvatarImage="";
let studioReferenceDataUrl="";
let avatarReferenceDataUrl="";
let ugcProductDataUrl="";

async function fileToDataUrl(file){
  if(!file)return "";
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=reject;r.readAsDataURL(file);});
}
async function localUrlToDataUrl(url){
  if(!url)return "";
  if(/^data:/i.test(url))return url;
  try{
    const res=await fetch(url);
    const blob=await res.blob();
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=reject;r.readAsDataURL(blob);});
  }catch{return ""}
}
function formatMoney(v){return `$${Number(v||0).toFixed(2)}`}
function studioTabEl(id){return document.getElementById(`studio${id[0].toUpperCase()+id.slice(1)}Tab`)}
function switchStudioTab(tab='salesAgent'){
  studioState.tab=tab;
  $$('.studio-tab').forEach(btn=>btn.classList.toggle('active', btn.dataset.studioTab===tab));
  ['salesAgent','marketingAgent','create','listings','pursuit','arrival','tours','avatars','ugc','projects','library'].forEach(id=>studioTabEl(id)?.classList.toggle('hidden', id!==tab));
}
async function studioFetchJson(url, options={}){
  const res=await fetch(url, options);
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
async function refreshStudio(){
  try{
    const [status, avatars, projects, library, history, listings, pursuit, arrival, tours, agents] = await Promise.all([
      studioFetchJson('/api/studio/status'),
      studioFetchJson('/api/studio/avatars'),
      studioFetchJson('/api/studio/projects'),
      studioFetchJson('/api/studio/library'),
      studioFetchJson('/api/studio/history'),
      studioFetchJson('/api/listings'),
      studioFetchJson('/api/pursuit'),
      studioFetchJson('/api/arrivalbrief'),
      studioFetchJson('/api/tours'),
      studioFetchJson('/api/agents/status')
    ]);
    studioState.status=status; studioState.avatars=avatars.avatars||[]; studioState.projects=projects.projects||[]; studioState.library=library.items||[]; studioState.history=history.history||[]; studioState.listings=listings.listings||[]; studioState.pursuits=pursuit.pursuits||[]; studioState.pursuitSummary=pursuit.summary||{}; studioState.arrivalbriefs=arrival.arrivalbriefs||[]; studioState.arrivalStatus={higgsfield_configured:!!arrival.higgsfield_configured}; studioState.tours=tours.tours||[]; studioState.tourRooms=tours.rooms||[]; studioState.tourPremium=tours.premium||{}; studioState.agents=agents||studioState.agents;
    renderStudioCounts(); renderStudioSelects(); renderAvatarList(); renderProjectList(); renderLibraryList(); renderStudioHistory(); renderListingList(); renderPursuitList(); renderArrivalList(); renderTourList(); renderTourPremiumStatus(); renderSalesAgent(); renderMarketingAgent();
    updateStudioEstimate();
  }catch(err){ console.warn(err); }
}
window.refreshStudio=refreshStudio;

function salesSettingsPayload(){return{knowledge:$('#salesKnowledge')?.value||'',goal:$('#salesGoal')?.value||'',icp:$('#salesIcp')?.value||'',geography:$('#salesGeography')?.value||'',offer:$('#salesOffer')?.value||'',sender_name:$('#salesSenderName')?.value||''}}
function applySalesSettings(){const s=studioState.agents?.sales?.settings||{};const set=(id,v)=>{const el=$('#'+id);if(el&&document.activeElement!==el)el.value=v||''};set('salesKnowledge',s.knowledge);set('salesGoal',s.goal);set('salesIcp',s.icp);set('salesGeography',s.geography);set('salesOffer',s.offer);set('salesSenderName',s.sender_name)}
async function saveSalesSettings(){return studioFetchJson('/api/agents/sales/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(salesSettingsPayload())})}
function renderSalesAgent(){const data=studioState.agents?.sales||{},sum=data.summary||{},leads=data.leads||[];applySalesSettings();renderCampaignStrategy("sales",data.strategy);const sources=data.settings?.website_knowledge?.sources||[];if($("#businessKnowledgeStatus"))$("#businessKnowledgeStatus").textContent=sources.length?`${sources.length} website pages saved · ${new Date(data.settings.website_knowledge.updated_at).toLocaleDateString()}`:"Read your website to add source-backed knowledge.";if($('#salesAgentMeta'))$('#salesAgentMeta').textContent=`${leads.length} lead${leads.length===1?'':'s'}`;if($('#salesMetricTotal'))$('#salesMetricTotal').textContent=String(sum.total||0);if($('#salesMetricReady'))$('#salesMetricReady').textContent=String(sum.ready||0);if($('#salesMetricOutreach'))$('#salesMetricOutreach').textContent=String(sum.outreach||0);if($('#salesMetricWon'))$('#salesMetricWon').textContent=String(sum.won||0);if($('#salesAgentProviderNote'))$('#salesAgentProviderNote').textContent=`Enrichment: public website + news${data.openenrich_configured?' + OpenEnrich (free)':''} · Email: ${data.email_provider||'connect Gmail/Outlook to send'}`;
  const root=$('#salesLeadList');if(!root)return;root.innerHTML='';if(!leads.length){root.innerHTML='<div class="studio-result empty">Add an account or discover public demand signals.</div>';return}leads.slice(0,100).forEach(x=>{const e=x.enrichment||{},o=x.outreach||{},published=(e.published_emails||[]).slice(0,3).map(v=>`<span class="agent-evidence-pill">${escapeHtml(v)}</span>`).join(''),news=(e.recent_news||[]).slice(0,2).map(n=>`<li>${escapeHtml(n.title||'')}</li>`).join('');const contactNote=e.openenrich?.email?`<small>OpenEnrich: ${escapeHtml(e.openenrich.email)} · ${escapeHtml(e.openenrich.status||'unverified')}${e.openenrich.selectable?'':' · not selected for outreach'}</small>`:'';const card=document.createElement('article');card.className='agent-work-card';card.innerHTML=`<div class="agent-work-head"><div><h4>${escapeHtml(x.company||'Account')}</h4><p>${escapeHtml([x.contact_name,x.contact_title,x.location].filter(Boolean).join(' · '))}</p></div><div class="agent-score">${Number(x.score||0)}</div></div><p class="agent-signal">${escapeHtml(x.signal||x.next_action||'No signal yet.')}</p><div class="agent-evidence-row">${x.website?`<a href="${escapeHtml(x.website)}" target="_blank" rel="noopener">website</a>`:''}${x.source_url?`<a href="${escapeHtml(x.source_url)}" target="_blank" rel="noopener">source</a>`:''}${published}</div>${contactNote}${e.qualification?`<div class="agent-principle"><strong>${escapeHtml(e.qualification.decision.replace('_',' '))}</strong><p>${escapeHtml(e.qualification.pain_hypothesis||'')}</p><small>Missing: ${escapeHtml((e.qualification.missing_information||[]).join(' · ')||'Review evidence and recipient')}</small></div>`:''}${news?`<details><summary>Recent evidence</summary><ul>${news}</ul></details>`:''}${o.sequence?.length?`<details><summary>Follow-up drafts · approval required</summary>${o.sequence.map(step=>`<h5>Day ${Number(step.day_offset)||0} · ${escapeHtml(step.subject||"")}</h5><pre>${escapeHtml(step.email||"")}</pre>`).join("")}</details>`:""}${o.email?`<details class="agent-draft"><summary>Outreach draft · ${escapeHtml(o.subject||'')}</summary><pre>${escapeHtml(o.email)}</pre></details>`:''}<div class="agent-work-actions"><button class="cc-secondary-btn" data-sales-enrich="${x.id}">Research</button><button class="cc-secondary-btn" data-sales-draft="${x.id}">Draft outreach</button>${x.email&&o.email&&e.qualification?.decision==="qualified"&&o.profile_business?`<button class="cc-primary-btn" data-sales-send="${x.id}">Send with approval</button>`:''}<select data-sales-status="${x.id}">${['new','researching','ready','outreach','follow-up','qualified','won','lost'].map(v=>`<option value="${v}" ${x.status===v?'selected':''}>${v.replace('-', ' ')}</option>`).join('')}</select></div><small>${escapeHtml(x.next_action||'')}</small>`;root.appendChild(card)});
  $$('[data-sales-enrich]').forEach(b=>b.onclick=async()=>{try{b.disabled=true;setStatus('Researching company evidence and enrichment…');await studioFetchJson('/api/agents/sales/enrich',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.salesEnrich})});await refreshStudio();setStatus('Lead research updated.')}catch(err){setStatus(err.message,true);alert(err.message)}finally{b.disabled=false}});
  $$('[data-sales-draft]').forEach(b=>b.onclick=async()=>{try{b.disabled=true;setStatus('Writing evidence-grounded outreach…');await studioFetchJson('/api/agents/sales/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.salesDraft})});await refreshStudio();setStatus('Outreach draft ready.')}catch(err){setStatus(err.message,true);alert(err.message)}finally{b.disabled=false}});
  $$('[data-sales-send]').forEach(b=>b.onclick=async()=>{const x=leads.find(v=>v.id===b.dataset.salesSend);if(!x)return;if(!confirm(`Send this approved email to ${x.email}? This changes external state.`))return;try{b.disabled=true;setStatus('Sending approved outreach…');await studioFetchJson('/api/agents/sales/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:x.id,approved:true})});await refreshStudio();setStatus('Outreach sent. Sales Agent will keep the outcome open.')}catch(err){setStatus(err.message,true);alert(err.message)}finally{b.disabled=false}});
  $$('[data-sales-status]').forEach(sel=>sel.onchange=async()=>{try{await studioFetchJson('/api/agents/sales/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:sel.dataset.salesStatus,status:sel.value})});await refreshStudio()}catch(err){setStatus(err.message,true)}})
}
function marketingSettingsPayload(){return{knowledge:$('#marketingKnowledge')?.value||'',business:$('#marketingBusiness')?.value||'',audience:$('#marketingAudience')?.value||'',offer:$('#marketingOffer')?.value||'',goal:$('#marketingGoal')?.value||'',voice:$('#marketingVoice')?.value||'',pillars:$('#marketingPillars')?.value||'',channels:$$('.marketing-channel:checked').map(x=>x.value)}}
function applyMarketingSettings(){const s=studioState.agents?.marketing?.settings||{};const set=(id,v)=>{const el=$('#'+id);if(el&&document.activeElement!==el)el.value=v||''};set('marketingKnowledge',s.knowledge);set('marketingBusiness',s.business);set('marketingAudience',s.audience);set('marketingOffer',s.offer);set('marketingGoal',s.goal);set('marketingVoice',s.voice);set('marketingPillars',s.pillars);$$('.marketing-channel').forEach(c=>c.checked=(s.channels||['LinkedIn','Instagram','X']).includes(c.value))}
async function saveMarketingSettings(){return studioFetchJson('/api/agents/marketing/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(marketingSettingsPayload())})}
function marketingMediaUrl(item){const o=item.media?.output||{};if(item.media?.kind==='video')return o.video?.url||o.video_asset?.url||o.video||'';return o.images?.[0]?.url||''}
function renderMarketingAgent(){const data=studioState.agents?.marketing||{},items=data.items||[],ints=data.integrations||[];applyMarketingSettings();renderCampaignStrategy("marketing",data.strategy);if($('#marketingAgentMeta'))$('#marketingAgentMeta').textContent=`${items.length} content piece${items.length===1?'':'s'}`;if($('#marketingPostizNote'))$('#marketingPostizNote').textContent=data.postiz_configured?`Postiz connected · ${ints.length} social channel${ints.length===1?'':'s'} available · generated image/video is uploaded with the approved post`:'Content generation ready. Add POSTIZ_API_KEY locally to schedule/publish from Kairoq.';const chip=$('#marketingIntegrationChips');if(chip)chip.innerHTML=ints.map(x=>`<span>${escapeHtml(x.name||x.identifier||x.provider||'channel')}</span>`).join('');const root=$('#marketingContentList');if(!root)return;root.innerHTML='';if(!items.length){root.innerHTML='<div class="studio-result empty">Set the strategy and generate the first content plan.</div>';return}items.slice(0,80).forEach(x=>{const media=marketingMediaUrl(x);const channelChoices=ints.map(i=>`<label><input type="checkbox" data-marketing-channel-for="${x.id}" value="${escapeHtml(String(i.id))}"> ${escapeHtml(i.name||i.identifier||i.provider||'channel')}</label>`).join('');const card=document.createElement('article');card.className='agent-work-card marketing-card';card.innerHTML=`<div class="agent-work-head"><div><span class="agent-pillar">${escapeHtml(x.pillar||'Content')}</span><h4>${escapeHtml(x.title||'Content')}</h4></div><span class="arrival-status">${escapeHtml(x.status||'draft')}</span></div><strong class="agent-hook">${escapeHtml(x.hook||'')}</strong><p>${escapeHtml((x.caption||x.linkedin||'').slice(0,900))}</p>${media?`${x.media?.kind==='video'?`<video controls playsinline src="${escapeHtml(media)}"></video>`:`<img class="agent-generated-media" src="${escapeHtml(media)}" alt="Generated marketing asset">`}`:''}<details><summary>Platform versions</summary><div class="agent-platform-copy"><strong>LinkedIn</strong><pre>${escapeHtml(x.linkedin||x.caption||'')}</pre><strong>Instagram</strong><pre>${escapeHtml(x.instagram||x.caption||'')}</pre><strong>X</strong><pre>${escapeHtml(x.x||x.caption||'')}</pre></div></details><div class="agent-work-actions"><button class="cc-secondary-btn" data-marketing-image="${x.id}">Generate image</button><button class="cc-secondary-btn" data-marketing-video="${x.id}">Generate video</button></div>${data.postiz_configured?`<div class="agent-publish-box"><div class="agent-check-row">${channelChoices}</div><label>Schedule time (leave blank = ~2 min from now)<input type="datetime-local" data-marketing-time="${x.id}"></label>${media?'<small class="agent-publish-media-note">Generated '+escapeHtml(x.media?.kind||'media')+' will be attached to this post.</small>':''}<button class="cc-primary-btn" data-marketing-publish="${x.id}">Schedule approved post</button></div>`:''}`;root.appendChild(card)});
  $$('[data-marketing-image]').forEach(b=>b.onclick=()=>generateMarketingAssetUI(b.dataset.marketingImage,'image',b));$$('[data-marketing-video]').forEach(b=>b.onclick=()=>generateMarketingAssetUI(b.dataset.marketingVideo,'video',b));$$('[data-marketing-publish]').forEach(b=>b.onclick=async()=>{const id=b.dataset.marketingPublish,ids=$$(`[data-marketing-channel-for="${id}"]:checked`).map(x=>x.value),time=document.querySelector(`[data-marketing-time="${id}"]`)?.value||'';if(!ids.length){alert('Choose at least one connected channel.');return}if(!confirm('Schedule this content on the selected social channels? This is an external publishing action.'))return;try{b.disabled=true;setStatus('Uploading generated media (if present) and scheduling approved content through Postiz…');await studioFetchJson('/api/agents/marketing/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,integration_ids:ids,scheduled_at:time?new Date(time).toISOString():'',approved:true})});await refreshStudio();setStatus('Content scheduled.')}catch(err){setStatus(err.message,true);alert(err.message)}finally{b.disabled=false}})
}
async function generateMarketingAssetUI(id,kind,btn){try{btn.disabled=true;setStatus(`Generating ${kind} for approved content concept…`);await studioFetchJson('/api/agents/marketing/asset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,kind,budget_mode:'free'})});await refreshStudio();setStatus(`${kind==='video'?'Video':'Image'} generated and attached to the content item.`)}catch(err){setStatus(err.message,true);alert(err.message)}finally{btn.disabled=false}}

function renderStudioCounts(){
  $('#studioAvatarCount').textContent=String(studioState.avatars.length);
  $('#studioProjectCount').textContent=String(studioState.projects.length);
  $('#studioPromptCount').textContent=String(studioState.library.length);
  $('#studioHistoryCount').textContent=String(studioState.history.length);
}
function fillSelect(select, items, placeholder, mapper){
  if(!select)return;
  const current=select.value;
  select.innerHTML='';
  if(placeholder!==null){ const opt=document.createElement('option'); opt.value=''; opt.textContent=placeholder||'Select'; select.appendChild(opt); }
  items.forEach(item=>{ const opt=document.createElement('option'); const m=mapper(item); opt.value=m.value; opt.textContent=m.label; select.appendChild(opt); });
  if([...select.options].some(o=>o.value===current)) select.value=current;
}
function renderStudioSelects(){
  fillSelect($('#studioProjectSelect'), studioState.projects, null, p=>({value:p.id,label:p.name}));
  if(!$('#studioProjectSelect').value && studioState.projects[0]) $('#studioProjectSelect').value=studioState.projects[0].id;
  const avatarMapper=a=>({value:a.id,label:a.name});
  fillSelect($('#studioAvatarSelect'), studioState.avatars, 'None', avatarMapper);
  fillSelect($('#talkingAvatarSelect'), studioState.avatars, studioState.avatars.length?'Select avatar':'No avatars yet', avatarMapper);
  fillSelect($('#ugcAvatarSelect'), studioState.avatars, studioState.avatars.length?'Select avatar':'No avatars yet', avatarMapper);
}
function renderAvatarList(){
  const root=$('#avatarList'); if(!root) return; root.innerHTML='';
  if(!studioState.avatars.length){ root.innerHTML='<div class="history-card"><p>No avatars yet. Create one on the left.</p></div>'; return; }
  studioState.avatars.forEach(a=>{
    const card=document.createElement('div'); card.className='avatar-card';
    const img=a.image_url?`<img src="${a.image_url}" alt="${a.name}">`:'<div style="width:72px;height:72px;border-radius:14px;background:#f2f4f7"></div>';
    card.innerHTML=`${img}<div><h4>${escapeHtml(a.name)}</h4><p>${escapeHtml(a.look||'')}</p><div class="meta"><span>${escapeHtml(a.voice||'')}</span><span>${new Date(a.updated_at||a.created_at).toLocaleString()}</span></div><div class="mini-actions"><button data-use-avatar="${a.id}">Use in Create</button><button data-load-avatar="${a.id}">Load</button></div></div>`;
    root.appendChild(card);
  });
  $$('[data-use-avatar]').forEach(btn=>btn.onclick=()=>{ $('#studioAvatarSelect').value=btn.dataset.useAvatar; switchStudioTab('create'); setMainView('studio'); updateStudioEstimate(); });
  $$('[data-load-avatar]').forEach(btn=>btn.onclick=()=>loadAvatarIntoForm(btn.dataset.loadAvatar));
}
function loadAvatarIntoForm(id){
  const a=studioState.avatars.find(x=>x.id===id); if(!a)return;
  $('#avatarName').value=a.name||''; $('#avatarLook').value=a.look||''; $('#avatarPersonality').value=a.personality||''; $('#avatarVoice').value=a.voice||''; studioDraftAvatarImage=a.image_url||''; switchStudioTab('avatars');
}
function renderProjectList(){
  const root=$('#projectList'); if(!root)return; root.innerHTML='';
  studioState.projects.forEach(p=>{ const count=studioState.history.filter(h=>h.project_id===p.id).length; const card=document.createElement('div'); card.className='project-card'; card.innerHTML=`<h4>${escapeHtml(p.name)}</h4><p>${escapeHtml(p.description||'')}</p><div class="meta"><span>${count} generations</span><span>${new Date(p.updated_at||p.created_at).toLocaleString()}</span></div>`; root.appendChild(card); });
}
function renderLibraryList(){
  const root=$('#libraryList'); if(!root)return; root.innerHTML='';
  if(!studioState.library.length){ root.innerHTML='<div class="history-card"><p>No prompts saved yet.</p></div>'; return; }
  studioState.library.forEach(item=>{ const card=document.createElement('div'); card.className='library-card'; card.innerHTML=`<h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.prompt)}</p><div class="meta"><span>${escapeHtml(item.category)}</span><span>${new Date(item.updated_at||item.created_at).toLocaleString()}</span></div><div class="mini-actions"><button data-load-prompt="${item.id}">Load into Create</button></div>`; root.appendChild(card); });
  $$('[data-load-prompt]').forEach(btn=>btn.onclick=()=>{ const item=studioState.library.find(x=>x.id===btn.dataset.loadPrompt); if(!item) return; $('#studioPrompt').value=item.prompt||''; $('#studioTitle').value=item.title||''; switchStudioTab('create'); setMainView('studio'); updateStudioEstimate(); });
}
function renderStudioHistory(){
  const root=$('#studioHistoryList'); if(!root)return; root.innerHTML='';
  if(!studioState.history.length){ root.innerHTML='<div class="history-card"><p>No generations yet.</p></div>'; return; }
  studioState.history.forEach(item=>{ const card=document.createElement('div'); card.className='history-card';
    const mediaHtml=item.kind==='video' ? (item.output?.video?`<video src="${item.output.video}" controls muted playsinline style="width:100%;margin-top:10px;border-radius:14px"></video>`:'') : (item.output?.images?.[0]?.url?`<img src="${item.output.images[0].url}" alt="${escapeHtml(item.title)}" style="width:100%;margin-top:10px;border-radius:14px">`:'');
    const project=studioState.projects.find(p=>p.id===item.project_id)?.name||'Project';
    card.innerHTML=`<h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.prompt)}</p><div class="meta"><span>${item.kind}</span><span>${escapeHtml(project)}</span><span>${escapeHtml(item.provider||'')}</span><span>${escapeHtml(item.model||'')}</span><span>${formatMoney(item.estimated_cost)}</span><span>${new Date(item.created_at).toLocaleString()}</span></div>${mediaHtml}`;
    root.appendChild(card);
  });
}
function renderStudioResult(payload, targetId='studioResult', metaId='studioResultMeta'){
  const root=$("#"+targetId); const meta=$("#"+metaId); if(!root) return;
  if(payload?.result?.video){ root.innerHTML=`<div class="stack"><video src="${payload.result.video}" controls playsinline></video></div>`; }
  else if(payload?.result?.images?.length){ root.innerHTML=`<div class="stack"><img src="${payload.result.images[0].url}" alt="Generated image"></div>`; }
  else { root.textContent='No preview available.'; }
  if(meta) meta.textContent=[payload?.history?.provider||payload?.result?.provider||'',payload?.history?.model||payload?.result?.model||'',payload?.history?.estimated_cost!=null?formatMoney(payload.history.estimated_cost):''].filter(Boolean).join(' · ');
}
async function updateStudioEstimate(){
  try{
    const body={kind:$('#studioKind')?.value||'image',duration:Number($('#studioDuration')?.value||4),budget_mode:$('#studioBudgetMode')?.value||'balanced',references:studioReferenceDataUrl?[studioReferenceDataUrl]:[],avatar_id:$('#studioAvatarSelect')?.value||''};
    const data=await studioFetchJson('/api/studio/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    $('#studioEstimatedCost').textContent=formatMoney(data.estimated_cost||0);
  }catch{ $('#studioEstimatedCost').textContent='$0.00'; }
}
function buildAvatarPrompt(a){
  if(!a)return '';
  return [a.name?`Use the recurring avatar ${a.name}.`:'' , a.look||'', a.personality?`Personality: ${a.personality}.`:'' , a.voice?`Voice/tone: ${a.voice}.`:'' ].filter(Boolean).join(' ');
}
$('#studioReferenceFile')?.addEventListener('change', async e=>{ studioReferenceDataUrl=await fileToDataUrl(e.target.files?.[0]); updateStudioEstimate(); });
$('#avatarReferenceFile')?.addEventListener('change', async e=>{ avatarReferenceDataUrl=await fileToDataUrl(e.target.files?.[0]); });
$('#ugcProductFile')?.addEventListener('change', async e=>{ ugcProductDataUrl=await fileToDataUrl(e.target.files?.[0]); });
['studioKind','studioDuration','studioBudgetMode','studioAvatarSelect','studioMode'].forEach(id=>$('#'+id)?.addEventListener('change', updateStudioEstimate));
$('#salesAgentSettingsForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await saveSalesSettings();await refreshStudio();setStatus('Sales Agent strategy saved.')}catch(err){setStatus(err.message,true);alert(err.message)}});
$('#salesDiscoverBtn')?.addEventListener('click',async()=>{const b=$('#salesDiscoverBtn');try{await saveSalesSettings();b.disabled=true;setStatus('Scanning public signals; import a lead export for named prospects…');const d=await studioFetchJson('/api/agents/sales/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...salesSettingsPayload(),limit:10})});await refreshStudio();setStatus(`Sales Agent added/refreshed ${d.count||0} opportunities.`)}catch(err){setStatus(err.message,true);alert(err.message)}finally{b.disabled=false}});
$('#salesRunBtn')?.addEventListener('click',async()=>{const b=$('#salesRunBtn');try{await saveSalesSettings();b.disabled=true;setStatus('Sales Agent is researching, scoring, and preparing personalized outreach…');const d=await studioFetchJson('/api/agents/sales/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:8})});await refreshStudio();setStatus(`Sales Agent prepared ${d.results?.filter(x=>x.ok).length||0} leads.`)}catch(err){setStatus(err.message,true);alert(err.message)}finally{b.disabled=false}});
$('#salesLeadForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await studioFetchJson('/api/agents/sales/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company:$('#salesLeadCompany').value,website:$('#salesLeadWebsite').value,contact_name:$('#salesLeadContact').value,email:$('#salesLeadEmail').value,location:$('#salesLeadLocation').value,signal:$('#salesLeadSignal').value,source:'manual'})});e.target.reset();await refreshStudio();setStatus('Lead added.')}catch(err){setStatus(err.message,true);alert(err.message)}});
$('#marketingAgentSettingsForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await saveMarketingSettings();await refreshStudio();setStatus('Marketing Agent strategy saved.')}catch(err){setStatus(err.message,true);alert(err.message)}});
$('#marketingGenerateBtn')?.addEventListener('click',async()=>{const b=$('#marketingGenerateBtn');try{await saveMarketingSettings();b.disabled=true;setStatus('Marketing Agent is drafting and running the editorial quality pass…');const d=await studioFetchJson('/api/agents/marketing/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({count:7})});await refreshStudio();setStatus(`Created and reviewed ${d.items?.length||0} content pieces.`)}catch(err){setStatus(err.message,true);alert(err.message)}finally{b.disabled=false}});
$$('.studio-tab').forEach(btn=>btn.addEventListener('click',()=>switchStudioTab(btn.dataset.studioTab)));
$('#studioCreateForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  try{
    const avatar=studioState.avatars.find(x=>x.id===($('#studioAvatarSelect').value||''));
    const basePrompt=($('#studioPrompt').value||'').trim();
    const prompt=[basePrompt, buildAvatarPrompt(avatar)].filter(Boolean).join(' ');
    const kind=$('#studioKind').value;
    const mode=$('#studioMode').value;
    const payload={
      kind,
      mode,
      prompt,
      image_size:$('#studioImageSize').value,
      duration:Number($('#studioDuration').value||4),
      budget_mode:$('#studioBudgetMode').value,
      project_id:$('#studioProjectSelect').value,
      avatar_id:avatar?.id||'',
      title:$('#studioTitle').value||basePrompt.slice(0,60)||'Studio generation',
      references: kind==='image' && studioReferenceDataUrl ? [studioReferenceDataUrl] : [],
      reference_image: kind==='video' ? (studioReferenceDataUrl || (avatar?.image_url ? await localUrlToDataUrl(avatar.image_url) : '')) : ''
    };
    const data=await studioFetchJson('/api/studio/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    renderStudioResult(data);
    setStatus('Studio generation completed.');
    await refreshStudio();
  }catch(err){ setStatus(err.message,true); alert(err.message); }
});
$('#generateAvatarBtn')?.addEventListener('click', async ()=>{
  try{
    const prompt=[($('#avatarLook').value||''), ($('#avatarPersonality').value?`Personality: ${$('#avatarPersonality').value}.`:''), 'Create a clean, reusable AI influencer portrait.'].filter(Boolean).join(' ');
    const data=await studioFetchJson('/api/studio/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'image',mode:'avatar',prompt,image_size:'portrait_16_9',budget_mode:'balanced',title:($('#avatarName').value||'Avatar draft'),references:avatarReferenceDataUrl?[avatarReferenceDataUrl]:[]})});
    studioDraftAvatarImage=data?.result?.images?.[0]?.url||'';
    renderStudioResult(data,'studioResult','studioResultMeta');
    setMainView('studio'); switchStudioTab('avatars'); setStatus('Avatar image generated. Click Save avatar to store it.');
  }catch(err){ setStatus(err.message,true); alert(err.message); }
});
$('#studioAvatarForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  try{
    const payload={name:$('#avatarName').value||'Untitled avatar',look:$('#avatarLook').value||'',personality:$('#avatarPersonality').value||'',voice:$('#avatarVoice').value||'',image_url:studioDraftAvatarImage||'',reference_image:avatarReferenceDataUrl||'',prompt_seed:$('#avatarLook').value||''};
    await studioFetchJson('/api/studio/avatars',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    setStatus('Avatar saved.');
    $('#studioAvatarForm').reset(); avatarReferenceDataUrl=''; studioDraftAvatarImage='';
    await refreshStudio();
  }catch(err){ setStatus(err.message,true); alert(err.message); }
});
$('#talkingAvatarForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  try{
    const avatar=studioState.avatars.find(x=>x.id===($('#talkingAvatarSelect').value||''));
    if(!avatar) throw new Error('Select an avatar first.');
    const ref=avatar.reference_image || await localUrlToDataUrl(avatar.image_url||'');
    const prompt=[`Create a talking avatar video of ${avatar.name}.`, avatar.look||'', avatar.personality?`Tone: ${avatar.personality}.`:'', `Script: ${$('#talkingAvatarScript').value||''}`, 'Look into the camera and speak naturally.'].filter(Boolean).join(' ');
    const data=await studioFetchJson('/api/studio/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'video',mode:'talking_avatar',prompt,reference_image:ref,duration:Number($('#talkingAvatarDuration').value||6),budget_mode:'balanced',project_id:$('#studioProjectSelect').value||'default-project',avatar_id:avatar.id,title:`Talking avatar · ${avatar.name}`})});
    renderStudioResult(data,'studioResult','studioResultMeta');
    setMainView('studio'); switchStudioTab('avatars'); setStatus('Talking avatar generated.');
    await refreshStudio();
  }catch(err){ setStatus(err.message,true); alert(err.message); }
});
$('#ugcForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  try{
    const avatar=studioState.avatars.find(x=>x.id===($('#ugcAvatarSelect').value||''));
    const prompt=[avatar?`Create a UGC style video featuring the recurring avatar ${avatar.name}.`:'' , avatar?.look||'', `Script: ${$('#ugcScript').value||''}`, $('#ugcStyle').value||'', 'Keep it vertical, social-first, authentic, and ad-ready.'].filter(Boolean).join(' ');
    const ref=ugcProductDataUrl || avatar?.reference_image || await localUrlToDataUrl(avatar?.image_url||'');
    const data=await studioFetchJson('/api/studio/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'video',mode:'ugc',prompt,reference_image:ref,duration:Number($('#ugcDuration').value||8),budget_mode:'balanced',project_id:$('#studioProjectSelect').value||'default-project',avatar_id:avatar?.id||'',title:`UGC · ${(avatar&&avatar.name)||'Creator'}`})});
    renderStudioResult(data,'ugcResult','ugcResultMeta');
    setStatus('UGC video generated.');
    await refreshStudio();
  }catch(err){ setStatus(err.message,true); alert(err.message); }
});
$('#projectForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  try{ await studioFetchJson('/api/studio/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#projectName').value||'Untitled project',description:$('#projectDescription').value||''})}); $('#projectForm').reset(); setStatus('Project saved.'); await refreshStudio(); }catch(err){ setStatus(err.message,true); }
});
$('#libraryForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  try{ await studioFetchJson('/api/studio/library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('#libraryTitle').value||'Untitled prompt',category:$('#libraryCategory').value||'General',prompt:$('#libraryPrompt').value||''})}); $('#libraryForm').reset(); setStatus('Prompt saved.'); await refreshStudio(); }catch(err){ setStatus(err.message,true); }
});
setTimeout(refreshStudio, 1200);




function arrivalValue(id){return ($('#'+id)?.value||'').trim()}
function renderArrivalPhotoPreview(){const root=$('#arrivalPhotoPreview');if(!root)return;root.innerHTML='';arrivalDraftPhotos.slice(0,8).forEach(src=>{const img=document.createElement('img');img.src=src;img.alt='Arrival reference';root.appendChild(img)})}
function currentArrivalPayload(){return {id:arrivalDraftId||undefined,guest_name:arrivalValue('arrivalGuest'),guest_email:arrivalValue('arrivalGuestEmail'),property_name:arrivalValue('arrivalProperty'),address:arrivalValue('arrivalAddress'),arrival:arrivalValue('arrivalDate'),departure:arrivalValue('arrivalDeparture'),language:$('#arrivalLanguage')?.value||'English',entrance:arrivalValue('arrivalEntrance'),parking:arrivalValue('arrivalParking'),access:arrivalValue('arrivalAccess'),wifi:arrivalValue('arrivalWifi'),thermostat:arrivalValue('arrivalThermostat'),laundry:arrivalValue('arrivalLaundry'),garbage:arrivalValue('arrivalGarbage'),amenities:arrivalValue('arrivalAmenities'),support_phone:arrivalValue('arrivalSupportPhone'),support_email:arrivalValue('arrivalSupportEmail'),photos:arrivalDraftPhotos}}
function loadArrivalIntoForm(id){const x=studioState.arrivalbriefs.find(a=>a.id===id);if(!x)return;arrivalDraftId=x.id;arrivalDraftPhotos=[...(x.photos||[])];const set=(id,v)=>{if($('#'+id))$('#'+id).value=v||''};set('arrivalGuest',x.guest_name);set('arrivalGuestEmail',x.guest_email);set('arrivalProperty',x.property_name);set('arrivalAddress',x.address);set('arrivalDate',x.arrival);set('arrivalDeparture',x.departure);set('arrivalLanguage',x.language||'English');set('arrivalEntrance',x.entrance);set('arrivalParking',x.parking);set('arrivalAccess',x.access);set('arrivalWifi',x.wifi);set('arrivalThermostat',x.thermostat);set('arrivalLaundry',x.laundry);set('arrivalGarbage',x.garbage);set('arrivalAmenities',x.amenities);set('arrivalSupportPhone',x.support_phone);set('arrivalSupportEmail',x.support_email);renderArrivalPhotoPreview();switchStudioTab('arrival')}
async function saveArrivalDraft(){const data=await studioFetchJson('/api/arrivalbrief/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(currentArrivalPayload())});arrivalDraftId=data.arrivalbrief.id;return data.arrivalbrief}
function renderArrivalList(){const root=$('#arrivalList');if(!root)return;const items=studioState.arrivalbriefs||[];if($('#arrivalMeta'))$('#arrivalMeta').textContent=`${items.length} arrival brief${items.length===1?'':'s'}`;root.innerHTML='';if(!items.length){root.innerHTML='<div class="studio-result empty">Create an ArrivalBrief to see the guest experience.</div>';return}items.slice(0,80).forEach(x=>{const g=x.guide||{};const steps=(g.steps||[]).slice(0,5).map(s=>`<li><strong>${escapeHtml(s.title||'')}</strong> — ${escapeHtml(s.body||'')}</li>`).join('');const card=document.createElement('article');card.className='arrival-card';card.innerHTML=`<div class="arrival-card-head"><div><h4>${escapeHtml(x.guest_name||'Guest')} · ${escapeHtml(x.property_name||x.address||'Property')}</h4><p>${escapeHtml([x.arrival,x.language].filter(Boolean).join(' · '))}</p></div><span class="arrival-status">${escapeHtml(x.status||'draft')}</span></div>${steps?`<div class="arrival-guide-preview"><strong>${escapeHtml(g.welcome||'Arrival guide')}</strong><ol>${steps}</ol></div>`:''}<p class="arrival-sensitive">${x.acknowledged_at?'✓ Guest confirmed settled in · '+escapeHtml(x.acknowledged_at):'Private link — may contain access information.'}</p><div class="arrival-card-actions"><button type="button" class="cc-secondary-btn" data-arrival-edit="${x.id}">Edit</button>${x.share_url?`<a class="cc-primary-btn" href="${escapeHtml(x.share_url)}" target="_blank" rel="noopener">Open guest guide</a>`:''}<button type="button" class="cc-secondary-btn" data-arrival-generate="${x.id}">${x.share_url?'Refresh guide':'Create guide'}</button>${studioState.arrivalStatus.higgsfield_configured?`<button type="button" class="cc-secondary-btn" data-arrival-video="${x.id}">▶ AI welcome clip</button>`:''}</div>`;root.appendChild(card)});$$('[data-arrival-edit]').forEach(b=>b.addEventListener('click',()=>loadArrivalIntoForm(b.dataset.arrivalEdit)));$$('[data-arrival-generate]').forEach(b=>b.addEventListener('click',async()=>{try{b.disabled=true;setStatus('Creating factual arrival guide…');await studioFetchJson('/api/arrivalbrief/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.arrivalGenerate})});await refreshStudio();setStatus('ArrivalBrief ready.')}catch(err){setStatus(err.message,true);alert(err.message)}finally{b.disabled=false}}));$$('[data-arrival-video]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('This makes a billable Higgsfield Seedance 2.5 request. No guest name, address, codes, unit number, or Wi-Fi credentials will be sent. Continue?'))return;try{b.disabled=true;setStatus('Generating privacy-safe Higgsfield welcome clip…');await studioFetchJson('/api/arrivalbrief/welcome-video',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.arrivalVideo})});await refreshStudio();setStatus('AI welcome clip added.')}catch(err){setStatus(err.message,true);alert(err.message)}finally{b.disabled=false}}))}
$('#arrivalPhotos')?.addEventListener('change',async e=>{const files=[...(e.target.files||[])].slice(0,8);arrivalDraftPhotos=[];for(const file of files)arrivalDraftPhotos.push(await fileToDataUrl(file));renderArrivalPhotoPreview()});
$('#arrivalForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await saveArrivalDraft();await refreshStudio();setStatus('ArrivalBrief draft saved.')}catch(err){setStatus(err.message,true);alert(err.message)}});
$('#arrivalGenerateBtn')?.addEventListener('click',async()=>{try{setStatus('Saving and creating ArrivalBrief…');const item=await saveArrivalDraft();await studioFetchJson('/api/arrivalbrief/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id})});await refreshStudio();setStatus('ArrivalBrief ready — open the guest guide to preview it.')}catch(err){setStatus(err.message,true);alert(err.message)}});
$('#arrivalVideoBtn')?.addEventListener('click',async()=>{if(!confirm('This makes a billable Higgsfield Seedance 2.5 request. No guest name, address, codes, unit number, or Wi-Fi credentials will be sent. Continue?'))return;try{const item=await saveArrivalDraft();setStatus('Generating privacy-safe Higgsfield welcome clip…');await studioFetchJson('/api/arrivalbrief/welcome-video',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id})});await refreshStudio();setStatus('AI welcome clip added.')}catch(err){setStatus(err.message,true);alert(err.message)}});


function tourValue(id){return ($('#'+id)?.value||'').trim()}
function tourRoomOptions(selected='Unassigned'){return (studioState.tourRooms?.length?studioState.tourRooms:['Living Area','Kitchen','Bedroom','Bathroom','Laundry','Balcony / View','Exterior','Amenities','Other','Unassigned']).map(r=>`<option ${r===selected?'selected':''}>${escapeHtml(r)}</option>`).join('')}
function renderTourPhotoEditor(){const root=$('#tourPhotoEditor');if(!root)return;root.innerHTML='';if(!tourDraftPhotos.length){root.innerHTML='<div class="studio-result empty">Upload photos or open the included sample tour.</div>';return}tourDraftPhotos.sort((a,b)=>Number(a.order)-Number(b.order)).forEach((p,i)=>{const card=document.createElement('article');card.className='tour-photo-card';card.innerHTML=`<img src="${escapeHtml(p.url)}" alt="Property photo"><div class="tour-photo-fields"><label>Room<select data-tour-room="${p.id}">${tourRoomOptions(p.room||'Unassigned')}</select></label><label>Label<input data-tour-label="${p.id}" value="${escapeHtml(p.label||'')}"></label><label class="tour-hero-check"><input type="radio" name="tourHero" data-tour-hero="${p.id}" ${p.hero?'checked':''}> Cover</label><div class="mini-actions"><button type="button" data-tour-up="${p.id}" ${i===0?'disabled':''}>↑</button><button type="button" data-tour-down="${p.id}" ${i===tourDraftPhotos.length-1?'disabled':''}>↓</button><button type="button" data-tour-remove="${p.id}">Remove</button></div></div>`;root.appendChild(card)});$$('[data-tour-room]').forEach(el=>el.onchange=()=>{const p=tourDraftPhotos.find(x=>x.id===el.dataset.tourRoom);if(p)p.room=el.value});$$('[data-tour-label]').forEach(el=>el.oninput=()=>{const p=tourDraftPhotos.find(x=>x.id===el.dataset.tourLabel);if(p)p.label=el.value});$$('[data-tour-hero]').forEach(el=>el.onchange=()=>{tourDraftPhotos.forEach(p=>p.hero=p.id===el.dataset.tourHero)});$$('[data-tour-remove]').forEach(b=>b.onclick=()=>{tourDraftPhotos=tourDraftPhotos.filter(p=>p.id!==b.dataset.tourRemove);tourDraftPhotos.forEach((p,i)=>p.order=i);renderTourPhotoEditor();renderTourPremiumStatus()});$$('[data-tour-up]').forEach(b=>b.onclick=()=>moveTourPhoto(b.dataset.tourUp,-1));$$('[data-tour-down]').forEach(b=>b.onclick=()=>moveTourPhoto(b.dataset.tourDown,1))}
function moveTourPhoto(id,delta){const i=tourDraftPhotos.findIndex(p=>p.id===id),j=i+delta;if(i<0||j<0||j>=tourDraftPhotos.length)return;[tourDraftPhotos[i],tourDraftPhotos[j]]=[tourDraftPhotos[j],tourDraftPhotos[i]];tourDraftPhotos.forEach((p,k)=>p.order=k);renderTourPhotoEditor()}
function currentTourPayload(){return {id:tourDraftId||undefined,title:tourValue('tourTitle')||'Untitled property',city:tourValue('tourCity'),beds:tourValue('tourBeds'),baths:tourValue('tourBaths'),cta_label:tourValue('tourCtaLabel')||'Request Quote',cta_url:tourValue('tourCtaUrl'),photos:tourDraftPhotos}}
function loadTourIntoForm(id){const x=studioState.tours.find(t=>t.id===id);if(!x)return;tourDraftId=x.id;tourDraftPhotos=(x.photos||[]).map(p=>({...p}));const set=(id,v)=>{if($('#'+id))$('#'+id).value=v||''};set('tourTitle',x.title);set('tourCity',x.city);set('tourBeds',x.beds);set('tourBaths',x.baths);set('tourCtaLabel',x.cta_label||'Request Quote');set('tourCtaUrl',x.cta_url);renderTourPhotoEditor();renderTourOutput(x);renderTourPremiumStatus();switchStudioTab('tours')}
function renderTourOutput(x){const root=$('#tourOutput');if(!root)return;if(!x){root.classList.add('hidden');return}let links='';if(x.share_url)links+=`<a class="cc-primary-btn" href="${escapeHtml(x.share_url)}" target="_blank" rel="noopener">Open Interactive Tour</a>`;if(x.walkthrough_url)links+=`<a class="cc-secondary-btn" href="${escapeHtml(x.walkthrough_url)}" target="_blank" rel="noopener">Standard Walkthrough</a>`;if(x.reel_url)links+=`<a class="cc-secondary-btn" href="${escapeHtml(x.reel_url)}" target="_blank" rel="noopener">Standard Reel</a>`;if(x.premium_walkthrough_url)links+=`<a class="cc-primary-btn" href="${escapeHtml(x.premium_walkthrough_url)}" target="_blank" rel="noopener">✦ Premium Walkthrough</a>`;if(x.premium_reel_url)links+=`<a class="cc-primary-btn" href="${escapeHtml(x.premium_reel_url)}" target="_blank" rel="noopener">✦ Premium Reel</a>`;const motion=(x.premium_clips||[]).length?`<p>${(x.premium_clips||[]).length} room motion clip${(x.premium_clips||[]).length===1?'':'s'} · Seedance 2.5</p>`:'';root.innerHTML=`<h3>${escapeHtml(x.title||'Tour')}</h3><p>${escapeHtml([x.city,x.beds&&x.beds+' bed',x.baths&&x.baths+' bath'].filter(Boolean).join(' · '))}</p>${motion}<div class="studio-inline-actions">${links||'<span>Choose an output above.</span>'}</div>`;root.classList.remove('hidden')}
function renderTourList(){const root=$('#tourList');if(!root)return;const items=studioState.tours||[];if($('#tourMeta'))$('#tourMeta').textContent=`${items.length} tour${items.length===1?'':'s'} · sample included`;root.innerHTML='';items.forEach(x=>{const hero=(x.photos||[]).find(p=>p.hero)||(x.photos||[])[0];const rooms=[...new Set((x.photos||[]).map(p=>p.room).filter(Boolean))].filter(r=>r!=='Unassigned');const card=document.createElement('article');card.className='tour-card';card.innerHTML=`${hero?`<img src="${escapeHtml(hero.url)}" alt="${escapeHtml(x.title)}">`:''}<div class="tour-card-body"><div class="arrival-card-head"><div><h4>${escapeHtml(x.title)}</h4><p>${escapeHtml([x.city,x.beds&&x.beds+' BR',x.baths&&x.baths+' BA'].filter(Boolean).join(' · '))}</p></div><span class="arrival-status">${(x.photos||[]).length} photos</span></div><p class="tour-room-summary">${escapeHtml(rooms.join(' · ')||'Rooms not assigned')}</p><div class="arrival-card-actions"><button type="button" class="cc-secondary-btn" data-tour-open="${x.id}">Open</button>${x.share_url?`<a class="cc-primary-btn" href="${escapeHtml(x.share_url)}" target="_blank" rel="noopener">Interactive Tour</a>`:''}${x.walkthrough_url?`<a class="cc-secondary-btn" href="${escapeHtml(x.walkthrough_url)}" target="_blank">16:9 Video</a>`:''}${x.reel_url?`<a class="cc-secondary-btn" href="${escapeHtml(x.reel_url)}" target="_blank">9:16 Reel</a>`:''}${x.premium_walkthrough_url?`<a class="cc-primary-btn" href="${escapeHtml(x.premium_walkthrough_url)}" target="_blank">✦ Premium</a>`:''}</div></div>`;root.appendChild(card)});$$('[data-tour-open]').forEach(b=>b.onclick=()=>loadTourIntoForm(b.dataset.tourOpen))}
function renderTourPremiumStatus(){const el=$('#tourPremiumStatus'),btn=$('#tourPremiumBtn'),reb=$('#tourPremiumRebuildBtn');if(!el)return;const p=studioState.tourPremium||{},engine=$('#tourMotionEngine')?.value||'wan2gp';const rooms=[...new Set(tourDraftPhotos.map(x=>x.room).filter(x=>x&&x!=='Unassigned'))];const count=Math.min(Number($('#tourPremiumClips')?.value||6),rooms.length||tourDraftPhotos.length||0);if(engine==='wan2gp'){if(!p.wan2gp_configured){el.textContent='Local Wan not connected — start Wan2GP and set WAN2GP_BASE_URL=http://127.0.0.1:7860.';if(btn)btn.disabled=true}else{el.textContent=`Local Wan ready · ${count||'up to 6'} room clip${count===1?'':'s'} · ${p.wan2gp_model||'1.3B image-to-video'} · no API charge`;if(btn)btn.disabled=false}}else if(!p.higgsfield_configured){el.textContent='Higgsfield not configured — add HF_CREDENTIALS locally.';if(btn)btn.disabled=true}else if(!p.public_https_site_ready){el.textContent='Higgsfield ready, but it needs a public HTTPS SITE_URL to read source photos.';if(btn)btn.disabled=true}else{el.textContent=`Higgsfield ready · ${count||'up to 6'} billable room generation${count===1?'':'s'} · ${p.model||'Seedance 2.5'}`;if(btn)btn.disabled=false}const current=studioState.tours.find(t=>t.id===tourDraftId);if(reb)reb.disabled=!((current?.premium_clips||[]).length)}
async function saveTourDraft(){const data=await studioFetchJson('/api/tours/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(currentTourPayload())});tourDraftId=data.tour.id;tourDraftPhotos=(data.tour.photos||[]).map(p=>({...p}));return data.tour}
async function runTourAction(endpoint,message){try{const item=await saveTourDraft();setStatus(message);const data=await studioFetchJson(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id})});await refreshStudio();loadTourIntoForm(data.tour.id);setStatus('Tour output ready.');return data.tour}catch(err){setStatus(err.message,true);alert(err.message);throw err}}
$('#tourPhotos')?.addEventListener('change',async e=>{const files=[...(e.target.files||[])].slice(0,30);const next=[];for(let i=0;i<files.length;i++){const url=await fileToDataUrl(files[i]);next.push({id:`local-${Date.now()}-${i}`,url,room:'Unassigned',label:files[i].name.replace(/\.[^.]+$/,''),order:i,hero:i===0})}tourDraftPhotos=next;renderTourPhotoEditor();renderTourPremiumStatus()});
$('#tourForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await saveTourDraft();await refreshStudio();setStatus('Tour saved.')}catch(err){setStatus(err.message,true);alert(err.message)}});
$('#tourInteractiveBtn')?.addEventListener('click',()=>runTourAction('/api/tours/interactive','Building interactive room-by-room tour…'));
$('#tourWalkthroughBtn')?.addEventListener('click',()=>runTourAction('/api/tours/walkthrough','Rendering 16:9 walkthrough from real photos…'));
$('#tourReelBtn')?.addEventListener('click',()=>runTourAction('/api/tours/reel','Rendering 9:16 vertical Reel from real photos…'));
$('#tourGalleryBtn')?.addEventListener('click',()=>runTourAction('/api/tours/gallery','Building enhanced share gallery…'));
$('#tourPremiumClips')?.addEventListener('change',renderTourPremiumStatus);
$('#tourMotionEngine')?.addEventListener('change',renderTourPremiumStatus);
$('#tourPremiumBtn')?.addEventListener('click',async()=>{try{const item=await saveTourDraft();const max_clips=Number($('#tourPremiumClips')?.value||6),duration=Number($('#tourPremiumDuration')?.value||5),intro=$('#tourPremiumIntro')?.checked!==false,outro=$('#tourPremiumOutro')?.checked!==false,engine=$('#tourMotionEngine')?.value||'wan2gp';const rooms=[...new Set((item.photos||[]).map(x=>x.room).filter(x=>x&&x!=='Unassigned'))];const estimate=Math.min(max_clips,rooms.length||(item.photos||[]).length);const label=engine==='wan2gp'?'Local Wan on this Mac (no API charge)':'Higgsfield Seedance 2.5 (billable)';if(!confirm(`This will generate up to ${estimate} room motion clips using ${label}. Motion is presentation-only; source photos remain the factual reference. Continue?`))return;setStatus(`Generating ${estimate} room motion clip${estimate===1?'':'s'} with ${engine==='wan2gp'?'Local Wan':'Higgsfield'}…`);const data=await studioFetchJson('/api/tours/premium/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,max_clips,duration,intro,outro,engine})});await refreshStudio();loadTourIntoForm(data.tour.id);setStatus(`AI Motion Tour ready · ${data.generations} ${engine==='wan2gp'?'local Wan':'Higgsfield'} clip${data.generations===1?'':'s'} reused across all outputs.`)}catch(err){setStatus(err.message,true);alert(err.message)}});
$('#tourPremiumRebuildBtn')?.addEventListener('click',async()=>{try{const item=await saveTourDraft();const intro=$('#tourPremiumIntro')?.checked!==false,outro=$('#tourPremiumOutro')?.checked!==false;setStatus('Rebuilding premium walkthrough, Reel, and interactive room clips without new Higgsfield generations…');const data=await studioFetchJson('/api/tours/premium/rebuild',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,intro,outro})});await refreshStudio();loadTourIntoForm(data.tour.id);setStatus('Premium exports rebuilt without new AI generations.')}catch(err){setStatus(err.message,true);alert(err.message)}});


function pursuitValue(id){return ($('#'+id)?.value||'').trim()}
function renderPursuitList(){
  const root=$('#pursuitList'); if(!root)return; const items=studioState.pursuits||[],sum=studioState.pursuitSummary||{};
  if($('#pursuitTotal'))$('#pursuitTotal').textContent=String(sum.total??items.length);
  if($('#pursuitHot'))$('#pursuitHot').textContent=String(sum.hot??items.filter(x=>x.score>=70).length);
  if($('#pursuitFollowups'))$('#pursuitFollowups').textContent=String(sum.followups??items.filter(x=>x.status==='follow-up').length);
  if($('#pursuitMeta'))$('#pursuitMeta').textContent=`${items.length} tracked opportunit${items.length===1?'y':'ies'}`;
  root.innerHTML='';
  if(!items.length){root.innerHTML='<div class="studio-result empty">Run discovery to find public events that may create temporary-housing demand.</div>';return}
  items.slice(0,80).forEach(x=>{
    const card=document.createElement('article');card.className='pursuit-card';
    const b=x.brief||{};const reasons=(x.score_reasons||[]).map(r=>`<span>${escapeHtml(r)}</span>`).join('');
    const brief=b.why_now?`<div class="pursuit-brief"><strong>Why now</strong><p>${escapeHtml(b.why_now)}</p><strong>Likely need / confidence</strong><p>${escapeHtml(b.likely_housing_need||'')} · ${escapeHtml(b.confidence||'')}</p><strong>Next action</strong><p>${escapeHtml(b.next_action||x.next_action||'')}</p>${b.outreach_email?`<details><summary>Draft outreach</summary><pre>${escapeHtml(b.outreach_email)}</pre></details>`:''}</div>`:'';
    card.innerHTML=`<div class="pursuit-card-head"><div><h4>${escapeHtml(x.company||'Potential account')}</h4><p>${escapeHtml(x.headline||x.signal||'')}</p></div><div class="pursuit-score ${Number(x.score)>=70?'hot':''}">${Number(x.score)||0}</div></div><div class="pursuit-reasons">${reasons}</div><p class="listing-trust-note">${escapeHtml([x.source,x.published_at,x.geography].filter(Boolean).join(' · '))}${x.source_url?` · <a href="${escapeHtml(x.source_url)}" target="_blank" rel="noopener">source</a>`:''}</p>${brief}<div class="pursuit-card-actions"><button type="button" class="cc-primary-btn" data-pursuit-brief="${x.id}">${b.why_now?'Refresh brief':'Build pursuit brief'}</button><select data-pursuit-status="${x.id}"><option value="new" ${x.status==='new'?'selected':''}>New</option><option value="researching" ${x.status==='researching'?'selected':''}>Researching</option><option value="outreach" ${x.status==='outreach'?'selected':''}>Outreach</option><option value="follow-up" ${x.status==='follow-up'?'selected':''}>Follow-up</option><option value="qualified" ${x.status==='qualified'?'selected':''}>Qualified</option><option value="won" ${x.status==='won'?'selected':''}>Won</option><option value="lost" ${x.status==='lost'?'selected':''}>Lost</option></select></div>`;
    root.appendChild(card);
  });
  $$('[data-pursuit-brief]').forEach(btn=>btn.addEventListener('click',async()=>{try{setStatus('Building evidence-based pursuit brief…');btn.disabled=true;await studioFetchJson('/api/pursuit/brief',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:btn.dataset.pursuitBrief})});await refreshStudio();setStatus('Pursuit brief ready.');}catch(err){setStatus(err.message,true);alert(err.message)}finally{btn.disabled=false}}));
  $$('[data-pursuit-status]').forEach(sel=>sel.addEventListener('change',async()=>{try{await studioFetchJson('/api/pursuit/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:sel.dataset.pursuitStatus,status:sel.value})});await refreshStudio();}catch(err){setStatus(err.message,true)}}));
}
$('#pursuitDiscoverForm')?.addEventListener('submit',async e=>{e.preventDefault();try{setStatus('Scanning public demand signals…');const btn=e.submitter;if(btn){btn.disabled=true;btn.textContent='Scanning…'}const data=await studioFetchJson('/api/pursuit/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geography:pursuitValue('pursuitGeography'),market:pursuitValue('pursuitMarket'),signals:pursuitValue('pursuitSignals'),limit:20})});await refreshStudio();setStatus(`Found ${data.count||0} public demand signals. Review evidence before outreach.`);if(btn){btn.disabled=false;btn.textContent='✦ Discover opportunities'}}catch(err){setStatus(err.message,true);alert(err.message);const btn=e.submitter;if(btn){btn.disabled=false;btn.textContent='✦ Discover opportunities'}}});
$('#pursuitRefreshBtn')?.addEventListener('click',async()=>{await refreshStudio();setStatus('Pursuit pipeline refreshed.')});

function listingValue(id){return ($('#'+id)?.value||'').trim()}
function renderListingPhotoPreview(){
  const root=$('#listingPhotoPreview'); if(!root)return; root.innerHTML='';
  listingDraftImages.slice(0,12).forEach(src=>{const img=document.createElement('img');img.src=src;img.alt='Property photo';root.appendChild(img)});
}
function currentListingPayload(){
  return {
    id:listingDraftId||undefined,
    source_url:listingValue('listingSourceUrl'),title:listingValue('listingTitle')||'Untitled property',address:listingValue('listingAddress'),city:listingValue('listingCity'),
    bedrooms:listingValue('listingBedrooms'),bathrooms:listingValue('listingBathrooms'),monthly_rate:listingValue('listingRate'),currency:$('#listingCurrency')?.value||'CAD',minimum_stay:listingValue('listingMinStay'),
    parking:listingValue('listingParking'),laundry:listingValue('listingLaundry'),wifi:listingValue('listingWifi'),amenities:listingValue('listingAmenities').split(/[\n,]/).map(x=>x.trim()).filter(Boolean),
    neighbourhood_facts:listingValue('listingNeighbourhood'),notes:listingValue('listingNotes'),images:listingDraftImages
  };
}
function clearListingForm(){listingDraftId='';listingDraftImages=[];$('#listingForm')?.reset();renderListingPhotoPreview();}
function loadListingIntoForm(id){
  const x=studioState.listings.find(l=>l.id===id); if(!x)return;
  listingDraftId=x.id; listingDraftImages=[...(x.images||[])];
  const set=(id,v)=>{if($('#'+id))$('#'+id).value=v||''};
  set('listingSourceUrl',x.source_url);set('listingTitle',x.title);set('listingAddress',x.address);set('listingCity',x.city);set('listingBedrooms',x.bedrooms);set('listingBathrooms',x.bathrooms);set('listingRate',x.monthly_rate);set('listingCurrency',x.currency||'CAD');set('listingMinStay',x.minimum_stay);set('listingParking',x.parking);set('listingLaundry',x.laundry);set('listingWifi',x.wifi);set('listingAmenities',(x.amenities||[]).join(', '));set('listingNeighbourhood',x.neighbourhood_facts);set('listingNotes',x.notes);renderListingPhotoPreview();renderListingOutput(x);switchStudioTab('listings');
}
function videoUrlFromResult(obj){return typeof obj?.video==='string'?obj.video:(obj?.video?.url||obj?.video_asset?.url||'')}
function renderListingOutput(x){
  const root=$('#listingOutput'); if(!root)return;
  const g=x?.generated||{}, c=g.copy||{}; if(!Object.keys(g).length){root.classList.add('hidden');root.innerHTML='';return}
  const sections=[];
  if(c.short_description)sections.push(`<div class="listing-output-section"><h4>Short description</h4><p>${escapeHtml(c.short_description)}</p></div>`);
  if(c.long_description)sections.push(`<div class="listing-output-section"><h4>Furnished-housing description</h4><p>${escapeHtml(c.long_description)}</p></div>`);
  if(c.amenity_highlights?.length)sections.push(`<div class="listing-output-section"><h4>Amenity highlights</h4><p>${c.amenity_highlights.map(v=>'• '+escapeHtml(v)).join('<br>')}</p></div>`);
  if(c.neighbourhood_section)sections.push(`<div class="listing-output-section"><h4>Neighbourhood</h4><p>${escapeHtml(c.neighbourhood_section)}</p></div>`);
  if(c.email_body)sections.push(`<div class="listing-output-section"><h4>Email-ready copy</h4><p><strong>${escapeHtml(c.email_subject||'')}</strong>\n\n${escapeHtml(c.email_body)}</p></div>`);
  if(c.proposal_intro)sections.push(`<div class="listing-output-section"><h4>Client proposal intro</h4><p>${escapeHtml(c.proposal_intro)}</p></div>`);
  let assets=''; if(g.property_sheet?.url)assets+=`<a class="cc-secondary-btn" href="${g.property_sheet.url}" target="_blank" rel="noopener">Open property sheet PDF</a>`;
  if(g.client_proposal?.url)assets+=`<a class="cc-secondary-btn" href="${g.client_proposal.url}" target="_blank" rel="noopener">Open client proposal PDF</a>`;
  const reel=videoUrlFromResult(g.reel), propVid=videoUrlFromResult(g.property_video); if(reel)assets+=`<a class="cc-secondary-btn" href="${reel}" target="_blank">Open Reel</a>`; if(propVid)assets+=`<a class="cc-secondary-btn" href="${propVid}" target="_blank">Open property video</a>`;
  if(g.reel_error||g.property_video_error)assets+=`<div class="listing-trust-note" style="margin-top:8px">Video note: ${escapeHtml(g.reel_error||g.property_video_error)}</div>`;
  root.innerHTML=`<h3>${escapeHtml(x.title)} · Sales Pack</h3>${assets}${sections.join('')}`;root.classList.remove('hidden');
}
function renderListingList(){
  const root=$('#listingList'); if(!root)return; root.innerHTML=''; $('#listingLibraryMeta').textContent=`${studioState.listings.length} saved ${studioState.listings.length===1?'property':'properties'}`;
  if(!studioState.listings.length){root.innerHTML='<div class="history-card"><p>No properties yet. Import a URL or upload photos to create your first reusable listing.</p></div>';return}
  studioState.listings.forEach(x=>{const card=document.createElement('div');card.className='listing-card';const thumb=(x.images||[])[0];card.innerHTML=`${thumb?`<img class="listing-card-thumb" src="${thumb}" alt="${escapeHtml(x.title)}">`:'<div class="listing-card-thumb"></div>'}<div><h4>${escapeHtml(x.title)}</h4><p>${escapeHtml([x.address,x.city].filter(Boolean).join(' · '))}</p><div class="listing-badges">${x.bedrooms?`<span class="listing-badge">${escapeHtml(x.bedrooms)} BR</span>`:''}${x.bathrooms?`<span class="listing-badge">${escapeHtml(x.bathrooms)} BA</span>`:''}${x.monthly_rate?`<span class="listing-badge">${escapeHtml(x.currency||'')} ${escapeHtml(x.monthly_rate)}</span>`:''}<span class="listing-badge">${escapeHtml(x.status||'draft')}</span></div><div class="mini-actions"><button data-listing-open="${x.id}">Open</button><button data-listing-sales-ready="${x.id}">Make Sales Ready</button><button data-listing-video="${x.id}">Property Video</button><button data-listing-proposal="${x.id}">Client Proposal</button></div></div>`;root.appendChild(card)});
  $$('[data-listing-open]').forEach(btn=>btn.onclick=()=>loadListingIntoForm(btn.dataset.listingOpen));
  $$('[data-listing-sales-ready]').forEach(btn=>btn.onclick=()=>makeListingSalesReadyUI(btn.dataset.listingSalesReady));
  $$('[data-listing-video]').forEach(btn=>btn.onclick=()=>createListingVideoUI(btn.dataset.listingVideo));
  $$('[data-listing-proposal]').forEach(btn=>btn.onclick=()=>createListingProposalUI(btn.dataset.listingProposal));
}
async function saveCurrentListing(){
  const data=await studioFetchJson('/api/listings/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(currentListingPayload())}); listingDraftId=data.listing.id; listingDraftImages=[...(data.listing.images||[])]; await refreshStudio(); loadListingIntoForm(data.listing.id); return data.listing;
}
function currentProposalPayload(){
  return {
    company:listingValue('proposalCompany'),contact:listingValue('proposalContact'),guest:listingValue('proposalGuest'),
    arrival:listingValue('proposalArrival'),departure:listingValue('proposalDeparture'),quoted_rate:listingValue('proposalRate'),notes:listingValue('proposalNotes')
  };
}
async function ensureListingForAction(id=''){
  let listing=id?studioState.listings.find(x=>x.id===id):null;
  if(!listing)listing=await saveCurrentListing();
  return listing;
}
async function makeListingSalesReadyUI(id=''){
  const btn=$('#listingSalesReadyBtn');
  try{
    const listing=await ensureListingForAction(id); setStatus('Making property sales-ready…'); if(btn){btn.disabled=true;btn.textContent='Working…'}
    const data=await studioFetchJson('/api/listings/make-sales-ready',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:listing.id})});
    listingDraftId=data.listing.id; await refreshStudio(); loadListingIntoForm(data.listing.id); renderListingOutput(data.listing); setStatus('Property is sales-ready.');
  }catch(err){setStatus(err.message,true);alert(err.message)}finally{if(btn){btn.disabled=false;btn.textContent='✦ Make Sales Ready'}}
}
async function createListingVideoUI(id=''){
  const btn=$('#listingVideoBtn');
  try{
    const listing=await ensureListingForAction(id); setStatus('Creating truthful property video…'); if(btn){btn.disabled=true;btn.textContent='Generating video…'}
    const data=await studioFetchJson('/api/listings/property-video',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:listing.id})});
    listingDraftId=data.listing.id; await refreshStudio(); loadListingIntoForm(data.listing.id); renderListingOutput(data.listing); setStatus('Property video ready.');
  }catch(err){setStatus(err.message,true);alert(err.message)}finally{if(btn){btn.disabled=false;btn.textContent='▶ Create Property Video'}}
}
async function createListingProposalUI(id=''){
  const btn=$('#listingProposalBtn');
  try{
    const listing=await ensureListingForAction(id); setStatus('Creating branded client proposal…'); if(btn){btn.disabled=true;btn.textContent='Creating proposal…'}
    const data=await studioFetchJson('/api/listings/client-proposal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:listing.id,client:currentProposalPayload()})});
    listingDraftId=data.listing.id; await refreshStudio(); loadListingIntoForm(data.listing.id); renderListingOutput(data.listing); setStatus('Client proposal ready.');
  }catch(err){setStatus(err.message,true);alert(err.message)}finally{if(btn){btn.disabled=false;btn.textContent='▦ Create Client Proposal'}}
}
async function generateListingPack(id=''){
  try{
    const listing=await ensureListingForAction(id); setStatus('Creating full sales pack…');
    const data=await studioFetchJson('/api/listings/generate-pack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:listing.id,video:true})});
    listingDraftId=data.listing.id; await refreshStudio(); loadListingIntoForm(data.listing.id); renderListingOutput(data.listing); setStatus('Sales pack ready.');
  }catch(err){setStatus(err.message,true);alert(err.message)}
}
$('#listingPhotos')?.addEventListener('change',async e=>{const files=[...(e.target.files||[])].slice(0,12);const vals=[];for(const f of files)vals.push(await fileToDataUrl(f));listingDraftImages=[...listingDraftImages,...vals].slice(0,30);renderListingPhotoPreview();e.target.value=''});
$('#listingImportBtn')?.addEventListener('click',async()=>{
  try{const url=listingValue('listingSourceUrl');if(!url)throw new Error('Paste a listing URL first.');setStatus('Importing property listing…');const data=await studioFetchJson('/api/listings/import-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});const x=data.extracted||{};const setIf=(id,v)=>{if(v&&$('#'+id)&&!$('#'+id).value)$('#'+id).value=Array.isArray(v)?v.join(', '):v};setIf('listingTitle',x.title||data.title);setIf('listingAddress',x.address);setIf('listingCity',x.city);setIf('listingBedrooms',x.bedrooms);setIf('listingBathrooms',x.bathrooms);setIf('listingRate',x.monthly_rate);setIf('listingCurrency',x.currency);setIf('listingMinStay',x.minimum_stay);setIf('listingParking',x.parking);setIf('listingLaundry',x.laundry);setIf('listingWifi',x.wifi);setIf('listingAmenities',x.amenities);setIf('listingNotes',x.notes||data.description);listingDraftImages=[...listingDraftImages,...(data.images||[])].filter((v,i,a)=>a.indexOf(v)===i).slice(0,30);renderListingPhotoPreview();setStatus(`Imported listing details${data.images?.length?` and ${data.images.length} images`:''}. Review facts before saving.`)}catch(err){setStatus(err.message,true);alert(err.message)}
});
$('#listingForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await saveCurrentListing();setStatus('Property saved to the reusable listing library.')}catch(err){setStatus(err.message,true);alert(err.message)}});
$('#listingSalesReadyBtn')?.addEventListener('click',()=>makeListingSalesReadyUI());
$('#listingVideoBtn')?.addEventListener('click',()=>createListingVideoUI());
$('#listingProposalBtn')?.addEventListener('click',()=>createListingProposalUI());

// Calm workspace navigation; existing conversations and settings are preserved.
$("#sidebarToggle")?.addEventListener("click", () => {
 const open = document.body.classList.toggle("nav-open");
 $("#sidebarToggle").setAttribute("aria-expanded", String(open));
});
document.addEventListener("keydown", e => {
 if(e.key === "Escape") { document.body.classList.remove("nav-open"); $("#sidebarToggle")?.setAttribute("aria-expanded", "false"); }
});
for (const [id, tab] of [["salesNavBtn", "salesAgent"], ["marketingNavBtn", "marketingAgent"]]) {
 $("#" + id)?.addEventListener("click", () => { setMainView("studio"); switchStudioTab(tab); refreshStudio(); });
}

function renderCampaignStrategy(kind,strategy){
 const root=document.querySelector('#'+kind+'CampaignStrategy');if(!root)return;root.innerHTML='';
 if(!strategy){root.textContent='Build a campaign strategy to define buyers, positioning, objections and experiments.';return;}
 const title=document.createElement('h3');title.textContent=strategy.objective;root.append(title);
 const position=document.createElement('p');position.textContent=strategy.positioning||'';root.append(position);
 for(const [key,label] of [['target_segments','Target segments'],['buyer_roles','Buyer roles'],['disqualifiers','Exclude'],['discovery_questions','Discovery questions'],['next_actions','Next actions']]){
 const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=label;details.append(summary);const list=document.createElement('ul');(strategy[key]||[]).forEach(value=>{const li=document.createElement('li');li.textContent=typeof value==='string'?value:JSON.stringify(value);list.append(li)});details.append(list);root.append(details);
 }
}
for(const kind of ['sales','marketing'])document.querySelector('#'+kind+'StrategyBtn')?.addEventListener('click',async e=>{
 const button=e.currentTarget;button.disabled=true;try{if(kind==='sales')await saveSalesSettings();else await saveMarketingSettings();setStatus('Building an evidence-grounded campaign strategy…');await studioFetchJson('/api/agents/strategy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind})});await refreshStudio();setStatus('Campaign strategy ready. Review the target segments before running.')}catch(err){setStatus(err.message,true);alert(err.message)}finally{button.disabled=false}
});
document.querySelector('#readTravellezWebsite')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{setStatus('Reading Travellez website…');const result=await studioFetchJson('/api/agents/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});await refreshStudio();setStatus(result.message)}catch(err){setStatus(err.message,true);alert(err.message)}finally{button.disabled=false}});

$('#salesImportForm')?.addEventListener('submit',async event=>{
 event.preventDefault();const button=event.submitter,note=$('#salesImportStatus');
 try{if(button)button.disabled=true;const file=$('#salesImportFile')?.files?.[0];if(file&&file.size>1000000)throw new Error('Choose an export smaller than 1 MB.');const text=file?await file.text():$('#salesImportText')?.value||'';
 const result=await studioFetchJson('/api/agents/sales/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
 await refreshStudio();note.textContent=`${result.imported} imported · ${result.duplicates} duplicates skipped. Research and qualify next.`;setStatus(note.textContent);
 }catch(err){note.textContent=err.message;setStatus(err.message,true)}finally{if(button)button.disabled=false}
});
