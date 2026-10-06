# STUDY — ref16

`576x1024` · 30 fps · 55.6 s · -14.2 LUFS · 2 cuts (2.2/min, avg shot 18.52 s)

## Colour & light (median / 10th / 90th pct)

- luma: (70.43, 65.81, 72.78)
- contrast: (17.98, 15.7, 20.52)
- saturation: (28.54, 27.55, 30.08)
- black_point: (12.55, 4.71, 22.55)
- white_point: (91.76, 90.59, 92.55)
- tint_a: (11.49, 11.21, 11.95)
- warmth_b: (-29.28, -29.92, -28.06)
- shadow_tint_b: (-16.42, -24.41, -8.33)
- highlight_tint_b: (-19.63, -20.42, -18.99)
- face centre_y: (0.45, 0.42, 0.48)
- face height: (0.21, 0.19, 0.22)
- face key_minus_fill: (-3.38, -31.34, 24.58)
- face face_minus_frame: (-7.93, -8.13, -7.73)
- face skin_hue: (241.17, 237.98, 244.35)

## Shots

| # | start | len (s) | luma | sat |
|---|---|---|---|---|
| 0 | 0.0 | 51.53 | 70.5 | 28.6 |
| 1 | 51.53 | 0.03 | None | None |
| 2 | 51.57 | 4.0 | 17.4 | 29.8 |

Zoom/punch moves at: 0.1, 0.2, 0.3, 0.4, 1.1, 1.2, 4.4, 4.5, 4.6, 4.7, 5.1, 6.2, 6.3, 7.1, 7.2, 8.4, 8.5, 9.3, 9.4, 9.5, 11.2, 11.6, 11.7, 11.8, 13.5, 13.6, 13.7, 13.8, 13.9, 14.0, 15.0, 15.1, 15.7, 16.1, 16.2, 16.3, 16.4, 16.7, 16.8, 21.1

## Breakdown (4 fps + 30 fps transition frames + full-res + Demucs stems)

**Salinur: "When I said graphic motion, this is exactly what I mean. I want this level of motion graphics."** — this is the TARGET for motion graphics.

Faceless voice-over essay (English, 55.6 s, 2 hard cuts — everything is animation). Topic: Einstein's flow state → AI shortcuts kill talent.

### The look (art direction)
- **One duotone world.** Every image is a **cut-out photo** (person/object, no background) recoloured to **black-and-white + one indigo/periwinkle tint (#5B5BD6 / #8A8AF0)**, with a real **soft contact shadow** on the floor. Background = the same indigo as a **radial gradient: near-white glow in the centre → saturated indigo at the edges** (studio-sweep look). Fine film grain over everything.
- **Collage / surreal scale:** giant hand holding chalk next to tiny Einstein; brain wearing crutches; brain hanging from a parachute; laptop floating with lightbulbs; pen nibs lined up like bullets. **Each sentence = one visual metaphor of exactly what is said.**
- Only one extra accent colour, used once for drama: **orange fire** on the burning pixel "E=mc²".
- Small details orbit the hero object: pocket watches + planets around the hand, dotted orbit ellipse around a figure, cursor arrows around the sofa, lightbulbs floating.

### Typography (= the captions)
- **Condensed heavy caps** (Bebas Neue / Anton / "Druk Condensed"-like), deep indigo **#1E1E5A**, for 1–3 key words of each sentence (ALBERT EINSTEIN, EQUATIONS, 2AM, CHALK, VIOLIN, MOZART, POUNDED, FLOW STATE, ESCAPING, ACTIVELY KILLING, AI SHORTCUTS, THINK, CARS, LACE UP RUNNING SHOES, SPRINT, MORNING, WHY?, ENGINE, WORK, MUSCLES ROT, HAPPENS TO THE MIND, SHORTCUT, CLIMB, CREATIVE INFLATION, EFFICIENCY, HUMAN TALENT, THOUSANDS OF PEOPLE, HEAVY SANDBAGS, TERRIFYING FUTURE OF ART, SOMETHING).
- **Small light italic** for the connective words ("In,", "was losing", "a war against", "by candlelight", "while his neighbours", "about it", "goes up", "goes down"), tucked tightly beside/above/below the big words — **a word ladder that re-composes for every sentence**, placed around the image (top-left, bottom-right…), never as a bottom subtitle bar.
- Letters **type in one at a time** (ALB → ALBERT → ALBERT EINSTEIN) synced to speech; once a phrase is done it stays until the scene changes. One word italic-caps for emphasis ("FLOW", "CREATIVE INFLATION").

### Motion (frame-by-frame at 30 fps)
- **Scene = one sentence (3–5 s).** Hero image enters with a **pixel/mosaic dissolve** (blocks resolve into the image) or **scale-in from small + slight rotation**, then keeps a **slow continuous drift / push** (never static). Supporting elements bob/float and orbit.
- **Transitions between scenes:** previous scene **dissolves out to the empty gradient** (~4 frames), next hero **assembles piece by piece** (E → E= → E=M → E=MC → E=MC² letter blocks pop in one by one while the caption types). Circle ripple (white ring expanding) behind the hero on a hit word ("POUNDED").
- Camera never cuts on a picture; the background is constant → feels like one continuous animated world.
- Outro: everything darkens to near-black indigo, Instagram glyph + handle.

### Sound
- Music: mid-tempo (~118 BPM) cinematic/lo-fi bed, loud (≈2–7 dB under the voice).
- **61 SFX hits in 55 s (≈1.1/s):** a sound for **every** element that appears — pops for letters/objects, whooshes for drifts, ticks for typing, impacts on key words, crackle on fire. Sound design is as dense as the visuals.

### Why it works
- Literal visual for every sentence + consistent art direction = premium, "documentary-animation" feel.
- Typography is the layout, not subtitles.
- Constant motion inside a constant world.

### How we produce this (production plan for Salinur's videos)
1. **Script → shot list:** one metaphor image per sentence (what exactly is said).
2. **Images:** cut-out photos/objects — sources: AI image generation (Canva `generate-image` connector is available to this session), CC0 photo packs, or our own 3D renders (Blender, consistent lighting). Background removal + duotone recolour + contact shadow done in code.
3. **Duotone treatment:** grayscale → map shadows to #1E1E5A, highlights to white, mid-tones tinted indigo; add soft shadow + grain.
4. **Layout & type:** condensed caps (Bebas Neue/Anton — free) + light italic (Inter/Playfair Italic); word ladder positions per sentence.
5. **Animation:** pixel-dissolve in, slow drift, orbiting props, letter-by-letter type, piece-by-piece assembly; SFX per element.
6. With Salinur on camera: put HIM in this world — his cut-out (person matte, already working) duotoned on the gradient for cutaway scenes, back to colour talking head between them.
