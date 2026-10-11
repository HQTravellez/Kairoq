'use strict';
const fs=require('node:fs'),path=require('node:path');
function source(files){return{...files,'app.js':files['app.js'].replace(/\/\* BEGIN KAIROQ WORKFLOW RUNTIME \*\/[\s\S]*?\/\* END KAIROQ WORKFLOW RUNTIME \*\/\n?/g,'')};}
function inject(files,enabled){const clean=source(files);return enabled?{...clean,'app.js':clean['app.js']+'\n'+fs.readFileSync(path.join(__dirname,'public','app-workflows-runtime.js'),'utf8')}:clean;}
module.exports={inject,source};
