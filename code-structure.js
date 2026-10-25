'use strict';
// How the code of a generated app is organised, so any developer can find their way and a
// one-line change means opening one small file. The builder is told these rules (RULES), and
// every change is checked against them (check): files it breaks go back to the builder once.

const RULES=`Code structure (write it the way a senior engineer sets up a project for a team):
- src/App.jsx only wires the app together: providers, the layout and the routes. No page content, data or business logic in it.
- src/pages/<Name>Page.jsx: one file per page or screen (HomePage.jsx, BookingPage.jsx). A page puts sections and components together; it does not hold long lists of data.
- src/components/<feature>/<Name>.jsx: the pieces of one feature together (components/booking/BookingForm.jsx, components/booking/TimeSlots.jsx). Shared layout pieces go in components/layout/ (Header.jsx, Footer.jsx). One component per file, the file named after it.
- src/components/ui/: the shared UI kit (buttons, inputs, dialogs). Reuse it; change it only for a kit-wide fix.
- src/hooks/use<Thing>.js: loading and saving data (useBookings.js wraps collection('bookings')), so pages never repeat backend calls.
- src/lib/: helpers and backend access (lib/format.js, lib/api.js). src/data/: copy, menus, prices, FAQs, sample records and constants.
- functions/ and sql/ hold the backend; src/backend.json declares collections.
- Page addresses: in App.jsx, import { Router } from 'kairoq' and wrap <Routes> in <Router> (real addresses like /services that search engines list; never HashRouter or BrowserRouter). Link with <Link to="/services">, never href="#/services". Every page calls usePageMeta({ title: "Prices – Joe's Barbers", description: "One sentence about this page." }) from 'kairoq'.
- Size: a page under 200 lines, a component under 250, App.jsx under 120. When a file grows past that, split it into smaller components in the same feature folder.
- Names say what things are (BookingForm, useBookings, formatPrice), never Component1, utils2 or temp. Imports use relative paths, in the order: packages, then app files.
- A small change touches only the files it needs, with "edits" where possible.

Readable code (a teammate should understand any file in a minute):
- Every file starts with a one-line comment saying what it is for (// Booking form: lets a guest pick a service, a day and a time.).
- Each function does one job and stays short (under about 60 lines; a component's render can be longer). Name things by what they mean: handleBookingSubmit, availableSlots, isLoading, formatPrice. Never data2, temp, foo, obj, arr, handleClick2.
- Inside a component, keep the same order: state, then data loading, then derived values, then event handlers, then the JSX.
- Simple, flat logic: early returns instead of deep nesting, no clever one-liners, no nested ternaries. Name numbers and strings that mean something (const MAX_GUESTS = 8).
- Comments explain why something is done, not what the code plainly says. No leftover console.log, debugger or commented-out code.
- The code is formatted automatically (Prettier, 2 spaces, single quotes), so do not hand-align anything.`;

// The request behind "Tidy up the code": reorganise without changing what the app does.
const TIDY=`Tidy up the code: reorganise this project into the code structure below without changing what the app does or how it looks. Move page content out of App.jsx into src/pages/, split long files into components grouped by feature under src/components/<feature>/, move data loading into hooks in src/hooks/, move copy, menus, prices and sample data into src/data/, and switch HashRouter or BrowserRouter to <Router> from 'kairoq' and "#/page" links to <Link to="/page">, give every page usePageMeta with its own title and description, rename unclear files and names, add a one-line comment at the top of each file saying what it is for, split long functions, and remove console.log lines and commented-out code. Update every import. Do not change copy, styles, routes, collections, backend functions or behaviour. In "message", list what moved where in a few short lines.\n\n`+RULES;

const LIMITS=[[/^src\/App\.jsx$/,120,'App.jsx should only wire the app (layout and routes)'],[/^src\/pages\//,200,'a page'],[/^src\/components\/(?!ui\/)/,250,'a component'],[/^src\/(hooks|lib)\//,250,'a helper']];
function lines(s){return String(s||'').split('\n').length}
// Components defined at the top level of a file: function Name( or const Name = (...) =>.
function components(src){
 const out=new Set();
 for(const m of String(src).matchAll(/^(?:export\s+(?:default\s+)?)?function\s+([A-Z]\w*)\s*\(/gm))out.add(m[1]);
 for(const m of String(src).matchAll(/^(?:export\s+)?const\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/gm))out.add(m[1]);
 return[...out];
}
// The longest array literal written inline (lines): big data belongs in src/data/.
function longestArray(src){
 let best=0;const L=String(src).split('\n');
 for(let i=0;i<L.length;i++){
  if(!/=\s*\[\s*$/.test(L[i]))continue;
  let depth=0,j=i;
  for(;j<L.length;j++){for(const c of L[j]){if(c==='[')depth++;else if(c===']')depth--}if(depth<=0)break}
  best=Math.max(best,j-i+1);
 }
 return best;
}
// Problems this change brings in: new files, or files it pushed past a limit. An existing long file
// that a small fix touches is not flagged (a one-line fix stays a one-line fix; "Tidy up the code"
// is how an old project gets reorganised).
function check(files,changed=Object.keys(files||{}),base={}){
 const problems=[];
 for(const f of changed){
  const src=files[f];if(typeof src!=='string'||!/\.(jsx?|tsx?)$/.test(f)||f.startsWith('src/components/ui/'))continue;
  const n=lines(src),lim=LIMITS.find(([re])=>re.test(f));
  const was=typeof base[f]==='string'?base[f]:null;
  if(lim&&n>lim[1]&&(was===null||lines(was)<=lim[1]))problems.push(f+' has '+n+' lines; '+lim[2]+' should stay under '+lim[1]+'. Split it into smaller files.');
  if(/\b(HashRouter|BrowserRouter)\b/.test(src)&&(was===null||!/\b(HashRouter|BrowserRouter)\b/.test(was)))problems.push(f+' uses '+(/HashRouter/.test(src)?'HashRouter':'BrowserRouter')+'; wrap the routes in <Router> from \'kairoq\' so every page has a real address search engines can list.');
  if(was===null&&/^src\/[^/]+\.jsx$/.test(f)&&!/^src\/(App|main)\.jsx$/.test(f))problems.push(f+' sits at the top of src/; move it to src/pages/ or src/components/<feature>/.');
  if(/^src\/(pages|components)\//.test(f)){const c=components(src);if(c.length>3&&(was===null||components(was).length<=3))problems.push(f+' defines '+c.length+' components ('+c.slice(0,6).join(', ')+'); keep one component per file (small private helpers are fine).')}
  if(!f.startsWith('src/data/')&&/\.jsx$/.test(f)){const a=longestArray(src);if(a>40&&(was===null||longestArray(was)<=40))problems.push(f+' holds a '+a+'-line list of data; move it to src/data/ and import it.')}
 }
 return problems;
}
// Readability problems this change brings in (only new or newly added issues count).
const VAGUE=/\b(?:const|let|var|function)\s+(data\d+|temp\d*|tmp\d*|foo|bar|baz|stuff|thing\d*|obj\d*|arr\d*|val\d+|handleClick\d+|Component\d+|myFunction\d*)\b/g;
const DEBUG=/^\s*(console\.log\(|debugger;)/m;
const COMMENTED_CODE=/^\s*\/\/\s*(?:const|let|var|return|import|export|if\s*\(|for\s*\(|function\b|await\b|<[A-Za-z])/m;
function headerComment(src){const first=String(src).split('\n').find(l=>l.trim());return Boolean(first)&&/^\s*(\/\/|\/\*)/.test(first)}
// Functions with a lowercase name (helpers and handlers) and how many lines each body has.
function longFunctions(src,max=60){
 const L=String(src).split('\n'),out=[];
 for(let i=0;i<L.length;i++){
  const m=/^\s*(?:export\s+)?(?:async\s+)?(?:function\s+([a-z]\w*)\s*\(|const\s+([a-z]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>\s*\{)/.exec(L[i]);
  if(!m)continue;
  let depth=0,started=false,j=i;
  for(;j<L.length;j++){for(const c of L[j]){if(c==='{'){depth++;started=true}else if(c==='}')depth--}if(started&&depth<=0)break}
  if(j-i+1>max)out.push([m[1]||m[2],j-i+1]);
 }
 return out;
}
function readability(files,changed=Object.keys(files||{}),base={}){
 const problems=[];
 for(const f of changed){
  const src=files[f];if(typeof src!=='string'||!/^(src|functions)\/.*\.(jsx?|mjs)$/.test(f)||f.startsWith('src/components/ui/')||f==='src/main.jsx')continue;
  const was=typeof base[f]==='string'?base[f]:null,isNew=was===null;
  if(isNew&&!headerComment(src))problems.push(f+' has no first-line comment saying what the file is for.');
  const longOld=new Set(isNew?[]:longFunctions(was).map(x=>x[0]));
  for(const [name,n] of longFunctions(src))if(!longOld.has(name))problems.push(f+': '+name+'() is '+n+' lines; split it into smaller, well-named functions.');
  const vague=[...new Set([...src.matchAll(VAGUE)].map(m=>m[1]))].filter(v=>isNew||!new RegExp('\\b'+v+'\\b').test(was));
  if(vague.length)problems.push(f+' uses unclear names ('+vague.slice(0,5).join(', ')+'); name them by what they hold or do.');
  if(DEBUG.test(src)&&(isNew||!DEBUG.test(was)))problems.push(f+' has leftover console.log or debugger lines; remove them.');
  if(COMMENTED_CODE.test(src)&&(isNew||!COMMENTED_CODE.test(was)))problems.push(f+' has commented-out code; delete it (the version history keeps old code).');
 }
 return problems;
}
// Small things (a missing top comment, a stray console.log) do not cost a round trip on their own:
// they go back only together with a real problem, so builds stay fast.
function isMinor(problem){return/no first-line comment|console\.log or debugger|commented-out code/.test(problem)}
function needsRework(problems){return problems.some(p=>!isMinor(p))}
// What goes back to the builder when a change breaks the rules.
function fixMessage(problems){return'The change works, but its code is not as clear and organised as this project needs (nothing was applied yet):\n'+problems.slice(0,12).map(p=>'- '+p).join('\n')+'\nReturn the same change again, following the code structure and readable code rules. Keep behaviour, copy and styles exactly the same.'}
function isTidy(message){return/^\s*tidy up the code\.?\s*$/i.test(String(message||''))}
module.exports={RULES,TIDY,check,readability,isMinor,needsRework,fixMessage,isTidy,components,longestArray,longFunctions,headerComment};
