"""Shared Blender helpers for Salinur's 3D shots (run with the `bpy` module, headless).

Look: clean stylised "clay" 3D — rounded shapes, soft studio light, shallow depth of
field, brand palette. Every shot is 9:16 1080x1920 and always has camera motion.
"""
import math
import bpy
from mathutils import Vector

NAVY = (0.0017, 0.0070, 0.0369)      # #061436 in linear
BLUE = (0.0222, 0.1878, 0.9911)      # #2878FE in linear
WHITE = (0.92, 0.93, 0.95)
SKY = (0.62, 0.78, 0.98)
GRASS = (0.20, 0.55, 0.28)
RED = (0.85, 0.06, 0.07)
FONT = None


def reset(frames, fps=60):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 14
    sc.cycles.adaptive_threshold = 0.04
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.render.use_persistent_data = True
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 2
    sc.cycles.transmission_bounces = 2
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    import os
    if os.environ.get("FAST"):  # 75% res, fewer samples; the compositor upscales to 1080x1920
        sc.render.resolution_percentage = 75
        sc.cycles.samples = 8
    sc.render.fps = fps
    sc.frame_start, sc.frame_end = 1, frames
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Punchy"
    sc.render.image_settings.file_format = "PNG"
    sc.render.film_transparent = False
    return sc


def mat(name, color, rough=0.55, emit=0.0, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


def rbox(name, size, loc, material, bevel=0.08, segs=4):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    md = o.modifiers.new("bev", "BEVEL"); md.width = bevel; md.segments = segs; md.limit_method = "ANGLE"
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def cyl(name, r, h, loc, material, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, vertices=verts)
    o = bpy.context.object; o.name = name; o.data.materials.append(material)
    md = o.modifiers.new("bev", "BEVEL"); md.width = min(r, h) * 0.15; md.segments = 3
    bpy.ops.object.shade_smooth()
    return o


def sphere(name, r, loc, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=48, ring_count=24)
    o = bpy.context.object; o.name = name; o.scale = scale; o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def text(name, body, loc, size, material, font_path, extrude=0.03, rot=(math.radians(90), 0, 0), align="CENTER"):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    o.data.body = body; o.data.size = size; o.data.extrude = extrude
    o.data.bevel_depth = extrude * 0.3; o.data.align_x = align; o.data.align_y = "CENTER"
    o.data.font = bpy.data.fonts.load(font_path)
    o.data.materials.append(material)
    return o


def ground(color=GRASS, size=200):
    bpy.ops.mesh.primitive_plane_add(size=size)
    g = bpy.context.object; g.name = "ground"; g.data.materials.append(mat("ground", color, 0.9))
    return g


def world_sky(top=SKY, horizon=(0.95, 0.93, 0.90), strength=1.0, hdri=None):
    w = bpy.data.worlds.new("w"); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes["Background"]
    if hdri:
        env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(hdri)
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    else:
        grad = nt.nodes.new("ShaderNodeTexGradient"); grad.gradient_type = "EASING"
        tc = nt.nodes.new("ShaderNodeTexCoord"); mp_ = nt.nodes.new("ShaderNodeMapping")
        mp_.inputs["Rotation"].default_value = (0, math.radians(-90), 0)
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*horizon, 1); ramp.color_ramp.elements[1].color = (*top, 1)
        ramp.color_ramp.elements[0].position = 0.5; ramp.color_ramp.elements[1].position = 0.75
        nt.links.new(tc.outputs["Generated"], mp_.inputs["Vector"]); nt.links.new(mp_.outputs["Vector"], grad.inputs["Vector"])
        nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength


def sun(rot=(50, 0, 35), energy=3.5, angle=8, color=(1.0, 0.96, 0.9)):
    bpy.ops.object.light_add(type="SUN", rotation=tuple(math.radians(a) for a in rot))
    s = bpy.context.object; s.data.energy = energy; s.data.angle = math.radians(angle); s.data.color = color
    return s


def area(loc, target, energy=800, size=6, color=(1, 1, 1)):
    bpy.ops.object.light_add(type="AREA", location=loc)
    l = bpy.context.object; l.data.energy = energy; l.data.size = size; l.data.color = color
    look_at(l, target)
    return l


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def camera(lens=35, fstop=2.8, focus=None):
    bpy.ops.object.camera_add()
    c = bpy.context.object; bpy.context.scene.camera = c
    c.data.lens = lens; c.data.sensor_width = 36
    if focus is not None:
        c.data.dof.use_dof = True; c.data.dof.aperture_fstop = fstop
        if isinstance(focus, (int, float)):
            c.data.dof.focus_distance = focus
        else:
            c.data.dof.focus_object = focus
    return c


def empty(name, loc):
    bpy.ops.object.empty_add(location=loc); e = bpy.context.object; e.name = name; return e


def key(obj, frame, **props):
    """key(obj, 10, location=(..), scale=(..), rotation_euler=(..)) with smooth (bezier auto-clamped) easing."""
    for k, v in props.items():
        setattr(obj, k, v); obj.keyframe_insert(k, frame=frame)


def ease_all(kind="BEZIER", easing="AUTO", handle="AUTO_CLAMPED"):
    for a in bpy.data.actions:
        for fc in getattr(a, "fcurves", []):
            for kp in fc.keyframe_points:
                kp.interpolation = kind; kp.easing = easing
                kp.handle_left_type = kp.handle_right_type = handle
    # Blender 5 layered actions
    for a in bpy.data.actions:
        for layer in getattr(a, "layers", []):
            for strip in layer.strips:
                for cb in strip.channelbags:
                    for fc in cb.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = kind; kp.handle_left_type = kp.handle_right_type = handle


def backdrop(cam, top=(0.03, 0.10, 0.45), bottom=(0.003, 0.012, 0.06), dist=60):
    """Brand gradient wall parented to the camera, seen only by the camera (doesn't light the scene)."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    p = bpy.context.object; p.name = "backdrop"
    p.parent = cam; p.location = (0, 0, -dist); p.rotation_euler = (0, 0, 0)
    h = 2 * dist * (cam.data.sensor_width / 2) / cam.data.lens * (1920 / 1080) * 1.3
    p.scale = (h * 0.6, h, 1)
    m = bpy.data.materials.new("backdrop"); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); em = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*bottom, 1); ramp.color_ramp.elements[1].color = (*top, 1)
    ramp.color_ramp.elements[0].position = 0.15; ramp.color_ramp.elements[1].position = 0.85
    nt.links.new(tc.outputs["Generated"], sep.inputs[0]); nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], em.inputs["Color"]); em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    p.data.materials.append(m)
    for attr in ("visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter", "visible_shadow"):
        setattr(p, attr, False)
    return p


def platform(radius=13, depth=1.6, top_mat=None, side_color=(0.85, 0.87, 0.92)):
    """Round floating diorama base."""
    side = mat("platform_side", side_color, 0.6)
    base = cyl("platform", radius, depth, (0, 0, -depth / 2), side, verts=96)
    if top_mat:
        top = cyl("platform_top", radius - 0.05, 0.12, (0, 0, 0.0), top_mat, verts=96)
    return base


def render(out_dir, frames=None):
    sc = bpy.context.scene
    sc.render.filepath = f"{out_dir}/f_"
    if frames:
        sc.frame_start, sc.frame_end = frames
    bpy.ops.render.render(animation=True)


# ---------------------------------------------------------------- characters (Kenney Mini Characters, CC0)
CHARS = "../../../assets/3d/models/kenney-mini"


def character(kind, loc=(0, 0, 0), rotz=0.0, scale=2.2):
    """Import a mini character (e.g. 'character-male-d'); returns its armature. Helper meshes removed."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f"{CHARS}/{kind}.glb")
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    for o in new:
        if o.type == "MESH" and o.parent is None:      # stray icosphere in the files
            bpy.data.objects.remove(o, do_unlink=True)
    arm.rotation_mode = "XYZ"          # glTF import uses quaternions; our turns are Euler
    arm.location = loc; arm.rotation_euler = (0, 0, rotz); arm.scale = (scale, scale, scale)
    if arm.animation_data:
        arm.animation_data.action = None
    return arm


def play(arm, action_name, start=1, end=None, fps_src=24):
    """Loop `action_name` on the armature from frame `start` to `end` (scene runs at 60 fps)."""
    act = bpy.data.actions[action_name]
    ad = arm.animation_data or arm.animation_data_create()
    tr = ad.nla_tracks.new()
    st = tr.strips.new(action_name + str(start), int(start), act)
    if hasattr(st, "action_slot") and getattr(act, "slots", None):
        st.action_slot = act.slots[0]
    st.scale = bpy.context.scene.render.fps / fps_src
    length = (act.frame_range[1] - act.frame_range[0]) * st.scale
    if end:
        st.repeat = max(1.0, (end - start) / max(length, 1))
    st.extrapolation = "HOLD"
    return st


def dress_doctor(arm):
    """White coat + stethoscope on a mini character (parented to the torso bone)."""
    from mathutils import Matrix
    from mathutils import Vector
    bpy.context.view_layer.update()
    body = next(o for o in arm.children if "body" in o.name)
    # torso box of the body mesh in world space (arms excluded by using the central 40 % of the width)
    bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
    zs = sorted(v.z for v in bb); xs = sorted(v.x for v in bb); ys = sorted(v.y for v in bb)
    zmin, zmax = zs[0], zs[-1]; cx = (xs[0] + xs[-1]) / 2; cy = (ys[0] + ys[-1]) / 2
    h = zmax - zmin; wdt = (xs[-1] - xs[0]) * 0.42; dep = (ys[-1] - ys[0]) * 1.12
    s = arm.scale[0]
    coatm = mat("coat", (0.95, 0.96, 0.98), 0.5)
    coat = rbox("coat", (wdt, dep, h * 0.62), (cx, cy, zmin + h * 0.62), coatm, bevel=0.03 * s)
    front = cy - dep / 2
    bpy.ops.mesh.primitive_torus_add(location=(cx, front - 0.005 * s, zmin + h * 0.70), major_radius=wdt * 0.22, minor_radius=0.010 * s,
                                     rotation=(math.radians(90), 0, 0))
    steth = bpy.context.object; steth.data.materials.append(mat("steth", (0.05, 0.05, 0.06), 0.3))
    badge = rbox("badge", (wdt * 0.16, 0.012 * s, wdt * 0.16), (cx + wdt * 0.28, front - 0.006 * s, zmin + h * 0.80),
                 mat("badge", (0.85, 0.05, 0.05), 0.4, emit=0.4), bevel=0.004 * s)
    for o in (coat, steth, badge):
        mw = o.matrix_world.copy()
        o.parent = arm; o.parent_type = "BONE"; o.parent_bone = "torso"
        o.matrix_world = mw
    return coat
