"use strict";
// The 'kairoq/scroll' module generated apps import: <ScrollVideo>, a pinned section that plays a
// film frame by frame with the scroll (product explode films from explode-video.js). Its readable
// source lives in app-modules/kairoq-scroll.js; the builder serves it as a virtual module.
const fs=require('fs'),path=require('path');
const FILE=path.join(__dirname,'app-modules','kairoq-scroll.js');
function source(){return fs.readFileSync(FILE,'utf8')}
module.exports={source,FILE};
