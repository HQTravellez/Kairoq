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
 assert.match(b,/structureTries<1&&attempt<MAX_ATTEMPTS&&process\.env\.KAIROQ_STRUCTURE_GATE!=='off'/);
});

test('the Code tab shows a folder tree with the app files first and the UI kit folded',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'../public/create.html'),'utf8');
 assert.match(js,/function renderTree\(list,paths\)/);
 assert.match(js,/if\(d!=='src\/components\/ui'\)state\.openDirs\.add\(d\)/);
 assert.match(js,/SRC_ORDER=\['pages','components','hooks','lib','data'/);
 assert.match(html,/id="file-tidy"[^>]*>Tidy up the code</);
});

test('code is formatted and readable: Prettier, a top comment, short functions, clear names, no debug leftovers',async()=>{
 const F=require('../code-format');
 const out=await F.format({'src/pages/A.jsx':"export default function A(){return <div className='p-4'><b>Hi</b></div>}",'src/components/ui/button.jsx':'const a  =  1','src/bad.jsx':'export default ('});
 assert.match(out['src/pages/A.jsx'],/^export default function A\(\) \{\n  return \(/);
 assert.equal(out['src/components/ui/button.jsx'],'const a  =  1','the UI kit keeps its own style');
 assert.equal(out['src/bad.jsx'],'export default (','unreadable code is left for the build to report');
 const bad="import x from 'y';\nconst data2 = 1;\nfunction calc(){\n"+lines(70)+"\n}\nconsole.log(data2)\n// const old = 2;\nexport default function A(){return null}";
 const p=C.readability({'src/components/x/A.jsx':bad});
 for(const re of [/first-line comment/,/calc\(\) is 72 lines/,/unclear names \(data2\)/,/console\.log/,/commented-out code/])assert.ok(p.some(x=>re.test(x)),String(re));
 assert.equal(C.needsRework(p),true);
 assert.equal(C.needsRework(['src/a.jsx has no first-line comment saying what the file is for.']),false,'small things alone do not cost a round trip');
 assert.deepEqual(C.readability({'src/pages/P.jsx':bad+'\n'},['src/pages/P.jsx'],{'src/pages/P.jsx':bad}),[],'old problems in an old file are not blocked');
 const good="// Booking form: lets a guest pick a time.\nexport default function BookingForm() {\n  const [isSaving, setIsSaving] = useState(false);\n  return <form />;\n}\n";
 assert.deepEqual(C.readability({'src/components/booking/BookingForm.jsx':good}),[]);
 const b=fs.readFileSync(path.join(__dirname,'../react-builder.js'),'utf8');
 assert.match(b,/require\('\.\/code-format'\)\.format\(next/);
 assert.match(b,/structureTries<1&&attempt<MAX_ATTEMPTS/,'never on the last try');
 assert.ok(require('../react-builder').SYSTEM_PROMPT.includes('Every file starts with a one-line comment'));
});
