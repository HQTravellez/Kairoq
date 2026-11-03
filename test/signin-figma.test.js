"use strict";
// The sign-in screen is the Figma one (forma.css, dialog.fm-auth): full screen, the story on the
// left and the form on the right. The older card styles in screens.css used stronger selectors
// and squeezed it to 420px, so they only apply to a dialog without .fm-auth. The rules that decide
// which form shows (reset password hides the sign-in form; no "Forgot password?" on Create account)
// still apply to every design.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"../public",f),"utf8");
test("the old sign-in card's look never applies to the Figma sign-in",()=>{
 const css=read("ui/screens.css"),html=read("create.html");
 assert.match(html,/<dialog class="auth-dialog fm-auth" id="auth-dialog"/);
 const look=css.split("\n").filter(l=>/#auth #auth-dialog/.test(l)&&/(width|padding|background|font|margin|grid|position)\s*:/.test(l)&&!/:has\(/.test(l)&&!/:empty/.test(l));
 for(const l of look)assert.match(l,/#auth-dialog:not\(\.fm-auth\)/,"scoped to the old card: "+l.slice(0,90));
 assert.match(read("ui/forma.css"),/html body dialog\.fm-auth\[open\]\{[^}]*width:100vw!important/);
});
test("which form shows still works in the Figma sign-in",()=>{
 const css=read("ui/screens.css");
 assert.match(css,/body:not\(\.app\) #auth #auth-dialog:has\(#forgot-form:not\(\.hidden\)\) #auth-form/);
 assert.match(css,/body:not\(\.app\) #auth #auth-dialog:has\(#tab-signup\[aria-selected=true\]\) #forgot-open\{display:none!important\}/);
});
