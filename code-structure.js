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
- Size: a page under 200 lines, a component under 250, App.jsx under 120. When a file grows past that, split it into smaller components in the same feature folder.
- Names say what things are (BookingForm, useBookings, formatPrice), never Component1, utils2 or temp. Imports use relative paths, in the order: packages, then app files.
- A small change touches only the files it needs, with "edits" where possible.`;

// The request behind "Tidy up the code": reorganise without changing what the app does.
const TIDY=`Tidy up the code: reorganise this project into the code structure below without changing what the app does or how it looks. Move page content out of App.jsx into src/pages/, split long files into components grouped by feature under src/components/<feature>/, move data loading into hooks in src/hooks/, move copy, menus, prices and sample data into src/data/, and rename unclear files. Update every import. Do not change copy, styles, routes, collections, backend functions or behaviour. In "message", list what moved where in a few short lines.\n\n`+RULES;

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
  if(was===null&&/^src\/[^/]+\.jsx$/.test(f)&&!/^src\/(App|main)\.jsx$/.test(f))problems.push(f+' sits at the top of src/; move it to src/pages/ or src/components/<feature>/.');
  if(/^src\/(pages|components)\//.test(f)){const c=components(src);if(c.length>3&&(was===null||components(was).length<=3))problems.push(f+' defines '+c.length+' components ('+c.slice(0,6).join(', ')+'); keep one component per file (small private helpers are fine).')}
  if(!f.startsWith('src/data/')&&/\.jsx$/.test(f)){const a=longestArray(src);if(a>40&&(was===null||longestArray(was)<=40))problems.push(f+' holds a '+a+'-line list of data; move it to src/data/ and import it.')}
 }
 return problems;
}
// What goes back to the builder when a change breaks the rules.
function fixMessage(problems){return'The change works, but its code is not organised the way this project needs (nothing was applied yet):\n'+problems.slice(0,10).map(p=>'- '+p).join('\n')+'\nReturn the same change again, split into well-named files that follow the code structure rules. Keep behaviour, copy and styles exactly the same.'}
function isTidy(message){return/^\s*tidy up the code\.?\s*$/i.test(String(message||''))}
module.exports={RULES,TIDY,check,fixMessage,isTidy,components,longestArray};
