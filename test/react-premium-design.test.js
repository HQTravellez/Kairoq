"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-travellez-demo-"));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(root,"projects");
const demo=require("../react-demo-travellez"),builder=require("../react-builder"),skills=require("../react-skills");
test("premium design skill is enabled by default and available to the generator",()=>{
 const found=skills.builtin().find(x=>x.id==="chakra-ui");
 assert.ok(found,"Chakra UI design guidance should be registered");
 assert.equal(found.defaultOn,true);
 assert.match(skills.promptNote({owner:"test-owner"}),/Premium UI with Chakra design principles/);
});
test("Travellez dashboard has valid React source, reusable design tokens and no unapproved imports",()=>{
 const files=demo.files();
 assert.equal(builder.validateFiles(files).length,0,builder.validateFiles(files).join("\n"));
 assert.match(files["src/App.jsx"],/Recent travel requests/);
 assert.match(files["src/App.jsx"],/aria-label="Filter status"/);
 assert.match(files["src/App.jsx"],/setRows/);
 assert.match(files["src/App.jsx"],/Export report/);
 assert.match(files["src/index.css"],/kairoq:tokens/);
});
test("Travellez demo compiles with Kairoq's actual Vite build pipeline",async()=>{
 const files=demo.files(),dest=path.join(root,"dist");
 await builder.runBuild(files,dest);
 assert.ok(fs.existsSync(path.join(dest,"index.html")));
 const assets=path.join(dest,"assets");
 assert.ok(fs.readdirSync(assets).some(x=>x.endsWith(".js")));
});
