#!/usr/bin/env bash
# Runs on GitHub's runner (the editing session can't reach these sites).
# Collects public-domain music (FreePD.com, CC0) and CC0 sound packs (Kenney)
# into ./library/ with an index of where every file came from.
set -uo pipefail
mkdir -p library/music library/sfx
idx=library/INDEX.tsv; printf 'file\tsource_url\tlicense\n' > "$idx"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

# FreePD: start at the home page, follow its internal links one level, take every .mp3.
mkdir -p library/pages
curl -sL -A "$UA" "https://freepd.com/" -o library/pages/home.html
{ echo "https://freepd.com/"
  grep -oiE 'href="[^"#]+"' library/pages/home.html | sed 's/href="//;s/"$//' | grep -viE '\.(mp3|css|js|png|jpg|ico)$' \
    | sed -E 's#^/#https://freepd.com/#; s#^([^h])#https://freepd.com/\1#' | grep '^https://freepd.com' ; } | sort -u > /tmp/pages.txt
echo "FreePD pages: $(wc -l < /tmp/pages.txt)"
while read -r pg; do
  cat=$(basename "${pg%/}" | sed 's/\.[a-z]*$//'); [ "$cat" = "freepd.com" ] && cat=home
  curl -sL -A "$UA" "$pg" -o "/tmp/pg.html" || continue
  grep -oiE "[^\"'<>()=]+\.mp3" /tmp/pg.html | sort -u | while read -r u; do
    case "$u" in http*) url="$u";; /*) url="https://freepd.com$u";; *) url="https://freepd.com/$u";; esac
    url="${url// /%20}"; f="library/music/$cat/$(basename "$url" | sed 's/%20/_/g')"
    [ -f "$f" ] && continue; mkdir -p "$(dirname "$f")"
    curl -sfL -A "$UA" "$url" -o "$f" && printf '%s\t%s\t%s\n' "$f" "$url" "FreePD public domain (CC0)" >> "$idx"
  done
done < /tmp/pages.txt
cp /tmp/pages.txt library/pages/

for pack in interface-sounds impact-sounds ui-audio digital-audio; do
  page="https://kenney.nl/assets/$pack"
  zip=$(curl -sL -A "$UA" "$page" | grep -oE 'https://kenney\.nl/media/pages/assets/[^"]+\.zip' | head -1)
  [ -n "$zip" ] || { echo "no zip for $pack"; continue; }
  curl -sfL -A "$UA" "$zip" -o "/tmp/$pack.zip" && unzip -qo "/tmp/$pack.zip" -d "library/sfx/$pack" \
    && printf '%s\t%s\t%s\n' "library/sfx/$pack/" "$page" "Kenney CC0" >> "$idx"
done
du -sh library/music/* library/sfx/* 2>/dev/null
wc -l "$idx"
