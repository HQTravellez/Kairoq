# Builds Kairoq's espresso machine and cup in Blender and exports them as web-ready GLB files.
#
# Run:  python scripts/props/espresso.py <output folder>   (a Python with the "bpy" module)
#
# The models are made the way a 3D artist would: bevelled edges, smooth curved surfaces, separate
# parts (body, group head, portafilter, gauges, steam wand, drip tray, cup, saucer), real material
# values (polished and brushed steel, black bakelite, glass, glazed ceramic), and soft shadows in
# the creases baked into each part's texture (ambient occlusion), so they look rich in the browser
# without extra lights. Front of every model faces the viewer (+Z in the exported file).
import math
import os
import sys

import bpy  # must come first: it makes bmesh and mathutils importable
import bmesh

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else 'out'
BAKE_SIZE = 512
BAKE_SAMPLES = 24


# ---------- scene and materials ----------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = BAKE_SAMPLES
    return scene


def material(name, color, metallic=0.0, roughness=0.5, clearcoat=0.0, transmission=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*hex_rgb(color), 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Coat Weight'].default_value = clearcoat
    bsdf.inputs['Transmission Weight'].default_value = transmission
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*hex_rgb(emission), 1)
        bsdf.inputs['Emission Strength'].default_value = 2.0
    return mat


def hex_rgb(value):
    value = value.lstrip('#')
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # Blender works in linear colour; the hex values are sRGB as designers pick them.
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


MATERIALS = {}


def materials():
    MATERIALS.update({
        'polished': material('Polished steel', '#d9dce0', metallic=1, roughness=0.16),
        'brushed': material('Brushed steel', '#c4c8cd', metallic=1, roughness=0.34),
        'dark': material('Dark steel', '#2a2c30', metallic=0.85, roughness=0.32),
        'bakelite': material('Bakelite', '#121212', roughness=0.38, clearcoat=0.4),
        'rubber': material('Rubber', '#0d0d0d', roughness=0.8),
        'copper': material('Copper', '#b8734a', metallic=1, roughness=0.26),
        'face': material('Gauge face', '#f3eee4', roughness=0.4),
        'glass': material('Glass', '#ffffff', roughness=0.04, transmission=1),
        'needle': material('Needle', '#b3261e', roughness=0.4),
        'ceramic': material('Ceramic', '#f6f3ee', roughness=0.12, clearcoat=1),
        'coffee': material('Coffee', '#2a160b', roughness=0.12, clearcoat=1),
        'crema': material('Crema', '#6e3d1d', roughness=0.4),
    })


# ---------- modelling helpers ----------
def finish(obj, mat, bevel=0.0, segments=3, subsurf=0, smooth=True):
    """Gives a part its material, bevelled edges and smooth shading, ready to export."""
    obj.data.materials.clear()
    obj.data.materials.append(MATERIALS[mat])
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
    if subsurf:
        mod = obj.modifiers.new('Smooth', 'SUBSURF')
        mod.levels = subsurf
        mod.render_levels = subsurf
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
        obj.modifiers.new('Normals', 'WEIGHTED_NORMAL').keep_sharp = True
    return obj


def box(name, size, location, mat, bevel=0.01, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(obj, mat, bevel=bevel, segments=segments)


def cylinder(name, radius, depth, location, mat, rotation=(0, 0, 0), vertices=48, bevel=0.004, radius_top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if radius_top is None else radius_top,
                                    depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat, bevel=bevel, segments=2)


def torus(name, major, minor, location, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=location, rotation=rotation,
                                     major_segments=48, minor_segments=12)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat)


def lathe(name, profile, mat, location=(0, 0, 0), thickness=0.0, subsurf=1):
    """Turns a 2D profile [(radius, height), ...] around the vertical axis, like a potter's wheel."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    for a, b in zip(verts, verts[1:]):
        bm.edges.new((a, b))
    bm.to_mesh(mesh)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    screw = obj.modifiers.new('Turn', 'SCREW')
    screw.steps = 64
    screw.render_steps = 64
    screw.use_merge_vertices = True
    if thickness:
        obj.modifiers.new('Wall', 'SOLIDIFY').thickness = thickness
    return finish(obj, mat, subsurf=subsurf)


def tube(name, points, radius, mat):
    """A smooth bent pipe through the given points (steam wand, cup handle, rails)."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 6
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object, mat)


# ---------- the espresso machine ----------
def espresso_machine():
    """Front faces -Y in Blender (+Z after export). Origin at the floor, centred."""
    parts = []
    W, D = 1.24, 0.78
    # Feet, base plinth and drip tray with a slotted grate.
    for x in (-0.52, 0.52):
        for y in (-0.28, 0.28):
            parts.append(cylinder('Foot', 0.045, 0.04, (x, y, 0.02), 'rubber'))
    parts.append(box('Plinth', (W, D, 0.1), (0, 0, 0.09), 'dark', bevel=0.02))
    parts.append(box('Drip tray', (0.66, 0.32, 0.04), (0, -0.2, 0.158), 'polished', bevel=0.012))
    for i in range(11):
        parts.append(box('Grate slot', (0.018, 0.27, 0.006), (-0.25 + i * 0.05, -0.2, 0.181), 'dark', bevel=0.002, segments=1))
    # Back column and the main body, with brushed side panels set into it.
    parts.append(box('Column', (1.2, 0.36, 0.56), (0, 0.2, 0.42), 'polished', bevel=0.03))
    parts.append(box('Body', (W, D, 0.4), (0, 0, 0.9), 'polished', bevel=0.05, segments=5))
    for x in (-W / 2 - 0.001, W / 2 + 0.001):
        parts.append(box('Side panel', (0.006, D - 0.14, 0.28), (x, 0, 0.9), 'brushed', bevel=0.003))
    # Copper front plate with two gauges (bezel, face, glass, needle) and two knobs.
    parts.append(box('Front plate', (1.0, 0.012, 0.22), (0, -D / 2 - 0.004, 0.9), 'copper', bevel=0.006))
    for x, angle in ((-0.3, -0.7), (0.3, 0.4)):
        parts.append(cylinder('Gauge bezel', 0.08, 0.03, (x, -D / 2 - 0.02, 0.9), 'polished', rotation=(math.pi / 2, 0, 0)))
        parts.append(cylinder('Gauge face', 0.066, 0.004, (x, -D / 2 - 0.036, 0.9), 'face', rotation=(math.pi / 2, 0, 0), bevel=0))
        # The needle pivots at the gauge centre: built pointing right, then turned and fixed in place.
        needle = box('Gauge needle', (0.05, 0.004, 0.007), (x + 0.025, -D / 2 - 0.041, 0.9), 'needle', bevel=0)
        bpy.context.scene.cursor.location = (x, -D / 2 - 0.041, 0.9)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        needle.rotation_euler = (0, angle, 0)
        bpy.ops.object.transform_apply(rotation=True)
        parts.append(needle)
        parts.append(cylinder('Needle hub', 0.009, 0.008, (x, -D / 2 - 0.042, 0.9), 'dark', rotation=(math.pi / 2, 0, 0), vertices=16, bevel=0))
        parts.append(cylinder('Gauge glass', 0.068, 0.006, (x, -D / 2 - 0.042, 0.9), 'glass', rotation=(math.pi / 2, 0, 0), bevel=0.002))
    for x in (-0.53, 0.53):
        parts.append(cylinder('Knob', 0.045, 0.05, (x, -D / 2 - 0.025, 0.9), 'bakelite', rotation=(math.pi / 2, 0, 0), vertices=24))
    # Cup warmer rail on top, with posts.
    parts.append(tube('Rail', [(-0.55, -0.3, 1.13), (0, -0.3, 1.13), (0.55, -0.3, 1.13)], 0.012, 'polished'))
    for x in (-0.55, 0.55):
        parts.append(cylinder('Rail post', 0.012, 0.06, (x, -0.3, 1.1), 'polished', vertices=16))
    # Group head with its rings, the portafilter (basket, handle, grip) and two spouts.
    parts.append(cylinder('Group head', 0.11, 0.1, (0, -0.25, 0.65), 'polished', radius_top=0.1))
    for z in (0.62, 0.68):
        parts.append(torus('Group ring', 0.108, 0.006, (0, -0.25, z), 'polished'))
    parts.append(cylinder('Portafilter', 0.09, 0.06, (0, -0.25, 0.57), 'polished', radius_top=0.095))
    parts.append(tube('Portafilter arm', [(0, -0.33, 0.57), (0, -0.42, 0.565), (0, -0.48, 0.56)], 0.018, 'polished'))
    grip = cylinder('Portafilter grip', 0.03, 0.26, (0, -0.6, 0.55), 'bakelite', rotation=(math.pi / 2 - 0.1, 0, 0), vertices=24, radius_top=0.026)
    parts.append(grip)
    for x in (-0.025, 0.025):
        parts.append(cylinder('Spout', 0.013, 0.05, (x, -0.25, 0.515), 'polished', vertices=16, radius_top=0.009))
    # Steam wand bending down to the right, with its valve knob, and the hot water tap on the left.
    parts.append(tube('Steam wand', [(0.45, -0.32, 0.74), (0.47, -0.36, 0.62), (0.49, -0.37, 0.32)], 0.013, 'polished'))
    parts.append(cylinder('Steam valve', 0.035, 0.06, (0.45, -0.3, 0.77), 'bakelite', vertices=24))
    parts.append(tube('Water tap', [(-0.45, -0.32, 0.74), (-0.46, -0.35, 0.6), (-0.46, -0.35, 0.5)], 0.011, 'polished'))
    return parts


def cup():
    """An espresso cup on its saucer, with coffee and crema."""
    parts = [
        lathe('Saucer', [(0.0, 0.0), (0.12, 0.0), (0.16, 0.008), (0.19, 0.022)], 'ceramic', thickness=0.008),
        lathe('Cup', [(0.0, 0.012), (0.075, 0.012), (0.09, 0.03), (0.104, 0.1), (0.11, 0.14)], 'ceramic', location=(0, 0, 0.012), thickness=0.007),
        tube('Cup handle', [(0.1, 0, 0.13), (0.15, 0, 0.12), (0.155, 0, 0.07), (0.098, 0, 0.055)], 0.009, 'ceramic'),
        lathe('Coffee', [(0.0, 0.11), (0.098, 0.11)], 'crema', location=(0, 0, 0.012), subsurf=0),
    ]
    return parts


# ---------- baking and export ----------
def bake_occlusion(parts, name):
    """Bakes soft shadows in creases (ambient occlusion) into one texture per part, wired so the
    glTF exporter writes it as the occlusion map."""
    scene = bpy.context.scene
    for obj in parts:
        if obj.type != 'MESH':
            continue
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target='MESH')  # applies the bevels and smoothing
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(island_margin=0.02)
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in [o for o in parts if o.type == 'MESH']:
        mat = obj.data.materials[0].copy()
        obj.data.materials[0] = mat
        image = bpy.data.images.new(name + '-' + obj.name + '-ao', BAKE_SIZE // 2, BAKE_SIZE // 2)
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = image
        nodes.active = tex
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.bake(type='AO', margin=4)
        image.pack()
        # The glTF exporter reads occlusion from a node group called "glTF Material Output".
        group = bpy.data.node_groups.get('glTF Material Output') or gltf_output_group()
        out = nodes.new('ShaderNodeGroup')
        out.node_tree = group
        sep = nodes.new('ShaderNodeSeparateColor')
        links.new(tex.outputs['Color'], sep.inputs['Color'])
        links.new(sep.outputs['Red'], out.inputs['Occlusion'])
    scene.render.engine = 'CYCLES'


def gltf_output_group():
    group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    group.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    group.nodes.new('NodeGroupInput')
    return group


def export(parts, filename):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, filename), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_image_format='WEBP')
    print('wrote', os.path.join(OUT, filename))


def build(maker, filename):
    reset()
    materials()
    parts = maker()
    bake_occlusion(parts, filename.split('.')[0])
    export(parts, filename)


if __name__ == '__main__':
    build(espresso_machine, 'espresso-machine.glb')
    build(cup, 'espresso-cup.glb')
