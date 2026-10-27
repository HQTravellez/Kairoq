"use strict";
// Section recipes: Kairoq's own library of premium section patterns (heroes, features, pricing,
// testimonials, calls to action...), written in our own words. The art director picks one recipe
// per section for a landing page; every later change sees the choice in the design brief, so a
// site keeps one coherent level of craft. Recipes describe layout and feel, and name the kit
// pieces that make them (src/components/ui/*), never content: words, numbers, logos and quotes
// still come only from the owner.

const R=(id,kind,name,look,fits,uses=[])=>({id,kind,name,look,fits,uses});
const RECIPES=[
 // ---------- hero ----------
 R('hero-split-photo','hero','Split with photo','Headline, one line and the main button on the left; a large, cropped photo of the real place or product on the right, its corners softly rounded; a thin row of facts (hours, area, rating only if real) under the button.','places and products with good photos: cafés, restaurants, stays, salons, shops'),
 R('hero-rotating-words','hero','Rotating words','A centred, very large headline whose last words rotate through the audiences or services the owner named, in the primary colour; one calm sentence; the main button pulls gently toward the pointer.','services for several kinds of customer: agencies, trades, studios, clinics',['TextLoop','TextEffect','Magnetic']),
 R('hero-flowing-lines','hero','Flowing lines','A quiet centred headline revealed word by word over a backdrop of fine flowing lines in the text colour that part around the cursor; lots of white space; a shimmering badge above the headline for the one piece of news.','software, consultancies, studios and services with no hero photo',['BackgroundPaths','TextEffect','TextShimmer']),
 R('hero-editorial','hero','Editorial cover','A magazine cover: an oversized serif headline across two thirds of the width, a small kicker line above it, a tall portrait photo on the right overlapping the headline slightly, page number style details in the corners.','luxury, fashion, architecture, wine, hotels, personal brands'),
 R('hero-product-3d','hero','Product in 3D','The product as a 3D object beside the headline, turning slowly with the pointer and scroll; the background a soft gradient of the brand colour; a small spec line under the button.','one signature product: a watch, a bottle, a device, a box',['HeroObject (kairoq/hero3d)']),
 R('hero-full-bleed','hero','Full-bleed photo','A full-screen photo or quiet video with a dark gradient from the bottom; the headline and button sit low on the left in white; the header is transparent over it.','experiences and places: tours, venues, resorts, restaurants with atmosphere'),
 R('hero-glow-gradient','hero','Glow gradient','Soft moving glows in the brand colours behind a centred headline and two buttons (main and quiet); below, a framed screenshot of the product rising from the bottom edge.','apps and software with a real screenshot',['AnimatedGradient','TextEffect']),
 R('hero-bento','hero','Bento hero','The headline in the first, largest tile of a bento grid; the other tiles show the three things the business is known for (a photo, a short fact, a small action).','businesses with several strong offers: gyms, studios, bakeries, coworking',['BentoGrid','BentoCard']),
 // ---------- features ----------
 R('features-tilt-cards','features','Tilt cards','Three cards in a row that arrive one after another and tilt slightly toward the pointer, each with a soft glow following the cursor; an icon, a short title, one sentence.','three clear benefits or services',['AnimatedGroup','Tilt','Spotlight']),
 R('features-bento','features','Bento grid','Features as tiles of different sizes: the most important one twice as wide with a photo or illustration, the rest small with an icon and one line.','four to six features of different weight',['BentoGrid','BentoCard']),
 R('features-alternating','features','Alternating rows','Each feature is a row: photo on one side, short heading and two sentences on the other, sides alternating; generous space between rows.','services that need a photo each: renovations, menus, treatments'),
 R('features-sticky-list','features','Sticky list','A sticky heading on the left while a list of numbered features scrolls on the right, each with a thin top border.','a sequence of things the business does, or a long feature list'),
 R('features-icon-grid','features','Icon grid','A grid of six to nine small items: a simple icon, a bold three-word title, one muted line; no cards, just space and alignment.','amenities, inclusions, what is in a plan'),
 R('features-tabs','features','Tabbed showcase','Tabs for each main service; the panel shows a large photo or screenshot and two lines; the tab indicator slides between tabs.','three to five services each with its own picture'),
 // ---------- story / about ----------
 R('story-split-quote','story','Story with quote','A short story of the founder or the place on the left in a readable column; on the right a large pull quote from the owner (their real words) set in the display font.','family businesses, makers, chefs, founders'),
 R('story-timeline','story','Timeline','A vertical timeline of real milestones (year and one line), with a photo for the most important one.','businesses with history: since 1987, three generations'),
 R('story-photo-mosaic','story','Photo mosaic','A mosaic of three to five real photos of the team and the place at different sizes, with one short paragraph over a blurred edge of the largest photo.','studios, restaurants, ateliers, teams',['ProgressiveBlur']),
 R('story-values','story','Values in large type','Three values, each a large display-font word followed by one plain sentence, separated by thin rules.','agencies, nonprofits, clinics'),
 // ---------- gallery / showcase ----------
 R('gallery-masonry','gallery','Masonry gallery','Real photos in a masonry grid; hovering one lifts it slightly; captions appear on a blurred bottom edge.','portfolios, interiors, food, events',['ProgressiveBlur','Tilt']),
 R('gallery-before-after','gallery','Before and after','One or two before/after sliders of the same view, a one-line caption each.','renovations, cleaning, detailing, hair and beauty, retouching (only with real before/after photos)',['ImageComparison']),
 R('gallery-film-scene','gallery','Film scene','A pinned scroll scene where the product film plays beside a headline as the visitor scrolls.','a product film the owner made with Make it move',['ScrollVideo (kairoq/scroll)']),
 R('gallery-marquee','gallery','Moving strip','A slow, endless strip of photos or real client names that pauses on hover.','many small pictures, or names of real partners the owner gave',['Marquee']),
 // ---------- process ----------
 R('process-steps','process','Three steps','Three numbered steps in a row joined by a thin line, each with a short title and one sentence; they arrive one after another.','how booking, ordering or working together goes',['AnimatedGroup']),
 R('process-scroll-assembly','process','Inside the product','A pinned 3D scene where the product comes apart as the visitor scrolls, with labels for its real parts, then assembles again.','a physical product people want to see inside',['ScrollAssembly (kairoq/hero3d)']),
 R('process-journey','process','Journey in 3D','A 3D story scene with step buttons and captions (from machine to guest, from oven to box).','cafés, pizzerias, makers with a process',['CoffeeJourney or Story (kairoq/story)']),
 // ---------- pricing ----------
 R('pricing-three-tiers','pricing','Three plans','Three plan cards side by side; the middle one is raised, outlined with a moving border and has the main button; a monthly/yearly switch above.','subscriptions and memberships with real prices',['BorderBeam']),
 R('pricing-menu','pricing','Menu list','Prices as an elegant menu: item names in the display font, a dotted leader, the price on the right, short notes under items, grouped under small headings.','restaurants, salons, spas, workshops'),
 R('pricing-single','pricing','One clear price','One wide card with the single price large, what is included in two columns of checks, and the button; a short line on refunds or terms.','one product or one service'),
 R('pricing-compare','pricing','Comparison table','A table comparing plans row by row with checks, the recommended column tinted; sticky plan names on scroll.','software with several plans and many features',['DataTable']),
 // ---------- testimonials ----------
 R('testimonials-quote-wall','testimonials','Quote wall','Real reviews in a masonry wall of small cards with the name and where they came from; two columns slowly scroll in opposite directions.','businesses with many real reviews',['Marquee']),
 R('testimonials-single-large','testimonials','One big quote','One real review in very large display type centred on a tinted band, the name and role below.','one strong real review'),
 R('testimonials-photo-cards','testimonials','Faces and words','Three cards with a real customer photo, a short quote and the name.','real reviews that come with photos (only if given)'),
 R('testimonials-ratings','testimonials','Ratings band','A thin band with the real average rating and count from the named source (Google, Tripadvisor) and one quote.','a real rating the owner gave'),
 // ---------- stats ----------
 R('stats-counters','stats','Counting figures','Three or four real figures that count up when they come into view, each with a short label, separated by thin dividers.','real numbers the owner gave (years, clients, rooms)',['NumberTicker','InView']),
 R('stats-band','stats','Dark figures band','A dark band across the page with real figures in large light type.','a bold page that needs a pause'),
 R('stats-inline','stats','Facts in the hero','Two or three real facts in small type right under the hero button.','short real facts: open 7 days, 20 years, free parking'),
 // ---------- FAQ ----------
 R('faq-accordion','faq','Questions','The owner\'s real questions as an accordion in one readable column, with a contact line at the end.','any business with common questions',['Accordion']),
 R('faq-two-column','faq','Questions beside a heading','A heading and a short line on the left, the accordion on the right.','wider pages',['Accordion']),
 // ---------- call to action ----------
 R('cta-glow-band','cta','Glow band','A full-width band with soft moving glows in the brand colours, a short headline and the main button.','software, studios, services',['AnimatedGradient','Magnetic']),
 R('cta-photo-band','cta','Photo band','A wide photo with a dark overlay, a short headline and the button on it.','places with atmosphere'),
 R('cta-split-form','cta','Ask right here','Headline on the left; a short real form (name, email, one question) on the right that saves to the app.','enquiries, bookings, quotes'),
 R('cta-simple','cta','Quiet close','A centred line in the display font and one button, lots of space, no background.','calm, editorial and luxury pages'),
 // ---------- contact / visit ----------
 R('contact-map-hours','contact','Visit us','The address, hours and phone on the left; a map or a photo of the entrance on the right; a "Get directions" link.','places people visit'),
 R('contact-form-card','contact','Contact card','A card with a short form that saves to the app, beside the email and phone.','services and studios'),
 R('contact-booking','contact','Book a time','A real booking form (date, time window, details) that saves a request, with a line that a request is not a confirmation.','appointments and visits'),
 // ---------- footer ----------
 R('footer-columns','footer','Columns','Logo and one line on the left, three short link columns, contact details, small print in a bottom row.','sites with several pages'),
 R('footer-big-wordmark','footer','Big wordmark','The business name set huge in the display font across the bottom, with a few links above it.','bold, editorial and luxury sites'),
 R('footer-minimal','footer','Minimal','One line: name, year, two links, social icons for the owner\'s real accounts.','single-page sites'),
];
const KINDS=[...new Set(RECIPES.map(r=>r.kind))];
const BY_ID=new Map(RECIPES.map(r=>[r.id,r]));

// Words in a request that point at recipes (most specific first).
const HINTS=[
 [/\b(watch\w*|jewell?er\w*|perfume|bottle|device|gadget|product)\b/i,['hero-product-3d','process-scroll-assembly']],
 [/\b(renovat\w*|contractor|cleaning|detailing|salon|hair|barber|before.and.after|retouch\w*)\b/i,['gallery-before-after','features-alternating']],
 [/\b(restaurant|caf[eé]|cafe|coffee|bakery|bistro|bar|pizz\w*|menu)(?![a-z])/i,['hero-split-photo','pricing-menu','story-split-quote']],
 [/\b(hotel|stay|villa|resort|tour|venue|travel|experience)\b/i,['hero-full-bleed','gallery-masonry','contact-map-hours']],
 [/\b(saas|software|app|platform|ai|startup|tool|api)\b/i,['hero-glow-gradient','features-bento','pricing-three-tiers','cta-glow-band']],
 [/\b(agency|studio|consult\w*|freelanc\w*|design|architect\w*)\b/i,['hero-rotating-words','story-values','footer-big-wordmark']],
 [/\b(luxury|fashion|wine|boutique|atelier|editorial|magazine)\b/i,['hero-editorial','cta-simple','footer-big-wordmark']],
 [/\b(gym|fitness|yoga|pilates|coworking|spa)\b/i,['hero-bento','pricing-three-tiers','testimonials-photo-cards']],
 [/\b(clinic|dentist|doctor|therap\w*|lawyer|accountant)\b/i,['hero-split-photo','process-steps','faq-accordion','contact-booking']],
];
function suggest(request){
 const t=String(request||''),out=new Set();
 for(const [re,ids] of HINTS)if(re.test(t))ids.forEach(i=>out.add(i));
 return[...out].slice(0,8);
}
// The block for the art director: the library, compact, with the suggested ones first.
function note(request){
 const s=suggest(request);
 const lines=['','Section recipes (Kairoq\'s library of premium section patterns; pick one per section the page needs, by id):'];
 for(const k of KINDS){
  const list=RECIPES.filter(r=>r.kind===k).sort((a,b)=>(s.includes(b.id)?1:0)-(s.includes(a.id)?1:0));
  lines.push('- '+k+': '+list.map(r=>r.id+' ('+r.fits+')').join('; '));
 }
 if(s.length)lines.push('Suggested for this request: '+s.join(', ')+'.');
 lines.push('Set "recipes" in your JSON to {"hero":"id","features":"id",...} for the sections this page needs (four to seven; leave out the rest), or {} for an app people work in.');
 return lines.join('\n');
}
// Keeps known recipes in their own section kind.
function normalize(v){
 if(!v||typeof v!=='object'||Array.isArray(v))return null;
 const out={};
 for(const [k,id] of Object.entries(v)){const r=BY_ID.get(String(id));if(r&&r.kind===k)out[k]=r.id}
 return Object.keys(out).length?out:null;
}
// The lines in every build's design brief.
function text(recipes){
 const chosen=Object.entries(recipes||{}).map(([,id])=>BY_ID.get(id)).filter(Boolean);
 if(!chosen.length)return'';
 return'Section recipes (build these sections this way; real content only):\n'+chosen.map(r=>'- '+r.kind[0].toUpperCase()+r.kind.slice(1)+': '+r.name+'. '+r.look+(r.uses.length?' Kit: '+r.uses.join(', ')+'.':'')).join('\n');
}
// ---------- signature moments ----------
// Every landing page gets one moment people remember, something that moves or answers the
// pointer. Kairoq picks it (suited to the business, different from the owner's recent sites);
// a 3D hero from kairoq/hero3d counts as one. After the first build Kairoq checks it is there.
const S=(id,name,look,needs,fits)=>({id,name,look,needs,fits});
const SIGNATURES=[
 S('object-3d','3D object','The 3D object from the design brief (kairoq/hero3d) as the hero visual, moving with the pointer and scroll.',[/['"]kairoq\/hero3d['"]/],null),
 S('flowing-lines','Flowing lines','A hero over fine flowing lines in the text colour that part around the cursor (BackgroundPaths), the headline revealed word by word (TextEffect).',[/\bui\/background-paths/,/\bui\/text-effect/],/\b(software|saas|consult\w*|studio|agency|law\w*|account\w*|finance|architect\w*|clinic|therap\w*)/i),
 S('glow-hero','Glow hero','Soft moving glows in the brand colours behind the hero (AnimatedGradient), the headline revealed word by word (TextEffect), the main button pulling toward the pointer (Magnetic).',[/\bui\/animated-gradient/,/\bui\/text-effect/],/\b(app|ai|tech|startup|events?|music|beauty|salon|spa|fitness|gym)/i),
 S('rotating-headline','Rotating headline','A very large headline whose last words rotate through the services or audiences (TextLoop), revealed word by word (TextEffect), with a magnetic main button (Magnetic).',[/\bui\/text-loop/,/\bui\/magnetic/],/\b(renovat\w*|contractor|trades?|cleaning|services?|agency|school|course|tours?|travel)/i),
 S('show-it-working','Show it working','The product shown working instead of feature cards: a product tour (ProductTour) where a cursor clicks through 3 to 5 real steps of the product, one short caption each, built from the product\'s own screens in code; where the product takes a request (search, booking, a question), the hero is that real input with example requests typed into it (TypedInput).',[/\bui\/product-tour/],/\b(software|saas|platform|b2b|dashboard|crm|api|startup|portal|ai (?:assistant|agent|tool)|(?:web|mobile) app|tool for)/i),
 S('tilt-cards','Living cards','The main offers as cards that arrive one after another (AnimatedGroup), tilt toward the pointer (Tilt) and glow under it (Spotlight).',[/\bui\/tilt/,/\bui\/spotlight/],/\b(restaurant|caf[eé]|cafe|menu|shop|store|products?|gym|hotel|stays?|florist|bakery)/i),
];
// The signature for a request: suited to it and not used by the owner's recent sites.
// Software is shown working: the product tour is the default for it.
const SOFTWARE=/\b(software|saas|platform|b2b|dashboard|crm|api|startup|portal|ai (?:assistant|agent|tool)|(?:web|mobile) app|tool for)/i;
function signature(request,{recent=[],seed=''}={}){
 if(SOFTWARE.test(String(request||'')))return'show-it-working';
 const used=new Set(recent.map(d=>d&&d.signature).filter(Boolean));
 const pool=SIGNATURES.filter(x=>x.fits);
 const fit=pool.filter(x=>x.fits.test(String(request||''))),rest=pool.filter(x=>!fit.includes(x));
 let h=0;for(const c of String(seed+request))h=(h*31+c.charCodeAt(0))>>>0;
 const turn=l=>l.length?[...l.slice(h%l.length),...l.slice(0,h%l.length)]:l;
 const order=[...turn(fit),...turn(rest)];
 return(order.find(x=>!used.has(x.id))||order[0]).id;
}
function signatureNote(id){const x=SIGNATURES.find(s=>s.id===id);return x?'\n\nSignature moment (required on the landing page; Kairoq checks it): '+x.name+'. '+x.look+' If you give the page a 3D hero ("hero3d"), that is the signature moment instead.':''}
function signatureText(id){const x=SIGNATURES.find(s=>s.id===id);return x?'Signature moment (required; the page must have it): '+x.name+'. '+x.look:''}
// After the first build: the signature's pieces must really be on the page.
function signatureMissing(id,files){
 const x=SIGNATURES.find(s=>s.id===id);if(!x)return null;
 const code=Object.entries(files||{}).filter(([n,c])=>/^src\/.*\.(jsx?|tsx?)$/.test(n)&&!n.startsWith('src/components/ui/')&&typeof c==='string').map(([,c])=>c).join('\n');
 if(!x.needs.every(re=>re.test(code)))return'The design brief\'s signature moment is missing from the page: '+x.name+'. '+x.look+' Add it to the landing page (import the pieces from the UI kit), keeping everything else.';
 // The 3D object is the hero's visual: it lives in the hero (a file named Hero or the one with
 // the page headline), not lower down the page.
 if(id==='object-3d'){
  const home=Object.entries(files||{}).filter(([n,c])=>/^src\/.*\.(jsx?|tsx?)$/.test(n)&&typeof c==='string'&&x.needs[0].test(c));
  if(!home.some(([n,c])=>/hero/i.test(n)||/<h1[\s>]/.test(c)||/function\s+Hero\b|const\s+Hero\b/.test(c)))return'The 3D object from the design brief is on the page but not in the hero. Move it into the hero section, beside the main headline at the top of the page, large (height={480} on desktop), keeping everything else.';
 }
 return null;
}
module.exports={SOFTWARE,RECIPES,KINDS,suggest,note,normalize,text,SIGNATURES,signature,signatureNote,signatureText,signatureMissing};
