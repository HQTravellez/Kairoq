'use strict';
const fs=require('node:fs'),path=require('node:path');
function source(files){const clean={...files,'app.js':files['app.js'].replace(/\/\* BEGIN KAIROQ WORKFLOW RUNTIME \*\/[\s\S]*?\/\* END KAIROQ WORKFLOW RUNTIME \*\/\n?/g,'')};if(typeof clean['styles.css']==='string')clean['styles.css']=clean['styles.css'].replace(/\/\* BEGIN KAIROQ DISABLED WORKFLOWS \*\/[\s\S]*?\/\* END KAIROQ DISABLED WORKFLOWS \*\/\n?/g,'');return clean;}
function inject(files,enabled){const clean=source(files);return enabled?{...clean,'app.js':clean['app.js']+'\n'+fs.readFileSync(path.join(__dirname,'public','app-workflows-runtime.js'),'utf8')}:{...clean,'styles.css':(clean['styles.css']||'')+'\n/* BEGIN KAIROQ DISABLED WORKFLOWS */\n#workflow-panel{display:none!important}\n/* END KAIROQ DISABLED WORKFLOWS */\n'};}
module.exports={inject,source};
