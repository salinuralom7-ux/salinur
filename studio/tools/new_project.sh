#!/usr/bin/env bash
# Creates projects/<video-name>/ with the standard layout.
set -euo pipefail
cd "$(dirname "$0")/.."
p="projects/$1"
mkdir -p "$p"/{raw,work,3d,final}
[ -f "$p/CREDITS.md" ] || printf '# CREDITS — %s\n\n| Asset | Used at | Source URL | License | Credit line needed? |\n|---|---|---|---|---|\n' "$1" > "$p/CREDITS.md"
echo "Created $p — put raw footage in $p/raw/"
