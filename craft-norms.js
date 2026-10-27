"use strict";
// What the best websites of each kind actually do, measured (craft-norms.json): 117 public home
// pages of well-designed sites in 12 business types, numbers only (headline size and weight, fonts,
// corners, shadows, boxes, card grids, sections, what the hero shows, how often the AI giveaways
// appear). The art director and the builder get the norms for the business; the craft check
// compares the built page with them.
const DATA=require('./craft-norms.json');

// The business type for a request: the earliest matching words win (like design-moods.js).
const TYPES=[
 ['saas',/\b(saas|software|app|platform|ai|tool|api|developer\w*|dashboard|startup)(?![a-z])/i],
 ['finance',/\b(bank\w*|fintech|finance|financial|payments?|invest\w*|wealth|insurance|lending|loans?|crypto)(?![a-z])/i],
 ['travel',/\b(travel|hotels?|resorts?|stays?|tours?|flights?|booking|hospitality|corporate housing|vacation|rentals?)(?![a-z])/i],
 ['law',/\b(law|legal|lawyers?|attorneys?|accounting|accountants?|consult\w*|advisory|tax)(?![a-z])/i],
 ['food',/\b(restaurants?|caf[eé]s?|cafe|coffee|bakery|food|bar|pizz\w*|bistro|catering|kitchen|brewery|deli)(?![a-z])/i],
 ['fitness',/\b(gyms?|fitness|yoga|pilates|crossfit|sports?|training|coach\w*|boxing|martial)(?![a-z])/i],
 ['realestate',/\b(real estate|realtors?|propert\w*|renovat\w*|contractors?|construction|architect\w*|interior\w*|home builders?|plumb\w*|roof\w*|landscap\w*)(?![a-z])/i],
 ['beauty',/\b(salons?|beauty|spa|florists?|flowers?|fashion|boutique|clothing|jewell?er\w*|skin\w*|cosmetic\w*|barber\w*)(?![a-z])/i],
 ['kids',/\b(kids?|child\w*|schools?|daycare|toys?|education|courses?|learning|tutor\w*|students?)(?![a-z])/i],
 ['health',/\b(clinics?|dent\w*|health|therap\w*|physio\w*|medical|pharmac\w*|wellness|doctors?|care)(?![a-z])/i],
 ['agency',/\b(agency|studio|design studio|graphic design|marketing agency|creative|photograph\w*|portfolio|branding)(?![a-z])/i],
 ['consumer',/\b(products?|hardware|devices?|shop|store|e-?commerce|brand)(?![a-z])/i],
];
const NAMES={saas:'software',finance:'finance',travel:'travel and hotels',law:'law and professional services',food:'cafés and restaurants',fitness:'gyms and fitness',realestate:'renovation, architecture and real estate',beauty:'beauty, fashion and florists',kids:'children and education',health:'health and clinics',agency:'agencies and studios',consumer:'consumer products'};

function typeOf(text){
 // Words about the page itself ("the marketing website home page for…") say nothing about the business.
 const t=String(text||'').replace(/\b(marketing\s+)?(web\s?site|landing page|home ?page|web app|site|page)s?\b/gi,' ');let best=null,at=Infinity;
 for(const [id,re] of TYPES){const m=re.exec(t);if(m&&m.index<at){at=m.index;best=id}}
 return best;
}
function norms(type){return(type&&DATA.types[type])||DATA.all}
const pct=x=>Math.round(x*100)+'%';
const two=r=>r&&r[0]!=null?(Math.round(r[0])===Math.round(r[1])?String(Math.round(r[0])):Math.round(r[0])+' to '+Math.round(r[1])):'';
const range=r=>r&&r[0]!=null?(r[0]===r[2]?String(Math.round(r[1])):Math.round(r[0])+' to '+Math.round(r[2])):'';

// The norms in plain words, for the art director and the builder.
function note(type){
 const n=norms(type),name=type?NAMES[type]:'all kinds of business',all=DATA.all;
 const hero=Object.entries(n.hero).filter(([,v])=>v>=0.2).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({video:'a video',image:'a large real photo',illustration:'an illustration',input:'a search or booking form','3d_canvas':'a 3D scene'}[k]+' ('+pct(v)+')')).join(', ');
 return'What the best websites for '+name+' do (measured on '+n.sites+' of them'+(n.examples?', e.g. '+n.examples.slice(0,4).join(', '):'')+'): a hero headline of about '+range(n.h1_px)+' px (median '+Math.round(n.h1_px[1])+'), weight about '+n.h1_weight+', '+n.h1_words[1]+' words; body text '+n.body_px+' px; '+(n.fonts[2]/n.sites<0.3?'one or two fonts':'two fonts at most on most of them')+(n.serif_share>=0.2?', a serif for headings on '+pct(n.serif_share):'')+'; corners about '+range(n.radius)+' px'+(n.pill_buttons>=0.3?' (pill buttons are common)':'')+'; '+(n.shadows[1]<=2?'almost no shadows':'shadows used sparingly')+'; '+(n.grids[1]<1?'no grid of identical cards':'at most one grid of cards')+'; about '+two(n.sections)+' sections. The hero shows '+(hero||'a large real photo')+'. Only '+pct(all.eyebrow_share)+' of the best sites put small labels above headings, '+pct(all.arrows_share)+' put arrows on many buttons and '+pct(all.dots_share)+' join words with "·".';
}

// The built page compared with the norms: what is clearly off (minor; the craft check sends them
// with the measured giveaways).
function compare(metrics,type){
 const n=norms(type),out=[],m=metrics||{};
 const add=(kind,issue,fix)=>out.push({severity:'minor',kind,issue,fix});
 if(m.h1px&&n.h1_px[0]&&m.h1px<n.h1_px[0]*0.8)add('norm-h1','The main headline is '+Math.round(m.h1px)+' px; the best '+(NAMES[type]||'')+' sites use about '+range(n.h1_px)+' px','Make the hero headline about '+Math.round(n.h1_px[1])+' px on desktop (it scales down on phones).');
 if(m.h1words&&m.h1words>Math.max(9,n.h1_words[2]*1.5))add('norm-words','The main headline has '+m.h1words+' words; the best sites use about '+n.h1_words[1],'Cut the headline to about '+n.h1_words[1]+' words; move the rest into the line below it.');
 if(m.radius!=null&&n.radius[2]!=null&&m.radius>Math.max(12,n.radius[2]*1.5))add('norm-radius','Boxes have '+Math.round(m.radius)+' px corners; the best sites of this kind use about '+range(n.radius)+' px','Use corners of about '+range(n.radius)+' px'+(n.radius[1]<=2?' (square or nearly square)':'')+'.');
 if(m.shadows!=null&&m.shadows>Math.max(4,n.shadows[1]*2))add('norm-shadows',m.shadows+' boxes have shadows; the best sites of this kind have about '+two(n.shadows),'Remove shadows except on things that float.');
 if(m.sections!=null&&n.sections[1]!=null&&m.sections>n.sections[1]+3)add('norm-sections',m.sections+' sections; the best sites of this kind have about '+two(n.sections),'Cut to the '+Math.round(n.sections[0]||5)+' to '+Math.round(n.sections[1])+' sections that matter.');
 return out;
}
module.exports={typeOf,norms,note,compare,NAMES,DATA};
