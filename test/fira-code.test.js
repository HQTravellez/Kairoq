"use strict";
// Fira Code (github.com/tonsky/FiraCode, SIL OFL 1.1): a code font for apps and Kairoq's code views.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const D=require('../react-design');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const base={palette:{background:'#ffffff',foreground:'#111111',primary:'#2255ff'},fonts:{display:'Inter',body:'Inter'}};

test('an app can pick a code font; it is loaded, tokenised and used by font-mono',()=>{
 assert.deepEqual(D.FONTS['Fira Code'],['mono','400;500;600;700']);
 const d=D.normalize({...base,fonts:{...base.fonts,mono:'fira code'}});
 assert.equal(d.fonts.mono,'Fira Code');
 assert.equal(D.tokens(d)['--font-mono'],"'Fira Code', ui-monospace, monospace");
 assert.match(D.THEME.extend.fontFamily.mono[0],/^var\(--font-mono, ui-monospace/);
 assert.match(D.designNote(d),/Fira Code for code \(font-mono/);
 // No code font picked: nothing extra is downloaded, and a text font cannot be the code font.
 assert.equal(D.normalize(base).fonts.mono,undefined);
 assert.equal(D.normalize({...base,fonts:{...base.fonts,mono:'Lora'}}).fonts.mono,undefined);
 assert.equal(D.tokens(D.normalize(base))['--font-mono'],undefined);
});

test('the Design dialog offers a code font and Kairoq shows code in Fira Code with joined symbols',()=>{
 assert.match(read('public/create.html'),/id="design-mono"/);
 assert.match(read('public/create.html'),/family=Fira\+Code/);
 assert.match(read('public/create.js'),/mono:\$\('design-mono'\)\.value/);
 assert.match(read('public/create.css'),/#ref-plan\{font-family:"Fira Code"[^}]*font-variant-ligatures:contextual/);
});
