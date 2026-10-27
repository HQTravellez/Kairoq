"use strict";
// Photo links that do not exist go back to the builder (image-links.js); sites that cannot be
// reached, and photos that load, do not.
const test=require('node:test'),assert=require('node:assert/strict');
const links=require('../image-links');

test('photo addresses are found in the app source and the ones that do not exist are reported',async()=>{
 const files={
  'src/components/home/Hero.jsx':'export default()=> <img src="https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&amp;w=1800" alt="" />',
  'src/components/home/Atelier.jsx':"const p='https://images.unsplash.com/photo-1455390582262-044cdeel?w=1200';\nconst bg={backgroundImage:'url(https://cdn.example.com/a/workbench.jpg)'};",
  'src/components/home/Map.jsx':'<img src="https://down.example.com/x.png" />',
  'src/components/ui/button.jsx':'// https://images.unsplash.com/photo-not-checked',
  'src/backend.json':'{}',
 };
 const found=links.links(files);
 assert.deepEqual(found.map(l=>l.url),['https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&w=1800','https://images.unsplash.com/photo-1455390582262-044cdeel?w=1200','https://cdn.example.com/a/workbench.jpg','https://down.example.com/x.png']);
 const asked=[];
 const fetchUrl=async({url,method})=>{asked.push(method+' '+url);
  if(/044cdeel/.test(url))return{status:404};
  if(/cdn\.example/.test(url))return method==='HEAD'?{status:405}:{status:206};
  if(/down\.example/.test(url))throw Error('timed out');
  return{status:200}};
 const problems=await links.broken(files,{fetchUrl});
 assert.deepEqual(problems,['A photo address in src/components/home/Atelier.jsx does not exist (HTTP 404): https://images.unsplash.com/photo-1455390582262-044cdeel?w=1200. Use another real photo address, or remove the image.']);
 assert.ok(asked.includes('GET https://cdn.example.com/a/workbench.jpg'),'a site that refuses HEAD is asked with GET');
 // Answers are remembered: the next build does not ask again (except a site that could not be reached).
 asked.length=0;
 await links.broken(files,{fetchUrl});
 assert.deepEqual(asked,['HEAD https://down.example.com/x.png']);
});
