(() => {
 const dialog = document.querySelector('#connectorsDialog');
 if (!dialog) return;
 const list = dialog.querySelector('.connector-list');
 const definitions = [
 ['google','Communication','G','Email research, drafts, and calendar planning.','GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI'],
 ['microsoft','Communication','M','Outlook, calendar, OneDrive, and Office files.','MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI'],
 ['localAi','AI & tools','AI','Use your own model endpoint.','LOCAL_LLM_BASE_URL, LOCAL_LLM_MODEL'],
 ['github','AI & tools','GH','Research repositories and work with code.','GITHUB_TOKEN, GITHUB_REPO'],
 ['nuitee','Business','T','Search hotel availability for travel work.','NUITEE_API_KEY'],
 ['slack','Communication','S','Research conversations and prepare team updates.','SLACK_BOT_TOKEN'],
 ['shopify','Business','S','Analyze your store and prepare improvements.','SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN'],
 ['metaAds','Business','M','Review advertising performance.','META_ADS_ACCESS_TOKEN'],
 ['googleAds','Business','G','Review campaign reporting through Google.','GOOGLE_ADS_CUSTOMER_ID; Google OAuth with Ads access'],
 ['browserless','AI & tools','W','Read rendered pages and run approved browser actions.','BROWSERLESS_URL, BROWSERLESS_TOKEN'],
 ['notifications','Communication','N','Receive agent completion and failure updates.','NOTIFY_WEBHOOK_URL'],
 ['telegram','Communication','T','Give Kairoq tasks from Telegram.','TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ALLOWED_CHAT_ID'],
 ['twilio','Communication','W','Reach Kairoq through WhatsApp and SMS.','TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM or TWILIO_WHATSAPP_FROM'],
 ['higgsfield','AI & tools','H','Generate media with your connected provider.','HIGGSFIELD_CREDENTIALS or HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_KEY_SECRET'],
 ['encryption','AI & tools','K','Protect saved connector credentials.','APP_ENCRYPTION_KEY'],
 ['webhook','AI & tools','↗','Run actions through your approved endpoint.','AGENT_WEBHOOK_URL']
 ];
 const intro=document.createElement('p');intro.className='connections-intro';intro.textContent='Bring your work into Kairoq. Connect the apps your Sales and Marketing agents need.';
 dialog.querySelector('.settings-head').after(intro);
 const toolbar=document.createElement('div');toolbar.className='connections-toolbar';
 toolbar.innerHTML='<input type="search" id="connectorSearch" placeholder="Search apps…" aria-label="Search connections"><button type="button" id="refreshConnections">Refresh status</button>';
 intro.after(toolbar);
 const tabs=document.createElement('div');tabs.className='connections-filters';tabs.setAttribute('aria-label','Filter connections');
 ['All apps','Communication','Business','AI & tools'].forEach((label,i)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.filter=label;button.setAttribute('aria-pressed',String(i===0));tabs.append(button)});toolbar.after(tabs);
 let active='All apps';const cards=[];
 for (const [id,category,mark,description,variables] of definitions) {
  const status=document.querySelector('#'+id+'ConnectorStatus');if(!status)continue;
  const card=status.closest('.connector-row');card.classList.add('connection-card');
  const icon=document.createElement('span');icon.className='connection-icon';icon.textContent=mark;icon.setAttribute('aria-hidden','true');card.prepend(icon);
  const content=status.parentElement;const copy=document.createElement('p');copy.className='connection-description';copy.textContent=description;content.querySelector('strong').after(copy);
  const old=card.querySelector('.connector-env');old?.remove();
  const badge=document.createElement('span');badge.className='connection-state';content.append(badge);
  const details=document.createElement('details');details.className='connection-setup';
  const summary=document.createElement('summary');summary.textContent='Setup guide';details.append(summary);
  const help=document.createElement('p');help.textContent='Add the following credentials in Railway → Kairoq → Variables, then deploy. Keep secrets out of chat.';details.append(help);
  const code=document.createElement('code');code.textContent=variables;details.append(code);
  if(id==='google'||id==='microsoft'){const next=document.createElement('p');next.textContent='Once configured, use the Connect button to authorize your account.';details.append(next)}
  card.append(details);
  function update(){const value=status.textContent;let state='Setup needed';if(/^Connected|^Enabled/.test(value))state='Connected';else if(/^Configured/.test(value))state='Configured';else if(/^Checking/.test(value))state='Checking';else if(/^Unable|^Error/.test(value))state='Unavailable';badge.textContent=state;badge.dataset.state=state;}
  new MutationObserver(update).observe(status,{childList:true,characterData:true,subtree:true});update();
  cards.push({card,category,text:content.textContent.toLowerCase()});
 }
 const empty=document.createElement('p');empty.className='connections-empty';empty.textContent='No apps match your search.';empty.hidden=true;list.after(empty);
 function filter(){const query=toolbar.querySelector('input').value.toLowerCase().trim();let count=0;cards.forEach(({card,category,text})=>{const show=(active==='All apps'||active===category)&&text.includes(query);card.hidden=!show;if(show)count++});empty.hidden=count>0;}
 toolbar.querySelector('input').addEventListener('input',filter);
 tabs.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;active=button.dataset.filter;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filter()});
 toolbar.querySelector('button').addEventListener('click',()=>loadConnectorStatus());
 dialog.querySelector('#closeConnectors').setAttribute('aria-label','Close connections');
})();
