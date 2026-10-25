'use strict';
// Formats the code the builder writes with Prettier, so every app reads the same way whichever
// AI model wrote it: consistent indentation, sensible line breaks, no crammed lines.
// A file Prettier cannot read (a syntax error) is left exactly as it was; the build reports it.

const OPTIONS={printWidth:100,singleQuote:true,semi:true,trailingComma:'es5',bracketSpacing:true,jsxSingleQuote:false,arrowParens:'always'};
const PARSERS={js:'babel',jsx:'babel',mjs:'babel',css:'css',json:'json'};

function parserFor(file){
 if(file==='index.html'||file.startsWith('src/components/ui/'))return null; // index.html is fixed; the UI kit keeps its own style
 return PARSERS[(file.split('.').pop()||'').toLowerCase()]||null;
}

// Returns a copy of files with the listed ones formatted.
async function format(files,only=Object.keys(files||{})){
 if(process.env.KAIROQ_FORMAT_CODE==='off')return files;
 const prettier=require('prettier'),out={...files};
 for(const file of only){
  const parser=parserFor(file),source=out[file];
  if(!parser||typeof source!=='string')continue;
  try{out[file]=await prettier.format(source,{...OPTIONS,parser,filepath:file})}catch{}
 }
 return out;
}

module.exports={format,parserFor,OPTIONS};
