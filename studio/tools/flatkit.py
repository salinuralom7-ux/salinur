"""Flat 2D vector illustration kit (own work) — premium explainer style Salinur asked for
(faceless characters, smooth shapes, soft flat colours, subtle shading). Renders SVG -> RGBA numpy via cairosvg.

character(kind, t, walk=0/1, ...) -> SVG <g>; building(kind) -> SVG <g>; render(svg_body, w, h) -> RGBA uint8.
All characters are drawn in a 400 x 1000 unit box, feet at y=1000, centred on x=200.
"""
import io, math
import numpy as np
import cairosvg
from PIL import Image

SKIN = ["#F2B98D", "#E3A27A", "#C98A5E", "#A86B45"]
SKIN_SH = {"#F2B98D": "#E39E72", "#E3A27A": "#CF8A60", "#C98A5E": "#B07348", "#A86B45": "#8E5636"}

PRESETS = {
    "doctor": dict(skin="#F2B98D", hair="#74360F", hair_style="curly", coat="#F4F5F7", coat_sh="#DADDE3", top="#0667AE", pants="#0B4F86",
                   shoes="#2B2B33", steth=True, coat_open=True),
    "owner": dict(skin="#C98A5E", hair="#1E1A18", hair_style="wavy", coat="#1E2A4A", coat_sh="#141D36", top="#FFFFFF", tie="#C8202A",
                  pants="#1E2A4A", shoes="#151515"),
    "p1": dict(skin="#E3A27A", hair="#2A1B12", hair_style="long", coat="#E85D75", coat_sh="#C9465E", top="#E85D75", pants="#3B4A6B", shoes="#2B2B33"),
    "p2": dict(skin="#A86B45", hair="#151515", hair_style="short", coat="#3FA7A0", coat_sh="#2F8A84", top="#3FA7A0", pants="#2E3440", shoes="#F2F2F2"),
    "p3": dict(skin="#F2B98D", hair="#8A5A2B", hair_style="bun", coat="#F2B544", coat_sh="#D99A26", top="#F2B544", pants="#4A5A7A", shoes="#2B2B33"),
    "p4": dict(skin="#C98A5E", hair="#C9C9C9", hair_style="short", coat="#7D6BD6", coat_sh="#6655BA", top="#7D6BD6", pants="#3A3A48", shoes="#2B2B33"),
    "p5": dict(skin="#E3A27A", hair="#151515", hair_style="long", coat="#5BA35B", coat_sh="#468A46", top="#5BA35B", pants="#2E3440", shoes="#2B2B33"),
    "p6": dict(skin="#A86B45", hair="#1E1A18", hair_style="wavy", coat="#E07B39", coat_sh="#C46224", top="#E07B39", pants="#3B4A6B", shoes="#F2F2F2"),
}


def _rot(g, ang, cx, cy):
    return f'<g transform="rotate({ang:.2f} {cx} {cy})">{g}</g>'


def hair(style, col):
    if style == "curly":
        blobs = [(150, 205, 40), (185, 175, 42), (230, 170, 44), (270, 190, 40), (292, 225, 32), (120, 240, 32), (140, 275, 26),
                 (255, 160, 30), (205, 160, 34), (300, 205, 26)]
        b = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{col}"/>' for x, y, r in blobs)
        b += f'<path d="M132 260 Q128 330 145 360 L150 300 Z" fill="{col}"/><path d="M268 260 Q276 330 258 360 L252 300 Z" fill="{col}"/>'
        b += f'<path d="M290 190 Q330 175 318 215 Q312 232 296 236 Z" fill="{col}"/>'
        return b
    if style == "wavy":
        return (f'<path d="M126 292 Q112 205 160 178 Q205 150 255 168 Q300 185 292 262 L282 292 Q276 246 262 232 Q236 250 200 238 Q170 254 146 240 Q136 258 136 292 Z" fill="{col}"/>'
                f'<path d="M150 182 Q200 140 262 168 Q296 150 300 196 Q280 178 252 186 Q210 170 170 196 Z" fill="{col}"/>')
    if style == "long":
        return (f'<path d="M124 300 Q110 180 200 168 Q292 175 278 300 L290 470 Q250 480 236 430 L240 300 Q200 268 160 300 L162 430 Q148 480 110 470 Z" fill="{col}"/>')
    if style == "bun":
        return (f'<circle cx="200" cy="150" r="38" fill="{col}"/><path d="M128 280 Q120 185 200 178 Q282 185 272 280 Q262 230 200 228 Q140 230 128 280 Z" fill="{col}"/>')
    return (f'<path d="M127 290 Q118 190 200 172 Q284 190 273 290 L264 290 Q258 238 230 226 Q200 238 170 226 Q142 238 136 290 Z" fill="{col}"/>')


def character(kind, t=0.0, walk=0.0, wave=0.0, hold=None, facing=1):
    """walk: 0..1 amount of walk cycle (t drives phase). wave: right arm raised. hold: 'camera' or None."""
    p = PRESETS[kind]
    ph = t * 2 * math.pi * 1.6
    sw = math.sin(ph) * 24 * walk
    bob = abs(math.cos(ph)) * 8 * walk
    skin, sh = p["skin"], SKIN_SH.get(p["skin"], "#00000022")
    g = []
    # legs (hip at 200,640)
    for side, a in ((-1, sw), (1, -sw)):
        x = 200 + side * 34
        leg = (f'<rect x="{x - 26}" y="630" width="52" height="300" rx="24" fill="{p["pants"]}"/>'
               f'<path d="M{x - 30} 925 Q{x - 30} 900 {x} 900 L{x + 38 * facing} 905 Q{x + 52 * facing} 915 {x + 50 * facing} 945 L{x - 30} 945 Z" fill="{p["shoes"]}"/>')
        g.append(_rot(leg, a, x, 640))
    # back arm
    arm = lambda x, col, ang, hand=True: _rot(f'<rect x="{x - 24}" y="400" width="48" height="250" rx="24" fill="{col}"/>'
                                              + (f'<circle cx="{x}" cy="655" r="26" fill="{skin}"/>' if hand else ""), ang, x, 410)
    g.append(arm(110, p["coat_sh"], -sw * 0.8 + 6))
    # torso
    g.append(f'<path d="M115 400 Q118 360 165 352 L235 352 Q282 360 285 400 L292 690 Q200 712 108 690 Z" fill="{p["coat"]}"/>')
    if p.get("coat_open"):
        g.append(f'<path d="M168 356 L200 470 L232 356 Z" fill="{skin}"/><path d="M172 352 L200 520 L228 352 L240 356 L212 690 L188 690 L160 356 Z" fill="{p["top"]}"/>')
        g.append(f'<path d="M165 352 L195 470 L180 690 L150 690 L140 420 Z" fill="{p["coat"]}"/><path d="M235 352 L205 470 L220 690 L250 690 L260 420 Z" fill="{p["coat"]}"/>')
        g.append(f'<path d="M140 420 L165 352 L180 380 L158 455 Z" fill="{p["coat_sh"]}"/><path d="M260 420 L235 352 L220 380 L242 455 Z" fill="{p["coat_sh"]}"/>')
    elif p.get("tie"):
        g.append(f'<path d="M172 352 L200 450 L228 352 Z" fill="{p["top"]}"/><path d="M193 372 L207 372 L212 470 L200 490 L188 470 Z" fill="{p["tie"]}"/>')
        g.append(f'<path d="M165 352 L196 455 L185 690 L140 690 L138 420 Z" fill="{p["coat"]}"/><path d="M235 352 L204 455 L215 690 L260 690 L262 420 Z" fill="{p["coat"]}"/>')
    else:
        g.append(f'<path d="M170 352 Q200 395 230 352 Z" fill="{sh}"/>')
    if p.get("steth"):
        g.append('<path d="M170 360 Q150 470 170 540" stroke="#1d1d1f" stroke-width="10" fill="none" stroke-linecap="round"/>'
                 '<path d="M230 360 Q252 440 240 500 Q236 560 262 590" stroke="#1d1d1f" stroke-width="10" fill="none" stroke-linecap="round"/>'
                 '<circle cx="172" cy="552" r="20" fill="#9aa0a6"/><circle cx="172" cy="552" r="10" fill="#e8eaed"/>')
    # neck + head (faceless)
    g.append(f'<rect x="178" y="300" width="44" height="64" rx="12" fill="{sh}"/>')
    head = (f'<ellipse cx="200" cy="255" rx="70" ry="86" fill="{skin}"/><ellipse cx="129" cy="262" rx="13" ry="20" fill="{sh}"/><ellipse cx="271" cy="262" rx="13" ry="20" fill="{sh}"/>'
            f'<path d="M150 318 Q200 352 250 318 Q232 345 200 347 Q168 345 150 318 Z" fill="{sh}" opacity="0.6"/>' + hair(p["hair_style"], p["hair"]))
    g.append(f'<g transform="translate(200 345) scale(1.22) translate(-200 -345)">{head}</g>')
    # front arm
    if hold == "camera":
        g.append(_rot(f'<rect x="266" y="400" width="48" height="190" rx="24" fill="{p["coat"]}"/><circle cx="290" cy="595" r="26" fill="{skin}"/>', -55, 290, 410))
        g.append('<g transform="translate(330 420)"><rect x="-10" y="-40" width="120" height="80" rx="14" fill="#202124"/>'
                 '<circle cx="50" cy="0" r="26" fill="#3c4043"/><circle cx="50" cy="0" r="14" fill="#8ab4f8"/>'
                 f'<circle cx="98" cy="-28" r="7" fill="{"#ff3b30" if (t % 0.8) < 0.45 else "#5f1b18"}"/></g>')
    elif wave:
        g.append(_rot(f'<rect x="266" y="400" width="48" height="230" rx="24" fill="{p["coat"]}"/><circle cx="290" cy="640" r="26" fill="{skin}"/>',
                      -150 + 12 * math.sin(t * 9), 290, 410))
    else:
        g.append(arm(290, p["coat"], sw * 0.8 - 6))
    body = "".join(g)
    if facing < 0:
        body = f'<g transform="translate(400 0) scale(-1 1)">{body}</g>'
    return f'<g transform="translate(0 {-bob:.1f})">{body}</g>'


def prop(kind, t=0.0):
    if kind == "tripod":
        rec = "#ff3b30" if (t % 0.8) < 0.45 else "#5f1b18"
        return ('<path d="M100 300 L40 640 M100 300 L160 640 M100 300 L100 640" stroke="#2b2b33" stroke-width="10" stroke-linecap="round"/>'
                '<rect x="62" y="150" width="76" height="150" rx="14" fill="#202124"/><rect x="70" y="162" width="60" height="120" rx="8" fill="#8ab4f8"/>'
                f'<circle cx="122" cy="174" r="7" fill="{rec}"/>')
    if kind == "ringlight":
        return ('<path d="M100 300 L100 700 M100 700 L50 740 M100 700 L150 740" stroke="#2b2b33" stroke-width="9" stroke-linecap="round"/>'
                '<circle cx="100" cy="190" r="100" fill="none" stroke="#FFF6D8" stroke-width="22"/><circle cx="100" cy="190" r="100" fill="none" stroke="#FFE9A6" stroke-width="6"/>')
    if kind == "open":
        return ('<path d="M60 0 L20 60 M60 0 L100 60" stroke="#2b2b33" stroke-width="5"/><rect x="0" y="55" width="120" height="56" rx="10" fill="#22C55E"/>'
                '<text x="60" y="96" font-family="Anton" font-size="36" fill="#fff" text-anchor="middle">OPEN</text>')
    raise KeyError(kind)


def building(kind):
    if kind == "clinic":
        return ('<rect x="0" y="120" width="620" height="420" rx="8" fill="#F6EFE4"/><rect x="-20" y="90" width="660" height="50" rx="10" fill="#1F8A84"/>'
                '<rect x="40" y="160" width="540" height="80" rx="12" fill="#2878FE"/>'
                '<text x="330" y="214" font-family="Anton" font-size="44" fill="#fff" text-anchor="middle">DR. PANDEY CLINIC</text>'
                '<rect x="68" y="182" width="12" height="38" fill="#fff"/><rect x="55" y="195" width="38" height="12" fill="#fff"/>'
                '<path d="M20 262 L600 262 L620 300 L0 300 Z" fill="#E84B4B"/>'
                + "".join(f'<path d="M{20 + k * 58} 300 Q{49 + k * 58} 322 {78 + k * 58} 300 Z" fill="#E84B4B"/>' for k in range(10)) +
                '<rect x="70" y="330" width="150" height="210" rx="8" fill="#9CC9F5"/><rect x="85" y="345" width="56" height="195" fill="#7FB4EC"/>'
                '<rect x="300" y="340" width="250" height="140" rx="8" fill="#9CC9F5"/><path d="M300 340 L380 340 L320 480 L300 480 Z" fill="#B9DAF8"/>')
    if kind == "hospital":
        win = "".join(f'<rect x="{x}" y="{y}" width="64" height="58" rx="6" fill="{c}"/>'
                      for x in (60, 150, 470, 560) for y, c in ((230, "#9CC9F5"), (320, "#B9DAF8"), (410, "#9CC9F5")))
        return ('<rect x="0" y="200" width="700" height="400" rx="10" fill="#EEF2F7"/><rect x="230" y="90" width="240" height="510" rx="10" fill="#F8FAFC"/>'
                '<rect x="230" y="150" width="240" height="22" fill="#2878FE"/><rect x="250" y="190" width="200" height="60" rx="10" fill="#2878FE"/>'
                '<text x="350" y="234" font-family="Anton" font-size="40" fill="#fff" text-anchor="middle">HOSPITAL</text>'
                '<rect x="334" y="20" width="32" height="90" rx="6" fill="#E53935"/><rect x="305" y="49" width="90" height="32" rx="6" fill="#E53935"/>'
                + win + '<rect x="290" y="440" width="120" height="160" rx="8" fill="#7FB4EC"/><rect x="270" y="420" width="160" height="22" rx="6" fill="#2878FE"/>')
    raise KeyError(kind)


def render(body, w, h, view=None):
    vb = view or f"0 0 {w} {h}"
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">{body}</svg>'
    png = cairosvg.svg2png(bytestring=svg.encode())
    return np.array(Image.open(io.BytesIO(png)).convert("RGBA"))


def place(obj_svg, x, y, s=1.0):
    return f'<g transform="translate({x:.1f} {y:.1f}) scale({s:.3f})">{obj_svg}</g>'
