# Builds Kairoq's starter hero objects for kairoq/hero3d and exports them as web-ready GLB files.
#
# Run:  python scripts/props/hero.py <output folder>   (a Python with the "bpy" module)
#
# Each object stands on the floor at the origin, about one unit tall, front facing the viewer.
# Parts made of the "brand" or "accent" material take each app's own colours in the browser
# (kairoq/hero3d recolours them from the design tokens); "Screen" parts show the app's screenshot.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import box, build, cylinder, lathe, screen, torus, tube  # noqa: E402  (kit loads Blender first)

HERO = {
    'brand': dict(color='#4f46e5', roughness=0.32, clearcoat=0.6),
    'accent': dict(color='#f59e0b', roughness=0.35, clearcoat=0.4),
    'shell': dict(color='#f4f1ec', roughness=0.38, clearcoat=0.3),
    'dark': dict(color='#1f2024', roughness=0.45),
    'rubber': dict(color='#111214', roughness=0.85),
    'chrome': dict(color='#e6e8eb', metallic=1, roughness=0.22),
    'brass': dict(color='#d4a64a', metallic=1, roughness=0.28),
    'glass': dict(color='#cfe3ee', roughness=0.05, transmission=0.85),
    'wall': dict(color='#f1ebe1', roughness=0.7),
    'trim': dict(color='#ffffff', roughness=0.45),
    'paper': dict(color='#f3ece0', roughness=0.8),
    'grass': dict(color='#86b06a', roughness=0.9),
    'screen': dict(color='#0b0c0f', roughness=0.3),
}


def suitcase():
    """A spinner suitcase: ribbed shell, telescopic handle, carry handle and four wheels."""
    parts = [box('Shell', (0.62, 0.3, 0.82), (0, 0, 0.5), 'brand', bevel=0.07, segments=6)]
    for x in (-0.18, 0, 0.18):
        parts.append(box('Rib', (0.06, 0.012, 0.7), (x, -0.153, 0.5), 'brand', bevel=0.005))
    parts.append(box('Zip band', (0.64, 0.025, 0.84), (0, 0, 0.5), 'dark', bevel=0.012))
    for x in (-0.26, 0.26):
        for z in (0.11, 0.89):
            parts.append(box('Corner guard', (0.1, 0.32, 0.06), (x, 0, z), 'dark', bevel=0.02))
    for x in (-0.13, 0.13):
        parts.append(cylinder('Handle post', 0.014, 0.28, (x, 0.09, 1.04), 'chrome', vertices=24))
    parts.append(box('Handle grip', (0.34, 0.045, 0.045), (0, 0.09, 1.18), 'dark', bevel=0.018))
    parts.append(tube('Carry handle', [(-0.1, -0.02, 0.91), (-0.06, -0.02, 0.96), (0.06, -0.02, 0.96), (0.1, -0.02, 0.91)], 0.016, 'dark'))
    for x in (-0.24, 0.24):
        for y in (-0.1, 0.1):
            parts.append(box('Caster', (0.06, 0.06, 0.05), (x, y, 0.075), 'dark', bevel=0.012))
            parts.append(cylinder('Wheel', 0.035, 0.03, (x, y, 0.035), 'rubber', rotation=(0, math.pi / 2, 0), vertices=24))
    return parts


def house():
    """A small modern house on a lawn: walls, gable roof in the brand colour, windows, door."""
    parts = [box('Lawn', (1.3, 1.0, 0.06), (0, 0, 0.03), 'grass', bevel=0.03)]
    parts.append(box('Walls', (0.8, 0.62, 0.5), (0, 0, 0.31), 'wall', bevel=0.012))
    pitch = math.radians(32)
    half = 0.34 / math.cos(pitch) + 0.06
    for side in (-1, 1):
        roof = box('Roof', (half, 0.74, 0.04), (side * 0.2, 0, 0.66), 'brand', bevel=0.012)
        roof.rotation_euler = (0, side * pitch, 0)
        parts.append(roof)
    parts.append(box('Gable', (0.78, 0.6, 0.02), (0, 0, 0.58), 'wall', bevel=0))
    parts.append(box('Chimney', (0.09, 0.09, 0.2), (0.22, 0.12, 0.78), 'dark', bevel=0.01))
    parts.append(box('Door', (0.14, 0.02, 0.26), (0.18, -0.315, 0.19), 'accent', bevel=0.008))
    parts.append(cylinder('Knob', 0.009, 0.02, (0.22, -0.33, 0.19), 'brass', rotation=(math.pi / 2, 0, 0), vertices=16))
    parts.append(box('Step', (0.22, 0.08, 0.03), (0.18, -0.36, 0.075), 'trim', bevel=0.008))
    for x, z in ((-0.26, 0.34), (-0.03, 0.34)):
        parts.append(box('Window frame', (0.17, 0.025, 0.18), (x, -0.31, z), 'trim', bevel=0.006))
        parts.append(box('Window', (0.13, 0.03, 0.14), (x, -0.312, z), 'glass', bevel=0.004))
    for y in (-0.15, 0.15):
        parts.append(box('Side window', (0.025, 0.14, 0.14), (0.405, y, 0.34), 'glass', bevel=0.004))
    for x in (-0.48, 0.5):
        parts.append(lathe('Shrub', [(0, 0.06), (0.07, 0.08), (0.09, 0.14), (0.06, 0.2), (0, 0.22)], 'grass', location=(x, -0.28, 0)))
    return parts


def key():
    """A house key with a brand-coloured tag, standing up as if held."""
    parts = [torus('Bow', 0.11, 0.028, (0, 0, 0.8), 'brass', rotation=(math.pi / 2, 0, 0))]
    parts.append(cylinder('Collar', 0.035, 0.06, (0, 0, 0.66), 'brass', vertices=32))
    parts.append(cylinder('Blade', 0.022, 0.5, (0, 0, 0.38), 'brass', vertices=24))
    for z, w in ((0.24, 0.07), (0.18, 0.05), (0.14, 0.08)):
        parts.append(box('Bit', (w, 0.02, 0.035), (w / 2 + 0.015, 0, z), 'brass', bevel=0.004))
    parts.append(torus('Ring', 0.07, 0.008, (-0.1, 0, 0.94), 'chrome', rotation=(0, math.pi / 2.4, 0)))
    tag = box('Tag', (0.16, 0.02, 0.22), (-0.2, 0, 1.06), 'brand', bevel=0.03, segments=6)
    tag.rotation_euler = (0, math.radians(-14), 0)
    parts.append(tag)
    return parts


def shopping_bag():
    """A paper shopping bag in the brand colour with rope handles and a folded rim."""
    parts = [box('Bag', (0.6, 0.26, 0.7), (0, 0, 0.36), 'brand', bevel=0.012)]
    parts.append(box('Rim', (0.61, 0.27, 0.06), (0, 0, 0.69), 'brand', bevel=0.008))
    parts.append(box('Label', (0.24, 0.006, 0.12), (0, -0.133, 0.42), 'paper', bevel=0.004))
    for y in (-0.11, 0.11):
        parts.append(tube('Handle', [(-0.12, y, 0.66), (-0.1, y, 0.82), (0, y, 0.88), (0.1, y, 0.82), (0.12, y, 0.66)], 0.011, 'accent'))
    return parts


def plane():
    """An airliner in flight pose: white body, brand tail and stripe, engines, windows."""
    parts = []
    body = lathe('Fuselage', [(0, -0.62), (0.05, -0.6), (0.085, -0.5), (0.095, -0.3), (0.095, 0.35), (0.07, 0.52), (0.03, 0.62), (0, 0.64)], 'shell', location=(0, 0, 0.5))
    body.rotation_euler = (math.pi / 2, 0, 0)
    parts.append(body)
    for side in (-1, 1):
        wing = box('Wing', (0.62, 0.2, 0.025), (side * 0.36, 0.0, 0.46), 'shell', bevel=0.01)
        wing.rotation_euler = (0, side * math.radians(-5), side * math.radians(-18))
        parts.append(wing)
        parts.append(cylinder('Engine', 0.045, 0.16, (side * 0.27, -0.05, 0.42), 'brand', rotation=(math.pi / 2, 0, 0), vertices=32, radius_top=0.04))
        stab = box('Stabiliser', (0.24, 0.1, 0.02), (side * 0.13, 0.52, 0.53), 'shell', bevel=0.006)
        stab.rotation_euler = (0, 0, side * math.radians(-22))
        parts.append(stab)
    fin = box('Tail', (0.02, 0.2, 0.22), (0, 0.5, 0.66), 'brand', bevel=0.008)
    fin.rotation_euler = (math.radians(-28), 0, 0)
    parts.append(fin)
    for i in range(9):
        y = -0.36 + i * 0.075
        for side in (-1, 1):
            parts.append(box('Window', (0.012, 0.03, 0.022), (side * 0.092, y, 0.53), 'dark', bevel=0.004))
    parts.append(box('Cockpit', (0.11, 0.04, 0.03), (0, -0.55, 0.535), 'dark', bevel=0.01))
    return parts


def gift_box():
    """A gift: box and lid in the brand colour, crossing ribbons and a bow."""
    parts = [box('Box', (0.6, 0.6, 0.5), (0, 0, 0.25), 'brand', bevel=0.015)]
    parts.append(box('Lid', (0.64, 0.64, 0.12), (0, 0, 0.54), 'brand', bevel=0.02))
    for rot in (0, math.pi / 2):
        ribbon = box('Ribbon', (0.08, 0.652, 0.62), (0, 0, 0.31), 'accent', bevel=0.004)
        ribbon.rotation_euler = (0, 0, rot)
        parts.append(ribbon)
    for side in (-1, 1):
        loop = torus('Bow loop', 0.09, 0.03, (side * 0.09, 0, 0.66), 'accent', rotation=(math.pi / 2, side * 0.6, 0))
        loop.scale = (1, 1, 0.55)
        parts.append(loop)
    parts.append(lathe('Knot', [(0, 0.6), (0.045, 0.62), (0.05, 0.66), (0.03, 0.69), (0, 0.7)], 'accent'))
    return parts


def dumbbell():
    """A dumbbell resting on its plates: knurled chrome handle, brand-coloured plates."""
    parts = [cylinder('Handle', 0.03, 0.5, (0, 0, 0.13), 'chrome', rotation=(0, math.pi / 2, 0), vertices=32)]
    for side in (-1, 1):
        parts.append(cylinder('Plate', 0.13, 0.07, (side * 0.3, 0, 0.13), 'brand', rotation=(0, math.pi / 2, 0), vertices=64))
        parts.append(cylinder('Plate rim', 0.11, 0.05, (side * 0.37, 0, 0.13), 'dark', rotation=(0, math.pi / 2, 0), vertices=64))
        parts.append(cylinder('Collar', 0.045, 0.04, (side * 0.22, 0, 0.13), 'chrome', rotation=(0, math.pi / 2, 0), vertices=32))
    for i in range(7):
        parts.append(torus('Knurl', 0.031, 0.003, (-0.12 + i * 0.04, 0, 0.13), 'dark', rotation=(0, math.pi / 2, 0)))
    return parts


def phone():
    """A phone standing upright; its "Screen" shows the app's screenshot."""
    parts = [box('Body', (0.42, 0.04, 0.88), (0, 0, 0.44), 'dark', bevel=0.06, segments=8)]
    parts.append(box('Frame', (0.43, 0.03, 0.89), (0, 0, 0.44), 'chrome', bevel=0.062, segments=8))
    parts.append(screen('Screen', 0.39, 0.85, (0, -0.0225, 0.44), rotation=(math.pi / 2, 0, 0)))
    parts.append(box('Island', (0.1, 0.004, 0.028), (0, -0.025, 0.83), 'rubber', bevel=0.012))
    return parts


def laptop():
    """An open laptop; its "Screen" shows the app's screenshot."""
    parts = [box('Base', (1.0, 0.68, 0.035), (0, 0, 0.018), 'chrome', bevel=0.02, segments=4)]
    parts.append(box('Keyboard', (0.86, 0.3, 0.004), (0, -0.04, 0.037), 'dark', bevel=0.004))
    parts.append(box('Trackpad', (0.34, 0.2, 0.003), (0, 0.22 - 0.48, 0.037), 'chrome', bevel=0.01))
    tilt = math.radians(-12)
    lid = box('Lid', (1.0, 0.025, 0.66), (0, 0.33, 0.36), 'chrome', bevel=0.02, segments=4)
    lid.rotation_euler = (tilt, 0, 0)
    parts.append(lid)
    bezel = box('Bezel', (0.98, 0.006, 0.64), (0, 0.317, 0.36), 'dark', bevel=0.012)
    bezel.rotation_euler = (tilt, 0, 0)
    parts.append(bezel)
    # The screen sits just in front of the bezel, turned with the lid.
    cy, cz = 0.33 - 0.0175 * math.cos(tilt), 0.36 + 0.0175 * math.sin(tilt)
    parts.append(screen('Screen', 0.92, 0.575, (0, cy - 0.001, cz), rotation=(math.pi / 2 + tilt, 0, 0)))
    return parts


OBJECTS = {
    'suitcase': suitcase, 'house': house, 'key': key, 'shopping-bag': shopping_bag, 'plane': plane,
    'gift-box': gift_box, 'dumbbell': dumbbell, 'phone': phone, 'laptop': laptop,
}

if __name__ == '__main__':
    only = os.environ.get('ONLY')
    for name, maker in OBJECTS.items():
        if not only or name in only.split(','):
            build(maker, 'hero-' + name + '.glb', HERO)
