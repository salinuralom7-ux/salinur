#!/usr/bin/env bash
# Runs on GitHub's runner. CC0 3D: Kenney kits (animated characters, buildings, props),
# Quaternius animated characters via OpenGameArt, Poly Haven HDRIs. Index in lib3d/INDEX.tsv.
set -uo pipefail
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
mkdir -p lib3d/kenney lib3d/oga lib3d/hdri lib3d/pages; idx=lib3d/INDEX.tsv; printf 'item\tsource\tlicense\n' > $idx

# Kenney: known slugs + every asset slug found on character searches
curl -sL -A "$UA" "https://kenney.nl/assets?search=character" -o lib3d/pages/kenney_search.html
curl -sL -A "$UA" "https://kenney.nl/assets/category:3D" -o lib3d/pages/kenney_3d.html
slugs=$( (grep -ohE 'kenney\.nl/assets/[a-z0-9-]+' lib3d/pages/kenney_*.html | sed 's#.*/##'; \
          printf '%s\n' animated-characters-1 animated-characters-2 animated-characters-3 blocky-characters mini-characters mini-characters-1 \
          city-kit-commercial city-kit-suburban furniture-kit car-kit) | grep -vE '^(category|search)' | sort -u)
for pack in $slugs; do
  case "$pack" in *character*|*city-kit*|furniture-kit|car-kit|*people*|*avatar*) ;; *) continue;; esac
  page="https://kenney.nl/assets/$pack"
  zip=$(curl -sL -A "$UA" "$page" | grep -oE 'https://kenney\.nl/media/pages/assets/[^"]+\.zip' | head -1)
  [ -n "$zip" ] || { echo "no zip: $pack"; continue; }
  curl -sfL -A "$UA" "$zip" -o /tmp/k.zip && unzip -qo /tmp/k.zip -d "lib3d/kenney/$pack" \
    && printf '%s\t%s\t%s\n' "kenney/$pack" "$page" "CC0" >> $idx && echo "ok: $pack"
done

# Quaternius & others on OpenGameArt: CC0 animated characters (3D)
for q in "quaternius character" "animated character rigged" "low poly people animated" "doctor 3d"; do
  qq=${q// /+}
  curl -sL -A "$UA" "https://opengameart.org/art-search-advanced?keys=$qq&field_art_licenses_tid%5B%5D=4&sort_by=count&sort_order=DESC" -o "lib3d/pages/oga_${qq}.html"
  grep -oE 'href="/content/[a-z0-9-]+"' "lib3d/pages/oga_${qq}.html" | sed 's/href="//;s/"$//' | sort -u | head -6 | while read -r c; do
    curl -sL -A "$UA" "https://opengameart.org$c" -o /tmp/c.html
    grep -q 'CC0' /tmp/c.html || continue
    grep -oE 'https://opengameart\.org/sites/default/files/[^"]+\.(zip|glb|gltf|fbx|blend)' /tmp/c.html | sort -u | head -3 | while read -r url; do
      f="lib3d/oga/$(basename "$c")/$(basename "$url" | sed 's/%20/_/g')"; [ -f "$f" ] && continue
      mkdir -p "$(dirname "$f")"
      curl -sfL -A "$UA" "$url" -o "$f" && printf '%s\t%s\t%s\n' "$f" "https://opengameart.org$c" "CC0 (OpenGameArt)" >> $idx && echo "ok: $f"
    done
  done
done
find lib3d/oga -name '*.zip' -exec sh -c 'unzip -qo "$1" -d "${1%.zip}" && rm "$1"' _ {} \;

# drop previews/samples only — keep fbx/glb/gltf/obj/blend + textures
find lib3d -type f \( -iname 'Preview*' -o -iname 'Sample*' -o -iname '*.blend1' -o -iname '*.unitypackage' \) -delete
for h in studio_small_09 brown_photostudio_02 kloofendal_48d_partly_cloudy_puresky; do
  url=$(curl -s "https://api.polyhaven.com/files/$h" | python3 -c "import json,sys;print(json.load(sys.stdin)['hdri']['2k']['hdr']['url'])" 2>/dev/null)
  [ -n "$url" ] && curl -sfL "$url" -o "lib3d/hdri/$h.hdr" && printf '%s\t%s\t%s\n' "hdri/$h" "https://polyhaven.com/a/$h" "CC0" >> $idx
done
du -sh lib3d/* lib3d/kenney/* lib3d/oga/* 2>/dev/null | head -60
