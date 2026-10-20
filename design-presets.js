"use strict";
// Starting points for a new app's design brief: palettes and font pairings by kind of business
// (design-presets.json, adapted from ui-ux-pro-max-skill, MIT). The request is matched to the
// closest business types by their words; the brief writer gets the best few as suggestions to
// adapt, so a bakery starts from warm bakery colours instead of the model's default indigo.
const data=require('./design-presets.json');

// Words people use for a business, mapped to the words in the preset names.
const SYNONYMS={cafe:'bakery cafe coffee food restaurant',coffee:'bakery cafe food',bakery:'bakery cafe food',patisserie:'bakery cafe food',bistro:'restaurant food',
 restaurant:'restaurant food',pizzeria:'restaurant food',bar:'restaurant food brewery',pub:'restaurant brewery',winery:'brewery winery',wine:'brewery winery',
 salon:'beauty spa wellness',hair:'beauty spa wellness',barber:'beauty spa wellness',nails:'beauty spa wellness',spa:'beauty spa wellness',massage:'beauty spa wellness',yoga:'fitness gym meditation wellness',
 gym:'fitness gym',fitness:'fitness gym',trainer:'fitness gym',pilates:'fitness gym wellness',hotel:'hotel hospitality',hostel:'hotel hospitality',
 apartment:'hotel hospitality real estate',villa:'hotel hospitality luxury',retreat:'hotel hospitality wellness',tours:'travel tourism agency',tour:'travel tourism agency',travel:'travel tourism agency',
 dentist:'dental practice',dental:'dental practice',clinic:'medical clinic healthcare',doctor:'medical clinic healthcare',physio:'medical clinic healthcare',therapist:'mental health medical clinic',
 vet:'veterinary clinic pet',pet:'pet veterinary',dog:'pet veterinary',florist:'florist plant shop',flowers:'florist plant shop',plants:'florist plant shop',
 plumber:'home services plumber electrician',electrician:'home services plumber electrician',cleaning:'home services',handyman:'home services',builder:'construction architecture home services',
 lawyer:'legal services',law:'legal services',accountant:'b2b service financial',agency:'marketing agency creative agency',photographer:'photography studio portfolio',photography:'photography studio',
 wedding:'wedding event planning',events:'event management wedding event planning',event:'event management event planning',party:'event management',
 school:'educational online course',course:'online course e-learning educational',tutor:'educational online course',daycare:'childcare daycare',nursery:'childcare daycare',
 church:'church religious organization',charity:'non-profit charity',nonprofit:'non-profit charity',club:'sports team club membership community',
 shop:'e-commerce',store:'e-commerce',boutique:'e-commerce luxury',jewellery:'e-commerce luxury luxury premium brand',jewelry:'e-commerce luxury luxury premium brand',
 crm:'crm client management b2b',invoice:'invoice billing tool',invoicing:'invoice billing tool',inventory:'inventory stock management',booking:'booking appointment',
 appointments:'booking appointment',dashboard:'analytics dashboard',saas:'saas',realtor:'real estate property',property:'real estate property',
 museum:'museum gallery',gallery:'museum gallery',theatre:'theater cinema',theater:'theater cinema',farm:'agriculture farm tech',car:'automotive car dealership',garage:'automotive car dealership',
 coworking:'coworking space',blog:'magazine blog',newsletter:'newsletter platform',recipes:'recipe cooking',delivery:'food delivery logistics delivery'};
const STOP=new Set('a an and app the for my our with of to in on we i website site page web build create make me that is are be it as at by from'.split(' '));
function words(t){return(String(t||'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(w=>w.length>2&&!STOP.has(w))}
// The request's own words count double; the synonyms they bring count once.
function expand(text){const out=new Map();for(const w of words(text)){out.set(w,2);const s=SYNONYMS[w]||SYNONYMS[w.replace(/s$/,'')];if(s)for(const x of s.split(' '))if(!out.has(x))out.set(x,1)}return out}
function score(want,text){const have=new Set(words(text));let n=0;for(const [w,v] of want)if(have.has(w))n+=v;return n}
// The best palettes and font pairings for a request (empty when nothing fits).
function match(request,{palettes=3,fonts=3}={}){
 const want=expand(request);
 const rank=(list,text,weight)=>list.map((x,i)=>({x,i,s:score(want,text(x))*weight(x)})).filter(r=>r.s>0).sort((a,b)=>b.s-a.s||a.i-b.i).map(r=>r.x);
 return{palettes:rank(data.palettes,p=>p.type,()=>1).slice(0,palettes),fonts:rank(data.fonts,f=>f.best_for+' '+f.mood,()=>1).slice(0,fonts)};
}
// The suggestion block for the brief writer.
function note(request){
 const m=match(request);
 if(!m.palettes.length&&!m.fonts.length)return'';
 const lines=['','Starting points that suit this kind of business (from a design library; adapt them to this business, keep contrast readable, and do not fall back to a default indigo or purple):'];
 for(const p of m.palettes)lines.push('- Palette for '+p.type+': '+Object.entries(p.palette).map(([k,v])=>k+' '+v).join(', ')+(p.note?' ('+p.note+')':''));
 for(const f of m.fonts)lines.push('- Fonts "'+f.name+'": display '+f.display+', body '+f.body+' ('+f.mood+')');
 return lines.join('\n');
}
module.exports={match,note,data};
