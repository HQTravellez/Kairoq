"use strict";
// Colour moods: so every site does not come out cream and dark green. Before the art director
// designs, Kairoq picks a colour mood that suits the business and that the owner's recent sites
// did not use, and fonts their recent sites did not use. Each mood has one bold signature colour
// the page really uses (buttons, a full-colour band, key words). Kairoq's own editor colours
// (warm cream with dark green or red) are never a mood, and a cream page is replaced unless the
// owner asked for one.

const M=(id,name,fits,palette,display,dark=false)=>({id,name,fits,palette,display,dark});
const MOODS=[
 M('ink-coral','Ink and coral',/\b(agency|studio|design|marketing|consult\w*|startup|events?|fitness|gym)(?![a-z])/i,{background:'#ffffff',foreground:'#0f1b3d',primary:'#ff5a4e',secondary:'#eef2ff',accent:'#0f1b3d',muted:'#f4f6fb'},['Space Grotesk','Syne','Manrope']),
 M('tomato-paper','Tomato on white',/\b(restaurant|pizz\w*|bistro|trattoria|food|deli|burger|taco|bakery|caf[eé]|cafe)(?![a-z])/i,{background:'#fffdf9',foreground:'#1d1a17',primary:'#e2321b',secondary:'#fff1ea',accent:'#1d1a17',muted:'#faf3ee'},['Bricolage Grotesque','DM Serif Display','Young Serif']),
 M('cobalt-lemon','Cobalt and lemon',/\b(saas|software|app|ai|tech|platform|school|education|course|kids?)(?![a-z])/i,{background:'#f7f9ff',foreground:'#0b1533',primary:'#2346ff',secondary:'#e8edff',accent:'#ffd84d',muted:'#eef1fb'},['Geist','Funnel Display','Inter Tight']),
 M('plum-blush','Plum and blush',/\b(salon|beauty|spa|florist|flowers?|wedding|bridal|nails?|skin\w*|boutique)(?![a-z])/i,{background:'#fff7f8',foreground:'#2b0f24',primary:'#7b1f5c',secondary:'#ffe6ec',accent:'#e98aa4',muted:'#fbeef1'},['Fraunces','Gloock','Bodoni Moda']),
 M('deep-teal','Deep teal',/\b(clinic|dent\w*|health|therap\w*|physio|pharmac\w*|wellness|medical|care)(?![a-z])/i,{background:'#f6fbfa',foreground:'#0b2b2b',primary:'#0e7c7b',secondary:'#e3f4f2',accent:'#f2a541',muted:'#edf6f5'},['Manrope','Figtree','Public Sans']),
 M('espresso-gold','Espresso and gold',/\b(watch\w*|jewell?er\w*|luxury|wine|cigar|whisky|hotel|atelier|tailor\w*)(?![a-z])/i,{background:'#16110d',foreground:'#f4ede4',primary:'#d4a648',secondary:'#241b15',accent:'#8c5a3c',muted:'#1e1712'},['Bodoni Moda','EB Garamond','Gloock'],true),
 M('mustard-navy','Mustard and navy',/\b(renovat\w*|contractor|build\w*|construction|plumb\w*|electric\w*|roof\w*|trades?|moving|logistics)(?![a-z])/i,{background:'#ffffff',foreground:'#13213c',primary:'#f2b632',secondary:'#eef1f6',accent:'#13213c',muted:'#f5f6f9'},['Archivo','Hubot Sans','Big Shoulders Display']),
 M('night-electric','Night with electric blue',/\b(bar|club|night\w*|music|dj|gaming|esports|tattoo|barber)(?![a-z])/i,{background:'#0b0d12',foreground:'#eef1f7',primary:'#3d7bff',secondary:'#151a24',accent:'#ff3d81',muted:'#121620'},['Unbounded','Bricolage Grotesque','Space Grotesk'],true),
 M('forest-mint','Forest and mint',/\b(garden\w*|landscap\w*|outdoor|camp\w*|hiking|eco|organic|farm|plant\w*|yoga)(?![a-z])/i,{background:'#f3faf5',foreground:'#0f2a1d',primary:'#1d7a4f',secondary:'#dff3e7',accent:'#ff8c42',muted:'#e9f5ee'},['Fraunces','Young Serif','Newsreader']),
 M('sky-sun','Sky and sun',/\b(travel|tours?|flights?|beach|resort|vacation|surf\w*|stays?|rentals?)(?![a-z])/i,{background:'#f5fbff',foreground:'#0c2338',primary:'#0a84d6',secondary:'#e2f1fb',accent:'#ffb703',muted:'#ecf5fb'},['Funnel Display','Host Grotesk','Figtree']),
 M('charcoal-orange','Charcoal and orange',/\b(auto\w*|car|garage|mechanic|motor\w*|bike|cycl\w*|sports?|crossfit)(?![a-z])/i,{background:'#f4f4f2',foreground:'#161616',primary:'#ff6a00',secondary:'#e7e7e3',accent:'#161616',muted:'#ececea'},['Anton','Big Shoulders Display','Archivo']),
 M('lilac-graphite','Lilac and graphite',/\b(photograph\w*|art|gallery|creative|music|podcast|writer|author)(?![a-z])/i,{background:'#f8f6ff',foreground:'#1c1a24',primary:'#6b4eff',secondary:'#ece8ff',accent:'#1c1a24',muted:'#f1eefb'},['Instrument Serif','DM Serif Display','Syne']),
 M('red-black-law','Oxblood and ivory',/\b(law\w*|legal|account\w*|finance|bank\w*|insurance|real estate|realtor|propert\w*)(?![a-z])/i,{background:'#ffffff',foreground:'#141414',primary:'#7a1426',secondary:'#f4f1ee',accent:'#b08d57',muted:'#f6f4f2'},['Libre Caslon Text','Newsreader','Source Serif 4']),
 M('aqua-sand','Aqua and sand',/\b(pool|cleaning|laundry|water|swim\w*|kids?|daycare|pet\w*|vet\w*|dog|cat)(?![a-z])/i,{background:'#f3fbfb',foreground:'#10242b',primary:'#00a6a6',secondary:'#e2f5f4',accent:'#ff7a59',muted:'#eaf6f5'},['Nunito','Fredoka','Baloo 2']),
];
const FALLBACK=['ink-coral','cobalt-lemon','deep-teal','mustard-navy','lilac-graphite','sky-sun'];
function hex(h){const m=/^#?([0-9a-f]{6})$/i.exec(String(h||''));if(!m)return null;const n=parseInt(m[1],16);return[n>>16&255,n>>8&255,n&255]}
function hsl(h){const c=hex(h);if(!c)return null;const [r,g,b]=c.map(x=>x/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let s=0,hue=0;if(d){s=d/(1-Math.abs(2*l-1));hue=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;hue=(hue*60+360)%360}return{h:hue,s,l}}
// The warm cream Kairoq's own editor uses (and the one every AI site falls into).
function isCream(h){const c=hsl(h);return Boolean(c&&c.l>0.9&&c.l<0.985&&c.h>=25&&c.h<=70&&c.s>0.15)}
function seeded(seed){let x=0;for(const ch of String(seed))x=(x*31+ch.charCodeAt(0))>>>0;return x}
// The mood for a request: one that fits the business, not used by the owner's recent sites
// (their saved moods and cream backgrounds), turned by the project name so two similar
// businesses do not always get the same one.
function deal(request,{recent=[],seed=''}={}){
 const used=new Set(recent.map(d=>d&&d.mood).filter(Boolean));
 // The business type comes first: the mood whose words appear earliest in the request wins
 // ("a law firm … a first consultation" is a law firm, not a consultancy). Ties are turned.
 const at=m=>{const x=m.fits.exec(String(request||''));return x?x.index:-1};
 const fit=MOODS.filter(m=>at(m)>=0).sort((a,b)=>at(a)-at(b));
 const first=fit.filter(m=>at(m)===at(fit[0]));
 const rest=MOODS.filter(m=>!fit.includes(m));
 const turn=list=>{const k=list.length?seeded(seed+request)%list.length:0;return[...list.slice(k),...list.slice(0,k)]};
 const order=[...turn(first),...fit.filter(m=>!first.includes(m)),...turn(rest.filter(m=>FALLBACK.includes(m.id))),...turn(rest.filter(m=>!FALLBACK.includes(m.id)))];
 return order.find(m=>!used.has(m.id))||order[0];
}
// Moods and signatures handed out in the last few minutes, per owner, so two sites designed at
// the same time (before either brief is saved) do not get the same look.
const CLAIMED=new Map(),HOLD=15*60*1000;
function claimed(owner){const now=Date.now();const list=(CLAIMED.get(String(owner||''))||[]).filter(c=>now-c.at<HOLD);CLAIMED.set(String(owner||''),list);return list}
function claim(owner,entry){if(!owner)return;claimed(owner).push({...entry,at:Date.now()})}
// Heading fonts the owner's recent sites used.
function recentFonts(recent){return[...new Set(recent.map(d=>d&&d.fonts&&d.fonts.display).filter(Boolean))].slice(0,4)}
// The block for the art director.
function note(mood,{avoidFonts=[]}={}){
 const p=mood.palette;
 return'\n\nColour mood for this site (Kairoq picked it so every site looks different; use it): "'+mood.name+'"'+(mood.dark?' (a dark page)':'')+'. Background '+p.background+', text '+p.foreground+', signature colour '+p.primary+', second colour '+p.accent+'. You may shift these slightly to fit the business, but keep the background and the signature colour family. Use the signature colour boldly and on purpose: the main buttons, key words in the headline, and one full-width band of that colour. Do not use a cream, beige or off-white paper background unless this mood has one.\nHeading fonts that suit this mood: '+mood.display.join(', ')+'.'+(avoidFonts.length?' Do not use these heading fonts (the owner\'s recent sites used them): '+avoidFonts.join(', ')+'.':'');
}
// The art director's palette, held to the mood: the background and the signature colour family
// come from the mood; a cream page or a heading font from the recent sites is replaced.
function enforce(brief,mood,{avoidFonts=[],fonts=[]}={}){
 const out={...brief,mood:mood.id},p={...(brief.palette||{})},m=mood.palette;
 const near=(a,b,deg)=>{const x=hsl(a),y=hsl(b);if(!x||!y)return false;const d=Math.abs(x.h-y.h);return Math.min(d,360-d)<=deg&&Math.abs(x.l-y.l)<0.25&&(y.s<0.15||x.s>0.25)};
 if(!near(p.background,m.background,40)||isCream(p.background)&&!isCream(m.background))for(const k of ['background','foreground','secondary','muted'])p[k]=m[k];
 if(!near(p.primary,m.primary,25))p.primary=m.primary;
 if(!p.accent||!hex(p.accent))p.accent=m.accent;
 out.palette=p;
 const display=out.fonts&&out.fonts.display;
 if(!display||avoidFonts.includes(display)){
  const pick=mood.display.find(f=>!avoidFonts.includes(f)&&(!fonts.length||fonts.includes(f)))||mood.display[0];
  out.fonts={...(out.fonts||{}),display:pick};
 }
 return out;
}
module.exports={MOODS,claim,claimed,deal,note,enforce,recentFonts,isCream,hsl};
