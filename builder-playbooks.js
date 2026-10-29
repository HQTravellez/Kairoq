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
 // Game playbooks: Kairoq's own words, informed by Claude Code Game Studios (Donchitos, MIT).
 {id:'game-design',when:/\b(game|arcade|platformer|puzzle|snake|tetris|pong|flappy|quiz|mini ?game|leaderboard|high ?score)\b/i,
  text:`Designing a small game:
- Start from a one-screen brief, not documents: the core loop (what the player does again and again), the goal, how you win and lose, the controls on desktop and on a phone, and how long one round lasts (30 to 120 seconds for a quick brand game).
- Keep every tuning value (speeds, timers, points, difficulty steps) in one data file (src/data/game.js), never scattered numbers in the code, so it can be tuned without touching logic.
- Use the time since the last frame (dt) for all movement and timers, so the game runs the same on fast and slow phones.
- Separate the game's logic (a pure state machine: ready, playing, paused, won, lost, with explicit transitions) from what draws it, so the logic can be tested without a screen.
- One clear call to action at the end of a round: play again, share the score, or the business's real offer.`},
 {id:'game-feel',when:/\b(game|arcade|platformer|puzzle|snake|tetris|pong|flappy|quiz|mini ?game|leaderboard|high ?score)\b/i,
  text:`Making a game feel good ("juice"):
- Every action answers within 100 ms with something the player can see and hear: a small bounce or squash-and-stretch, a burst of particles, a short sound, a number that pops up.
- Hits and wins get weight: a tiny pause on impact (40 to 80 ms), a light screen shake (a few pixels, never for people who prefer reduced motion), a flash.
- Ease everything (ease-out for things arriving, ease-in for leaving); nothing jumps or stops dead.
- Ramp difficulty in small steps and give a moment of calm after a hard part; the first 10 seconds teach the controls by doing, not by reading.
- Sound only after the first tap, a mute button always visible, and music quieter than effects.`},
 {id:'game-qa',when:/\b(game|arcade|platformer|puzzle|snake|tetris|pong|flappy|quiz|mini ?game|leaderboard|high ?score)\b/i,
  text:`Testing a game before calling it done:
- Play it like a first-time player: within 5 seconds is the goal clear, within 10 are the controls clear, and does losing feel fair? Check on a phone size and with touch.
- Automatic checks: the game starts, input moves the player, the score changes, pausing works and the tab being hidden pauses it, a round can be won and lost, play-again resets everything, and there are no errors in the console.
- Balance: no dead stretch where nothing changes, no single trick that wins every time, difficulty that rises and never jumps, rewards that keep coming.
- Never claim it is balanced or fun without evidence: if no one played it, say what was not tested in "Not done yet:".`},
 {id:'game-accessibility',when:/\b(game|arcade|platformer|puzzle|snake|tetris|pong|flappy|quiz|mini ?game|leaderboard|high ?score)\b/i,
  text:`Games everyone can play:
- Text at least 18 px and readable on a phone, contrast at least 4.5:1, and never colour alone to tell things apart (add a shape, icon or label).
- Simple controls: no pressing two buttons at once, taps instead of holds (or a toggle), big touch targets (at least 44 px), and keyboard play on desktop.
- A pause that works at any moment, an easier or slower mode, and no time pressure that cannot be turned off for players who need it.
- Separate volume (or mute) for music and effects, visual signs for important sounds, and no flashing faster than three times a second.`},
];
function pick(text){return BOOKS.filter(b=>b.when.test(String(text||''))).slice(0,4)}
function note(text){const list=pick(text);return list.length?'\n\nPLAYBOOKS (how these are really built; follow them):\n'+list.map(b=>b.text).join('\n\n'):''}
module.exports={BOOKS,pick,note};
