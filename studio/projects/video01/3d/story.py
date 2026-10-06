"""Story scenes for video01 v4 — Kenney mini characters acting out what Salinur says.
Floating diorama on a glowing base, transparent background, wide 1080x600 (shown IN FRONT of
Salinur, just above the captions). 60 fps.

Run: FAST=1 python3 story.py <scene> <out_dir> [first last]
Scenes: doc_walk, doc_film, owner_out, queue, steal
"""
import math, random, sys
sys.path.insert(0, "../../../presets")
import bpy
import blender_kit as K

FONT = "../../../assets/fonts/Poppins-800.ttf"
SCENE = sys.argv[1]
FRAMES = {"hospital": 180, "doc_walk": 160, "doc_film": 110, "owner_out": 140, "queue": 170, "steal": 120}[SCENE]

sc = K.reset(FRAMES)
sc.render.resolution_x, sc.render.resolution_y = 1080, 600
sc.render.film_transparent = True
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.45, 0.55, 0.85, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.65
K.sun(rot=(42, 6, 32), energy=4.2, angle=3, color=(1.0, 0.95, 0.88))

M = dict(
    white=K.mat("white", (0.88, 0.90, 0.94), 0.4), cream=K.mat("cream", (0.93, 0.86, 0.72), 0.5),
    teal=K.mat("teal", (0.02, 0.45, 0.42), 0.4), glass=K.mat("glass", (0.10, 0.38, 0.95), 0.12, metal=0.2),
    glass_lit=K.mat("glass_lit", (0.35, 0.65, 1.0), 0.2, emit=1.0), blue=K.mat("blue", K.BLUE, 0.3),
    red=K.mat("red", (0.90, 0.02, 0.03), 0.3, emit=0.6), grass=K.mat("grass", (0.13, 0.52, 0.20), 0.85),
    road=K.mat("road", (0.07, 0.075, 0.09), 0.7), paint=K.mat("paint", (0.95, 0.95, 0.92), 0.5),
    pave=K.mat("pave", (0.72, 0.72, 0.76), 0.7), black=K.mat("black", (0.02, 0.02, 0.025), 0.35, metal=0.4),
    signtxt=K.mat("signtxt", (1, 1, 1), 0.4, emit=0.4), trunk=K.mat("trunk", (0.32, 0.18, 0.09), 0.8),
    leaf=K.mat("leaf", (0.10, 0.45, 0.16), 0.6), glow=K.mat("glow", (0.16, 0.47, 1.0), 0.3, emit=6.0),
    green=K.mat("greensign", (0.1, 0.8, 0.3), 0.4, emit=1.5),
)


def base(radius=11):
    """Floating platform + glowing ring under it (like the 3D-character base in Salinur's own edits)."""
    K.platform(radius, 1.4, top_mat=M["grass"], side_color=(0.86, 0.88, 0.93))
    bpy.ops.mesh.primitive_torus_add(location=(0, 0, -1.5), major_radius=radius * 0.98, minor_radius=0.12)
    bpy.context.object.data.materials.append(M["glow"])


def tree(x, y, s=1.0):
    K.cyl(f"tr{x}{y}", 0.15 * s, 1.3 * s, (x, y, 0.65 * s), M["trunk"], verts=16)
    K.sphere(f"lf{x}{y}", 0.95 * s, (x, y, 1.75 * s), M["leaf"], scale=(1, 1, 1.2))


def hospital(x=0.0, y=1.0, s=1.0):
    """Returns door world position (front centre)."""
    g = K.empty("hospital", (x, y, 0)); g.scale = (s, s, s)
    parts = [K.rbox("h_main", (7, 4.6, 6.4), (0, 0, 3.2), M["white"], bevel=0.14),
             K.rbox("h_stripe", (7.05, 4.65, 0.32), (0, 0, 5.75), M["blue"], bevel=0.05),
             K.rbox("h_canopy", (3.8, 1.7, 0.22), (0, -2.9, 2.2), M["blue"], bevel=0.06),
             K.rbox("h_door", (2.2, 0.12, 1.9), (0, -2.33, 0.95), M["glass"], bevel=0.03),
             K.rbox("h_signp", (4.6, 0.14, 1.0), (0, -2.36, 5.05), M["blue"], bevel=0.06),
             K.text("h_sign", "HOSPITAL", (0, -2.47, 5.05), 0.78, M["signtxt"], FONT, extrude=0.05)]
    for side in (-1, 1):
        parts.append(K.rbox(f"h_wing{side}", (3.6, 4.0, 4.2), (side * 5.3, 0.3, 2.1), M["white"], bevel=0.14))
        for r in range(2):
            for c in range(2):
                parts.append(K.rbox(f"h_ww{side}{r}{c}", (1.0, 0.1, 0.9), (side * 5.3 + (c - 0.5) * 1.5, -1.73, 1.5 + r * 1.6), M["glass_lit"] if (r + c + side) % 2 else M["glass"], bevel=0.03))
    for r in range(2):
        for c in range(4):
            if r == 0 and c in (1, 2):
                continue
            parts.append(K.rbox(f"h_w{r}{c}", (1.05, 0.1, 1.0), ((c - 1.5) * 1.6, -2.33, 2.9 + r * 1.45), M["glass_lit"] if (r * 4 + c) % 3 else M["glass"], bevel=0.03))
    cross = [K.rbox("h_c1", (0.65, 0.35, 1.9), (0, 0, 7.7), M["red"], bevel=0.08), K.rbox("h_c2", (1.9, 0.35, 0.65), (0, 0, 7.7), M["red"], bevel=0.08)]
    for p in parts + cross:
        p.parent = g
    return (x, y - 2.4 * s)


def clinic(x=0.0, y=0.8, s=1.0, open_sign_frame=None):
    g = K.empty("clinic", (x, y, 0)); g.scale = (s, s, s)
    parts = [K.rbox("c_body", (6, 4, 3.6), (0, 0, 1.8), M["cream"], bevel=0.12),
             K.rbox("c_roof", (6.4, 4.4, 0.3), (0, 0, 3.7), M["teal"], bevel=0.08),
             K.rbox("c_door", (1.4, 0.12, 2.1), (-1.6, -2.03, 1.05), M["glass"], bevel=0.03),
             K.rbox("c_win", (2.4, 0.12, 1.4), (1.3, -2.03, 1.5), M["glass"], bevel=0.03),
             K.rbox("c_awning", (6.2, 1.2, 0.18), (0, -2.55, 2.55), K.mat("awn", (0.9, 0.1, 0.1), 0.5), bevel=0.05),
             K.rbox("c_board", (5.0, 0.16, 0.9), (0, -2.1, 3.1), M["blue"], bevel=0.05),
             K.text("c_txt", "DR. PANDEY CLINIC", (0.25, -2.2, 3.1), 0.42, M["signtxt"], FONT, extrude=0.04),
             K.rbox("c_rc1", (0.18, 0.06, 0.55), (-2.05, -2.2, 3.1), M["red"], bevel=0.02),
             K.rbox("c_rc2", (0.55, 0.06, 0.18), (-2.05, -2.2, 3.1), M["red"], bevel=0.02)]
    for p in parts:
        p.parent = g
    if open_sign_frame:
        sign = K.empty("open", (x + (-1.6 + 0.0) * s, y + (-2.2) * s, 1.75 * s))
        b = K.rbox("open_b", (0.9, 0.06, 0.38), (0, 0, 0), M["green"], bevel=0.03); b.parent = sign
        t = K.text("open_t", "OPEN", (0, -0.05, 0), 0.26, M["signtxt"], FONT, extrude=0.02); t.parent = sign
        sign.scale = (s, s, s)
        K.key(sign, open_sign_frame, scale=(0, 0, 0)); K.key(sign, open_sign_frame + 10, scale=(1.25 * s,) * 3); K.key(sign, open_sign_frame + 16, scale=(s, s, s))
    return (x - 1.6 * s, y - 2.3 * s)


def ground_road(y=-6.0, length=21):
    K.rbox("road", (length, 3.2, 0.08), (0, y, 0.08), M["road"], bevel=0.02)
    for xx in range(-int(length / 2) + 1, int(length / 2), 3):
        K.rbox(f"dash{xx}", (1.2, 0.15, 0.05), (xx, y, 0.13), M["paint"], bevel=0.01)


def walk(arm, p0, p1, f0, f1, speed_anim="walk"):
    """Walk from p0 to p1 between frames f0..f1, facing the direction of travel."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    # measured: rotz 0 faces -Y (camera), 90 faces -X  ->  heading (dx, dy) = atan2(-dx, -dy)
    arm.rotation_euler = (0, 0, math.atan2(-dx, -dy))
    arm.keyframe_insert("rotation_euler", frame=f0)      # turn happens at the start of this leg only
    K.key(arm, f0, location=(p0[0], p0[1], 0.12)); K.key(arm, f1, location=(p1[0], p1[1], 0.12))
    K.play(arm, speed_anim, f0, f1)


def vanish(obj, frame):
    """Hide an armature and its meshes from `frame` on (walked inside)."""
    for o in [obj] + list(obj.children_recursive):
        o.hide_render = False; o.keyframe_insert("hide_render", frame=frame - 1)
        o.hide_render = True; o.keyframe_insert("hide_render", frame=frame)


def cam_rig(target, start, end, lens=40):
    tg = K.empty("target", target)
    cam = K.camera(lens=lens, fstop=6.0, focus=tg)
    con = cam.constraints.new("TRACK_TO"); con.target = tg; con.track_axis = "TRACK_NEGATIVE_Z"; con.up_axis = "UP_Y"
    K.key(cam, 1, location=start); K.key(cam, FRAMES, location=end)
    return cam, tg


random.seed(3)
CH = K.character
LINEAR_LOC = []

if SCENE == "hospital":         # "you have a hospital in your town" — slow hero orbit, no people
    base(12); ground_road(-6.6, 23)
    K.rbox("plaza", (12, 4.0, 0.12), (0, -3.6, 0.1), K.mat("plaza", (0.72, 0.73, 0.78), 0.7), bevel=0.04)
    hospital(0.0, 1.6, 0.85)
    for t in ((-8.8, 1), (8.8, 1), (-7, 6), (7, 6), (-9.5, -1.5), (9.6, -2.0)):
        tree(*t)
    tg = K.empty("target", (0, -0.5, 3.3))
    cam = K.camera(lens=45, fstop=8.0, focus=tg)
    con = cam.constraints.new("TRACK_TO"); con.target = tg; con.track_axis = "TRACK_NEGATIVE_Z"; con.up_axis = "UP_Y"
    rig = K.empty("rig", (0, 0, 0)); cam.parent = rig; cam.location = (0, -31, 10)
    K.key(rig, 1, rotation_euler=(0, 0, math.radians(-22))); K.key(rig, FRAMES, rotation_euler=(0, 0, math.radians(12)))

elif SCENE == "doc_walk":          # "Dr. Pandey comes to your town, opens a small clinic"
    base(); ground_road(); K.rbox("pave", (12, 3.0, 0.12), (0, -3.4, 0.1), M["pave"], bevel=0.04)
    door = clinic(1.0, 0.8, open_sign_frame=128)
    for t in ((-8, 2), (8.2, 1.5), (-6, 6), (6, 6.5)):
        tree(*t)
    doc = CH("character-male-e", scale=2.3); K.dress_doctor(doc)
    walk(doc, (-8.5, -3.6), (door[0], -3.4), 1, 95)
    walk(doc, (door[0], -3.4), (door[0], door[1] + 0.4), 96, 122)
    vanish(doc, 123)
    LINEAR_LOC.append(doc)
    cam_rig((-2.0, -2.8, 1.3), (-5, -17, 5.0), (-1, -14.5, 4.2), lens=45)

elif SCENE == "doc_film":        # "he starts making video every day"
    base(9); K.rbox("pave", (12, 4.0, 0.12), (0, -2.8, 0.1), M["pave"], bevel=0.04)
    clinic(0.0, 1.8)
    doc = CH("character-male-e", (-1.0, -3.0, 0.12), rotz=math.radians(-41), scale=2.3); K.dress_doctor(doc)   # faces the tripod camera
    K.play(doc, "idle", 1, 50); K.play(doc, "emote-yes", 50, 110)
    gear = K.empty("gear", (1.8, -6.2, 0))
    for a in range(3):
        ang = math.radians(90 + a * 120)
        leg = K.cyl(f"leg{a}", 0.035, 1.6, (0.28 * math.cos(ang), 0.28 * math.sin(ang), 0.75), M["black"], verts=12)
        leg.rotation_euler = (0.17 * math.sin(ang), -0.17 * math.cos(ang), 0); leg.parent = gear
    body = K.rbox("cambody", (0.6, 0.42, 0.42), (0, 0, 1.75), M["black"], bevel=0.05); body.parent = gear
    rec = K.mat("rec", (0.25, 0, 0), 0.3); rec.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1, 0.02, 0.02, 1)
    rl = K.sphere("recl", 0.06, (0.22, -0.1, 2.0), rec); rl.parent = gear
    lens = K.cyl("camlens", 0.16, 0.38, (0, 0.38, 1.75), M["black"], verts=32); lens.rotation_euler = (math.radians(90), 0, 0); lens.parent = gear
    gear.rotation_euler = (0, 0, math.radians(150))
    em = rec.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
    for f in range(1, FRAMES + 1, 30):
        em.default_value = 14; em.keyframe_insert("default_value", frame=f)
        em.default_value = 0; em.keyframe_insert("default_value", frame=f + 15)
    for t in ((-6.5, 1.5), (6.5, 1.5)):
        tree(*t)
    cam_rig((0, -3.5, 1.6), (6, -20, 5.5), (4, -16, 4.2), lens=45)

elif SCENE == "owner_out":       # "someday you step out of your hospital"
    base(); ground_road(-6.6)
    K.rbox("plaza", (12, 4.0, 0.12), (0, -3.6, 0.1), K.mat("plaza", (0.72, 0.73, 0.78), 0.7), bevel=0.04)
    door = hospital(0.0, 1.6, 0.8)
    for t in ((-8.8, 1), (8.8, 1), (-7, 6), (7, 6)):
        tree(*t)
    own = CH("character-male-d", scale=2.3)
    for o in [own] + list(own.children_recursive):
        o.hide_render = True; o.keyframe_insert("hide_render", frame=1)
        o.hide_render = False; o.keyframe_insert("hide_render", frame=12)
    walk(own, (door[0], door[1] + 0.3), (0.6, -4.8), 12, 105)
    K.play(own, "idle", 106, FRAMES)
    LINEAR_LOC.append(own)
    cam_rig((0.4, -3.2, 1.5), (2.5, -16, 5.2), (1.2, -12.5, 4.0), lens=45)

elif SCENE == "queue":           # "a large queue of patients outside his clinic"
    base(12); ground_road(-6.8, 23); K.rbox("pave", (20, 3.2, 0.12), (0, -3.6, 0.1), M["pave"], bevel=0.04)
    door = clinic(-5.0, 0.6)
    kinds = ["character-female-a", "character-male-a", "character-female-c", "character-male-b", "character-female-b",
             "character-male-c", "character-female-f", "character-male-f"]
    for k, kind in enumerate(kinds):
        x = door[0] + 1.0 + k * 1.55
        a = CH(kind, (x, -3.4, 0.12), rotz=math.radians(60 + random.uniform(-12, 12)), scale=2.2)   # facing the clinic door, 3/4 to camera
        K.play(a, "idle", 1 + k * 4, FRAMES)
    wc = CH("character-female-d", (door[0] + 1.0 + 8 * 1.55 + 0.4, -3.4, 0.12), rotz=math.radians(60), scale=2.2)
    K.play(wc, "wheelchair-sit", 1, FRAMES)
    bpy.ops.import_scene.gltf(filepath=f"{K.CHARS}/wheelchair.glb")
    for o in bpy.context.selected_objects:
        if o.parent is None:
            o.location = wc.location; o.rotation_euler = wc.rotation_euler; o.scale = (2.2, 2.2, 2.2)
    for t in ((9.5, 1.5), (-9.5, 2.5)):
        tree(*t)
    cam_rig((-1.0, -3.2, 1.3), (-7, -19, 5.5), (5, -19, 5.5), lens=40)

elif SCENE == "steal":           # "he is stealing your customers"
    base(13); K.rbox("path", (16, 2.4, 0.12), (0, -3.8, 0.1), M["pave"], bevel=0.04)
    hd = hospital(-6.5, 1.0, 0.65)
    cd = clinic(6.3, 0.6, 0.9)
    kinds = ["character-female-a", "character-male-a", "character-female-c", "character-male-b", "character-female-b"]
    for k, kind in enumerate(kinds):
        a = CH(kind, scale=2.1)
        f0 = 1 + k * 14
        walk(a, (-6.0 + random.uniform(-0.5, 0.5), -3.8 + random.uniform(-0.4, 0.4)), (cd[0] - 0.5, -3.6 + random.uniform(-0.3, 0.3)), f0, f0 + 95)
        LINEAR_LOC.append(a)
    cam_rig((0, -3.2, 1.6), (-1.5, -21, 6.5), (1.5, -18.5, 5.5), lens=42)

K.backdrop  # (no backdrop: transparent)
K.ease_all()
# characters walk at constant speed; camera keeps its ease
for a in bpy.data.actions:
    for layer in getattr(a, "layers", []):
        for strip in layer.strips:
            for cb in strip.channelbags:
                for fc in cb.fcurves:
                    if fc.data_path in ("location",) and any(o.animation_data and o.animation_data.action == a for o in LINEAR_LOC):
                        for kp in fc.keyframe_points:
                            kp.interpolation = "LINEAR"
                    if fc.data_path in ("hide_render", "rotation_euler") and any(o.animation_data and o.animation_data.action == a for o in LINEAR_LOC) \
                            or fc.data_path == "hide_render" or "Emission" in fc.data_path or "default_value" in fc.data_path:
                        for kp in fc.keyframe_points:
                            kp.interpolation = "CONSTANT"

if __name__ == "__main__":
    out = sys.argv[2] if len(sys.argv) > 2 else f"renders/{SCENE}"
    rng = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else None
    K.render(out, rng)
