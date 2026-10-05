"""S2 — "Dr. Pandey comes to your town, opens a small clinic ... starts making video every day".
Same diorama language as S1 (continuity). Shot A (frames 1-160): wide, clinic pops in, sign lights up.
Shot B (frames 161-300): camera pushes in to the tripod camera, REC light blinks.
Run: python3 s2_clinic.py <out_dir> [first last]
"""
import math, random, sys
sys.path.insert(0, "../../../presets")
import bpy
import blender_kit as K

FONT = "../../../assets/fonts/Poppins-800.ttf"
N = 300
sc = K.reset(N)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.42, 0.55, 0.85, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
K.sun(rot=(40, 6, -30), energy=4.5, angle=3, color=(1.0, 0.95, 0.86))

white = K.mat("white", (0.88, 0.90, 0.94), 0.4)
cream = K.mat("cream", (0.93, 0.86, 0.72), 0.5)
teal = K.mat("teal", (0.02, 0.45, 0.42), 0.4)
glass = K.mat("glass", (0.10, 0.38, 0.95), 0.12, metal=0.2)
blue = K.mat("blue", K.BLUE, 0.3)
red = K.mat("red", (0.90, 0.02, 0.03), 0.3, emit=0.6)
grass = K.mat("grass", (0.13, 0.52, 0.20), 0.85)
road = K.mat("road", (0.07, 0.075, 0.09), 0.7)
paint = K.mat("paint", (0.95, 0.95, 0.92), 0.5)
pave = K.mat("pave", (0.70, 0.70, 0.74), 0.7)
black = K.mat("black", (0.02, 0.02, 0.025), 0.35, metal=0.4)
lensg = K.mat("lens", (0.05, 0.08, 0.15), 0.05, metal=0.6)
rec = K.mat("rec", (0.25, 0.0, 0.0), 0.3, emit=0.0)
rec.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1.0, 0.02, 0.02, 1)
ring = K.mat("ring", (1.0, 0.97, 0.9), 0.3, emit=4.0)
trunk = K.mat("trunk", (0.32, 0.18, 0.09), 0.8)
leaf = K.mat("leaf", (0.10, 0.45, 0.16), 0.6)
signmat = K.mat("signtxt", (1, 1, 1), 0.4, emit=0.4)

root = K.empty("root", (0, 0, 0))
d = [K.platform(11, 1.6, top_mat=grass, side_color=(0.86, 0.88, 0.93)), bpy.data.objects["platform_top"],
     K.rbox("road", (21.5, 3.4, 0.08), (0, -6.2, 0.08), road, bevel=0.02),
     K.rbox("pave", (10, 3.6, 0.12), (0, -2.8, 0.1), pave, bevel=0.04)]
for x in range(-9, 10, 3):
    d.append(K.rbox(f"dash{x}", (1.2, 0.15, 0.05), (x, -6.2, 0.13), paint, bevel=0.01))
for i, (x, y) in enumerate([(-7.5, 1.0), (7.6, 0.8), (-5, 6.5), (5.5, 6.2)]):
    d.append(K.cyl(f"tr{i}", 0.15, 1.3, (x, y, 0.65), trunk, verts=16)); d.append(K.sphere(f"lf{i}", 0.95, (x, y, 1.75), leaf, scale=(1, 1, 1.2)))
for o in d:
    o.parent = root

clinic = K.empty("clinic", (0, 0.8, 0)); clinic.parent = root
cp = [K.rbox("body", (6, 4, 3.6), (0, 0, 1.8), cream, bevel=0.12),
      K.rbox("roof", (6.4, 4.4, 0.3), (0, 0, 3.7), teal, bevel=0.08),
      K.rbox("door", (1.4, 0.12, 2.1), (-1.6, -2.03, 1.05), glass, bevel=0.03),
      K.rbox("win", (2.4, 0.12, 1.4), (1.3, -2.03, 1.5), glass, bevel=0.03),
      K.rbox("awning", (6.2, 1.2, 0.18), (0, -2.55, 2.55), K.mat("awn", (0.9, 0.1, 0.1), 0.5), bevel=0.05),
      K.rbox("signboard", (5.0, 0.16, 0.9), (0, -2.1, 3.1), blue, bevel=0.05),
      K.text("signtxt", "DR. PANDEY CLINIC", (0.25, -2.2, 3.1), 0.42, signmat, FONT, extrude=0.04)]
c1 = K.rbox("rc1", (0.18, 0.06, 0.55), (-2.05, -2.2, 3.1), red, bevel=0.02); c2 = K.rbox("rc2", (0.55, 0.06, 0.18), (-2.05, -2.2, 3.1), red, bevel=0.02)
cp += [c1, c2]
for o in cp:
    o.parent = clinic

# Creator setup on the pavement: tripod camera pointing at the clinic (lens +Y), ring light beside it
gear = K.empty("gear", (1.2, -4.4, 0)); gear.parent = root
for a in range(3):
    ang = math.radians(90 + a * 120)
    leg = K.cyl(f"leg{a}", 0.035, 1.6, (0.28 * math.cos(ang), 0.28 * math.sin(ang), 0.75), black, verts=12)
    leg.rotation_euler = (0.17 * math.sin(ang), -0.17 * math.cos(ang), 0); leg.parent = gear
for o in (K.rbox("cambody", (0.6, 0.42, 0.42), (0, 0, 1.75), black, bevel=0.05),
          K.rbox("screen", (0.42, 0.03, 0.28), (0, -0.22, 1.76), K.mat("screen", (0.25, 0.55, 1.0), 0.2, emit=2.5), bevel=0.02),
          K.sphere("recl", 0.055, (0.22, -0.1, 1.99), rec)):
    o.parent = gear
lens = K.cyl("camlens", 0.16, 0.38, (0, 0.38, 1.75), lensg, verts=32); lens.rotation_euler = (math.radians(90), 0, 0); lens.parent = gear
rl = K.empty("ringlight", (-1.0, -4.0, 0)); rl.parent = root
pole = K.cyl("rpole", 0.03, 1.8, (0, 0, 0.9), black, verts=12); pole.parent = rl
bpy.ops.mesh.primitive_torus_add(location=(0, 0, 2.0), major_radius=0.38, minor_radius=0.05, rotation=(math.radians(90), 0, 0))
tor = bpy.context.object; tor.data.materials.append(ring); tor.parent = rl
rl.rotation_euler = (0, 0, math.radians(15))

# --- animation
K.key(root, 1, scale=(0.55, 0.55, 0.55)); K.key(root, 16, scale=(1.03, 1.03, 1.03)); K.key(root, 26, scale=(1, 1, 1))
K.key(clinic, 4, scale=(1, 1, 0.01)); K.key(clinic, 22, scale=(1, 1, 1.08)); K.key(clinic, 32, scale=(1, 1, 1))
for o, f0 in ((gear, 34), (rl, 40)):
    K.key(o, f0, scale=(0, 0, 0)); K.key(o, f0 + 12, scale=(1.15, 1.15, 1.15)); K.key(o, f0 + 20, scale=(1, 1, 1))
# REC blinks during shot B
emit_in = rec.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
for f in range(150, N + 1, 30):
    emit_in.default_value = 12.0; emit_in.keyframe_insert("default_value", frame=f)
    emit_in.default_value = 0.0; emit_in.keyframe_insert("default_value", frame=f + 15)
for fc in rec.node_tree.animation_data.action.fcurves if rec.node_tree.animation_data and hasattr(rec.node_tree.animation_data.action, "fcurves") else []:
    for kp in fc.keyframe_points:
        kp.interpolation = "CONSTANT"

target = K.empty("target", (0, 0, 1.8)); rig = K.empty("rig", (0, 0, 0))
cam = K.camera(lens=50, fstop=4.0, focus=target); cam.parent = rig
con = cam.constraints.new("TRACK_TO"); con.target = target; con.track_axis = "TRACK_NEGATIVE_Z"; con.up_axis = "UP_Y"
# shot A: wide orbit
K.key(rig, 1, rotation_euler=(0, 0, math.radians(28))); K.key(rig, 160, rotation_euler=(0, 0, math.radians(8)))
K.key(cam, 1, location=(0, -36, 14)); K.key(cam, 160, location=(0, -29, 10))
K.key(target, 1, location=(0, -1, 1.2)); K.key(target, 160, location=(0, -1.5, 1.8))
# shot B: hard cut, then push into the tripod camera (rig continues)
# over-the-shoulder of the tripod camera, clinic sign behind
K.key(rig, 161, rotation_euler=(0, 0, math.radians(-10))); K.key(rig, N, rotation_euler=(0, 0, math.radians(4)))
K.key(cam, 161, location=(1.8, -11.5, 2.9)); K.key(cam, N, location=(1.6, -8.6, 2.4))
K.key(target, 161, location=(0.6, -1.8, 2.3)); K.key(target, N, location=(0.6, -1.8, 2.2))
K.backdrop(cam)
K.ease_all()
# the cut between shots must be instant, not eased
for a in bpy.data.actions:
    for layer in getattr(a, "layers", []):
        for strip in layer.strips:
            for cb in strip.channelbags:
                for fc in cb.fcurves:
                    kps = fc.keyframe_points
                    for i in range(len(kps) - 1):
                        if kps[i].co[0] == 160 and kps[i + 1].co[0] == 161:
                            kps[i].interpolation = "CONSTANT"
                    if "Emission" in fc.data_path or "default_value" in fc.data_path:
                        for kp in kps:
                            kp.interpolation = "CONSTANT"

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "renders/s2"
    rng = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else None
    K.render(out, rng)
