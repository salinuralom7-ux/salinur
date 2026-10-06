#!/usr/bin/env python3
"""Runs on GitHub's runner. For each 'name|query' line, searches Openverse + Wikimedia Commons for
CC0 / public-domain photos, downloads up to N per query, cuts them out (rembg) and writes
out/<name>/<n>.png + out/LICENSES.tsv + out/<name>_sheet.jpg (alpha over grey)."""
import json, os, sys, time, io, urllib.parse, urllib.request
from PIL import Image
from rembg import remove, new_session

qfile, out, N = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 6
UA = {"User-Agent": "salinur-studio/1.0 (github actions; salinuralom7-ux)"}
sess = new_session("isnet-general-use")
os.makedirs(out, exist_ok=True)
lic = open(f"{out}/LICENSES.tsv", "a")


def get(url, raw=False):
    r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
    return r if raw else json.loads(r)


def openverse(q):
    u = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(
        {"q": q, "license": "cc0,pdm", "category": "photograph", "page_size": 12})
    try:
        return [(r["url"], r.get("foreign_landing_url", ""), r["license"], r.get("creator") or "") for r in get(u)["results"]]
    except Exception as e:
        print("openverse fail", q, e); return []


def commons(q):
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap {q}",
        "gsrnamespace": 6, "gsrlimit": 15, "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1600})
    res = []
    try:
        for p in get(u).get("query", {}).get("pages", {}).values():
            ii = p["imageinfo"][0]; m = ii.get("extmetadata", {})
            l = m.get("LicenseShortName", {}).get("value", "")
            if any(k in l.lower() for k in ("cc0", "public domain", "pd")):
                res.append((ii.get("thumburl") or ii["url"], ii["descriptionurl"], l, m.get("Artist", {}).get("value", "")[:80]))
    except Exception as e:
        print("commons fail", q, e)
    return res


count = {}
for line in open(qfile):
    if "|" not in line:
        continue
    name, q = [s.strip() for s in line.split("|", 1)]
    os.makedirs(f"{out}/{name}", exist_ok=True)
    got = 0
    for (url, land, l, who) in openverse(q) + commons(q):
        if got >= N:
            break
        try:
            im = Image.open(io.BytesIO(get(url, raw=True))).convert("RGB")
            if min(im.size) < 500:
                continue
            im.thumbnail((1600, 1600))
            cut = remove(im, session=sess)
            k = count.get(name, 0); count[name] = k + 1
            cut.save(f"{out}/{name}/{k:02d}.png")
            lic.write(f"{name}/{k:02d}.png\t{l}\t{land}\t{who}\t{q}\n"); lic.flush()
            got += 1
            print(name, k, l, land, flush=True)
        except Exception as e:
            print("skip", url, e)
        time.sleep(0.5)

# contact sheets
for name in count:
    ims = [Image.open(f"{out}/{name}/{k:02d}.png") for k in range(count[name])]
    sheet = Image.new("RGB", (300 * len(ims), 330), (128, 128, 140))
    for i, im in enumerate(ims):
        im.thumbnail((290, 290)); sheet.paste(im, (300 * i + 5, 5), im)
    sheet.save(f"{out}/{name}_sheet.jpg", quality=85)
