'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const fn=name=>{const m=source.match(new RegExp('function '+name+'\\(s\\)\\{[\\s\\S]*?\\n\\}'));assert.ok(m,name+' is defined in public/app.js');return m[0]};

// The Studio lists call escapeHtml; without a definition every list with data throws instead of rendering.
test('escapeHtml is defined wherever app.js calls it, and escapes markup', () => {
 assert.match(source,/\bescapeHtml\(/);
 const ctx={};
 vm.runInNewContext(fn('escapeHTML')+'\n'+fn('escapeHtml')+'\nthis.escapeHtml=escapeHtml;',ctx);
 assert.equal(ctx.escapeHtml('<img src=x onerror="a">'),'&lt;img src=x onerror=&quot;a&quot;&gt;');
 assert.equal(ctx.escapeHtml("Tom & Jerry's"),'Tom &amp; Jerry&#039;s');
 assert.equal(ctx.escapeHtml(undefined),'');
 assert.equal(ctx.escapeHtml(null),'');
 assert.equal(ctx.escapeHtml(0),'0');
});
