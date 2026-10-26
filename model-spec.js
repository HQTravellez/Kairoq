'use strict';
// Checks a model "spec" (a JSON parts list the AI modelling agent writes) before Blender reads it:
// only known shapes, materials and fields, finite numbers in sensible ranges, and a part budget.
// The spec is data; scripts/props/spec.py interprets it and no code from it ever runs.

const SHAPES = ['box', 'cylinder', 'sphere', 'torus', 'lathe', 'tube', 'ring', 'screen'];
const MATERIALS = ['brand', 'accent', 'shell', 'white', 'black', 'dark', 'rubber', 'chrome', 'steel', 'brass', 'gold', 'copper', 'glass', 'ceramic', 'wood', 'leather', 'fabric', 'paper', 'wall', 'trim', 'grass', 'plant', 'ruby', 'light', 'screen'];
const AXES = ['x', 'y', 'z'];
const MAX_PARTS = 400, MAX_RING = 72, LIMIT = 5;

function fail(message) { return Object.assign(Error(message), { status: 422, spec: true }); }
function num(v, where, { min = -LIMIT, max = LIMIT } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw fail(where + ' must be a number from ' + min + ' to ' + max);
  return Math.round(n * 10000) / 10000;
}
function vec(v, where, size = 3, opts) {
  if (!Array.isArray(v) || v.length !== size) throw fail(where + ' must be a list of ' + size + ' numbers');
  return v.map((x, i) => num(x, where + '[' + i + ']', opts));
}
const positive = { min: 0.0005, max: LIMIT };

function part(p, where, depth = 0) {
  if (!p || typeof p !== 'object') throw fail(where + ' must be an object');
  const shape = String(p.shape || '');
  if (!SHAPES.includes(shape)) throw fail(where + ': shape must be one of ' + SHAPES.join(', '));
  const out = { shape, name: String(p.name || shape).replace(/[^\w .\-#]/g, '').slice(0, 60) || shape };
  if (shape !== 'ring') {
    const mat = String(p.material || 'shell');
    if (!MATERIALS.includes(mat)) throw fail(where + ': material must be one of ' + MATERIALS.join(', '));
    out.material = mat;
  }
  if (p.at !== undefined) out.at = vec(p.at, where + '.at');
  if (p.rotate !== undefined) out.rotate = vec(p.rotate, where + '.rotate', 3, { min: -360, max: 360 });
  if (p.bevel !== undefined) out.bevel = num(p.bevel, where + '.bevel', { min: 0, max: 0.3 });
  if (p.axis !== undefined) { if (!AXES.includes(p.axis)) throw fail(where + '.axis must be x, y or z'); out.axis = p.axis; }
  if (shape === 'box') out.size = vec(p.size, where + '.size', 3, positive);
  if (shape === 'cylinder') {
    out.radius = num(p.radius, where + '.radius', positive);
    out.depth = num(p.depth, where + '.depth', positive);
    if (p.radius_top !== undefined) out.radius_top = num(p.radius_top, where + '.radius_top', { min: 0, max: LIMIT });
    if (p.vertices !== undefined) out.vertices = Math.round(num(p.vertices, where + '.vertices', { min: 3, max: 128 }));
  }
  if (shape === 'sphere') {
    out.radius = num(p.radius, where + '.radius', positive);
    if (p.scale !== undefined) out.scale = vec(p.scale, where + '.scale', 3, positive);
  }
  if (shape === 'torus') { out.major = num(p.major, where + '.major', positive); out.minor = num(p.minor, where + '.minor', positive); }
  if (shape === 'lathe') {
    if (!Array.isArray(p.profile) || p.profile.length < 2 || p.profile.length > 40) throw fail(where + '.profile must have 2 to 40 [radius, height] points');
    out.profile = p.profile.map((v, i) => vec(v, where + '.profile[' + i + ']', 2, { min: 0, max: LIMIT }));
    if (p.thickness !== undefined) out.thickness = num(p.thickness, where + '.thickness', { min: 0, max: 0.5 });
  }
  if (shape === 'tube') {
    if (!Array.isArray(p.points) || p.points.length < 2 || p.points.length > 24) throw fail(where + '.points must have 2 to 24 [x, y, z] points');
    out.points = p.points.map((v, i) => vec(v, where + '.points[' + i + ']'));
    out.radius = num(p.radius, where + '.radius', positive);
  }
  if (shape === 'screen') { out.width = num(p.width, where + '.width', positive); out.height = num(p.height, where + '.height', positive); }
  if (shape === 'ring') {
    if (depth > 0) throw fail(where + ': a ring cannot contain another ring');
    out.count = Math.round(num(p.count, where + '.count', { min: 2, max: MAX_RING }));
    out.radius = num(p.radius, where + '.radius', positive);
    if (p.centre !== undefined) out.centre = vec(p.centre, where + '.centre');
    out.part = part(p.part, where + '.part', depth + 1);
  }
  return out;
}

// A clean copy of the spec, or an error that says exactly what to fix.
function validate(spec) {
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.parts) || !spec.parts.length) throw fail('The spec needs a "parts" list');
  const parts = spec.parts.map((p, i) => part(p, 'parts[' + i + ']'));
  const total = parts.reduce((n, p) => n + (p.shape === 'ring' ? p.count : 1), 0);
  if (total > MAX_PARTS) throw fail('The model has ' + total + ' parts; keep it under ' + MAX_PARTS + ' (use fewer ring copies)');
  const materials = {};
  for (const [k, v] of Object.entries(spec.materials || {})) {
    if (!MATERIALS.includes(k) || k === 'brand' || k === 'accent') continue; // brand and accent come from the app
    if (!/^#[0-9a-f]{6}$/i.test(String(v))) throw fail('materials.' + k + ' must be a #rrggbb colour');
    materials[k] = String(v).toLowerCase();
  }
  return { name: String(spec.name || 'Model').slice(0, 80), materials, parts, total };
}

module.exports = { SHAPES, MATERIALS, MAX_PARTS, validate };
