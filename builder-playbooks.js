"use strict";
// Playbooks: short, tested know-how the builder reads when a request touches a hard topic, so it
// starts from the way these things are really made (like a developer who has built them before)
// instead of a placeholder. Each is matched by words in the request; at most three are added.
const BOOKS=[
 {id:'3d-character',when:/\b(3d|three[- ]?d)\b.*\b(character|animal|dinosaur|t-?rex|mascot|creature|pet|robot)\b|\b(character|animal|dinosaur|t-?rex|mascot|creature|robot)\b.*\b(3d|animated|comes? (alive|to life)|pops? out|walks?|jumps?)\b/i,
  text:`3D characters:
- Use a real, ready-made animated model, never one drawn with SVG, divs or three.js boxes. If the project has none, search Poly Pizza (poly.pizza; Quaternius and Kenney are CC0 and animated), read the model page for the licence and the .glb download, and fetch it with kairoq_download.
- Show it with Model3D from 'kairoq/3d': animation="Idle" loops, tapAnimation="Jump" plays on tap, onControls gives play(name,{once}) for Walk / Jump / Replay buttons, blank makes it plain white (ready to colour), colors={{"Body":"#hex"}} paints parts by material name (controls.materials lists them).
- Put "Drag to turn · Tap to jump" near it and the credit ("T-Rex by Quaternius · CC0") under it.`},
 {id:'ar-coloring',when:/\b(ar|augmented reality|point (the|your) (phone|camera)|scan(s|ning)? (the|a|your) (page|paper|drawing))\b|\bcolou?ring (book|page)\b.*\b(camera|phone|scan|life)\b/i,
  text:`AR from a printed page:
- The simple, reliable version: the child scans or photographs the page, the app reads it, and the 3D character appears on screen wearing those colours, with "View in your room" (Model3D ar, iPhone Quick Look / Android Scene Viewer) to place it in the room.
- For true tracking on the paper, add the mind-ar package (MIT) with kairoq_package and import { Controller, Compiler } from 'mind-ar/dist/mindar-image.prod.js' (its -three build needs an older three.js than this app has, so do not use it): compile the printed page as the target in the browser with Compiler, run Controller on the camera video, and move the Model3D (or a Scene3D camera) with the pose it reports. Keep a corner pattern on the page uncoloured so tracking works.
- Ask for the camera only after a button press, explain why first, and handle "camera blocked" with a clear way forward (upload a photo instead).
- Say in "Not done yet:" what still needs a real phone to check (tracking, lighting, colour accuracy).`},
 {id:'camera-colours',when:/\b(child'?s|kid'?s|their|my|your|the) colou?rs?\b|\bcolou?rs? (from|of) (the|a|their|your) (drawing|page|paper|photo)\b|\bwearing\b.*\bcolou?rs?\b/i,
  text:`Reading colours from a coloured page:
- Take a frame from the camera (getUserMedia, a <video> drawn onto a <canvas>) or an uploaded photo.
- Find the page: ask the child to fit it inside an on-screen frame, so the page's corners are known.
- The printable page and the code share a map of regions (in % of the page: body, belly, spikes...) that match the model's materials. For each region take the median colour of its pixels, ignoring near-white paper and dark outline pixels; fall back to a friendly default when a region was left blank.
- Pass the result to Model3D colors={{...}} and keep it in state (and localStorage) so it survives a reload.`},
 {id:'printable',when:/\b(print(able|ed)?|colou?ring (page|sheet|book)|worksheet|a4|letter size)\b/i,
  text:`Printable pages:
- Make the page its own route with a big "Print" button (window.print()) and @media print CSS: @page { size: A4 portrait; margin: 12mm }, hide the app's header, footer and buttons, black line art on white.
- Draw the page as a clean SVG (thick, closed outlines a child can colour), with the regions the app reads later, a title and small "Made with <app>" text. Offer a download of the same SVG or PNG.`},
];
function pick(text){return BOOKS.filter(b=>b.when.test(String(text||''))).slice(0,3)}
function note(text){const list=pick(text);return list.length?'\n\nPLAYBOOKS (how these are really built; follow them):\n'+list.map(b=>b.text).join('\n\n'):''}
module.exports={BOOKS,pick,note};
