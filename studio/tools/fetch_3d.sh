#!/usr/bin/env bash
# Runs on GitHub's runner. CC0 3D: Kenney kits (characters, buildings, props) + Poly Haven HDRIs.
set -uo pipefail
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
mkdir -p lib3d/kenney lib3d/hdri; idx=lib3d/INDEX.tsv; printf 'item\tsource\tlicense\n' > $idx
for pack in mini-characters-1 mini-characters animated-characters-1 animated-characters-2 blocky-characters \
            city-kit-commercial city-kit-suburban city-kit-roads car-kit furniture-kit mini-market \
            prototype-kit food-kit modular-buildings building-kit; do
  page="https://kenney.nl/assets/$pack"
  zip=$(curl -sL -A "$UA" "$page" | grep -oE 'https://kenney\.nl/media/pages/assets/[^"]+\.zip' | head -1)
  [ -n "$zip" ] || { echo "no zip: $pack"; continue; }
  curl -sfL -A "$UA" "$zip" -o /tmp/k.zip && unzip -qo /tmp/k.zip -d "lib3d/kenney/$pack" \
    && printf '%s\t%s\t%s\n' "kenney/$pack" "$page" "CC0" >> $idx && echo "ok: $pack"
done
# keep only model formats + textures + licence (drop huge previews / fbx duplicates)
find lib3d/kenney -type f \( -iname '*.fbx' -o -iname '*.obj' -o -iname '*.mtl' -o -iname '*.dae' -o -iname 'Preview*' -o -iname '*.blend1' \) -delete
for h in studio_small_09 studio_small_08 brown_photostudio_02 venice_sunset kloofendal_48d_partly_cloudy_puresky; do
  url=$(curl -s "https://api.polyhaven.com/files/$h" | python3 -c "import json,sys;print(json.load(sys.stdin)['hdri']['2k']['hdr']['url'])" 2>/dev/null)
  [ -n "$url" ] && curl -sfL "$url" -o "lib3d/hdri/$h.hdr" && printf '%s\t%s\t%s\n' "hdri/$h" "https://polyhaven.com/a/$h" "CC0" >> $idx && echo "ok: $h"
done
du -sh lib3d/*; find lib3d/kenney -maxdepth 3 -type d | head -60
