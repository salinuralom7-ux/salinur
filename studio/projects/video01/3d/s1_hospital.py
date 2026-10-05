"""S1 — "you have a HOSPITAL in your town".
Floating diorama on the brand backdrop: platform pops in, hospital grows out of it,
red cross pops on the roof, camera glides round. 60 fps, 150 frames (2.5 s).
Run: python3 s1_hospital.py <out_dir> [first last]
"""
import math, random, sys
sys.path.insert(0, "../../../presets")
import bpy
import blender_kit as K

FONT = "../../../assets/fonts/Poppins-800.ttf"
N = 150
sc = K.reset(N)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.42, 0.55, 0.85, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
K.sun(rot=(42, 8, 38), energy=4.5, angle=3, color=(1.0, 0.95, 0.86))

white = K.mat("white", (0.88, 0.90, 0.94), 0.4)
glass = K.mat("glass", (0.10, 0.38, 0.95), 0.12, metal=0.2)
glass_lit = K.mat("glass_lit", (0.35, 0.65, 1.0), 0.2, emit=1.2)
navy = K.mat("navy", K.NAVY, 0.35)
blue = K.mat("blue", K.BLUE, 0.3)
red = K.mat("red", (0.90, 0.02, 0.03), 0.3, emit=0.6)
grass = K.mat("grass", (0.13, 0.52, 0.20), 0.85)
road = K.mat("road", (0.07, 0.075, 0.09), 0.7)
paint = K.mat("paint", (0.95, 0.95, 0.92), 0.5)
plaza = K.mat("plaza", (0.72, 0.73, 0.78), 0.7)
trunk = K.mat("trunk", (0.32, 0.18, 0.09), 0.8)
leaf = K.mat("leaf", (0.10, 0.45, 0.16), 0.6)
leaf2 = K.mat("leaf2", (0.25, 0.60, 0.15), 0.6)

world_root = K.empty("world_root", (0, 0, 0))
dio = []
dio.append(K.platform(12.5, 1.8, top_mat=grass, side_color=(0.86, 0.88, 0.93)))
dio.append(bpy.data.objects["platform_top"])
dio.append(K.rbox("road", (25.5, 3.6, 0.08), (0, -7.0, 0.08), road, bevel=0.02))
for x in range(-10, 11, 3):
    dio.append(K.rbox(f"dash{x}", (1.3, 0.16, 0.05), (x, -7.0, 0.13), paint, bevel=0.01))
dio.append(K.rbox("plaza", (12, 4.0, 0.12), (0, -3.4, 0.1), plaza, bevel=0.04))
random.seed(7)
for i, (x, y) in enumerate([(-9.5, 1.5), (-9.0, -2.8), (9.3, -2.6), (9.6, 2.0), (-6.5, 7.6), (6.8, 7.4), (-2.0, 9.5), (3.0, 9.2)]):
    s = random.uniform(0.85, 1.25)
    dio.append(K.cyl(f"tr{i}", 0.16 * s, 1.4 * s, (x, y, 0.7 * s), trunk, verts=16))
    dio.append(K.sphere(f"lf{i}", 1.0 * s, (x, y, 1.9 * s), leaf if i % 2 else leaf2, scale=(1, 1, 1.2)))
for o in dio:
    o.parent = world_root

# Hospital (grows from the plaza)
bld = K.empty("bld", (0, 1, 0)); bld.parent = world_root
parts = [
    K.rbox("main", (7, 4.6, 6.4), (0, 0, 3.2), white, bevel=0.14),
    K.rbox("stripe", (7.05, 4.65, 0.32), (0, 0, 5.75), blue, bevel=0.05),
    K.rbox("canopy", (3.8, 1.7, 0.22), (0, -2.9, 2.2), blue, bevel=0.06),
    K.rbox("door", (2.2, 0.12, 1.9), (0, -2.33, 0.95), glass, bevel=0.03),
    K.rbox("signpanel", (4.6, 0.14, 1.0), (0, -2.36, 5.05), blue, bevel=0.06),
    K.text("sign", "HOSPITAL", (0, -2.47, 5.05), 0.78, K.mat("signtxt", (1, 1, 1), 0.4, emit=0.4), FONT, extrude=0.05),
]
for side in (-1, 1):
    parts.append(K.rbox(f"wing{side}", (3.6, 4.0, 4.2), (side * 5.3, 0.3, 2.1), white, bevel=0.14))
    for r in range(2):
        for c in range(2):
            parts.append(K.rbox(f"ww{side}{r}{c}", (1.0, 0.1, 0.9), (side * 5.3 + (c - 0.5) * 1.5, -1.73, 1.5 + r * 1.6), glass_lit if (r + c + side) % 2 else glass, bevel=0.03))
for r in range(2):
    for c in range(4):
        if r == 0 and c in (1, 2):
            continue  # canopy / door zone
        parts.append(K.rbox(f"w{r}{c}", (1.05, 0.1, 1.0), ((c - 1.5) * 1.6, -2.33, 2.9 + r * 1.45), glass_lit if (r * 4 + c) % 3 else glass, bevel=0.03))
for sx in (-1.6, 1.6):
    parts.append(K.cyl(f"pillar{sx}", 0.11, 2.1, (sx, -3.5, 1.05), white))
for p in parts:
    p.parent = bld

cross = K.empty("cross", (0, 1, 6.45)); cross.parent = world_root
for o in (K.rbox("c1", (0.65, 0.35, 1.9), (0, 0, 1.25), red, bevel=0.08),
          K.rbox("c2", (1.9, 0.35, 0.65), (0, 0, 1.25), red, bevel=0.08),
          K.rbox("cb", (2.3, 0.6, 0.22), (0, 0, 0.1), white, bevel=0.05)):
    o.parent = cross

# --- animation (60 fps). Back-ease pops = key to overshoot then settle.
K.key(world_root, 1, scale=(0.55, 0.55, 0.55)); K.key(world_root, 16, scale=(1.03, 1.03, 1.03)); K.key(world_root, 26, scale=(1, 1, 1))
K.key(bld, 6, scale=(1, 1, 0.01)); K.key(bld, 26, scale=(1, 1, 1.07)); K.key(bld, 36, scale=(1, 1, 1))
K.key(cross, 24, scale=(0, 0, 0)); K.key(cross, 36, scale=(1.2, 1.2, 1.2)); K.key(cross, 44, scale=(1, 1, 1))
K.key(cross, 44, rotation_euler=(0, 0, 0)); K.key(cross, N, rotation_euler=(0, 0, math.radians(30)))

target = K.empty("target", (0, 0, 2.5))
rig = K.empty("rig", (0, 0, 0))
cam = K.camera(lens=50, fstop=5.6, focus=target)
cam.parent = rig
con = cam.constraints.new("TRACK_TO"); con.target = target; con.track_axis = "TRACK_NEGATIVE_Z"; con.up_axis = "UP_Y"
K.key(rig, 1, rotation_euler=(0, 0, math.radians(-32))); K.key(rig, N, rotation_euler=(0, 0, math.radians(8)))
K.key(cam, 1, location=(0, -52, 20)); K.key(cam, N, location=(0, -43, 14))
K.key(target, 1, location=(0, 0, 1.0)); K.key(target, N, location=(0, 0, 2.8))
K.backdrop(cam)
K.ease_all()

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "renders/s1"
    rng = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else None
    K.render(out, rng)
