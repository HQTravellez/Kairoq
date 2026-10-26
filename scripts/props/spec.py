# Builds a model from a JSON parts list (a "spec") with Kairoq's Blender kit, exports a GLB and
# renders a preview picture. The AI modelling agent (model-agent.js) writes the spec; Kairoq checks
# it first (model-spec.js), and this script only reads data: no code from the spec ever runs.
#
# Run:  python spec.py --spec model.json --out model.glb --poster preview.png [--bake]
#
# Spec: {"materials": {"wood": "#8a5a3b"}, "parts": [
#   {"shape": "box", "name": "03 Body", "size": [w, d, h], "at": [x, y, z], "rotate": [rx, ry, rz], "material": "brand", "bevel": 0.02},
#   {"shape": "cylinder", "radius": r, "depth": d, "radius_top": r2, "axis": "z", ...},
#   {"shape": "sphere", "radius": r, ...}, {"shape": "torus", "major": R, "minor": r, "axis": "y", ...},
#   {"shape": "lathe", "profile": [[r, z], ...], "thickness": t, ...}, {"shape": "tube", "points": [[x, y, z], ...], "radius": r, ...},
#   {"shape": "ring", "count": n, "radius": R, "axis": "y", "centre": [x, y, z], "part": {...one part...}},
#   {"shape": "screen", "width": w, "height": h, ...}]}
# Units are metres-ish: the model is about one unit tall, standing on z=0, front facing -y.
# Rotations are in degrees. A name starting with a number ("03 Dial") sets the part's layer for
# scroll assemblies.
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402  (loads Blender first)
from kit import box, cylinder, lathe, screen, torus, tube  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

PALETTE = {
    'brand': dict(color='#4f46e5', roughness=0.32, clearcoat=0.6),
    'accent': dict(color='#f59e0b', roughness=0.35, clearcoat=0.4),
    'shell': dict(color='#f4f1ec', roughness=0.38, clearcoat=0.3),
    'white': dict(color='#f7f7f5', roughness=0.4),
    'black': dict(color='#141416', roughness=0.45),
    'dark': dict(color='#1f2024', roughness=0.45),
    'rubber': dict(color='#111214', roughness=0.85),
    'chrome': dict(color='#e6e8eb', metallic=1, roughness=0.22),
    'steel': dict(color='#b9bec5', metallic=1, roughness=0.35),
    'brass': dict(color='#d4a64a', metallic=1, roughness=0.28),
    'gold': dict(color='#e3b341', metallic=1, roughness=0.2),
    'copper': dict(color='#c8845a', metallic=0.8, roughness=0.35),
    'glass': dict(color='#cfe3ee', roughness=0.05, transmission=0.85),
    'ceramic': dict(color='#f6f3ee', roughness=0.12, clearcoat=1),
    'wood': dict(color='#8a5a3b', roughness=0.6),
    'leather': dict(color='#3b2a20', roughness=0.7),
    'fabric': dict(color='#6b7280', roughness=0.9),
    'paper': dict(color='#f3ece0', roughness=0.8),
    'wall': dict(color='#f1ebe1', roughness=0.7),
    'trim': dict(color='#ffffff', roughness=0.45),
    'grass': dict(color='#86b06a', roughness=0.9),
    'plant': dict(color='#4f8a3c', roughness=0.7),
    'ruby': dict(color='#b3122e', roughness=0.15, clearcoat=1),
    'light': dict(color='#fff6d8', roughness=0.3, emission='#fff1c2'),
    'screen': dict(color='#0b0c0f', roughness=0.3),
}

AXES = {'x': (0, math.pi / 2, 0), 'y': (math.pi / 2, 0, 0), 'z': (0, 0, 0)}


def rad(v):
    return tuple(math.radians(a) for a in (v or (0, 0, 0)))


def turn(obj, rotate):
    """Turns a finished part in place (degrees), then fixes the turn into the mesh."""
    if not any(rotate or ()):
        return obj
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    obj.rotation_euler = rad(rotate)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return obj


def make(p):
    """One part from the spec; returns a list of Blender objects."""
    shape, name, mat = p['shape'], p.get('name', p['shape']), p.get('material', 'shell')
    at = tuple(p.get('at', (0, 0, 0)))
    if shape == 'box':
        return [turn(box(name, tuple(p['size']), at, mat, bevel=p.get('bevel', 0.01)), p.get('rotate'))]
    if shape == 'cylinder':
        obj = cylinder(name, p['radius'], p['depth'], at, mat, rotation=AXES[p.get('axis', 'z')], vertices=p.get('vertices', 48),
                       bevel=p.get('bevel', 0.004), radius_top=p.get('radius_top'))
        return [turn(obj, p.get('rotate'))]
    if shape == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=p['radius'], location=at, segments=48, ring_count=24)
        obj = bpy.context.object
        obj.name = name
        if p.get('scale'):
            obj.scale = tuple(p['scale'])
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        return [turn(kit.finish(obj, mat), p.get('rotate'))]
    if shape == 'torus':
        return [turn(torus(name, p['major'], p['minor'], at, mat, rotation=AXES[p.get('axis', 'z')]), p.get('rotate'))]
    if shape == 'lathe':
        obj = lathe(name, [tuple(v) for v in p['profile']], mat, location=at, thickness=p.get('thickness', 0.0))
        return [turn(obj, p.get('rotate'))]
    if shape == 'tube':
        return [tube(name, [tuple(v) for v in p['points']], p['radius'], mat)]
    if shape == 'screen':
        return [screen(name, p['width'], p['height'], at, rotation=rad(p.get('rotate', (90, 0, 0))))]
    if shape == 'ring':
        # Copies of one part around a circle (watch indices, gear teeth, petals, bolts, chair legs).
        out = []
        cx, cy, cz = p.get('centre', (0, 0, 0))
        axis = p.get('axis', 'z')
        for i in range(p['count']):
            a = i / p['count'] * math.tau
            child = dict(p['part'])
            if axis == 'z':
                pos, spin = (cx + math.cos(a) * p['radius'], cy + math.sin(a) * p['radius'], cz), (0, 0, math.degrees(a))
            elif axis == 'y':
                pos, spin = (cx + math.sin(a) * p['radius'], cy, cz + math.cos(a) * p['radius']), (0, -math.degrees(a), 0)
            else:
                pos, spin = (cx, cy + math.sin(a) * p['radius'], cz + math.cos(a) * p['radius']), (math.degrees(a), 0, 0)
            child['at'] = pos
            child['rotate'] = tuple(s + r for s, r in zip(spin, child.get('rotate', (0, 0, 0))))
            out += make(child)
        return out
    raise ValueError('Unknown shape ' + shape)


def frame_camera(parts, size):
    """A camera and three soft lights that frame the whole model, three-quarter view."""
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in parts:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo, hi = Vector(map(min, lo, w)), Vector(map(max, hi, w))
    centre, extent = (lo + hi) / 2, max((hi - lo).length, 0.1)
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 50
    cam = bpy.data.objects.new('Camera', cam_data)
    bpy.context.collection.objects.link(cam)
    direction = Vector((0.55, -1.0, 0.45)).normalized()
    cam.location = centre + direction * extent * 1.55
    cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene = bpy.context.scene
    scene.camera = cam
    for loc, energy in (((3, -4, 5), 900), ((-4, -2, 3), 400), ((0, 5, 4), 500)):
        light = bpy.data.lights.new('Light', 'AREA')
        light.energy = energy * extent
        light.size = 3 * extent
        obj = bpy.data.objects.new('Light', light)
        obj.location = centre + Vector(loc) * extent
        obj.rotation_euler = (centre - obj.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.collection.objects.link(obj)
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.82, 0.84, 0.87, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
    scene.world = world
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX' if 'AgX' in [v.identifier for v in type(scene.view_settings).bl_rna.properties['view_transform'].enum_items] else 'Filmic'


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', required=True)
    ap.add_argument('--out', default='')
    ap.add_argument('--poster', default='')
    ap.add_argument('--size', type=int, default=640)
    ap.add_argument('--samples', type=int, default=24)
    ap.add_argument('--bake', action='store_true')
    a = ap.parse_args(argv)
    with open(a.spec) as f:
        spec = json.load(f)
    kit.reset()
    bpy.context.scene.cycles.samples = a.samples
    palette = {k: dict(v) for k, v in PALETTE.items()}
    for name, colour in (spec.get('materials') or {}).items():
        palette.setdefault(name, dict(roughness=0.5))['color'] = colour
    kit.MATERIALS.clear()
    kit.MATERIALS.update({n: kit.material(n, **v) for n, v in palette.items()})
    parts = []
    for p in spec['parts']:
        parts += make(p)
    # Soft shadows baked into each part: worth it for a few dozen parts, too slow for hundreds.
    if a.bake and len(parts) <= 60:
        kit.bake_occlusion(parts, 'model')
    if a.out:
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=a.out, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_image_format='WEBP')
    if a.poster:
        frame_camera(parts, a.size)
        bpy.context.scene.render.filepath = a.poster
        bpy.ops.render.render(write_still=True)
    print('KAIROQ_RESULT ' + json.dumps({'parts': len(parts)}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # a plain message for the agent to fix the spec
        print('KAIROQ_ERROR ' + str(e)[:300], flush=True)
        sys.exit(2)
