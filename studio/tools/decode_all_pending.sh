#!/usr/bin/env bash
# Decodes every row marked `pending` in references/REFERENCE_LINKS.md.
set -uo pipefail
cd "$(dirname "$0")/.."
grep -E '^\| [0-9]+ .*\| pending \|' references/REFERENCE_LINKS.md | while IFS='|' read -r _ _ _ name link _; do
  name=$(echo $name); link=$(echo $link)
  echo "== $name  $link"
  tools/decode_reference.sh "$link" "$name" || echo "!! $name failed"
done
