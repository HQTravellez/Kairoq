'use strict';
// create.html loads create.js and each stylesheet once, and the agent's instructions have one
// finish tool and one way of working. Merging PRs in GitHub's web editor kept both sides of these
// lines: the editor ran five times and the agent was told both "one write_files" and "3 files a step".
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('each script and stylesheet is loaded once',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','public','create.html'),'utf8');
 const tags=[...html.matchAll(/<(?:script[^>]*src|link[^>]*href)="([^"?]+)/g)].map(m=>m[1]);
 const dup=tags.filter((t,i)=>tags.indexOf(t)!==i);
 assert.deepEqual(dup,[],'loaded more than once: '+dup.join(', '));
 assert.doesNotMatch(html,/^(<<<<<<<|=======|>>>>>>>)/m,'no merge markers');
});
test('the agent gets one finish tool and one way of working',()=>{
 const p=require('../react-agent').protocol({maxSteps:10});
 assert.equal((p.match(/"tool":"finish"/g)||[]).length,1);
 assert.equal((p.match(/^Work this way/gm)||[]).length,1);
 assert.doesNotMatch(p,/ONE write_files/);
});
