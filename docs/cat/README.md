# The trade photographs

One square photograph per tile on the home screen. Tapping the picture opens
the results for that trade, filtered to the customer's own area.

**Nothing here is required for the app to work.** A tile with no photograph
shows its line icon instead and behaves identically, so these can arrive one
at a time, in any order, whenever they are ready.

---

## What a file has to be

| | |
|---|---|
| Format | **WebP** |
| Size | **400 × 400**, square |
| Weight | under 30 KB — the doctor is 9 KB |
| Name | exactly the slug below, lowercase, `.webp` |
| Location | `docs/cat/` |

Send the images as they come out of the generator — full size, PNG or JPEG is
fine — and they will be squared, resized and converted here. Getting that
wrong is not worth your time.

---

## The twelve, and what each one needs

Nine of the twelve have a photograph. Three to go.

| Slug | Shows | Status |
|---|---|---|
| `general-physician` | doctor with a stethoscope | ✅ |
| `electrician` | electrician at a switchboard | ✅ |
| `plumber` | plumber under a sink | ✅ |
| `ac-repair` | technician on a split AC unit | ✅ |
| `home-tutor` | tutor with a schoolchild | ✅ |
| `beautician` | beautician giving a facial | ✅ |
| `driver` | driver at the wheel | ✅ |
| `packers-movers` | two movers with a box | ✅ |
| `tailor` | tailor at a sewing machine | ✅ |
| `housemaid` | woman cleaning a home | **wanted** |
| `home-cook` | woman cooking in a home kitchen | **wanted** |
| `carpenter` | carpenter measuring a plank | **wanted** |

Three more exist but are not on the home grid, which holds twelve. They are
ready if the twelve ever change, and they are the right size for Instagram and
for ad creative in the meantime:

| Slug | Shows |
|---|---|
| `home-nurse` | nurse taking an elderly woman's blood pressure |
| `car-mechanic` | mechanic under a car bonnet |
| `video-editor` | editor at a timeline |

---

## Prompts

One paste per image. The three constants matter more than the wording: **Indian
person, real photograph, square, plain background.** Anything that looks like a
Western stock library breaks the illusion that these are people from Guwahati.

```
A friendly Indian electrician in his 30s working at an electrical switchboard,
wearing a work shirt, holding a screwdriver, looking at the camera and smiling
slightly. Photorealistic, natural daylight, shallow depth of field, plain
softly blurred background. Square 1:1 composition, subject centred, head and
upper body in frame.
```

```
A friendly Indian plumber in his 30s crouched under a kitchen sink with a pipe
wrench, wearing a work shirt, looking at the camera. Photorealistic, natural
daylight, shallow depth of field, plain softly blurred background. Square 1:1,
subject centred.
```

```
A warm Indian woman in her 30s in a simple salwar kameez cleaning a bright
Indian home, holding a cloth, looking at the camera and smiling.
Photorealistic, natural daylight, shallow depth of field, plain softly blurred
background. Square 1:1, subject centred.
```

```
A warm Indian woman in her 40s cooking in a home kitchen, stirring a steel
pan, wearing a cotton saree, looking at the camera and smiling.
Photorealistic, natural daylight, shallow depth of field, plain softly blurred
background. Square 1:1, subject centred.
```

```
An Indian carpenter in his 40s measuring a wooden plank with a tape measure in
a small workshop, wearing a work shirt, looking at the camera.
Photorealistic, natural daylight, shallow depth of field, plain softly blurred
background. Square 1:1, subject centred.
```

```
An Indian air-conditioning technician in his 30s servicing a wall-mounted
split AC unit, in a technician's uniform, looking at the camera.
Photorealistic, natural daylight, shallow depth of field, plain softly blurred
background. Square 1:1, subject centred.
```

```
An Indian beautician in her 20s in a clean home salon setting, holding beauty
tools, wearing a neat kurta, looking at the camera and smiling.
Photorealistic, natural daylight, shallow depth of field, plain softly blurred
background. Square 1:1, subject centred.
```

```
An Indian home tutor in her 20s sitting at a table teaching a school child
from a notebook, warm and encouraging, looking at the camera.
Photorealistic, natural daylight, shallow depth of field, plain softly blurred
background. Square 1:1, subjects centred.
```

```
An Indian driver in his 40s standing beside a white hatchback car holding the
keys, in a clean shirt, looking at the camera and smiling. Photorealistic,
natural daylight, shallow depth of field, plain softly blurred background.
Square 1:1, subject centred.
```

```
Two Indian movers in their 30s in matching uniforms carrying a large cardboard
box together, looking at the camera. Photorealistic, natural daylight, shallow
depth of field, plain softly blurred background. Square 1:1, subjects centred.
```

```
An Indian tailor in his 50s at a sewing machine with fabric in his hands,
measuring tape around his neck, looking at the camera. Photorealistic, natural
daylight, shallow depth of field, plain softly blurred background. Square 1:1,
subject centred.
```

---

## Two things to keep to

**Do not use a photograph of a real person who has not agreed to it.** These
are generated images of nobody, which is exactly why they are safe to use for
a category. A real face belongs on that person's own profile and nowhere else.

**Do not let a generated face end up looking like a listing.** These sit on
category tiles, never on a profile card, never in a search result. A customer
must never be shown an invented person as though they were somebody they could
book.
