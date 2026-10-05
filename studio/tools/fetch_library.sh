#!/usr/bin/env bash
# Runs on GitHub's runner (the editing session can't reach these sites).
# Collects public-domain music (FreePD.com, CC0) and CC0 sound packs (Kenney)
# into ./library/ with an index of where every file came from.
set -uo pipefail
mkdir -p library/music library/sfx
idx=library/INDEX.tsv; printf 'file\tsource_url\tlicense\n' > "$idx"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

for cat in upbeat epic electronic misc scoring romantic; do
  curl -sL -A "$UA" "https://freepd.com/$cat.php" -o "/tmp/$cat.html" || continue
  grep -oE 'href="[^"]+\.mp3"' "/tmp/$cat.html" | sed 's/href="//;s/"$//' | sort -u | while read -r u; do
    case "$u" in http*) url="$u";; /*) url="https://freepd.com$u";; *) url="https://freepd.com/$u";; esac
    f="library/music/$cat/$(basename "$url" | sed 's/%20/_/g')"
    mkdir -p "$(dirname "$f")"
    curl -sfL -A "$UA" "$url" -o "$f" && printf '%s\t%s\t%s\n' "$f" "$url" "FreePD public domain (CC0)" >> "$idx"
  done
done

for pack in interface-sounds impact-sounds ui-audio digital-audio; do
  page="https://kenney.nl/assets/$pack"
  zip=$(curl -sL -A "$UA" "$page" | grep -oE 'https://kenney\.nl/media/pages/assets/[^"]+\.zip' | head -1)
  [ -n "$zip" ] || { echo "no zip for $pack"; continue; }
  curl -sfL -A "$UA" "$zip" -o "/tmp/$pack.zip" && unzip -qo "/tmp/$pack.zip" -d "library/sfx/$pack" \
    && printf '%s\t%s\t%s\n' "library/sfx/$pack/" "$page" "Kenney CC0" >> "$idx"
done
du -sh library/music/* library/sfx/* 2>/dev/null
wc -l "$idx"
