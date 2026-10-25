'use strict';
// Generated apps are organised like a team project, and the Code tab shows a folder tree.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../code-structure');
const lines=n=>Array.from({length:n},(_,i)=>'// '+i).join('\n');

test('the builder is told the project layout and the size rules',()=>{
 const B=require('../react-builder');
 for(const s of ['src/pages/<Name>Page.jsx','src/components/<feature>/<Name>.jsx','src/hooks/use<Thing>.js','src/data/','One component per file','a page under 200 lines'])assert.ok(B.SYSTEM_PROMPT.includes(s),s);
});

test('a change that adds a long page, a loose file, many components or inline data goes back once',()=>{
 assert.match(C.check({'src/pages/HomePage.jsx':lines(260)},['src/pages/HomePage.jsx']).join(),/under 200/);
 assert.match(C.check({'src/Gallery.jsx':'export default function Gallery(){}'},['src/Gallery.jsx']).join(),/move it to src\/pages/);
 assert.match(C.check({'src/components/x/A.jsx':'export default function A(){}\nfunction B(){}\nfunction C(){}\nconst D=()=>null\n'},['src/components/x/A.jsx']).join(),/one component per file/);
 assert.match(C.check({'src/pages/P.jsx':'const SERVICES = [\n'+lines(45)+'\n];'},['src/pages/P.jsx']).join(),/src\/data/);
 assert.deepEqual(C.check({'src/components/ui/button.jsx':lines(400)},['src/components/ui/button.jsx']),[],'the UI kit is left alone');
});

test('a small fix in an old long file is not blocked (Tidy up the code handles old projects)',()=>{
 const old=lines(400);
 assert.deepEqual(C.check({'src/pages/HomePage.jsx':old+'\n// fix'},['src/pages/HomePage.jsx'],{'src/pages/HomePage.jsx':old}),[]);
 assert.ok(C.isTidy('Tidy up the code'));
 assert.match(C.TIDY,/without changing what the app does/);
 const api=fs.readFileSync(path.join(__dirname,'../create-api.js'),'utf8'),b=fs.readFileSync(path.join(__dirname,'../react-builder.js'),'utf8');
 assert.match(api,/isTidy\(message\)\)\{shownText='Tidy up the code';message=require\('\.\/code-structure'\)\.TIDY\}/);
 assert.match(b,/structureTries<1&&process\.env\.KAIROQ_STRUCTURE_GATE!=='off'/);
});

test('the Code tab shows a folder tree with the app files first and the UI kit folded',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'../public/create.html'),'utf8');
 assert.match(js,/function renderTree\(list,paths\)/);
 assert.match(js,/if\(d!=='src\/components\/ui'\)state\.openDirs\.add\(d\)/);
 assert.match(js,/SRC_ORDER=\['pages','components','hooks','lib','data'/);
 assert.match(html,/id="file-tidy"[^>]*>Tidy up the code</);
});
