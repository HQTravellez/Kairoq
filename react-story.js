"use strict";
// The 'kairoq/story' module generated apps import: 3D "journey" scenes (how something is made,
// step by step) with detailed props and a storyboard player. Its readable source lives in
// app-modules/kairoq-story.js; the builder serves it as a virtual module.
const fs=require('fs'),path=require('path');
const FILE=path.join(__dirname,'app-modules','kairoq-story.js');
function source(){return fs.readFileSync(FILE,'utf8')}
module.exports={source,FILE};
