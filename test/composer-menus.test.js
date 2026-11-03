"use strict";
// The message box, like Lovable: next-step pills above the box, a short + menu with search and
// icons, each menu opening at its own button, no spinning connector badge and no keyboard hint.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"../public",f),"utf8");
test("the + menu is one short list with a search box and icons",()=>{
 const html=read("create.html"),panel=html.slice(html.indexOf('class="menu-panel plus-panel"'),html.indexOf('</details>',html.indexOf('class="menu-panel plus-panel"')));
 assert.match(panel,/id="plus-search"/);
 for(const label of ["Attach files","Connectors","Figma","Reference site","Polish the design","Voice transcript","Voice studio"])assert.match(panel,new RegExp("<b>"+label+"</b>"));
 assert.doesNotMatch(panel,/menu-note/,"no section headings");
 assert.match(panel,/id="builder-model-open" hidden/,"Model has its own button, so it is not in this menu");
 assert.match(html,/id="composer-connect" hidden/,"the spinning connector badge is gone");
 assert.doesNotMatch(html,/How Kairoq should work on your next message/);
 const js=read("create.js");
 assert.match(js,/\$\('plus-connectors'\)\.onclick=\(\)=>\{\$\('menu-plus'\)\.open=false;openManage\('connectors'\)\}/);
 assert.match(js,/\$\('plus-search'\)\.oninput=/);
});
test("each menu opens at its own button, and the box has no keyboard hint",()=>{
 const css=read("ui/forma.css");
 assert.match(css,/#chat-form \.composer-bar>\.menu\.up\{position:relative!important\}/);
 assert.match(css,/#chat-form \.composer-bar>#menu-mode>\.menu-panel\{left:auto!important;right:0!important/);
 assert.match(css,/#chat-form \.composer-bar>#menu-tier>\.menu-panel\{left:auto!important;right:0!important/);
 assert.match(css,/#chat-form\.composer::after\{content:none!important/);
});
