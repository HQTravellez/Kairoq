# Builds Kairoq's espresso machine and cup in Blender and exports them as web-ready GLB files.
#
# Run:  python scripts/props/espresso.py <output folder>   (a Python with the "bpy" module)
#
# Separate parts (body, group head, portafilter, gauges, steam wand, drip tray, cup, saucer) in
# polished and brushed steel, copper, black bakelite, glass and glazed ceramic. Front faces the
# viewer (+Z in the exported file); the origin is on the floor, centred.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import box, build, cylinder, lathe, tube, torus  # noqa: E402  (kit loads Blender first)
import bpy  # noqa: E402

ESPRESSO = {
    'polished': dict(color='#e4e7ea', metallic=0.85, roughness=0.3),
    'brushed': dict(color='#cfd3d8', metallic=0.85, roughness=0.42),
    'dark': dict(color='#2a2c30', metallic=0.85, roughness=0.32),
    'bakelite': dict(color='#121212', roughness=0.38, clearcoat=0.4),
    'rubber': dict(color='#0d0d0d', roughness=0.8),
    'copper': dict(color='#c8845a', metallic=0.75, roughness=0.38),
    'face': dict(color='#f3eee4', roughness=0.4),
    'glass': dict(color='#ffffff', roughness=0.04, transmission=1),
    'needle': dict(color='#b3261e', roughness=0.4),
    'ceramic': dict(color='#f6f3ee', roughness=0.12, clearcoat=1),
}


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
    """An empty espresso cup on its saucer (the story fills it with coffee as it plays)."""
    parts = [
        lathe('Saucer', [(0.0, 0.0), (0.12, 0.0), (0.16, 0.008), (0.19, 0.022)], 'ceramic', thickness=0.008),
        lathe('Cup', [(0.0, 0.012), (0.075, 0.012), (0.09, 0.03), (0.104, 0.1), (0.11, 0.14)], 'ceramic', location=(0, 0, 0.012), thickness=0.007),
        tube('Cup handle', [(0.1, 0, 0.13), (0.15, 0, 0.12), (0.155, 0, 0.07), (0.098, 0, 0.055)], 0.009, 'ceramic'),
    ]
    return parts


if __name__ == '__main__':
    build(espresso_machine, 'espresso-machine.glb', ESPRESSO)
    build(cup, 'espresso-cup.glb', ESPRESSO)
