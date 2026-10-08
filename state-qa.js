'use strict';
// Journey fixtures run only as the freshly registered, isolated QA identity.
async function appStates(page,collections,{sample,selectCollection,shot,fixtures=true}){
 const tested=[];
 for(const collection of collections){
  await page.setViewportSize({width:1440,height:1000});await selectCollection(page,collection.name);
  const read=()=>page.evaluate(async name=>{const r=await fetch('api/collections/'+name);if(!r.ok)throw Error('Collection fetch failed');return(await r.json()).records;},collection.name);
  const before=await read();if(before.length)throw Error('QA collection must be empty at the start of its journey');
  await shot(page,'Desktop '+collection.label+' · empty');
  const values=sample(collection);for(const field of collection.fields){const input=page.locator('#record-form [name="'+field.name+'"]');if(field.type==='boolean')await input.setChecked(values[field.name]);else if(field.type==='select')await input.selectOption(String(values[field.name]));else await input.fill(String(values[field.name]??''));}
  if(fixtures){
   const required=collection.fields.find(f=>f.required&&['text','textarea','email','number','date'].includes(f.type));
   if(required){const input=page.locator('#record-form [name="'+required.name+'"]');await input.fill('');await page.locator('#save-record').click();if((await read()).length)throw Error('Invalid form saved a record');if(await input.evaluate(n=>n.validity.valid))throw Error('Required field validation missing');if(!await page.locator('#app-message[role=alert]').isVisible())throw Error('Validation has no visible explanation');await shot(page,'Desktop '+collection.label+' · validation');await input.fill(String(values[required.name]));tested.push(collection.name+': required form validation');}
   const route='**/api/collections/'+collection.name;
   // Observe a pending save, then a controlled service error and successful retry.
   let unblock,seen;const observed=new Promise(r=>seen=r),blocked=new Promise(r=>unblock=r);
   await page.route(route,async request=>{if(request.request().method()!=='POST')return request.continue();seen();await blocked;await request.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'We couldn’t save this record. Please try again.'})});});
   try{await page.locator('#save-record').click();await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Save request not observed')),5000))]);if(!await page.locator('#save-record').isDisabled())throw Error('Saving state allows duplicate submissions');await shot(page,'Desktop '+collection.label+' · saving');unblock();await page.locator('#app-message[role=alert]').waitFor({state:'visible',timeout:10000});if(!await page.locator('#save-record').isEnabled())throw Error('Failed save cannot be retried');await shot(page,'Desktop '+collection.label+' · service error');tested.push(collection.name+': pending save and error recovery');}finally{unblock?.();await page.unroute(route);}
  }
  await page.locator('#save-record').click();await page.waitForFunction(async name=>(await(await fetch('api/collections/'+name)).json()).records.length===1,collection.name,{timeout:10000});await page.locator('[data-record-id]').waitFor();
  const created=(await read())[0];for(const[key,value]of Object.entries(values))if(created.data[key]!==value)throw Error('UI create did not preserve '+collection.name+'.'+key);
  await shot(page,'Desktop '+collection.label+' · saved');
  await page.locator('[data-record-id] button[data-action=edit]').click();if(!/^Edit /i.test(await page.locator('#form-title').innerText()))throw Error('Edit mode heading is unclear');if(await page.locator('#app-message').isVisible())throw Error('Edit mode retains stale save message');await shot(page,'Desktop '+collection.label+' · editing');
  const change=collection.fields.find(f=>f.type==='select'&&f.options.length>1)||collection.fields.find(f=>['text','textarea','number'].includes(f.type));
  if(change){const value=change.type==='select'?change.options.find(v=>v!==created.data[change.name]):change.type==='number'?126:'Edited QA '+change.label;const input=page.locator('#record-form [name="'+change.name+'"]');if(change.type==='select')await input.selectOption(value);else await input.fill(String(value));await page.locator('#save-record').click();await page.waitForFunction(async({name,key,value})=>(await(await fetch('api/collections/'+name)).json()).records.some(r=>r.data[key]===value),{name:collection.name,key:change.name,value},{timeout:10000});}
  else await page.locator('#save-record').click();
  const saved=(await read())[0];await page.reload();await page.locator('#record-form').waitFor({state:'visible'});await selectCollection(page,collection.name);await page.locator('[data-record-id]').waitFor();if(JSON.stringify((await read())[0].data)!==JSON.stringify(saved.data))throw Error('Reload lost edited values');
  if(await page.locator('#record-search').count()){await page.locator('#record-search').fill('kairoq-no-match-qa-847236');await page.waitForFunction(()=>!document.querySelector('[data-record-id]'));await shot(page,'Desktop '+collection.label+' · no matches');await page.locator('#record-search').fill('');await page.locator('[data-record-id]').waitFor();tested.push(collection.name+': search empty state');}
  const filters=page.locator('#app-view select[data-field]');for(const filter of await filters.all()){const name=await filter.getAttribute('data-field'),field=collection.fields.find(f=>f.name===name);if(field?.type!=='select')continue;for(const value of field.options){await filter.selectOption(value);const expected=(await read()).filter(r=>r.data[name]===value).length;await page.waitForFunction(count=>document.querySelectorAll('[data-record-id]').length===count,expected,{timeout:5000});}await filter.selectOption('');tested.push(collection.name+': '+name+' filter');}
  const dashboard=await page.evaluate(async()=>(await(await fetch('api/dashboard')).json()));if(dashboard.collections[collection.name]!==1)throw Error('Dashboard collection count is incorrect');
  // Verify intermediate tablet widths as well as mobile before modifying records.
  for(const width of [768,1024]){
   await page.setViewportSize({width,height:900});
   await page.reload();await page.locator('#record-form').waitFor({state:'visible'});
   await selectCollection(page,collection.name);await page.locator('[data-record-id]').waitFor();
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+8))throw Error('Responsive overflow at '+width+'px in '+collection.name);
   await shot(page,'Responsive '+width+'px '+collection.label+' · saved');
   tested.push(collection.name+': responsive '+width+'px');
  }
  await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('#record-form').waitFor({state:'visible'});await selectCollection(page,collection.name);await page.locator('[data-record-id]').waitFor();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+8))throw Error('Mobile overflow in '+collection.name);await shot(page,'Mobile '+collection.label+' · saved');
  await page.locator('[data-record-id] button[data-action=edit]').click();await shot(page,'Mobile '+collection.label+' · editing');await page.locator('#cancel-edit').click();
  await page.locator('[data-record-id] button[data-action=delete]').click();await page.waitForFunction(async name=>(await(await fetch('api/collections/'+name)).json()).records.length===0,collection.name,{timeout:10000});tested.push(collection.name+': UI create/edit/reload/delete, dashboard, desktop and mobile');
 }
 return tested;
}
module.exports={appStates};
