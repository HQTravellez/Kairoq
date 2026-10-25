# Kairoq's Blender worker (blender.js runs it): turns an uploaded 3D file into a web-ready GLB
# and renders a still preview picture. Works with the Blender app
#   blender -b --factory-startup -noaudio --python-exit-code 1 --python blender-kairoq.py -- ARGS
# or with Blender as a Python module (pip "bpy"):  python3.11 -I blender-kairoq.py ARGS
# Scripts inside uploaded files never run: auto-run is switched off and .blend files are opened
# with use_scripts=False.
import argparse, json, math, os, sys, zipfile

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
p = argparse.ArgumentParser()
p.add_argument('--in', dest='src', required=True)
p.add_argument('--out', default='')            # GLB to write ('' = do not export)
p.add_argument('--poster', default='')         # PNG to render ('' = no picture)
p.add_argument('--max-tris', type=int, default=200000)
p.add_argument('--max-texture', type=int, default=2048)
p.add_argument('--size', type=int, default=800)
p.add_argument('--samples', type=int, default=24)
a = p.parse_args(argv)

def fail(msg):
    print('KAIROQ_ERROR ' + msg, flush=True)
    sys.exit(2)


MODELS = ('.glb', '.gltf', '.fbx', '.obj', '.stl', '.ply', '.blend')
bpy.context.preferences.filepaths.use_scripts_auto_execute = False


def unzip(path):
    """Extracts a .zip safely next to it and returns the main model file inside."""
    root = os.path.join(os.path.dirname(path), 'unzipped')
    os.makedirs(root, exist_ok=True)
    total = 0
    with zipfile.ZipFile(path) as z:
        names = z.infolist()
        if len(names) > 200:
            fail('The zip has too many files (200 at most).')
        for info in names:
            target = os.path.realpath(os.path.join(root, info.filename))
            if not target.startswith(os.path.realpath(root) + os.sep):
                fail('The zip has a file outside its folder.')
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                fail('The zip has a link in it; zip the files themselves.')
            total += info.file_size
            if total > 300 * 1024 * 1024:
                fail('The zip is too big when unpacked (300 MB at most).')
        z.extractall(root)
    found = []
    for d, _, files in os.walk(root):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in MODELS and not f.startswith('.'):
                found.append((MODELS.index(ext), os.path.getsize(os.path.join(d, f)) * -1, os.path.join(d, f)))
    if not found:
        fail('No 3D model found in the zip (.glb, .gltf, .fbx, .obj, .stl, .ply or .blend).')
    return sorted(found)[0][2]


src = a.src
if src.lower().endswith('.zip'):
    src = unzip(src)
ext = os.path.splitext(src)[1].lower()

if ext not in MODELS:
    fail('Unsupported 3D file: ' + ext)
try:
    if ext == '.blend':
        bpy.ops.wm.open_mainfile(filepath=src, load_ui=False, use_scripts=False)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        if ext in ('.glb', '.gltf'):
            bpy.ops.import_scene.gltf(filepath=src)
        elif ext == '.fbx':
            bpy.ops.import_scene.fbx(filepath=src)
        elif ext == '.obj':
            bpy.ops.wm.obj_import(filepath=src)
        elif ext == '.stl':
            bpy.ops.wm.stl_import(filepath=src)
        elif ext == '.ply':
            bpy.ops.wm.ply_import(filepath=src)
except Exception as e:
    fail('Blender could not read this file (' + (str(e).splitlines() or ['unknown error'])[0][:160] + ')')

scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == 'MESH']
if not meshes:
    fail('The file has no 3D shapes in it.')

# Triangle count, and a Decimate modifier on each mesh when the model is too heavy for phones.
deps = bpy.context.evaluated_depsgraph_get()
tris = 0
for o in meshes:
    m = o.evaluated_get(deps).to_mesh()
    tris += sum(len(poly.vertices) - 2 for poly in m.polygons)
    o.evaluated_get(deps).to_mesh_clear()
decimated = False
if a.out and tris > a.max_tris:
    ratio = max(0.02, a.max_tris / tris)
    for o in meshes:
        # Imported models often have split vertices along seams; welding them first stops
        # Decimate from opening holes. The poster is rendered without these (show_render off).
        weld = o.modifiers.new('KairoqWeld', 'WELD')
        weld.merge_threshold = 1e-6
        mod = o.modifiers.new('KairoqDecimate', 'DECIMATE')
        mod.ratio = ratio
        for m in (weld, mod):
            m.show_render = False
    decimated = True

# Large textures shrink to max-texture pixels on their longest side.
shrunk = 0
for img in bpy.data.images:
    w, h = img.size[0], img.size[1]
    if a.out and max(w, h) > a.max_texture and img.has_data:
        s = a.max_texture / max(w, h)
        img.scale(max(1, int(w * s)), max(1, int(h * s)))
        shrunk += 1

# Bounds of everything visible, in world space.
lo = Vector((math.inf,) * 3)
hi = Vector((-math.inf,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
center = (lo + hi) / 2
radius = max((hi - lo).length / 2, 1e-4)

if a.out:
    bpy.ops.export_scene.gltf(filepath=a.out, export_format='GLB', export_apply=True,
                              export_cameras=False, export_lights=False, export_yup=True,
                              export_image_format='AUTO', use_selection=False)

if a.poster:
    # A camera at a three-quarter view, soft light from a grey sky and one sun, Cycles on the CPU
    # (no screen or graphics card needed), transparent background.
    for o in list(scene.objects):
        if o.type in ('CAMERA', 'LIGHT'):
            bpy.data.objects.remove(o, do_unlink=True)
    cam_data = bpy.data.cameras.new('KairoqCam')
    cam_data.lens = 50
    cam = bpy.data.objects.new('KairoqCam', cam_data)
    scene.collection.objects.link(cam)
    fov = 2 * math.atan(cam_data.sensor_width / (2 * cam_data.lens))
    dist = radius / math.sin(fov / 2) * 0.92
    direction = Vector((0.8, -1.0, 0.55)).normalized()
    cam.location = center + direction * dist
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam_data.clip_start = dist / 100
    cam_data.clip_end = dist * 10
    scene.camera = cam
    sun_data = bpy.data.lights.new('KairoqSun', 'SUN')
    sun_data.energy = 3
    sun = bpy.data.objects.new('KairoqSun', sun_data)
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)
    world = scene.world or bpy.data.worlds.new('KairoqWorld')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs[0].default_value = (0.85, 0.86, 0.88, 1)
        bg.inputs[1].default_value = 1.0
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = a.samples
    try:
        scene.cycles.use_denoising = True
    except Exception:
        pass
    scene.render.film_transparent = True
    scene.render.resolution_x = a.size
    scene.render.resolution_y = int(a.size * 0.75)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = a.poster
    bpy.ops.render.render(write_still=True)

print('KAIROQ_RESULT ' + json.dumps({'tris': tris, 'meshes': len(meshes), 'decimated': decimated,
                                     'textures_shrunk': shrunk, 'size': [round(x, 4) for x in (hi - lo)]}))
