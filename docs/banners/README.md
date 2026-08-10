# The home-screen banners

Three slots, one shown at a time, changing every six seconds. Edited from the
admin screen — **Admin → Banner** — with no deploy and no code change.

## Putting a banner up

1. Send the image here and it gets committed as `banners/<name>.webp`.
2. Admin → Banner → paste `banners/<name>.webp` into **Picture**.
3. Add a **Link** if tapping it should go somewhere. It must start with
   `https://` — the database refuses anything else, because a banner link is
   followed by a phone that trusts us.
4. Tick **Showing** → **Save the banners**.

A slot with Showing off, or with no picture, is skipped. Turn all three off and
the band disappears from the home screen rather than leaving an empty frame.

## What an image should be

| | |
|---|---|
| Shape | **2:1** — twice as wide as tall |
| Size | **1000 × 500** is plenty |
| Format | WebP, or send anything and it gets converted |
| Weight | under 60 KB |

The slot is a fixed 2:1 box and the picture is cropped to fill it, so keep
anything important away from the edges.

## Selling the slot

This is the one place MySheher can take money without touching what a service
expert earns, which is what keeps "no commission, ever" true. If you sell it:

* the advertiser's link is theirs, but it still has to be `https://`;
* say it is an advertisement somewhere on the image itself — a banner that
  reads as MySheher's own recommendation, when somebody paid for it, is the
  kind of thing that ends up in a complaint;
* nothing about the viewer reaches the advertiser. The link carries no
  referrer and no identifier — `rel="noopener noreferrer nofollow"` — so this
  stays consistent with the privacy policy's promise of no tracking.
