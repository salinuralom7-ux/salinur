#!/usr/bin/env python3
"""Money Explained — logo (own work, vector). Mark = a gold rupee coin seen through a magnifying glass
(money + explained). Outputs profile picture, mark on transparent, horizontal + stacked wordmarks."""
import os
import cairosvg

OUT = os.path.dirname(os.path.abspath(__file__))
INK = "#0A0F1E"       # near-black navy
NAVY = "#121A33"
GOLD_HI, GOLD, GOLD_LO = "#FBE7A1", "#E3B04B", "#9A6A1C"

DEFS = f"""
<defs>
  <radialGradient id="bg" cx="50%" cy="42%" r="70%">
    <stop offset="0" stop-color="#1B2547"/><stop offset="0.6" stop-color="{NAVY}"/><stop offset="1" stop-color="{INK}"/>
  </radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{GOLD_HI}"/><stop offset="0.45" stop-color="{GOLD}"/><stop offset="1" stop-color="{GOLD_LO}"/>
  </linearGradient>
  <linearGradient id="goldR" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{GOLD_HI}"/><stop offset="0.5" stop-color="{GOLD}"/><stop offset="1" stop-color="{GOLD_LO}"/>
  </linearGradient>
  <radialGradient id="coin" cx="38%" cy="32%" r="80%">
    <stop offset="0" stop-color="#FFF3C4"/><stop offset="0.35" stop-color="#F0C964"/><stop offset="0.8" stop-color="#C68E2E"/><stop offset="1" stop-color="#8E5F17"/>
  </radialGradient>
  <linearGradient id="glare" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity="0.55"/>
  </filter>
</defs>"""


def rupee(cx, cy, s, colour):
    """geometric ₹ drawn as strokes inside a 100x100 box centred on (cx,cy), size s"""
    k = s / 100
    x0, y0 = cx - 50 * k, cy - 50 * k
    w = 12 * k

    def P(x, y):
        return f"{x0 + x * k:.1f} {y0 + y * k:.1f}"
    return (f'<g fill="none" stroke="{colour}" stroke-width="{w:.1f}" stroke-linecap="square" stroke-linejoin="miter">'
            f'<path d="M{P(24, 14)} H{P(78, 14).split()[0]}"/>'
            f'<path d="M{P(24, 36)} H{P(78, 36).split()[0]}"/>'
            f'<path d="M{P(24, 14)} H{P(44, 14).split()[0]} C{P(74, 14)} {P(74, 58)} {P(44, 58)} H{P(26, 58).split()[0]}"/>'
            f'<path d="M{P(30, 58)} L{P(72, 92)}" stroke-linecap="butt"/>'
            "</g>")


def mark(cx, cy, R):
    """magnifier: gold ring + coin face with ₹, glare, handle down-right"""
    ring = R * 0.17
    face = R - ring * 0.5
    hx0, hy0 = cx + R * 0.74, cy + R * 0.74
    hx1, hy1 = cx + R * 1.42, cy + R * 1.42
    g = f'<g filter="url(#sh)">'
    # handle (behind ring): collar + grip
    g += f'<line x1="{hx0:.1f}" y1="{hy0:.1f}" x2="{hx1:.1f}" y2="{hy1:.1f}" stroke="url(#goldR)" stroke-width="{R * 0.30:.1f}" stroke-linecap="round"/>'
    g += f'<line x1="{cx + R * 0.86:.1f}" y1="{cy + R * 0.86:.1f}" x2="{cx + R * 0.98:.1f}" y2="{cy + R * 0.98:.1f}" stroke="{INK}" stroke-width="{R * 0.31:.1f}" stroke-opacity="0.35"/>'
    # coin face
    g += f'<circle cx="{cx}" cy="{cy}" r="{face:.1f}" fill="url(#coin)"/>'
    # inner engraved ring of the coin
    g += f'<circle cx="{cx}" cy="{cy}" r="{face * 0.80:.1f}" fill="none" stroke="#8E5F17" stroke-opacity="0.55" stroke-width="{R * 0.025:.1f}"/>'
    # reeded edge dots
    import math
    for i in range(60):
        a = 2 * math.pi * i / 60
        g += f'<circle cx="{cx + face * 0.90 * math.cos(a):.1f}" cy="{cy + face * 0.90 * math.sin(a):.1f}" r="{R * 0.012:.1f}" fill="#8E5F17" fill-opacity="0.5"/>'
    g += rupee(cx + R * 0.03, cy + R * 0.03, face * 1.1, INK)
    # lens ring
    g += f'<circle cx="{cx}" cy="{cy}" r="{R - ring / 2:.1f}" fill="none" stroke="url(#gold)" stroke-width="{ring:.1f}"/>'
    g += f'<circle cx="{cx}" cy="{cy}" r="{R - ring:.1f}" fill="none" stroke="{INK}" stroke-opacity="0.85" stroke-width="{R * 0.035:.1f}"/>'
    # glass glare
    g += (f'<path d="M{cx - face * 0.78:.1f} {cy - face * 0.10:.1f} A{face * 0.8:.1f} {face * 0.8:.1f} 0 0 1 {cx - face * 0.10:.1f} {cy - face * 0.78:.1f}" '
          f'fill="none" stroke="url(#glare)" stroke-width="{R * 0.07:.1f}" stroke-linecap="round"/>')
    return g + "</g>"


def svg(w, h, body, bg=True):
    b = f'<rect width="{w}" height="{h}" fill="url(#bg)"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{DEFS}{b}{body}</svg>'


def save(name, s, w=None):
    open(os.path.join(OUT, name + ".svg"), "w").write(s)
    cairosvg.svg2png(bytestring=s.encode(), write_to=os.path.join(OUT, name + ".png"), output_width=w)


# 1) profile picture (circle-safe: everything inside the central 80 %)
save("profile_1080", svg(1080, 1080, mark(470, 470, 270)))
# 2) mark only, transparent
save("mark_transparent", svg(900, 900, mark(390, 390, 250), bg=False))
# 3) horizontal wordmark (dark)
word = (f'<text x="620" y="330" font-family="Anton" font-size="250" fill="url(#gold)" letter-spacing="4">MONEY</text>'
        f'<text x="630" y="440" font-family="Inter" font-weight="300" font-style="italic" font-size="118" fill="#F4F1E8">explained</text>')
save("wordmark_dark", svg(1640, 600, mark(330, 270, 190) + word))
save("wordmark_transparent", svg(1640, 600, mark(330, 270, 190) + word, bg=False))
# 4) stacked (for video outro / posts)
stack = (mark(540, 470, 250) +
         f'<text x="540" y="1020" text-anchor="middle" font-family="Anton" font-size="230" fill="url(#gold)" letter-spacing="4">MONEY</text>'
         f'<text x="540" y="1140" text-anchor="middle" font-family="Inter" font-weight="300" font-style="italic" font-size="110" fill="#F4F1E8">explained</text>')
save("stacked_1080x1350", svg(1080, 1350, stack))
print("ok")
