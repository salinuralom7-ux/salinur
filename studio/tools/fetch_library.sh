#!/usr/bin/env bash
# Runs on GitHub's runner (the editing session can't reach these sites).
# Collects public-domain music (FreePD.com, CC0) and CC0 sound packs (Kenney)
# into ./library/ with an index of where every file came from.
set -uo pipefail
mkdir -p library/music library/sfx
idx=library/INDEX.tsv; printf 'file\tsource_url\tlicense\n' > "$idx"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

mkdir -p library/pages
# 1) OpenGameArt music filtered to CC0 (type 12 = Music, license 4 = CC0), a few mood searches.
for q in inspirational motivational uplifting corporate piano ambient cinematic hopeful; do
  pg="https://opengameart.org/art-search-advanced?keys=$q&field_art_type_tid%5B%5D=12&field_art_licenses_tid%5B%5D=4&sort_by=count&sort_order=DESC"
  curl -sL -A "$UA" "$pg" -o "library/pages/oga_$q.html"
  grep -oE 'href="/content/[a-z0-9-]+"' "library/pages/oga_$q.html" | sed 's/href="//;s/"$//' | sort -u | head -8 | while read -r c; do
    curl -sL -A "$UA" "https://opengameart.org$c" -o /tmp/c.html
    grep -q 'CC0' /tmp/c.html || continue
    grep -oE 'https://opengameart\.org/sites/default/files/[^"]+\.(mp3|ogg)' /tmp/c.html | sort -u | head -2 | while read -r url; do
      f="library/music/oga_$q/$(basename "$url" | sed 's/%20/_/g')"; [ -f "$f" ] && continue
      mkdir -p "$(dirname "$f")"
      curl -sfL -A "$UA" "$url" -o "$f" && printf '%s\t%s\t%s\n' "$f" "https://opengameart.org$c" "CC0 (OpenGameArt)" >> "$idx"
    done
  done
done
# 2) Kevin MacLeod / incompetech, CC-BY 4.0: credit "Music: <Title> by Kevin MacLeod (incompetech.com), CC BY 4.0".
for t in "Inspired" "Carefree" "Wallpaper" "Dreamer" "Healing" "Clear Air" "Easy Lemon" "Bright Wish" "Light Awash" \
         "Heartwarming" "Ascending the Vale" "Brightly Fancy" "Hidden Agenda" "Investigations" "Life of Riley" \
         "Wholesome" "Aspire" "Motivator" "Fresh Air" "Inner Light" "Feather Waltz" "Sincerely" "Hopeful Freedom" \
         "Achievement" "Positive Thinking" "Rising Game" "Thinking Music" "Fearless First" "Reaching the Sky" "Pride"; do
  u="https://incompetech.com/music/royalty-free/mp3-royaltyfree/${t// /%20}.mp3"
  f="library/music/incompetech/${t// /_}.mp3"; mkdir -p library/music/incompetech
  curl -sfL -A "$UA" "$u" -o "$f" && [ "$(stat -c%s "$f")" -gt 100000 ] \
    && printf '%s\t%s\t%s\n' "$f" "$u" "CC BY 4.0 Kevin MacLeod (credit required)" >> "$idx" || rm -f "$f"
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
