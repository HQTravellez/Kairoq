"use strict";
// Design system for Create projects: the starter UI kit, design tokens (CSS variables in
// src/index.css that the Tailwind theme reads), fonts, and the design brief the AI writes
// before the first build so every later edit follows one coherent look.
const fs=require('fs'),path=require('path');

// ---------- starter kit ----------
const KIT_DIR=path.join(__dirname,'starter-kit');
let kitCache=null;
function kit(){
 if(kitCache)return kitCache;
 const out={};
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else out[path.relative(KIT_DIR,p).split(path.sep).join('/')]=fs.readFileSync(p,'utf8')}};
 walk(path.join(KIT_DIR,'src'));
 return kitCache=out;
}
// One line per kit file so the model knows the API without reading every file.
const KIT_API={
 'src/lib/utils.js':'cn(...classes) merges class names',
 'src/components/ui/button.jsx':'Button {variant: default|secondary|outline|ghost|link|destructive|hero, size: sm|default|lg|xl|icon, asChild}, buttonVariants',
 'src/components/ui/card.jsx':'Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter',
 'src/components/ui/input.jsx':'Input',
 'src/components/ui/textarea.jsx':'Textarea',
 'src/components/ui/label.jsx':'Label',
 'src/components/ui/badge.jsx':'Badge {variant: default|secondary|outline|muted|accent|destructive}',
 'src/components/ui/dialog.jsx':'Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose (Radix)',
 'src/components/ui/sheet.jsx':'Sheet, SheetTrigger, SheetContent {side: right|left|bottom|top}, SheetTitle, SheetDescription, SheetClose (slide-in panels, mobile menus, bottom sheets)',
 'src/components/ui/tabs.jsx':'Tabs, TabsList, TabsTrigger, TabsContent (Radix)',
 'src/components/ui/select.jsx':'Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup (Radix; onValueChange)',
 'src/components/ui/accordion.jsx':'Accordion {type: single|multiple, collapsible}, AccordionItem, AccordionTrigger, AccordionContent',
 'src/components/ui/switch.jsx':'Switch {checked, onCheckedChange}',
 'src/components/ui/dropdown-menu.jsx':'DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator',
 'src/components/ui/tooltip.jsx':'TooltipProvider, Tooltip, TooltipTrigger, TooltipContent',
 'src/components/ui/avatar.jsx':'Avatar {src, name} (initials fallback)',
 'src/components/ui/skeleton.jsx':'Skeleton (loading placeholder)',
 'src/components/ui/separator.jsx':'Separator {orientation}',
 'src/components/ui/toaster.jsx':'Toaster (render once), toast (toast.success("Saved"))',
 'src/components/ui/section.jsx':'Container (max-w-6xl page width), Section (vertical rhythm), Eyebrow (small label above headings)'
};
function isKitFile(name,code){const k=kit();return Object.hasOwn(k,name)&&k[name]===code}

// ---------- fonts ----------
// Google Fonts with the weights each one really has (a wrong weight breaks the whole request).
const FONTS={
 'Inter':['sans','400;500;600;700'],'Plus Jakarta Sans':['sans','400;500;600;700'],'DM Sans':['sans','400;500;600;700'],'Manrope':['sans','400;500;600;700'],
 'Outfit':['sans','400;500;600;700'],'Figtree':['sans','400;500;600;700'],'Work Sans':['sans','400;500;600;700'],'Lato':['sans','400;700'],
 'Source Sans 3':['sans','400;500;600;700'],'IBM Plex Sans':['sans','400;500;600;700'],'Space Grotesk':['sans','400;500;600;700'],'Sora':['sans','400;500;600;700'],
 'Rubik':['sans','400;500;600;700'],'Poppins':['sans','400;500;600;700'],'Karla':['sans','400;500;600;700'],'Nunito':['sans','400;500;600;700'],
 'Josefin Sans':['sans','400;500;600;700'],'Archivo':['sans','400;500;600;700'],'Bricolage Grotesque':['sans','400;500;600;700'],'Syne':['sans','400;500;600;700'],
 'Unbounded':['display','400;500;600;700'],'Bebas Neue':['display','400'],
 'Playfair Display':['serif','400;500;600;700'],'Cormorant Garamond':['serif','400;500;600;700'],'Fraunces':['serif','400;500;600;700'],'DM Serif Display':['serif','400'],
 'Lora':['serif','400;500;600;700'],'EB Garamond':['serif','400;500;600;700'],'Libre Baskerville':['serif','400;700'],'Instrument Serif':['serif','400'],'Merriweather':['serif','400;700'],
 'Roboto':['sans','400;500;700'],'Open Sans':['sans','400;500;600;700'],'Montserrat':['sans','400;500;600;700'],'Raleway':['sans','400;500;600;700'],'Nunito Sans':['sans','400;600;700'],'Public Sans':['sans','400;500;600;700'],
 'Quicksand':['sans','400;500;600;700'],'Lexend':['sans','400;500;600;700'],'Atkinson Hyperlegible':['sans','400;700'],'Be Vietnam Pro':['sans','400;500;600;700'],'Noto Sans':['sans','400;500;600;700'],'Varela Round':['sans','400'],
 'Fredoka':['display','400;500;600;700'],'Abril Fatface':['display','400'],'Caveat':['display','400;700'],
 'Crimson Pro':['serif','400;500;600;700'],'Cormorant':['serif','400;500;600;700'],'Newsreader':['serif','400;500;600;700'],
 // From the type systems in design-library/type.json (taste-skill, MIT).
 'Schibsted Grotesk':['sans','400;600;800'],'Hanken Grotesk':['sans','400;500'],'Libre Franklin':['sans','400;600;700'],'Source Serif 4':['serif','400;600'],'Anton':['display','400'],'Big Shoulders':['display','400;800'],'Barlow Condensed':['display','400;700'],'Barlow':['sans','400;500'],'TikTok Sans':['sans','400;500;800'],'Onest':['sans','400;500'],'Chivo':['sans','400;700;900'],'Epilogue':['sans','400;500;900'],'Red Hat Display':['sans','400;900'],'Red Hat Text':['sans','400;500'],'Jost':['sans','400;500;700'],'Stack Sans Headline':['sans','300;400'],'Stack Sans Text':['sans','400;500'],'Albert Sans':['sans','400;500;600'],'League Spartan':['sans','400;700'],'Bodoni Moda':['serif','400;500'],'Imbue':['serif','400'],'Literata':['serif','400;500;600'],'STIX Two Text':['serif','400;600'],'Young Serif':['serif','400'],'Zilla Slab':['serif','400;500;600'],'Besley':['serif','400;800'],'Rokkitt':['serif','400;800'],
 'JetBrains Mono':['mono','400;500;600;700'],'Space Mono':['mono','400;700'],
 // Fira Code (github.com/tonsky/FiraCode, SIL OFL 1.1): joins -> => != into one shape in code blocks.
 'Fira Code':['mono','400;500;600;700']
};
const FALLBACK={sans:'ui-sans-serif, system-ui, sans-serif',display:'ui-sans-serif, system-ui, sans-serif',serif:'ui-serif, Georgia, serif',mono:'ui-monospace, monospace'};
function fontStack(name){const f=FONTS[name];return"'"+name+"', "+FALLBACK[f?f[0]:'sans']}
function fontUrl(names){
 const list=[...new Set(names.filter(n=>FONTS[n]))];
 if(!list.length)return null;
 return'https://fonts.googleapis.com/css2?'+list.map(n=>'family='+n.replace(/ /g,'+')+':wght@'+FONTS[n][1]).join('&')+'&display=swap';
}

// ---------- colours ----------
function hexToRgb(hex){const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||'').trim());if(!m)return null;const n=parseInt(m[1],16);return[(n>>16)&255,(n>>8)&255,n&255]}
function rgbToHex(c){return'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('')}
function rgbToHsl([r,g,b]){
 r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;let h=0,s=0;
 if(max!==min){const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;h*=60}
 return Math.round(h)+' '+Math.round(s*100)+'% '+Math.round(l*100)+'%';
}
function mix(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t)}
function luminance(c){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}
function readableOn(bg,candidates){return candidates.reduce((best,c)=>contrast(bg,c)>contrast(bg,best)?c:best)}
// Darkens or lightens `fg` towards the far end until it reads on `bg` (WCAG AA for text).
function ensureContrast(fg,bg,min=4.5){
 const target=luminance(bg)>0.4?[0,0,0]:[255,255,255];let c=fg;
 for(let i=0;i<20&&contrast(c,bg)<min;i++)c=mix(c,target,0.15);
 return c;
}
const DEFAULT_PALETTE={background:'#ffffff',foreground:'#0f172a',primary:'#4f46e5',secondary:'#f1f5f9',accent:'#ec4899'};
// Turns the brief's few colours into the full token set.
function tokens(design={}){
 const p={...DEFAULT_PALETTE,...(design.palette||{})};
 const c=k=>hexToRgb(p[k])||hexToRgb(DEFAULT_PALETTE[k]);
 const bg=c('background'),fg=ensureContrast(c('foreground'),bg,7),primary=c('primary'),secondary=c('secondary'),accent=c('accent');
 const dark=luminance(bg)<0.2,white=[255,255,255],ink=[10,10,15];
 const card=hexToRgb(p.card)||(dark?mix(bg,white,0.04):mix(bg,white,0.7));
 const muted=hexToRgb(p.muted)||mix(bg,fg,dark?0.1:0.05);
 const border=hexToRgb(p.border)||mix(bg,fg,dark?0.16:0.11);
 const destructive=hexToRgb(p.destructive)||[220,38,38];
 const on=x=>readableOn(x,[fg,bg,white,ink]);
 const radius=/^(0|0?\.\d+|1(\.\d+)?)rem$/.test(String(design.radius||''))?design.radius:'0.75rem';
 const display=FONTS[design.fonts?.display]?design.fonts.display:'Inter',body=FONTS[design.fonts?.body]?design.fonts.body:'Inter';
 const hsl=rgbToHsl;
 return{
  '--background':hsl(bg),'--foreground':hsl(fg),
  '--card':hsl(card),'--card-foreground':hsl(fg),'--popover':hsl(card),'--popover-foreground':hsl(fg),
  '--primary':hsl(primary),'--primary-foreground':hsl(on(primary)),
  '--secondary':hsl(secondary),'--secondary-foreground':hsl(on(secondary)),
  '--muted':hsl(muted),'--muted-foreground':hsl(ensureContrast(mix(fg,bg,0.42),muted,4.5)),
  '--accent':hsl(accent),'--accent-foreground':hsl(on(accent)),
  '--destructive':hsl(destructive),'--destructive-foreground':hsl(on(destructive)),
  '--border':hsl(border),'--input':hsl(border),'--ring':hsl(primary),
  '--radius':radius,'--radius-sm':'calc(var(--radius) - 4px)','--radius-xl':'calc(var(--radius) + 4px)','--radius-2xl':'calc(var(--radius) + 8px)',
  '--font-sans':fontStack(body),'--font-display':fontStack(display),
  ...(FONTS[design.fonts?.mono]&&FONTS[design.fonts.mono][0]==='mono'?{'--font-mono':fontStack(design.fonts.mono)}:{}),
  '--gradient-hero':'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)',
  '--gradient-subtle':'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%)',
  '--shadow-soft':'0 1px 2px hsl(var(--foreground) / 0.04), 0 8px 24px -12px hsl(var(--foreground) / 0.14)',
  '--shadow-glow':'0 24px 60px -24px hsl(var(--primary) / 0.45)'
 };
}
const START='/* kairoq:tokens:start (design tokens; edit colours here, not in components) */',END='/* kairoq:tokens:end */';
const FONT_MARK='/* kairoq:fonts */';
function tokensBlock(design){return START+'\n@layer base {\n  :root {\n'+Object.entries(tokens(design)).map(([k,v])=>'    '+k+': '+v+';').join('\n')+'\n  }\n}\n'+END}
function fontLine(design){const url=fontUrl([design.fonts?.display||'Inter',design.fonts?.body||'Inter',...(FONTS[design.fonts?.mono]?[design.fonts.mono]:[])]);return url?"@import url('"+url+"'); "+FONT_MARK:''}
const BASE_CSS=`@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { @apply border-border; }
  html { -webkit-tap-highlight-color: transparent; }
  body { @apply bg-background font-sans text-foreground antialiased; }
  h1, h2, h3, h4 { @apply font-display tracking-tight; text-wrap: balance; }
  p { text-wrap: pretty; }
  ::selection { background: hsl(var(--primary) / 0.2); }
}
`;
// Writes the brief's tokens and fonts into src/index.css, replacing earlier ones.
function applyToCss(css,design){
 let out=String(css||'');
 const s=out.indexOf(START.slice(0,24)),e=out.indexOf(END);
 if(s>=0&&e>s)out=out.slice(0,s)+'%%TOKENS%%'+out.slice(e+END.length);
 out=out.split('\n').filter(l=>!l.includes(FONT_MARK)).join('\n').replace(/^\n+/,'');
 if(!/@tailwind\s+base/.test(out))out=BASE_CSS+'\n'+out;
 if(out.includes('%%TOKENS%%'))out=out.replace('%%TOKENS%%',tokensBlock(design));
 else out=out.replace(/(@tailwind\s+utilities;\s*\n)/,'$1\n'+tokensBlock(design)+'\n');
 const font=fontLine(design);
 return(font?font+'\n':'')+out;
}
function starterCss(design){return applyToCss(BASE_CSS,design)}

// Tailwind theme every Create build uses. Values fall back to Tailwind's defaults, so
// projects without tokens look the same as before.
const THEME={extend:{
 colors:Object.fromEntries([['border'],['input'],['ring'],['background'],['foreground']].map(([k])=>[k,'hsl(var(--'+k+') / <alpha-value>)']).concat(
  ['primary','secondary','muted','accent','destructive','card','popover'].map(k=>[k,{DEFAULT:'hsl(var(--'+k+') / <alpha-value>)',foreground:'hsl(var(--'+k+'-foreground) / <alpha-value>)'}]))),
 borderRadius:{sm:'var(--radius-sm, 0.125rem)',md:'calc(var(--radius, 0.5rem) - 2px)',lg:'var(--radius, 0.5rem)',xl:'var(--radius-xl, 0.75rem)','2xl':'var(--radius-2xl, 1rem)'},
 fontFamily:{mono:['var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)'],sans:['var(--font-sans, ui-sans-serif, system-ui, sans-serif)'],display:['var(--font-display, var(--font-sans, ui-sans-serif, system-ui, sans-serif))']},
 boxShadow:{soft:'var(--shadow-soft, 0 1px 3px rgb(0 0 0 / 0.1))',glow:'var(--shadow-glow, 0 20px 50px -20px rgb(0 0 0 / 0.35))'},
 backgroundImage:{'gradient-hero':'var(--gradient-hero, none)','gradient-subtle':'var(--gradient-subtle, none)'},
 keyframes:{
  'fade-in':{from:{opacity:'0'},to:{opacity:'1'}},
  'fade-up':{from:{opacity:'0',transform:'translateY(16px)'},to:{opacity:'1',transform:'translateY(0)'}},
  'scale-in':{from:{opacity:'0',transform:'translate(-50%, -48%) scale(0.96)'},to:{opacity:'1',transform:'translate(-50%, -50%) scale(1)'}},
  'slide-up':{from:{transform:'translateY(100%)'},to:{transform:'translateY(0)'}},
  'slide-in-right':{from:{transform:'translateX(100%)'},to:{transform:'translateX(0)'}},
  'slide-in-left':{from:{transform:'translateX(-100%)'},to:{transform:'translateX(0)'}}
 },
 animation:{'fade-in':'fade-in 0.3s ease-out both','fade-up':'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both','scale-in':'scale-in 0.2s ease-out both','slide-up':'slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1)','slide-in-right':'slide-in-right 0.3s cubic-bezier(0.22, 1, 0.36, 1)','slide-in-left':'slide-in-left 0.3s cubic-bezier(0.22, 1, 0.36, 1)'}
}};

function starterApp(name){
 const title=String(name||'New app').replace(/[^\w .,'&-]/g,'').slice(0,80)||'New app';
 return`import React from 'react';
import { Sparkles } from 'lucide-react';

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-subtle px-6">
      <div className="max-w-xl text-center animate-fade-up">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
          <Sparkles className="h-6 w-6" />
        </span>
        <h1 className="mt-6 font-display text-4xl font-semibold sm:text-5xl">${title}</h1>
        <p className="mt-3 text-muted-foreground">Describe your app in the chat and it will appear here.</p>
      </div>
    </main>
  );
}
`;
}
// The files of a brand-new project.
function starterFiles(name,design){
 return{
  'src/main.jsx':`import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(<App />);
`,
  'src/App.jsx':starterApp(name),
  'src/index.css':starterCss(design||{}),
  ...kit()
 };
}
// A project still showing the untouched starter page (so the next build is the first real one).
function isUntouchedStarter(files){return String(files['src/App.jsx']||'').includes('Describe your app in the chat and it will appear here.')&&Object.keys(files).filter(n=>!isKitFile(n,files[n])).length<=3}
// Adds the kit and tokens to an older project that has neither (the "Add design system" action).
function addDesignSystem(files,design){
 const next={...files};
 for(const [k,v] of Object.entries(kit()))if(!Object.hasOwn(next,k))next[k]=v;
 next['src/index.css']=applyToCss(next['src/index.css']||BASE_CSS,design||{});
 return next;
}
function hasTokens(files){return String(files['src/index.css']||'').includes(END)}

// ---------- prompt text ----------
const RULES=`
DESIGN (as important as working code; the app must look like a polished product a designer made):
- Design system: src/index.css holds the design tokens (CSS variables between the kairoq:tokens markers) and the font import. Use the semantic Tailwind classes: bg-background text-foreground, bg-card text-card-foreground, bg-primary text-primary-foreground, bg-secondary text-secondary-foreground, bg-muted text-muted-foreground, bg-accent text-accent-foreground, border-border, ring-ring, shadow-soft, shadow-glow, bg-gradient-hero, bg-gradient-subtle, font-display for headings, font-sans for text, rounded-md/lg/xl/2xl (they follow --radius). Opacity modifiers work (bg-primary/10). Do not hard-code colours in components (no bg-blue-600, text-[#123456] or inline hex); to change the look, change the tokens in src/index.css (HSL values like "222 47% 11%"). White or black with opacity over photos (bg-black/40, text-white) is fine. If a project has no tokens yet, choose a palette and add a :root token block to src/index.css first.
- Components: reuse the UI kit in src/components/ui/ (listed with the files) and extend it with new variants instead of restyling the same element by hand in many places. Keep pages in src/pages/ and sections in src/components/.
- Layout: generous whitespace (sections py-16 to py-24, Container for page width), one clear focal point per screen, a strong headline (font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight), supporting text in text-muted-foreground with max-w-2xl, then clear actions. Use consistent gaps (gap-4, gap-6, gap-8), a real grid, and vary section backgrounds (bg-background, bg-muted/50, bg-gradient-subtle, a dark band) so pages have rhythm.
- Make it feel crafted: real imagery (a large hero photo or illustration with object-cover and rounded-2xl), subtle depth (shadow-soft cards with a border), hover and focus states on everything clickable (transition, hover:-translate-y-0.5, hover:shadow-glow, focus-visible rings), and tasteful entrance motion (animate-fade-up on hero content, framer-motion for staggered lists) that never gets in the way.
- Typography: two font families at most (font-display and font-sans), three or four sizes per screen, tracking-tight on large headings, leading-relaxed body text, sentence case.
- States: every list and page has a designed empty state, a loading state (Skeleton) and a friendly error state; forms have labels, helpful placeholders, inline validation and a success state.
- Responsive: mobile first. At 375 px wide everything stacks, buttons are easy to tap and nothing scrolls sideways; at 1280 px use multi-column grids and wider imagery.
- Avoid the generic AI look: no gradient text, aurora/mesh gradients or glowing blobs; no row of identical icon-in-a-tinted-square cards (show a small slice of the real product instead); no vague copy ("seamless", "revolutionize", "unlock", "all-in-one"); no invented customer logos, testimonials or user counts; no centred-everything pages or sections that all share one layout; no plain grey boxes, emoji icons, lorem ipsum or default blue buttons. Use specific names, places, times and amounts as clearly sample data, one confident brand colour and a different layout for each section.
- Make the kit yours: adapt the UI kit's components to this app's brand (shape, spacing, weight) rather than shipping them looking like everyone else's. Let typography carry character (a distinctive display font, confident sizes). Do not build text-only walls: break long text with imagery, icons, numbers or cards.
- Contrast: body text must be easily readable on its background (dark text on light, light on dark; never light grey on white or mid-grey on a photo without an overlay). Use one primary colour confidently; do not use pure black as the primary colour.
- Motion: a few coordinated entrance animations and hover feedback, not everything moving.`;

function designNote(design){
 if(!design||!design.palette)return'';
 const lines=['','','DESIGN BRIEF for this project (follow it in every change; the tokens in src/index.css already match it):'];
 lines.push('Style: '+(design.name||'Custom')+'. '+(design.summary||''));
 lines.push('Palette: '+Object.entries(design.palette).map(([k,v])=>k+' '+v).join(', ')+'. Fonts: '+(design.fonts?.display||'Inter')+' for headings (font-display), '+(design.fonts?.body||'Inter')+' for text (font-sans)'+(design.fonts?.mono?', '+design.fonts.mono+' for code (font-mono; it joins -> and => into one shape)':'')+'. Corner radius '+(design.radius||'0.75rem')+'.');
 if(design.layout)lines.push('Layout: '+design.layout);
 if(design.imagery)lines.push('Imagery: '+design.imagery);
 if(Array.isArray(design.details)&&design.details.length)lines.push('Details:\n'+design.details.map(d=>'- '+d).join('\n'));
 if(design.notes)lines.push('Owner notes: '+design.notes);
 if(design.idea)lines.push('The idea: '+design.idea);
 if(design.direction){const b=require('./design-directions').blueprint(design,{seed:design.created_at||''});if(b)lines.push(b)}
 if(design.style){const t=require('./design-styles').text(design.style);if(t)lines.push(t)}
 return lines.join('\n');
}

// ---------- the design brief ----------
const BRIEF_PROMPT=`You are the art director of an app builder like Lovable. Before any code is written, decide the visual direction for the app the user describes. Be specific and bold: pick a direction that suits the audience and brand (for example warm Mediterranean editorial for a boutique hotel, crisp dark technical for a developer tool, soft playful pastels for a kids' app), not a generic blue SaaS look.
Respond with ONLY a JSON object, no markdown:
{"name":"2-4 word style name","summary":"two or three sentences describing the look and feel","palette":{"background":"#hex","foreground":"#hex","primary":"#hex","secondary":"#hex","accent":"#hex","muted":"#hex"},"fonts":{"display":"heading font","body":"text font"},"radius":"0.75rem","layout":"one or two sentences: page structure, hero treatment, grid, navigation","imagery":"what photos or illustrations to use and how to frame them","details":["5 to 8 short, concrete design rules for this app (buttons, cards, sections, motion, icon style)"],"direction":"id of the dealt direction you chose, or empty","style":"id of a ready style system below, or empty","idea":"one sentence: what only this business has, carried by that direction","skill":"id of the best matching design skill below, or empty"}
Rules: background and foreground must have strong contrast; primary must stand out on the background; secondary is a quiet surface colour; muted is a subtle background tint; accent is a second highlight. radius is between 0rem and 1.5rem. Choose fonts only from this list: FONTS.`;
function briefPrompt(skills){
 const list=Object.keys(FONTS).filter(n=>FONTS[n][0]!=='mono').map(n=>n+' ('+FONTS[n][0]+')').join(', ');
 return BRIEF_PROMPT.replace('FONTS',list)+(skills&&skills.length?'\nDesign skills (pick at most one that fits, or ""):\n'+skills.map(s=>'- '+s.id+': '+s.description).join('\n'):'\nThere are no design skills to choose from; set "skill" to "".');
}
function cleanText(v,n){return String(v||'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,n)}
function parseBrief(content){
 let v=content;
 if(typeof v==='string'){const t=v.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');try{v=JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('Design brief was not JSON');v=JSON.parse(t.slice(a,b+1))}}
 if(!v||typeof v!=='object'||!v.palette||typeof v.palette!=='object')throw Error('Design brief needs a palette');
 return normalize(v);
}
// Keeps only known fields with valid values.
function normalize(v){
 const palette={};
 for(const k of ['background','foreground','primary','secondary','accent','muted','card','border'])if(hexToRgb(v.palette?.[k]))palette[k]=rgbToHex(hexToRgb(v.palette[k]));
 for(const k of ['background','foreground','primary'])if(!palette[k])throw Object.assign(Error('The palette needs a valid '+k+' colour (#rrggbb)'),{status:400});
 const font=n=>{const name=Object.keys(FONTS).find(f=>f.toLowerCase()===String(n||'').trim().toLowerCase());return name||'Inter'};
 const radius=/^(0|0?\.\d+|1(\.\d+)?)rem$/.test(String(v.radius||'').trim())?String(v.radius).trim():'0.75rem';
 return{name:cleanText(v.name,60)||'Custom',summary:cleanText(v.summary,600),palette,fonts:{display:font(v.fonts?.display),body:font(v.fonts?.body),...(FONTS[font(v.fonts?.mono)]&&FONTS[font(v.fonts?.mono)][0]==='mono'&&v.fonts?.mono?{mono:font(v.fonts.mono)}:{})},radius,
  layout:cleanText(v.layout,600),imagery:cleanText(v.imagery,400),details:(Array.isArray(v.details)?v.details:[]).map(d=>cleanText(d,200)).filter(Boolean).slice(0,10),
  notes:cleanText(v.notes,1500),...(v.direction&&require('./design-directions').validId(String(v.direction))?{direction:String(v.direction),...(/^[a-z-]{2,30}$/.test(String(v.sector||''))?{sector:String(v.sector)}:{})}:{}),...(cleanText(v.idea,300)?{idea:cleanText(v.idea,300)}:{}),...(v.style&&require('./design-styles').valid(String(v.style))?{style:String(v.style)}:{}),skill:/^[a-z0-9][a-z0-9-]{0,60}$/.test(String(v.skill||''))?String(v.skill):''};
}
// Three directions are dealt from the design library (design-directions.js); the brief picks one.
async function createBrief(request,{callModel,tier,signal,skills=[],projectName='',avoid=[]}){
 const directions=require('./design-directions'),dealt=directions.deal(projectName+' '+request,{seed:projectName,avoid});
 const styles=require('./design-styles'),styleOptions=styles.options(request),named=styles.named(request);
 const messages=[{role:'system',content:briefPrompt(skills)},{role:'user',content:'App name: '+projectName+'\nWhat the user wants:\n'+String(request).slice(0,4000)+require('./design-presets').note(projectName+' '+request)+directions.note(dealt)+styles.note(styleOptions)}];
 const brief=await callModel({messages,temperature:0.7,maxOutputTokens:1800,signal,tier,design:true},parseBrief);
 if(brief.skill&&!skills.some(s=>s.id===brief.skill))brief.skill='';
 // The direction must be one of those dealt; otherwise the first one is used.
 if(dealt.options.length){if(!dealt.options.some(o=>o.id===brief.direction))brief.direction=dealt.options[0].id;brief.sector=dealt.sector}
 // A style the owner named is always used; otherwise only one of those offered.
 if(named.length&&!named.some(s=>s.id===brief.style))brief.style=named[0].id;
 else if(brief.style&&!styleOptions.some(s=>s.id===brief.style))delete brief.style;
 return{...brief,created_at:new Date().toISOString()};
}

module.exports={kit,KIT_API,isKitFile,FONTS,fontUrl,tokens,tokensBlock,applyToCss,starterFiles,starterApp,isUntouchedStarter,addDesignSystem,hasTokens,THEME,RULES,designNote,briefPrompt,parseBrief,normalize,createBrief,hexToRgb,contrast};
