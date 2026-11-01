"use strict";
// Hallmark in Kairoq (hallmark.js): the 50 themes as looks with real colours and known fonts,
// the theme's own words in the design brief, the floor in the builder's rules, and real
// photos with credits for a request.
const test=require('node:test'),assert=require('node:assert');
const hallmark=require('../hallmark'),looks=require('../looks'),{FONTS}=require('../react-design');

test('50 themes parse into looks the builder can use',()=>{
 const t=hallmark.themes();
 assert.equal(t.length,50);
 const L=hallmark.looks();
 assert.equal(new Set(L.map(l=>l.id)).size,50);
 for(const l of L){
  assert.ok(l.id.startsWith('hallmark-'));
  assert.ok(FONTS[l.head]&&FONTS[l.body],l.id+' uses known fonts ('+l.head+', '+l.body+')');
  for(const k of ['bg','surface','ink','muted','accent','accentInk'])assert.match(l.colors[k],/^#[0-9a-f]{6}$/,l.id+' '+k);
  assert.ok(looks.contrast(l.colors.ink,l.colors.bg)>=4.5,l.id+' text reads on its paper');
  assert.ok(looks.FEELS.some(f=>f[0]===l.feel),l.id+' has a feel');
  assert.ok(l.material.length>20,l.id+' says what it is made of');
 }
 assert.equal(looks.all().length,150);
 assert.equal(new Set(looks.all().map(l=>l.id)).size,150);
});

test('OKLCH tokens become hex',()=>{
 assert.equal(hallmark.parseColor('oklch(84% 0.012 245)'),'#c4cbd2');
 assert.equal(hallmark.parseColor('oklch(16% 0.020 245)'),'#060e15');
 assert.equal(hallmark.parseColor('#ABCDEF'),'#abcdef');
 assert.equal(hallmark.parseColor('red'),null);
});

test('a picked theme puts its material, type, surfaces and do-nots in the design brief',()=>{
 const look=hallmark.looks().find(l=>l.id==='hallmark-almanac');
 const d=looks.toDesign(look,{request:'A field guide site',projectName:'Guide'});
 assert.equal(d.look_id,'hallmark-almanac');
 assert.equal(d.fonts.display,'Hanken Grotesk');assert.equal(d.fonts.body,'Newsreader');
 const text=d.details.join('\n');
 assert.match(text,/Hallmark theme "Almanac": cool slate stock/);
 assert.match(text,/Type:/);assert.match(text,/Surfaces:/);assert.match(text,/Do-nots:/);
 assert.match(text,/Photographs take the theme's treatment: muted/);
 assert.ok(!text.includes('var(--font'),'no raw tokens in the brief');
 assert.deepEqual(hallmark.briefFor('cool-white-slate--hanken-grotesk'),[],'a Kairoq look adds nothing');
});

test('themes are matched to a request by their keywords',()=>{
 const m=hallmark.match('A field guide and reference handbook with tables of data');
 assert.ok(m.includes('hallmark-almanac'),m.join());
 assert.deepEqual(hallmark.match('zzz nothing here'),[]);
 // Kind-of-thing words count little: "a mobile app for a running club" is Sport, not the
 // pharmacy theme tagged "app, mobile"; "a mobile app" alone suggests nothing.
 assert.equal(hallmark.match('Build a mobile app: A phone app for a running club: members see this week\'s group runs')[0],'hallmark-sport');
 assert.deepEqual(hallmark.match('A mobile app'),[]);
 assert.deepEqual(hallmark.match('A medication reminder app for my mum'),['hallmark-dose']);
});

test('the builder rules carry the Hallmark floor',()=>{
 const R=require('../react-design').RULES;
 assert.match(R,/Hallmark floor/);assert.match(R,/never transition: all/);assert.match(R,/overflow-x: clip/);assert.match(R,/minmax\(0,1fr\)/);
});

test('real photos with credits for a request, none for nonsense',()=>{
 const list=hallmark.findPhotos('a bakery with fresh bread and coffee',{n:4});
 assert.ok(list.length>=1&&list.length<=4);
 for(const p of list){assert.match(p.file,/^https:\/\/upload\.wikimedia\.org\//);assert.ok(p.license&&p.author!==undefined)}
 const note=hallmark.photoNote('a bakery with fresh bread and coffee',{n:4});
 assert.match(note,/REAL PHOTOS you may use/);assert.match(note,/Credit: /);
 assert.equal(hallmark.photoNote('qwxyz'),'');
 assert.equal(hallmark.photos().length,755);
});
