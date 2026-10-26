'use strict';
// The Blender modelling agent: makes a bespoke 3D model for an app ("a vintage film camera", "a
// boarding pass and a plane", "our espresso grinder"). The AI writes a parts list (model-spec.js
// checks it), Blender builds it and renders a preview (blender.js runSpec), and an AI that can see
// judges the preview against the request. Up to three rounds, then the model is saved with the
// project's 3D files (react-models.js), ready for <HeroObject src="./models/..." />.

const SPEC = require('./model-spec');

const PROMPT = `You are a 3D modelling artist. You build one object from simple parts that Kairoq turns into a polished model in Blender (bevelled edges, smooth shading, real materials, soft shadows).
Reply with ONLY JSON: {"name":"short name","materials":{"wood":"#8a5a3b"},"parts":[...]}.
Space: the object is about 1 unit tall, stands on z=0, centred on x=0 and y=0; z is up, the front faces -y. Rotations are degrees.
Parts:
- {"shape":"box","name":"..","size":[w,d,h],"at":[x,y,z],"rotate":[rx,ry,rz],"material":"..","bevel":0.01}
- {"shape":"cylinder","radius":r,"depth":d,"radius_top":r2,"axis":"z|x|y","at":[..],"material":"..","vertices":48}
- {"shape":"sphere","radius":r,"scale":[sx,sy,sz],"at":[..],"material":".."}
- {"shape":"torus","major":R,"minor":r,"axis":"z|x|y","at":[..],"material":".."}
- {"shape":"lathe","profile":[[radius,height],...],"thickness":0.01,"at":[..],"material":".."}  (a turned shape: cups, bottles, lenses, knobs; thickness makes a hollow wall)
- {"shape":"tube","points":[[x,y,z],...],"radius":r,"material":".."}  (handles, cables, straps, bent rails)
- {"shape":"ring","count":n,"radius":R,"axis":"z|x|y","centre":[x,y,z],"part":{one part without "at"}}  (repeats: teeth, bolts, petals, keys, spokes)
- {"shape":"screen","width":w,"height":h,"at":[..],"rotate":[90,0,0]}  (a display that will show the app's screenshot)
Materials: brand and accent take the app's own colours, so use them for the parts that carry the brand; also shell, white, black, dark, rubber, chrome, steel, brass, gold, copper, glass, ceramic, wood, leather, fabric, paper, wall, trim, grass, plant, ruby, light, screen. You may recolour the non-brand ones in "materials".
Craft: real proportions, rounded edges (bevel 0.005 to 0.05), separate parts for separate pieces (a lid, a lens, a button), small details that make it recognisable (seams, screws, labels, feet, handles), 10 to 120 parts.
Layers: start each part's name with a two-digit layer, front to back ("00 Glass", "01 Bezel", "02 Dial"...), so the model can come apart in order on a scroll; parts that belong together share a layer.`;

function parseSpec(text) {
  let v = text;
  if (typeof v === 'string') {
    const t = v.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { v = JSON.parse(t); } catch { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) throw Object.assign(Error('The model reply was not JSON'), { spec: true }); v = JSON.parse(t.slice(a, b + 1)); }
  }
  return SPEC.validate(v);
}

const REVIEW = (description) => `This picture is a 3D model Kairoq built for the request: "${String(description).slice(0, 300)}".
Judge it like a 3D art director. Is it clearly recognisable as that object at a glance? Are the proportions believable? Does it look crafted (several distinct parts, details, real materials) rather than a few plain blocks? Ignore the grey background and the lighting.
Reply with ONLY JSON: {"ok":true} or {"ok":false,"problems":["specific fix: which part, what to change", ...]} (at most 4).`;

// description: what to model. callModel(opts, parse): the usual model call. review({request, pictures, prompt}):
// the vision check (returns {ok, problems} or null). runSpec: blender.runSpec. save(glb, poster, title): stores it.
async function make(description, { callModel, review, runSpec = require('./blender').runSpec, save, rounds = 3, signal, onProgress = () => {}, tier } = {}) {
  const text = String(description || '').trim().slice(0, 300);
  if (!text) throw Object.assign(Error('Say what to model, for example "a vintage film camera"'), { status: 400 });
  const messages = [{ role: 'system', content: PROMPT }, { role: 'user', content: 'Model: ' + text }];
  const history = [];
  let best = null;
  for (let round = 1; round <= rounds; round++) {
    signal?.throwIfAborted?.();
    onProgress('Modelling ' + text + (round > 1 ? ' (round ' + round + ')' : ''));
    let spec;
    try { spec = await callModel({ messages, temperature: 0.4, maxOutputTokens: 9000, signal, tier, design: true }, parseSpec); }
    catch (e) {
      if (signal?.aborted || !e.spec) throw e;
      messages.push({ role: 'user', content: 'That spec was rejected: ' + e.message + '. Return the whole corrected JSON.' });
      history.push({ round, error: e.message });
      continue;
    }
    messages.push({ role: 'assistant', content: JSON.stringify(spec) });
    let built;
    try { built = await runSpec(spec, { poster: true }); }
    catch (e) {
      if (signal?.aborted) throw e;
      messages.push({ role: 'user', content: 'Blender could not build it: ' + e.message + '. Return the whole corrected JSON.' });
      history.push({ round, error: e.message });
      continue;
    }
    const fs = require('fs');
    const glb = fs.readFileSync(built.glb), poster = built.poster ? fs.readFileSync(built.poster) : null;
    fs.rmSync(built.dir, { recursive: true, force: true });
    let verdict = null;
    if (review && poster) {
      onProgress('Checking the model looks like ' + text);
      try { verdict = await review({ request: text, pictures: [{ data: poster.toString('base64'), mime: 'image/png' }], prompt: REVIEW(text), signal }); }
      catch (e) { if (signal?.aborted) throw e; verdict = null; }
    }
    best = { spec, glb, poster, parts: built.parts, review: verdict, round };
    history.push({ round, parts: built.parts, ok: verdict ? verdict.ok : null, problems: verdict?.problems || [] });
    // No reviewer available: the first model that builds is kept.
    if (!verdict || verdict.ok) break;
    messages.push({ role: 'user', content: 'The preview shows these problems:\n' + verdict.problems.map((p) => '- ' + p).join('\n') + '\nFix them and return the whole corrected JSON.' });
  }
  if (!best) throw Object.assign(Error('Kairoq could not build a model of "' + text + '" this time. ' + (history.at(-1)?.error || '')), { status: 422 });
  const saved = save ? save(best.glb, best.poster, best.spec.name || text) : null;
  return { model: saved, spec: best.spec, parts: best.parts, rounds: best.round, review: best.review, history };
}

module.exports = { make, parseSpec, PROMPT, REVIEW };
