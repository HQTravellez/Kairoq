"use strict";
// The font library (font-library.js): a small set of the best free fonts, OFL-licensed, bundled
// into each build; reference-site fonts matched to the closest free one.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-fonts-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const lib=require('../font-library'),design=require('../react-design'),builder=require('../react-builder'),moods=require('../design-moods');
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
const root=path.join(__dirname,'..');

test('every library font is installed, OFL-licensed, and its CSS family name is the one Kairoq uses',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 assert.ok(Object.keys(lib.LIBRARY).length>=30&&Object.keys(lib.LIBRARY).length<=45,'a small, curated set');
 for(const [name,f] of Object.entries(lib.LIBRARY)){
  assert.ok(pkg.dependencies[f.pkg],name+' is a dependency');
  const meta=JSON.parse(fs.readFileSync(path.join(root,'node_modules',f.pkg,'package.json'),'utf8'));
  assert.equal(meta.license,'OFL-1.1',name+' licence');
  assert.ok(fs.readdirSync(path.join(root,'node_modules',f.pkg)).some(x=>/^LICEN[CS]E/i.test(x)),name+' ships its licence');
  const css=fs.readFileSync(path.join(root,'node_modules',f.pkg,'index.css'),'utf8');
  assert.ok(css.includes("font-family: '"+f.family+"'"),name+' is called '+f.family+' in its CSS');
 }
 for(const [d,b] of lib.PAIRINGS){assert.ok(lib.has(d)&&lib.has(b),d+' + '+b)}
 for(const m of moods.MOODS)for(const f of m.display)assert.ok(lib.has(f),'mood '+m.id+' uses library font '+f);
 assert.match(fs.readFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),'utf8'),/## Font library[\s\S]*SIL Open Font License 1\.1/);
});

test('fonts from a reference site: library fonts kept, paid ones matched to the closest free one',()=>{
 for(const [from,to] of [['Söhne','Geist'],['Canela','Gloock'],['GT America','Hanken Grotesk'],['SF Pro Display','Inter Tight'],['Helvetica Neue','Inter Tight'],['Satoshi','Instrument Sans'],['Tiempos Headline','Newsreader'],['Fraunces','Fraunces'],['Inter Variable','Inter'],['Berkeley Mono','JetBrains Mono']])assert.equal(lib.closest(from),to,from);
 assert.equal(lib.closest('A font nobody knows','serif'),'Newsreader');assert.equal(lib.closest('','sans'),'Inter');
});

test('new design briefs use only library fonts; the art director sees the library and its pairings',async()=>{
 let prompt='';
 const b=await design.createBrief('A website for a Toronto law firm',{projectName:'Hale Law',callModel:async(o,parse)=>{prompt=o.messages[0].content;return parse(JSON.stringify({name:'x',summary:'y',palette:{background:'#ffffff',foreground:'#141414',primary:'#7a1426',secondary:'#f4f1ee',accent:'#b08d57',muted:'#f6f4f2'},fonts:{display:'Playfair Display',body:'Lato'},radius:'0.5rem'}))}});
 assert.ok(lib.has(b.fonts.display)&&lib.has(b.fonts.body),JSON.stringify(b.fonts));
 assert.equal(b.fonts.display,'Gloock','Playfair Display becomes its library match');
 assert.match(prompt,/Fonts: use only these[\s\S]*Libre Caslon Text \+ Public Sans \(law, accounting, finance\)/);
 assert.doesNotMatch(prompt,/Lato \(sans\)|Poppins/);
});

test('a site with library fonts bundles them into the build: no request to Google',{timeout:180000},async()=>{
 const css=design.applyToCss('',{palette:{background:'#ffffff',foreground:'#111111',primary:'#123456',secondary:'#eeeeee',accent:'#ff0000',muted:'#fafafa'},fonts:{display:'Fraunces',body:'Instrument Sans'}});
 assert.match(css,/^\/\* Fonts: SIL Open Font License 1\.1[^\n]*\n@import '@fontsource-variable\/fraunces';[^\n]*\n@import '@fontsource-variable\/instrument-sans';/);
 assert.match(design.tokens({palette:{background:'#fff',foreground:'#111',primary:'#123',secondary:'#eee',accent:'#f00',muted:'#fafafa'},fonts:{display:'Fraunces',body:'Instrument Sans'}})['--font-display'],/^'Fraunces Variable', 'Fraunces'/);
 // Older projects with other fonts still load them as before.
 assert.match(design.applyToCss('',{palette:{background:'#fff',foreground:'#111',primary:'#123',secondary:'#eee',accent:'#f00',muted:'#fafafa'},fonts:{display:'Lora',body:'Lato'}}),/fonts\.googleapis\.com/);
 const meta=builder.create({name:'Fonts',owner:'owner'});await builder.initialize(meta);
 const files=builder.loadFiles(meta.id,1);files['src/index.css']=design.applyToCss(files['src/index.css'],{palette:{background:'#ffffff',foreground:'#111111',primary:'#123456',secondary:'#eeeeee',accent:'#ff0000',muted:'#fafafa'},fonts:{display:'Fraunces',body:'Instrument Sans'}});
 await builder.saveSource(meta.id,files,{summary:'fonts'});
 const m=builder.loadMeta(meta.id),dist=path.join(builder.projectDir(meta.id),'versions',String(m.current_version),'dist');
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 const all=walk(dist),built=all.filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(f,'utf8')).join('');
 assert.ok(all.some(f=>f.endsWith('.woff2')),'font files are in the build');
 assert.match(built,/font-family:\s*"?Fraunces Variable/);assert.doesNotMatch(built,/googleapis/);
 // Any other package import in CSS is still refused.
 files['src/index.css']="@import 'some-package/x.css';\n"+files['src/index.css'];
 await assert.rejects(builder.saveSource(meta.id,files,{summary:'bad'}),/must be an https URL, a project CSS file or a font from the font library/);
});
