"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-design-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_WEB_RESEARCH='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='60';
process.env.KAIROQ_BUILDER_PAID_APPROVED='true';
process.env.KAIROQ_WEB_RESEARCH='off';
process.env.KAIROQ_DESIGN_PANEL='off';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),hosting=require('../react-hosting');
const design=require('../react-design'),skills=require('../react-skills'),mobile=require('../react-mobile'),runtime=require('../runtime-check');

const BRIEF={name:'Warm Lisbon editorial',summary:'Calm and photographic with serif headlines.',palette:{background:'#faf7f2',foreground:'#1f1b16',primary:'#b4532a',secondary:'#efe6da',accent:'#c8a96a',muted:'#f1ebe3'},fonts:{display:'Cormorant Garamond',body:'DM Sans'},radius:'0.5rem',layout:'Full-bleed hero, alternating image and text.',imagery:'Warm daylight photos of rooms and tiles.',details:['Serif headlines in light weight','Thin dividers'],skill:'luxury-hospitality'};
const APP='export default function App(){return <main className="min-h-screen bg-background text-foreground"><h1 className="font-display text-5xl">Casa Azul</h1><img src="./uploads/hero-terrace.jpg" alt="Terrace" /></main>}\n';
// The scripted model: answers the art-director prompt with BRIEF and everything else from a queue.
let queue=[],calls=[];
const callModel=async(opts,parse)=>{
 calls.push(opts);
 if(String(opts.messages[0].content).startsWith('You are the art director'))return parse(JSON.stringify(BRIEF));
 const next=queue.shift()||{message:'ok',files:{}};
 return parse(typeof next==='function'?next(opts):JSON.stringify(next));
};
// The request the model got (the messages array keeps growing after the call).
const lastUser=opts=>opts.messages.filter(m=>m.role==='user').at(-1).content;
const PNG=mobile.solidPng(8,'#3366ff').toString('base64');
let shots=[],imageCalls=[],imageFail=false;
const deps={designShots:async()=>shots,generateImage:async img=>{imageCalls.push(img);if(imageFail)throw Error('provider down');return{mime:'image/png',data:PNG}}};
let enabled={designShots:true,generateImage:true};

function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,headers:res.headers,json,text:buf.toString()})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false,designShots:enabled.designShots?deps.designShots:undefined,generateImage:enabled.generateImage?deps.generateImage:null}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.9.0.'+(++ip)}});assert.equal(r.status,201,r.text);return r.headers['set-cookie'][0].split(';')[0]}
async function waitJob(cookie,job){for(let i=0;i<400;i++){const j=(await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job;if(['complete','failed'].includes(j.status))return j;await new Promise(r=>setTimeout(r,25))}throw Error('job timeout')}
async function credits(cookie){return(await request(server,'GET','/api/create/credits',{headers:{cookie}})).json.account.credits}

test('new projects start with the UI kit and design tokens, the model sees the kit API, and the theme compiles',async()=>{
 const files=design.starterFiles('Casa Azul');
 assert.ok(files['src/components/ui/button.jsx']&&files['src/components/ui/sheet.jsx']&&files['src/lib/utils.js']);
 assert.ok(Object.keys(files).filter(f=>f.startsWith('src/components/ui/')).length>=15);
 assert.deepEqual(builder.validateFiles(files),[]);
 assert.ok(design.hasTokens(files)&&design.isUntouchedStarter(files));
 assert.match(files['src/index.css'],/^@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;500;600;700&display=swap'\);/);
 const ctx=builder.contextFiles(files);
 assert.match(ctx,/UI kit \(unchanged starter files[\s\S]*button\.jsx: Button \{variant: default\|secondary/);
 assert.ok(!ctx.includes('buttonVariants = cva('),'kit code is summarised, not sent');
 const out=path.join(tmp,'starter-dist');
 await builder.runBuild({...files,'src/App.jsx':"import { Button } from './components/ui/button.jsx';\nexport default function App(){return <Button variant=\"hero\" className=\"rounded-xl font-display shadow-soft bg-primary/10\">Book</Button>}\n"},out);
 const css=fs.readFileSync(path.join(out,'assets',fs.readdirSync(path.join(out,'assets')).find(f=>f.endsWith('.css'))),'utf8');
 assert.match(css,/hsl\(var\(--primary\)\s*\/\s*\.1\)/,'opacity modifiers work on token colours');
 assert.match(css,/\.font-display\{font-family:var\(--font-display/);
 assert.match(css,/\.rounded-xl\{border-radius:var\(--radius-xl, ?\.75rem\)\}/,'old projects keep Tailwind\'s default radius');
 assert.match(css,/--primary:/);
 // Exports carry the same theme.
 assert.match(require('../react-export').exportFiles((await builder.initialize(builder.create({name:'Export check'}))).id)['tailwind.config.js'],/"gradient-hero": "var\(--gradient-hero, none\)"/);
});

test('tokens are readable: foregrounds are chosen for contrast and briefs are validated',()=>{
 const t=design.tokens({palette:{background:'#0b0d12',foreground:'#9ca3af',primary:'#facc15',secondary:'#1f2937',accent:'#22d3ee'}});
 const hsl=v=>{const [h,s,l]=v.split(' ').map(parseFloat);const a=s/100*Math.min(l/100,1-l/100),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l/100-a*Math.max(-1,Math.min(k-3,9-k,1))))};return[f(0),f(8),f(4)]};
 assert.ok(design.contrast(hsl(t['--foreground']),hsl(t['--background']))>=6.5,'body text is pushed to strong contrast');
 assert.ok(design.contrast(hsl(t['--primary-foreground']),hsl(t['--primary']))>=4.5,'text on a yellow button is dark');
 assert.ok(design.contrast(hsl(t['--muted-foreground']),hsl(t['--muted']))>=4.4);
 assert.throws(()=>design.normalize({palette:{background:'red'}}),/valid background/);
 const n=design.normalize({...BRIEF,fonts:{display:'comic sans',body:'dm sans'},radius:'9rem',skill:'../x'});
 assert.deepEqual([n.fonts.display,n.fonts.body,n.radius,n.skill],['Inter','DM Sans','0.75rem','']);
 // Re-applying replaces the token block and the font import instead of stacking them.
 const css=design.applyToCss(design.applyToCss(design.starterFiles('x')['src/index.css'],BRIEF),{...BRIEF,fonts:{display:'Fraunces',body:'Inter'}});
 assert.equal(css.match(/kairoq:tokens:end/g).length,1);assert.equal(css.match(/kairoq:fonts/g).length,1);
 assert.match(css,/family=Fraunces:wght@400;500;600;700&family=Inter/);
});

test('the first build gets a design brief and a matching skill; later builds follow it',async()=>{
 const cookie=await signup('brief@example.com');
 queue=[{message:'Built the hotel site.',files:{'src/App.jsx':APP}},{message:'Added reviews.',files:{'src/App.jsx':APP.replace('Casa Azul','Casa Azul · Reviews')}}];calls=[];
 enabled.generateImage=false;
 const created=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{prompt:'A boutique hotel website for Casa Azul in Lisbon'}})).json;
 const job=await waitJob(cookie,created.job);
 assert.equal(job.status,'complete',job.error);
 const id=created.project.id,meta=builder.loadMeta(id);
 assert.equal(meta.design.name,'Warm Lisbon editorial');assert.deepEqual(meta.skills,['luxury-hospitality']);
 assert.match(calls[0].messages[0].content,/luxury-hospitality: Luxury hospitality/,'the art director sees the skills');
 assert.equal(calls[0].design,true,'the brief goes to the design model');assert.ok(!calls[1].design,'the code goes to the tier model');
 const system=calls[1].messages[0].content;
 assert.match(system,/DESIGN \(as important as working code/);
 assert.match(system,/DESIGN BRIEF for this project[\s\S]*Warm Lisbon editorial[\s\S]*Cormorant Garamond for headings/);
 assert.match(system,/### Skill: Luxury hospitality/);
 const files=builder.loadFiles(id,meta.current_version);
 assert.match(files['src/index.css'],/--primary: 18 62% 44%;/,'#b4532a as HSL');
 assert.match(files['src/index.css'],/family=Cormorant\+Garamond:wght@400;500;600;700&family=DM\+Sans/);
 // No image generation here: the requested image becomes a placeholder and the user is told.
 const msg=meta.messages.at(-1);
 assert.equal(msg.design.name,'Warm Lisbon editorial');
 // A second build does not ask for a new brief.
 calls=[];
 const j2=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Add reviews'}})).json.job);
 assert.equal(j2.status,'complete');assert.equal(calls.length,1);
 // Templates keep their own look: no brief.
 calls=[];
 const t=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{template:'restaurant',prompt:'Make the menu bigger'}})).json;
 await waitJob(cookie,t.job);
 assert.ok(!calls.some(c=>String(c.messages[0].content).startsWith('You are the art director')));
 assert.equal(builder.loadMeta(t.project.id).design,undefined);
 enabled.generateImage=true;
});

test('design dialog: edit colours and fonts, new direction from the AI, add the design system to older projects',async()=>{
 const cookie=await signup('dialog@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{template:'restaurant'}})).json.project.id;
 let d=(await request(server,'GET','/api/create/projects/'+id+'/design',{headers:{cookie}})).json;
 assert.equal(d.has_tokens,false);assert.equal(d.design,null);assert.ok(d.library.length>=5&&d.fonts.includes('Fraunces'));
 const before=builder.loadMeta(id).current_version;
 d=(await request(server,'POST','/api/create/projects/'+id+'/design',{headers:{cookie},body:{add_system:true}})).json;
 assert.equal(d.has_tokens,true);assert.equal(d.version,before+1);
 const files=builder.loadFiles(id,d.version);
 assert.ok(files['src/components/ui/card.jsx']);assert.match(files['src/index.css'],/kairoq:tokens:start/);
 // Saving colours rewrites the tokens as a new version.
 d=(await request(server,'POST','/api/create/projects/'+id+'/design',{headers:{cookie},body:{design:{name:'Sea',palette:{background:'#ffffff',foreground:'#111111',primary:'#0e7490'},fonts:{display:'Fraunces'},notes:'Photos of the sea only.'}}})).json;
 assert.equal(d.design.name,'Sea');assert.equal(d.version,before+2);
 assert.match(builder.loadFiles(id,d.version)['src/index.css'],/--primary: 193 82% 31%;/);
 assert.match(builder.knowledgeNote(builder.loadMeta(id)),/Owner notes: Photos of the sea only\./);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/design',{headers:{cookie},body:{design:{palette:{background:'nope'}}}})).status,400);
 // A new direction costs a Discuss message and saves the AI's brief.
 const c0=await credits(cookie);
 d=(await request(server,'POST','/api/create/projects/'+id+'/design',{headers:{cookie},body:{regenerate:'warmer and more luxurious'}})).json;
 assert.equal(d.design.name,'Warm Lisbon editorial');assert.equal(await credits(cookie),c0-1);
 assert.match(calls.at(-1).messages[1].content,/Direction from the owner: warmer and more luxurious/);
 // Skills per project.
 d=(await request(server,'POST','/api/create/projects/'+id+'/design',{headers:{cookie},body:{skills:['dashboard']}})).json;
 assert.deepEqual(d.skills,['dashboard']);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/design',{headers:{cookie},body:{skills:['nope']}})).status,400);
});

test('skills: built-in library, your own skills, always-on, and import from GitHub',async()=>{
 assert.deepEqual(skills.builtin().map(s=>s.id),['accessibility','app-onboarding','brand-from-logo','brutalist-style','dashboard','data-viz','diagrams','digital-guide','ecommerce','editorial','email-newsletter','event-flyer','framer-motion','frontend-design','help-docs','human-crafted','illustration-icons','kanban-board','launch-deck','loyalty-rewards','luxury-hospitality','magazine-cover','marketplace','mobile-app','modern-css','modern-saas','monthly-report','pitch-deck','presentation-slides','pricing-page','printable-invoice','remotion-video','resume-portfolio','scroll-story','secure-app','social-carousel','social-dashboard','social-share-card','soft-minimal-style','staff-onboarding','team-goals','three-3d','waitlist-page','weekly-update']);
 // Page types adapted from html-anything carry a group; the styles do not.
 assert.equal(skills.builtin().filter(s=>s.group==='Page types').length,25);
 for(const s of skills.builtin())assert.ok(s.name&&s.description.length>40&&s.body.length>1500,s.id);
 const cookie=await signup('skills@example.com');
 const add=await request(server,'POST','/api/create/skills',{headers:{cookie},body:{text:'---\nname: Our brand\ndescription: Navy and gold for all our apps\n---\n# Rules\n- Navy (#14213d) and gold (#fca311), serif headlines, pill buttons.'}});
 assert.equal(add.status,201);const mine=add.json.skill;assert.equal(mine.name,'Our brand');
 assert.equal((await request(server,'POST','/api/create/skills',{headers:{cookie},body:{text:'short'}})).status,400);
 // On for all projects: it reaches the prompt of a project that did not pick it.
 await request(server,'POST','/api/create/skills/default',{headers:{cookie},body:{id:mine.id,on:true}});
 const pid=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Brand test'}})).json.project.id;
 assert.match(builder.knowledgeNote(builder.loadMeta(pid)),/### Skill: Our brand[\s\S]*pill buttons/);
 // Craft skills marked "default: on" reach every project until the owner turns them off.
 const note=builder.knowledgeNote(builder.loadMeta(pid));assert.match(note,/### Skill: Human-crafted/);assert.match(note,/### Skill: Frontend design \(Anthropic\)/);assert.match(note,/### Skill: Accessibility/);
 await request(server,'POST','/api/create/skills/default',{headers:{cookie},body:{id:'human-crafted',on:false}});
 assert.ok(!builder.knowledgeNote(builder.loadMeta(pid)).includes('### Skill: Human-crafted'));
 await request(server,'POST','/api/create/skills/default',{headers:{cookie},body:{id:'human-crafted',on:true}});
 assert.match(builder.knowledgeNote(builder.loadMeta(pid)),/### Skill: Human-crafted/);
 // Another account cannot see or remove it.
 const other=await signup('other-skills@example.com');
 assert.ok(!(await request(server,'GET','/api/create/skills',{headers:{cookie:other}})).json.skills.some(s=>s.id===mine.id));
 assert.equal((await request(server,'DELETE','/api/create/skills',{headers:{cookie:other},body:{id:mine.id}})).status,404);
 // GitHub: a repo with several skills offers a choice; picking one imports it.
 const original=global.fetch,seen=[];
 global.fetch=async url=>{
  const u=String(url);seen.push(u);
  if(u==='https://raw.githubusercontent.com/acme/design/HEAD/SKILL.md')return new Response('Not found',{status:404});
  if(u==='https://api.github.com/repos/acme/design/git/trees/HEAD?recursive=1')return new Response(JSON.stringify({tree:[{path:'skills/retro/SKILL.md',type:'blob'},{path:'skills/brutal/SKILL.md',type:'blob'},{path:'README.md',type:'blob'}]}));
  if(u==='https://raw.githubusercontent.com/acme/design/HEAD/skills/retro/SKILL.md')return new Response('---\nname: Retro\ndescription: Seventies colours and rounded type\n---\nUse orange, brown and cream. Rounded display type. Grain textures.');
  if(u==='https://raw.githubusercontent.com/acme/design/main/brand/SKILL.md')return new Response('# Acme brand\n\nCrisp black and white with one red accent. Big type, no shadows, square corners everywhere.');
  return new Response('nope',{status:404});
 };
 try{
  const c=(await request(server,'POST','/api/create/skills',{headers:{cookie},body:{url:'https://github.com/acme/design'}})).json;
  assert.deepEqual(c.choices.map(x=>x.name),['retro','brutal']);
  const r=(await request(server,'POST','/api/create/skills',{headers:{cookie},body:{url:'https://github.com/acme/design',path:'skills/retro/SKILL.md'}})).json.skill;
  assert.equal(r.name,'Retro');assert.equal(r.source,'github');
  const b=(await request(server,'POST','/api/create/skills',{headers:{cookie},body:{url:'https://github.com/acme/design/tree/main/brand'}})).json.skill;
  assert.equal(b.name,'Acme brand');assert.match(b.description,/Crisp black and white/);
  assert.equal((await request(server,'POST','/api/create/skills',{headers:{cookie},body:{url:'https://evil.example.com/acme/design'}})).status,400);
  assert.equal((await request(server,'POST','/api/create/skills',{headers:{cookie},body:{url:'https://github.com/acme/design/blob/main/.secrets/notes.md'}})).status,400);
  assert.ok(seen.every(u=>u.startsWith('https://raw.githubusercontent.com/')||u.startsWith('https://api.github.com/')),'only GitHub hosts are fetched');
 }finally{global.fetch=original}
 assert.equal((await request(server,'DELETE','/api/create/skills',{headers:{cookie},body:{id:mine.id}})).status,200);
 assert.ok(!builder.knowledgeNote(builder.loadMeta(pid)).includes('Our brand'));
});

test('generated images: saved to uploads, code points at the saved file, credits per image, refunds on failure',async()=>{
 const cookie=await signup('images@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Gallery'}})).json.project.id;
 builder.saveMeta({...builder.loadMeta(id),design:{...BRIEF}});
 queue=[{message:'Added a hero.',files:{'src/App.jsx':APP},images:[{name:'hero-terrace.jpg',prompt:'Sunlit terrace with blue tiles',aspect:'16:9'},{name:'bad',prompt:''}]}];imageCalls=[];calls=[];
 const c0=await credits(cookie);
 const job=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Add a hero photo'}})).json.job);
 assert.equal(job.status,'complete',job.error);
 assert.match(lastUser(calls.at(-1)),/Image generation is available for this message[\s\S]*2 credits each/);
 assert.equal(imageCalls.length,1);assert.match(imageCalls[0].prompt,/Sunlit terrace[\s\S]*Visual style of the app: Warm daylight photos/);assert.equal(imageCalls[0].aspect,'16:9');
 const meta=builder.loadMeta(id),files=builder.loadFiles(id,meta.current_version);
 assert.match(files['src/App.jsx'],/\.\/uploads\/hero-terrace\.png/,'the .jpg request became the real .png file');
 assert.ok(require('../react-assets').read(id,'hero-terrace.png'));
 assert.deepEqual(meta.messages.at(-1).generated,['hero-terrace.png']);
 assert.equal(await credits(cookie),c0-1-2,'one edit plus one image');
 // A failed generation is refunded and leaves a placeholder.
 imageFail=true;queue=[{message:'Added a photo.',files:{'src/App.jsx':APP.replace('hero-terrace','pool')},images:[{name:'pool.jpg',prompt:'Rooftop pool'}]}];
 const c1=await credits(cookie);
 const j2=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Add a pool photo'}})).json.job);
 imageFail=false;
 assert.equal(j2.status,'complete');assert.equal(await credits(cookie),c1-1);
 assert.match(builder.loadMeta(id).messages.at(-1).text,/could not be generated: provider down/);
 assert.ok(require('../react-assets').read(id,'pool.png'),'placeholder keeps the app working');
 // The Design dialog's generator.
 const g=await request(server,'POST','/api/create/projects/'+id+'/images',{headers:{cookie},body:{prompt:'Breakfast on the balcony',aspect:'4:3'}});
 assert.equal(g.status,201);assert.equal(g.json.saved[0],'breakfast-on-the-balcony.png');
 enabled.generateImage=false;
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/images',{headers:{cookie},body:{prompt:'x y z w'}})).status,503);
 const me=(await request(server,'GET','/api/create/me',{headers:{cookie}})).json;
 assert.deepEqual(me.image_generation,{enabled:false,credits:2});
 enabled.generateImage=true;
});

test('design review: screenshots go to the model and the fix is saved; Pro first builds get one automatically',async()=>{
 const cookie=await signup('polish@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Polish me'}})).json.project.id;
 shots=[{name:'desktop',mime:'image/jpeg',data:'AAAA'},{name:'phone',mime:'image/jpeg',data:'BBBB'}];
 queue=[{message:'Tightened the spacing and fixed the phone header.',files:{'src/App.jsx':APP}}];calls=[];
 const job=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{mode:'polish',message:'',tier:'pro'}})).json.job);
 assert.equal(job.status,'complete',job.error);
 const user=lastUser(calls.at(-1));
 assert.equal(calls.at(-1).design,true,'the review goes to the design model');
 assert.match(user[0].text,/Design review\. The attached screenshots[\s\S]*Keep every feature/);
 assert.deepEqual(user.slice(1).map(p=>p.image_url.url.slice(0,27)),['data:image/jpeg;base64,AAAA','data:image/jpeg;base64,BBBB']);
 const meta=builder.loadMeta(id);
 assert.equal(meta.messages.at(-2).text,'Polish the design');assert.equal(meta.messages.at(-1).polish,true);
 assert.equal(meta.versions.at(-1).polish,true);
 // The review costs at least KAIROQ_POLISH_CREDITS, so a Standard review by a design model is not sold at a loss.
 process.env.KAIROQ_POLISH_CREDITS='3';queue=[{message:'Polished.',files:{'src/App.jsx':APP}}];
 const p0=await credits(cookie);
 assert.equal((await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{mode:'polish',tier:'standard'}})).json.job)).status,'complete');
 assert.equal(await credits(cookie),p0-3);
 assert.equal((await request(server,'GET','/api/create/me',{headers:{cookie}})).json.polish_credits,3);
 delete process.env.KAIROQ_POLISH_CREDITS;
 // Without screenshots on the server the review is refused before charging.
 enabled.designShots=false;
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{mode:'polish'}})).status,503);
 enabled.designShots=true;
 // Pro: the first build of a new app is followed by a free design review.
 queue=[{message:'Built it.',files:{'src/App.jsx':APP}},{message:'Polished.',files:{'src/App.jsx':APP.replace('text-5xl','text-6xl')}}];calls=[];
 const c0=await credits(cookie);
 const created=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{prompt:'A hotel site',tier:'pro'}})).json;
 const j=await waitJob(cookie,created.job);
 assert.equal(j.status,'complete',j.error);assert.equal(j.result.polished,true);
 assert.equal(await credits(cookie),c0-5,'one Pro message');
 const versions=builder.loadMeta(created.project.id).versions;
 assert.deepEqual(versions.slice(-2).map(v=>Boolean(v.polish)),[false,true]);
 assert.match(builder.loadFiles(created.project.id,versions.at(-1).n)['src/App.jsx'],/text-6xl/);
});

test('agent mode designs new projects first and can generate images',async()=>{
 const cookie=await signup('agent-design@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Agent hotel'}})).json.project.id;
 queue=[
  {thought:'I need a hero photo.',actions:[{tool:'generate_images',images:[{name:'lobby.jpg',prompt:'Bright hotel lobby'}]}]},
  o=>{const last=o.messages.at(-1).content;const text=typeof last==='string'?last:last[0].text;const m=/saved (\.\/uploads\/[a-z0-9-]+\.[a-z]+)/.exec(text);return JSON.stringify({thought:'Writing the page.',actions:[{tool:'write_files',files:{'src/App.jsx':'export default function App(){return <main className="bg-background"><img src="'+(m?m[1]:'missing')+'" alt="Lobby" /></main>}\n'}},{tool:'finish',message:'Done.'}]})}
 ];calls=[];
 const job=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{mode:'agent',message:'Build a hotel homepage'}})).json.job);
 assert.equal(job.status,'complete',job.error);
 assert.match(calls[1].messages[0].content,/"tool":"generate_images"/);
 const meta=builder.loadMeta(id),files=builder.loadFiles(id,meta.current_version);
 assert.equal(meta.design.name,'Warm Lisbon editorial');
 assert.match(files['src/App.jsx'],/\.\/uploads\/lobby\.png/);
 assert.match(files['src/index.css'],/--primary: 18 62% 44%;/,'the brief\'s tokens are saved with the agent\'s version');
});
