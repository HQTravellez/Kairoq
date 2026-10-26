# Shared tools for Kairoq's Blender prop scripts (espresso.py, pizza.py): materials, modelling
# helpers (bevelled boxes, lathed shapes, bent tubes), soft-shadow baking and GLB export.
# Every prop is built the way a 3D artist would: bevelled edges, smooth surfaces, real material
# values, and ambient occlusion baked into each part's texture so it looks solid in the browser.
import math
import os
import sys

import bpy  # must come first: it makes bmesh importable
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
    # Bake the size into the mesh but keep the position, so the part can still be turned in place.
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
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
    # A profile drawn bottom to top faces inwards once turned; a single surface (no wall) is
    # flipped so it faces out and lights correctly.
    screw.use_normal_flip = not thickness
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


# ---------- baking and export ----------
def bake_occlusion(parts, name):
    """Bakes soft shadows in creases (ambient occlusion) into one texture per part, wired so the
    glTF exporter writes it as the occlusion map."""
    scene = bpy.context.scene
    # A part marked keep_uv (a phone or laptop screen) keeps its own 0..1 UVs, so the app's
    # screenshot fills it exactly, and gets no shadow bake.
    parts_to_bake = [o for o in parts if o.type == 'MESH' and not o.get('keep_uv')]
    for obj in parts:
        if obj.type != 'MESH' or obj.get('keep_uv'):
            continue
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target='MESH')  # applies the bevels and smoothing
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(island_margin=0.02)
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in parts_to_bake:
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


def screen(name, width, height, location, rotation=(0, 0, 0)):
    """A flat screen with 0..1 UVs (the app's screenshot is shown on it in the browser)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (width, height, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj['keep_uv'] = True
    return finish(obj, 'screen', smooth=False)


def build(maker, filename, palette):
    """Builds one prop with the given materials and writes it as a GLB file."""
    reset()
    MATERIALS.clear()
    MATERIALS.update({name: material(name, **spec) for name, spec in palette.items()})
    parts = maker()
    bake_occlusion(parts, filename.split('.')[0])
    export(parts, filename)


