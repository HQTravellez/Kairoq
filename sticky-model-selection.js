"use strict";
// The project remembers the user's explicit model; absent selections inherit it.
// Switching back to Auto is explicit, never an implicit fallback.
function resolve(requested,saved){
 if(typeof requested==='string'&&requested.trim()){
  if(requested==='auto')return null;
  return requested.trim();
 }
 return typeof saved==='string'&&saved.trim()?saved:null;
}
module.exports={resolve};
