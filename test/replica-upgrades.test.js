"use strict";
// Build from a reference, with the Replica method (github.com/Jakeschincariol/replica-skill, MIT):
// what the original's users complain about (real, linked reviews), a weighted match score, and
// a sweep so nothing of the original's brand ships.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-replica-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const R=require('../react-reviews'),P=require('../react-parity'),S=require('../react-sweep');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

const ROWS=[
 {source:'app-store',url:'https://apps.apple.com/us/app/id1?see-all=reviews#1',date:'2026-09-01',rating:1,text:'Way too expensive. The per seat pricing doubled for our team of 6.'},
 {source:'app-store',url:'https://apps.apple.com/us/app/id1?see-all=reviews#2',date:'2026-08-01',rating:2,text:'Great app. But the subscription is overpriced for small teams.'},
 {source:'hacker-news',url:'https://news.ycombinator.com/item?id=3',date:'2026-07-01',rating:null,text:'We left because of pricing. I wish it had text reminders, guests miss meetings.'},
 {source:'app-store',url:'https://apps.apple.com/us/app/id1?see-all=reviews#4',date:'2023-01-01',rating:5,text:'Love it, works well.'},
 {source:'app-store',url:'https://apps.apple.com/us/app/id1?see-all=reviews#5',date:'2026-09-02',rating:1,text:'Crashes every time I open the calendar. Broken since the update.'},
];

test('reviews are ranked into themes with counts, sources and verbatim linked quotes',()=>{
 const r=R.analyse(ROWS,{today:new Date('2026-10-25')});
 assert.equal(r.reviews,5);
 const pricing=r.themes.find(t=>t.id==='pricing');
 assert.equal(r.themes[0].id,'pricing','most weighted complaint first');
 assert.equal(pricing.count,3);
 assert.deepEqual(pricing.sources,['app-store','hacker-news']);
 assert.equal(pricing.thin,false);
 for(const q of pricing.quotes){const row=ROWS.find(x=>x.url===q.url);assert.ok(row.text.includes(q.quote.replace(/^\.\.\.|\.\.\.$/g,'')),'quote is a substring of the review')}
 assert.equal(pricing.quotes[0].rating,1,'sharpest (lowest rated) quote first');
 assert.ok(r.themes.find(t=>t.id==='bugs').thin,'one source only = thin');
 assert.ok(r.requests.some(q=>/I wish it had text reminders/.test(q.quote)));
 // A 5-star review older than 18 months weighs 0.1 (0.2 halved).
 assert.equal(R.weight(ROWS[3],new Date('2026-10-25')),0.1);
});

test('reviews come only from Apple\'s and Hacker News\' official public APIs, with links',async()=>{
 const seen=[];
 const fetchImpl=async url=>{seen.push(url);const u=new URL(url);const ok=b=>({ok:true,status:200,json:async()=>b});
  if(u.hostname==='itunes.apple.com'&&u.pathname==='/search')return ok({results:[{trackId:123456789,trackName:'Bookly - Scheduling',sellerName:'Bookly Inc.'}]});
  if(u.hostname==='itunes.apple.com'&&/customerreviews\/page=1\/id=123456789/.test(u.pathname))return ok({feed:{entry:[{'im:rating':{label:'1'},title:{label:'Too pricey'},content:{label:'Per seat pricing is too expensive.'},id:{label:'9001'},updated:{label:'2026-09-01T00:00:00-07:00'}}]}});
  if(u.hostname==='itunes.apple.com')return ok({feed:{}});
  if(u.hostname==='hn.algolia.com')return ok({hits:[{objectID:'42',comment_text:'Bookly&#x27;s <i>pricing</i> is too high',created_at:'2026-08-01T00:00:00Z'},{objectID:'43',comment_text:'unrelated comment',created_at:'2026-08-01'}]});
  return{ok:false,status:404};
 };
 const {rows,sources}=await R.collect({name:'Bookly'},{fetchImpl});
 assert.deepEqual(rows.map(r=>r.source).sort(),['app-store','hacker-news']);
 assert.equal(rows.find(r=>r.source==='hacker-news').text,"Bookly's pricing is too high",'HTML cleaned, the words kept');
 assert.equal(rows.find(r=>r.source==='hacker-news').url,'https://news.ycombinator.com/item?id=42');
 assert.match(rows.find(r=>r.source==='app-store').url,/^https:\/\/apps\.apple\.com\/us\/app\/id123456789/);
 assert.match(sources[0].note,/App Store search/);
 assert.ok(seen.every(u=>/^https:\/\/(itunes\.apple\.com|hn\.algolia\.com)\//.test(u)),'no other sites are read');
 // A link to the app on the reference site wins over searching.
 assert.equal((await R.appStoreId({name:'X',appLinks:['https://apps.apple.com/ca/app/bookly/id987654321']},fetchImpl)).id,'987654321');
});

test('suggested fixes must point at a real theme; nothing invented gets through',async()=>{
 const r=R.analyse(ROWS,{today:new Date('2026-10-25')});
 const callModel=async()=>({angle:'Booking links for small teams who hate per-seat pricing',fixes:[
  {theme:'pricing',title:'Flat pricing',feature:{name:'Flat team pricing',description:'One price for the whole team.'}},
  {theme:'made-up',title:'Invented',feature:{name:'X',description:'Y'}},
  {theme:'notifications',title:'No feature',feature:null}]});
 const out=await R.suggest(r,{callModel,product:'Bookly'});
 assert.equal(out.fixes.length,1);
 assert.equal(out.fixes[0].count,3);assert.equal(out.fixes[0].theme_label,'Price and paywalls');
 assert.match(out.angle,/per-seat/);
 assert.equal(R.productName({pages:[{site_name:'',title:'Bookly | Easy scheduling'}]}),'Bookly');
});

test('the match score weighs must 3, should 2, could 1 and leaves your own improvements out',()=>{
 const m=P.score([
  {name:'Book a time',priority:1,status:'yes'},{name:'Reschedule',priority:1,status:'partial'},
  {name:'Team pages',priority:2,status:'no'},{name:'Themes',priority:3,status:'yes'},
  {name:'Text reminders',priority:1,status:'no',added:true}]);
 // (3*1 + 3*0.5 + 2*0 + 1*1) / (3+3+2+1) = 5.5/9
 assert.equal(m.score,61);
 assert.equal(m.musts,2);assert.equal(m.musts_done,1);
 assert.deepEqual(m.missing.map(x=>x.name),['Reschedule','Team pages']);
 assert.deepEqual(m.added,[{name:'Text reminders',status:'no'}]);
 assert.match(P.summaryLine(m),/Match score 61%, 1 of 2 must-haves done\. Missing: Reschedule, Team pages/);
 assert.match(P.missingMessage(m),/- Reschedule \(must, partly done\)/);
});

test('the sweep finds the original\'s name (inside words too), address and brand colours, not your own name',()=>{
 const reference={analysis:{url:'https://www.bookly.com/',pages:[{site_name:'Bookly',title:'Bookly | Scheduling',styles:{buttons:['rgb(0, 102, 255)'],backgrounds:['rgb(255, 255, 255)'],text:['rgb(17, 24, 39)']}}]}};
 const avoid=S.avoidList(reference);
 assert.deepEqual(avoid.names,['Bookly']);assert.deepEqual(avoid.domains,['bookly.com']);assert.deepEqual(avoid.colors,['#0066ff'],'plain white and near-black are ignored');
 const found=S.scan({
  'src/App.jsx':'export default function App(){return <BooklyButton/>}\n<a href="https://bookly.com/help">',
  'src/index.css':':root{--brand:#06f}\n.x{color:#06fa00}',
  'src/Hero.jsx':'<h1>Slotwise</h1>'},avoid,{ownName:'Slotwise'});
 assert.deepEqual(found.map(f=>f.kind+':'+f.file+':'+f.line),['name:src/App.jsx:1','name:src/App.jsx:2','web address:src/App.jsx:2','brand colour:src/index.css:1']);
 assert.match(S.message(found),/name: Bookly in src\/App\.jsx:1, src\/App\.jsx:2/);
 // An app named after the reference's word is not flagged for its own name.
 assert.equal(S.scan({'a.js':'Bookly Pro'},{names:['Bookly'],domains:[],colors:[]},{ownName:'Bookly Pro'}).length,0);
});

test('the reference flow reads reviews, adds ticked fixes, scores the build and holds publishing on leftovers',()=>{
 const api=read('create-api.js'),run=read('react-reference-run.js'),gate=read('launch-gate.js'),ui=read('public/create.js'),html=read('public/create.html'),ref=read('react-reference.js');
 assert.match(api,/update\(\{status:'reviews'\}\)/);
 assert.match(api,/added:f\.theme_label/);
 assert.match(run,/require\('\.\/react-parity'\)\.judge/);
 assert.match(run,/remove what is left of the original first/);
 assert.match(gate,/kind:'leftover'/);
 assert.match(ui,/fixes:pickedFixes\(\)/);
 for(const id of ['ref-reviews-box','ref-themes','ref-fixes','ref-angle','ref-skip'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(ref,/out_of_scope/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','vendor','replica','LICENSE'),'utf8'),/MIT License/);
});
