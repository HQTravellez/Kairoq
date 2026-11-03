"use strict";
// Motion on Home: the heading rises in word by word, project cards fade in one after another and
// lift on hover, the Build arrow nudges, and the prompt slides into the chat as the first message.
// All of it is off for people who ask for reduced motion.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"../public",f),"utf8");
const js=read("create.js"),css=read("ui/forma.css");
test("heading, cards and Build button move, and reduced motion turns it off",()=>{
 assert.match(js,/const CALM=window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches;/);
 assert.match(js,/function revealTitle\(\)\{\n const h=\$\('home-title'\);if\(!h\|\|CALM\)return;/);
 assert.match(js,/h\.setAttribute\('aria-label',words\.join\(' '\)\)/,"screen readers still hear the whole heading");
 assert.match(css,/#home-title \.hw\{[^}]*animation:fm-word/);
 assert.match(css,/\.projects\.cards>li\{animation:fm-card \.5s cubic-bezier\(\.2,\.8,\.2,1\) backwards;/,"backwards, so it never blocks the hover lift");
 assert.match(css,/\.projects\.cards>li:hover\{transform:translateY\(-4px\)/);
 assert.match(css,/#new-submit\.primary:hover svg\{transform:translateX\(3px\)\}/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{html body\.app #home #home-title \.hw,html body\.app #home \.projects\.cards>li\{animation:none!important;opacity:1!important\}/);
});
test("the prompt slides from Home into the chat",()=>{
 assert.match(js,/state\.fly=\{rect:\{left:r\.left,top:r\.top,width:r\.width,height:r\.height\},text:typed,at:Date\.now\(\)\}/);
 assert.match(js,/if\(!f\|\|!target\|\|CALM\|\|Date\.now\(\)-f\.at>15000\|\|!document\.body\.animate\)return;/);
 assert.match(js,/ let mine=messageItem\(\{role:'user',text:prompt\}\);list\.append\(mine\);\n flyIn\(mine\);/,"build requests");
 assert.match(js,/const sending=send\(typed,'discuss'\);flyIn\(\[\.\.\.document\.querySelectorAll\('#messages>li\.user'\)\]\.pop\(\)\);/,"greetings and questions");
 assert.match(css,/#messages\.fly-wait>li\.user:not\(:has\(~ li\.user\)\)\{visibility:hidden\}/,"no double message if the chat redraws mid-flight");
});
