"""S3 — "we help businesses GROW online": glossy F&F-blue 3D growth arrows shooting up diagonally.
Transparent background (composited BEHIND the speaker, ref07 style). 60 fps, 120 frames.
Run: FAST=1 python3 s3_arrows.py <out_dir> [first last]
"""
import math, sys
sys.path.insert(0, "../../../presets")
import bpy
import blender_kit as K

N = 120
sc = K.reset(N)
sc.render.film_transparent = True
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.65, 0.9, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
K.sun(rot=(35, 10, 30), energy=3.5, angle=4)
K.area((-6, -8, 10), (0, 0, 0), energy=1200, size=8, color=(0.8, 0.9, 1.0))

blue = K.mat("arrowblue", (0.03, 0.22, 1.0), 0.18, metal=0.15)
blue_l = K.mat("arrowlight", (0.25, 0.55, 1.0), 0.2, emit=0.6)


def arrow(name, length, width, mat):
    """Arrow pointing +X: shaft box + triangular head, extruded."""
    bpy.ops.object.empty_add(location=(0, 0, 0)); root = bpy.context.object; root.name = name
    shaft = K.rbox(name + "_s", (length, width * 0.6, width * 0.45), (length / 2, 0, 0), mat, bevel=0.12)
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=width * 1.05, depth=width * 0.45, location=(length + width * 0.45, 0, 0))
    head = bpy.context.object; head.name = name + "_h"; head.rotation_euler = (0, 0, math.radians(-90))
    head.scale = (1, 1.1, 1); head.data.materials.append(mat)
    b = head.modifiers.new("b", "BEVEL"); b.width = 0.05; b.segments = 3
    for o in (shaft, head):
        o.parent = root
    return root


# three arrows at staggered depths, all rising up-right at ~45 degrees
specs = [  # (start loc, end loc, length, width, mat, f0, f1)
    ((-30, 6, -30), (8, 6, 8), 26, 4.2, blue, 1, 75),
    ((-26, 14, -36), (10, 14, 0), 20, 3.2, blue_l, 18, 100),
    ((-34, -4, -40), (-4, -4, -10), 18, 3.0, blue, 34, 120),
]
for i, (a, b, L, Wd, m, f0, f1) in enumerate(specs):
    r = arrow(f"arrow{i}", L, Wd, m)
    r.rotation_euler = (math.radians(90), math.radians(-42), 0)
    K.key(r, f0, location=a); K.key(r, f1, location=b)
    K.key(r, f0, scale=(0.6, 0.6, 0.6)); K.key(r, f0 + 15, scale=(1, 1, 1))

cam = K.camera(lens=35)
cam.location = (0, -40, 0); cam.rotation_euler = (math.radians(90), 0, 0)
K.ease_all()
# arrows should fly with constant speed after the start (linear), not ease-in-out
for a in bpy.data.actions:
    for layer in getattr(a, "layers", []):
        for strip in layer.strips:
            for cb in strip.channelbags:
                for fc in cb.fcurves:
                    if fc.data_path == "location":
                        for kp in fc.keyframe_points:
                            kp.interpolation = "LINEAR"

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "renders/s3"
    rng = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else None
    K.render(out, rng)
