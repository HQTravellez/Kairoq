(() => {
 // Connections dialog: one status per row, and the Railway variables only for apps that are not connected yet.
 const dialog = document.querySelector('#connectorsDialog');
 if (!dialog) return;
 const variables = {
  google:'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI',
  microsoft:'MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI',
  localAi:'LOCAL_LLM_BASE_URL, LOCAL_LLM_MODEL',
  github:'GITHUB_TOKEN, GITHUB_REPO',
  nuitee:'NUITEE_API_KEY',
  slack:'SLACK_BOT_TOKEN',
  shopify:'SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN',
  metaAds:'META_ADS_ACCESS_TOKEN',
  googleAds:'GOOGLE_ADS_CUSTOMER_ID (and Google connected with Ads access)',
  browserless:'BROWSERLESS_URL, BROWSERLESS_TOKEN',
  notifications:'NOTIFY_WEBHOOK_URL',
  telegram:'TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ALLOWED_CHAT_ID',
  twilio:'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM or TWILIO_WHATSAPP_FROM',
  higgsfield:'HIGGSFIELD_CREDENTIALS, or HIGGSFIELD_API_KEY_ID and HIGGSFIELD_API_KEY_SECRET',
  encryption:'APP_ENCRYPTION_KEY',
  webhook:'AGENT_WEBHOOK_URL'
 };
 const head = dialog.querySelector('.kd-head > div');
 const refresh = document.createElement('button');
 refresh.type = 'button'; refresh.id = 'refreshConnections'; refresh.className = 'kd-link'; refresh.textContent = 'Check again';
 refresh.addEventListener('click', () => loadConnectorStatus());
 head?.append(refresh);
 // Search across every row, including the ones folded under "Behind the scenes".
 const search = document.createElement('input');
 search.type = 'search'; search.className = 'kd-search'; search.placeholder = 'Search'; search.setAttribute('aria-label', 'Search connections');
 dialog.querySelector('.kd-body')?.prepend(search);
 search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  dialog.querySelectorAll('.connector-row').forEach(r => { r.hidden = !!q && !r.textContent.toLowerCase().includes(q); });
  dialog.querySelectorAll('.kd-label').forEach(l => { l.hidden = !!q; });
  const fold = dialog.querySelector('.kd-fold'); if (fold && q) fold.open = true;
 });
 for (const [id, vars] of Object.entries(variables)) {
  const status = document.querySelector('#' + id + 'ConnectorStatus'); if (!status) continue;
  const row = status.closest('.connector-row');
  const badge = document.createElement('span'); badge.className = 'connection-state';
  const name = row.querySelector('strong'), title = document.createElement('span');
  title.className = 'kd-title'; name.before(title); title.append(name, badge);
  const mark = document.createElement('span'); mark.className = 'kd-mark'; mark.setAttribute('aria-hidden', 'true');
  mark.textContent = name.textContent.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  row.prepend(mark);
  const setup = document.createElement('details'); setup.className = 'connection-setup';
  setup.innerHTML = '<summary>How to connect</summary><p>Add these in Railway → Kairoq → Variables, then redeploy. Never paste keys into chat.</p><code></code>';
  setup.querySelector('code').textContent = vars;
  status.after(setup);
  const update = () => {
   const value = status.textContent;
   const state = /^Connected|^Enabled/.test(value) ? 'Connected' : /^Configured/.test(value) ? 'Ready' : /^Checking/.test(value) ? 'Checking' : /^Unable|^Error/.test(value) ? 'Unavailable' : 'Not set up';
   badge.textContent = state; badge.dataset.state = state;
   row.dataset.state = state;
   status.classList.toggle('kd-plain', /^Not configured\.?$/.test(value.trim()));
   setup.hidden = state === 'Connected' || state === 'Ready' || state === 'Checking';
  };
  new MutationObserver(update).observe(status, { childList: true, characterData: true, subtree: true });
  update();
 }
})();
