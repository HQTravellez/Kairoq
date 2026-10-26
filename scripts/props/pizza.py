# Builds Kairoq's pizza props in Blender and exports them as web-ready GLB files:
# a wood-fired oven, a pizza, a peel and a takeaway box with a lid that opens.
#
# Run:  python scripts/props/pizza.py <output folder>   (a Python with the "bpy" module)
#
# Names matter: the story finds "Cheese" (to brown it while baking) and "Lid" (to close it,
# turning about its back edge) by name. Front faces the viewer (+Z in the exported file).
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import box, build, cylinder, finish, lathe, torus  # noqa: E402  (kit loads Blender first)
import bpy  # noqa: E402

PIZZA = {
    'plaster': dict(color='#c27a4c', roughness=0.9),
    'brick': dict(color='#9a4527', roughness=0.85),
    'brick_dark': dict(color='#7c3720', roughness=0.9),
    'stone': dict(color='#7b7068', roughness=0.85),
    'stone_dark': dict(color='#5f564f', roughness=0.9),
    'soot': dict(color='#1a110c', roughness=1),
    'iron': dict(color='#2b2b2d', metallic=0.8, roughness=0.45),
    'dough': dict(color='#e7c48c', roughness=0.8),
    'crust': dict(color='#cf9450', roughness=0.7),
    'sauce': dict(color='#b2321a', roughness=0.45),
    'cheese': dict(color='#f4e4b2', roughness=0.4, clearcoat=0.3),
    'pepperoni': dict(color='#9d2a19', roughness=0.4),
    'basil': dict(color='#3b7a28', roughness=0.5),
    'steel': dict(color='#cfd2d6', metallic=1, roughness=0.3),
    'wood': dict(color='#a8743f', roughness=0.6),
    'card': dict(color='#c79a62', roughness=0.85),
    'card_inside': dict(color='#ead5b0', roughness=0.9),
}


def dome_oven():
    """A wood-fired oven: stone-block base, plastered dome with a cut mouth, a brick arch made
    of real bricks, a brick ring at the foot of the dome, and a chimney with an iron cap."""
    parts = []
    # Stone base: a slab with a row of bevelled blocks across its front.
    parts.append(box('Base', (1.6, 1.3, 0.34), (0, 0, 0.17), 'stone', bevel=0.03))
    for i in range(6):
        parts.append(box('Base block', (0.255, 0.03, 0.15), (-0.66 + i * 0.265, -0.655, 0.25 - (i % 2) * 0.16), 'stone_dark', bevel=0.012))
    # The dome, smoothed, with the mouth cut out of its front.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.68, segments=64, ring_count=32, location=(0, 0, 0.34))
    dome = bpy.context.object
    dome.name = 'Dome'
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for v in dome.data.vertices:
        v.select = v.co.z < -0.001
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='VERT')
    bpy.ops.object.mode_set(mode='OBJECT')
    dome.modifiers.new('Wall', 'SOLIDIFY').thickness = 0.05
    cutter = cylinder('Mouth cutter', 0.3, 1.0, (0, -0.6, 0.34), 'soot', rotation=(math.pi / 2, 0, 0), vertices=48, bevel=0)
    cut = dome.modifiers.new('Mouth', 'BOOLEAN')
    cut.object = cutter
    cut.operation = 'DIFFERENCE'
    bpy.context.view_layer.objects.active = dome
    for mod in list(dome.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    parts.append(finish(dome, 'plaster'))
    # Inside floor (dark, sooty) so the opening shows depth.
    parts.append(cylinder('Oven floor', 0.62, 0.01, (0, 0, 0.345), 'soot', bevel=0))
    # Brick arch: 13 wedge-shaped bricks around the mouth, then a brick ring at the dome's foot.
    for k in range(13):
        a = math.pi * k / 12
        b = box('Arch brick', (0.07, 0.12, 0.11), (math.cos(a) * 0.36, -0.62, 0.34 + math.sin(a) * 0.36), 'brick' if k % 2 else 'brick_dark', bevel=0.01)
        b.rotation_euler = (0, -a + math.pi / 2, 0)
        parts.append(b)
    for k in range(28):
        a = math.pi * 2 * k / 28
        if abs(math.atan2(math.sin(a), math.cos(a)) + math.pi / 2) < 0.5:
            continue  # leave the mouth open
        b = box('Ring brick', (0.15, 0.08, 0.07), (math.cos(a) * 0.7, math.sin(a) * 0.7, 0.38), 'brick' if k % 2 else 'brick_dark', bevel=0.008)
        b.rotation_euler = (0, 0, a + math.pi / 2)
        parts.append(b)
    # Chimney with an iron cap.
    parts.append(cylinder('Chimney', 0.1, 0.42, (0, 0.18, 1.0), 'brick', vertices=32, radius_top=0.09))
    parts.append(cylinder('Chimney cap', 0.14, 0.03, (0, 0.18, 1.23), 'iron', vertices=32, radius_top=0.08))
    return parts


def pizza():
    """A Neapolitan-style pizza: soft dough, puffed crust, sauce, cheese pools, pepperoni, basil."""
    parts = [
        cylinder('Dough', 0.215, 0.018, (0, 0, 0.009), 'dough', vertices=64, bevel=0.008),
        torus('Crust', 0.2, 0.024, (0, 0, 0.022), 'crust'),
        cylinder('Sauce', 0.19, 0.006, (0, 0, 0.021), 'sauce', vertices=64, bevel=0.002),
    ]
    cheese = cylinder('Cheese', 0.17, 0.008, (0, 0, 0.026), 'cheese', vertices=64, bevel=0.003)
    sub = cheese.modifiers.new('Melt', 'DISPLACE')
    tex = bpy.data.textures.new('Melt', 'CLOUDS')
    tex.noise_scale = 0.06
    sub.texture = tex
    sub.strength = 0.006
    parts.append(cheese)
    for k, (r, a) in enumerate([(0.12, 0.2), (0.12, 1.45), (0.12, 2.7), (0.12, 3.95), (0.12, 5.2), (0.0, 0.0)]):
        parts.append(cylinder('Pepperoni', 0.032, 0.007, (math.cos(a) * r, math.sin(a) * r, 0.032), 'pepperoni', vertices=32, bevel=0.002))
    for a in (0.8, 2.1, 3.3, 4.6, 5.8):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(math.cos(a) * 0.065, math.sin(a) * 0.065, 0.034))
        leaf = bpy.context.object
        leaf.name = 'Basil'
        leaf.scale = (1.0, 0.55, 0.12)
        leaf.rotation_euler = (0, 0, a)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        parts.append(finish(leaf, 'basil'))
    return parts


def peel():
    """A pizza peel: thin steel blade with a rolled edge, riveted to a long wooden handle that
    points towards the viewer."""
    return [
        box('Blade', (0.48, 0.5, 0.008), (0, 0, 0.004), 'steel', bevel=0.003),
        box('Blade collar', (0.1, 0.08, 0.02), (0, -0.27, 0.012), 'steel', bevel=0.005),
        cylinder('Handle', 0.02, 0.75, (0, -0.68, 0.03), 'wood', rotation=(math.pi / 2 - 0.06, 0, 0), vertices=24, radius_top=0.022),
    ]


def pizza_box():
    """A takeaway box: base with walls, and a lid named "Lid" that turns about its back edge."""
    w, d, t, wall = 0.52, 0.52, 0.008, 0.06
    parts = [box('Box floor', (w, d, t), (0, 0, t / 2), 'card_inside', bevel=0.002)]
    for x, y, sx, sy in ((0, d / 2, w, t), (0, -d / 2, w, t), (w / 2, 0, t, d), (-w / 2, 0, t, d)):
        parts.append(box('Box wall', (sx, sy, wall), (x, y, wall / 2), 'card', bevel=0.002))
    lid = box('Lid', (w + 0.01, d + 0.01, t), (0, 0, wall + t / 2), 'card', bevel=0.002)
    # The lid's pivot is its back edge, so the story can open and close it.
    bpy.context.scene.cursor.location = (0, d / 2, wall)
    bpy.ops.object.select_all(action='DESELECT')
    lid.select_set(True)
    bpy.context.view_layer.objects.active = lid
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    parts.append(lid)
    return parts


if __name__ == '__main__':
    build(dome_oven, 'pizza-oven.glb', PIZZA)
    build(pizza, 'pizza.glb', PIZZA)
    build(peel, 'pizza-peel.glb', PIZZA)
    build(pizza_box, 'pizza-box.glb', PIZZA)
