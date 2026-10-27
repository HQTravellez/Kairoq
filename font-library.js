"use strict";
// The font library: a small set of the best free fonts, the same for every new site and app,
// bundled into each build from npm (Fontsource) so nothing loads from Google at runtime. Every
// font is under the SIL Open Font License 1.1 (free for commercial use, including embedding in
// websites); the licence is checked in test/font-library.test.js against each package. Fonts a
// reference site uses are matched: a library font is used as it is, a paid font gets the closest
// free one (MATCH).

// name: [npm package, CSS family, kind, character]
const F=(pkg,family,kind,character)=>({pkg,family,kind,character});
const LIBRARY={
 // Sans for text and interfaces.
 'Geist':F('@fontsource-variable/geist','Geist Variable','sans','precise, modern software'),
 'Inter':F('@fontsource-variable/inter','Inter Variable','sans','neutral, very readable'),
 'Inter Tight':F('@fontsource-variable/inter-tight','Inter Tight Variable','sans','tight headlines, Swiss'),
 'Mona Sans':F('@fontsource-variable/mona-sans','Mona Sans Variable','sans','confident, wide range of widths'),
 'Instrument Sans':F('@fontsource-variable/instrument-sans','Instrument Sans Variable','sans','calm, editorial grotesk'),
 'Hanken Grotesk':F('@fontsource-variable/hanken-grotesk','Hanken Grotesk Variable','sans','friendly grotesk'),
 'Schibsted Grotesk':F('@fontsource-variable/schibsted-grotesk','Schibsted Grotesk Variable','sans','newsroom, sturdy'),
 'Familjen Grotesk':F('@fontsource-variable/familjen-grotesk','Familjen Grotesk Variable','sans','quirky, characterful'),
 'Onest':F('@fontsource-variable/onest','Onest Variable','sans','clean, rounded corners in the letters'),
 'Figtree':F('@fontsource-variable/figtree','Figtree Variable','sans','warm geometric'),
 'Manrope':F('@fontsource-variable/manrope','Manrope Variable','sans','technical, open'),
 'Public Sans':F('@fontsource-variable/public-sans','Public Sans Variable','sans','plain, trustworthy'),
 // Display sans: headlines with character.
 'Bricolage Grotesque':F('@fontsource-variable/bricolage-grotesque','Bricolage Grotesque Variable','display','expressive, inky'),
 'Archivo':F('@fontsource-variable/archivo','Archivo Variable','display','strong, from condensed to wide'),
 'Hubot Sans':F('@fontsource-variable/hubot-sans','Hubot Sans Variable','display','technical, bold'),
 'Funnel Display':F('@fontsource-variable/funnel-display','Funnel Display Variable','display','soft, contemporary'),
 'Host Grotesk':F('@fontsource-variable/host-grotesk','Host Grotesk Variable','display','crisp, startup'),
 'Space Grotesk':F('@fontsource-variable/space-grotesk','Space Grotesk Variable','display','quirky tech'),
 'Unbounded':F('@fontsource-variable/unbounded','Unbounded Variable','display','wide, loud'),
 'Syne':F('@fontsource-variable/syne','Syne Variable','display','art, gallery'),
 'Big Shoulders Display':F('@fontsource-variable/big-shoulders-display','Big Shoulders Display Variable','display','condensed, industrial'),
 'Anton':F('@fontsource/anton','Anton','display','poster, sport'),
 // Serif.
 'Fraunces':F('@fontsource-variable/fraunces','Fraunces Variable','serif','soft old-style, warm'),
 'Newsreader':F('@fontsource-variable/newsreader','Newsreader Variable','serif','literary, editorial'),
 'Source Serif 4':F('@fontsource-variable/source-serif-4','Source Serif 4 Variable','serif','clear reading serif'),
 'EB Garamond':F('@fontsource-variable/eb-garamond','EB Garamond Variable','serif','classic book'),
 'Bodoni Moda':F('@fontsource-variable/bodoni-moda','Bodoni Moda Variable','serif','fashion, high contrast'),
 'Instrument Serif':F('@fontsource/instrument-serif','Instrument Serif','serif','condensed display serif'),
 'Young Serif':F('@fontsource/young-serif','Young Serif','serif','heavy, friendly'),
 'Gloock':F('@fontsource/gloock','Gloock','serif','dramatic display serif'),
 'DM Serif Display':F('@fontsource/dm-serif-display','DM Serif Display','serif','elegant display'),
 'Libre Caslon Text':F('@fontsource/libre-caslon-text','Libre Caslon Text','serif','traditional, legal'),
 // Mono.
 'Geist Mono':F('@fontsource-variable/geist-mono','Geist Mono Variable','mono','code'),
 'JetBrains Mono':F('@fontsource-variable/jetbrains-mono','JetBrains Mono Variable','mono','code'),
 'IBM Plex Mono':F('@fontsource/ibm-plex-mono','IBM Plex Mono','mono','technical'),
 // For children.
 'Fredoka':F('@fontsource-variable/fredoka','Fredoka Variable','kids','round, playful'),
 'Baloo 2':F('@fontsource-variable/baloo-2','Baloo 2 Variable','kids','bubbly'),
 'Nunito':F('@fontsource-variable/nunito','Nunito Variable','kids','soft, rounded'),
 'Quicksand':F('@fontsource-variable/quicksand','Quicksand Variable','kids','light, rounded'),
};

// Tested pairings: [heading, text, what it suits].
const PAIRINGS=[
 ['Geist','Geist','software, AI, developer tools'],['Inter Tight','Inter','software, finance, product'],['Mona Sans','Mona Sans','software, platforms'],
 ['Funnel Display','Inter','startups, apps'],['Host Grotesk','Instrument Sans','startups, studios'],['Instrument Serif','Inter','editorial tech, premium software'],
 ['Fraunces','Instrument Sans','food, cafés, hospitality'],['Newsreader','Inter','publishing, consultancies, education'],['Gloock','Hanken Grotesk','fashion, beauty, florists'],
 ['Bodoni Moda','Public Sans','luxury, jewellery, watches'],['EB Garamond','Hanken Grotesk','books, galleries, heritage'],['Young Serif','Figtree','bakeries, local shops, families'],
 ['DM Serif Display','Onest','restaurants, hotels, events'],['Libre Caslon Text','Public Sans','law, accounting, finance'],['Source Serif 4','Schibsted Grotesk','news, government, nonprofits'],
 ['Bricolage Grotesque','Bricolage Grotesque','creative services, studios, food brands'],['Archivo','Archivo','trades, construction, logistics'],['Hubot Sans','Mona Sans','engineering, hardware'],
 ['Anton','Inter','gyms, sport, events'],['Big Shoulders Display','Public Sans','industrial, auto, sport'],['Syne','Manrope','art, agencies, music'],
 ['Unbounded','Onest','music, gaming, nightlife'],['Space Grotesk','Inter','tech, crypto'],['Familjen Grotesk','Libre Caslon Text','architecture, design studios'],
 ['Fredoka','Nunito','children, schools, toys'],['Baloo 2','Quicksand','children, play, family'],
];

// A paid or system font (seen on a reference site) and the closest free one in the library.
const MATCH={
 'söhne':'Geist','sohne':'Geist','gt america':'Hanken Grotesk','graphik':'Inter','circular':'Figtree','circular std':'Figtree','founders grotesk':'Schibsted Grotesk',
 'neue montreal':'Instrument Sans','pp neue montreal':'Instrument Sans','neue haas grotesk':'Inter Tight','helvetica neue':'Inter Tight','helvetica':'Inter Tight','arial':'Inter',
 'sf pro':'Inter','sf pro display':'Inter Tight','sf pro text':'Inter','-apple-system':'Inter','system-ui':'Inter','segoe ui':'Inter','roboto':'Inter',
 'satoshi':'Instrument Sans','general sans':'Hanken Grotesk','switzer':'Inter','cabinet grotesk':'Bricolage Grotesque','clash display':'Syne','clash grotesk':'Host Grotesk',
 'aeonik':'Host Grotesk','pp mori':'Hanken Grotesk','basis grotesque':'Public Sans','apercu':'Instrument Sans','brown':'Figtree','avenir':'Figtree','avenir next':'Figtree',
 'futura':'Figtree','proxima nova':'Figtree','gotham':'Archivo','montserrat':'Figtree','gilroy':'Manrope','sofia pro':'Figtree','gordita':'Manrope','euclid circular':'Figtree',
 'poppins':'Figtree','dm sans':'Instrument Sans','plus jakarta sans':'Figtree','outfit':'Figtree','sora':'Host Grotesk','work sans':'Hanken Grotesk','ibm plex sans':'Public Sans',
 'canela':'Gloock','tiempos':'Newsreader','tiempos headline':'Newsreader','gt super':'Fraunces','recoleta':'Young Serif','editorial new':'Instrument Serif','pp editorial new':'Instrument Serif',
 'playfair display':'Gloock','cormorant garamond':'EB Garamond','cormorant':'EB Garamond','lora':'Newsreader','merriweather':'Source Serif 4','libre baskerville':'Libre Caslon Text',
 'times new roman':'Source Serif 4','georgia':'Source Serif 4','didot':'Bodoni Moda','baskerville':'Libre Caslon Text',
 'berkeley mono':'JetBrains Mono','sf mono':'Geist Mono','menlo':'Geist Mono','fira code':'JetBrains Mono','roboto mono':'IBM Plex Mono','space mono':'IBM Plex Mono',
 'bebas neue':'Anton','oswald':'Big Shoulders Display','druk':'Anton','league spartan':'Archivo','barlow condensed':'Big Shoulders Display','cinzel':'Bodoni Moda',
 'comic sans ms':'Fredoka','varela round':'Nunito',
};

function has(name){return Object.hasOwn(LIBRARY,String(name||''))}
// The library font for any name: itself, a known match, or the same kind's default.
function closest(name,kind='sans'){
 const n=String(name||'').trim();
 const exact=Object.keys(LIBRARY).find(k=>k.toLowerCase()===n.toLowerCase());if(exact)return exact;
 const full=n.toLowerCase().replace(/["']/g,'').trim();if(MATCH[full])return MATCH[full];
 const key=full.replace(/\s+(variable|vf|text|display)$/,'').trim();
 if(MATCH[key])return MATCH[key];
 const lib=Object.keys(LIBRARY).find(k=>k.toLowerCase()===key);if(lib)return lib;
 return kind==='serif'?'Newsreader':kind==='mono'?'Geist Mono':kind==='display'?'Inter Tight':'Inter';
}
function family(name){return has(name)?LIBRARY[name].family:null}
function packages(){return[...new Set(Object.values(LIBRARY).map(f=>f.pkg))]}
// The CSS import lines for a site's fonts (bundled into the build by Vite).
function imports(names){return[...new Set(names.filter(has))].map(n=>"@import '"+LIBRARY[n].pkg+"';")}
// For the art director: the library with what each font suits, and the pairings.
function note(){
 const byKind=k=>Object.entries(LIBRARY).filter(([,f])=>f.kind===k).map(([n,f])=>n+' ('+f.character+')').join(', ');
 return'Fonts: use only these (Kairoq\'s library of the best free fonts; any other font becomes the closest one of these).\nText and interface: '+byKind('sans')+'.\nHeadlines with character: '+byKind('display')+'.\nSerif: '+byKind('serif')+'.\nCode: '+byKind('mono')+'.\nFor children only: '+byKind('kids')+'.\nGood pairings (heading + text, what they suit): '+PAIRINGS.map(([d,b,w])=>d+(d===b?' alone':' + '+b)+' ('+w+')').join('; ')+'.';
}
module.exports={LIBRARY,PAIRINGS,MATCH,has,closest,family,packages,imports,note};
