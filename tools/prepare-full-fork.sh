#!/usr/bin/env bash
# Create a genuine Git branch preserving upstream history, then apply this UXP source target.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$ROOT/../twp-uxp-git-fork}"
[[ ! -e "$DEST" ]] || { echo "Already exists: $DEST" >&2; exit 1; }
git clone https://github.com/FilipePS/Traduzir-paginas-web.git "$DEST"
cd "$DEST"
git checkout v10.2.1.0
git switch -c uxp-palemoon
cp -a "$ROOT/uxp" "$DEST/uxp"
cp "$ROOT/UXP-PORT-README.md" "$DEST/UXP-PORT-README.md"
cp "$ROOT/tools/build-uxp.py" "$DEST/tools/build-uxp.py"
python3 tools/build-uxp.py
printf 'Git fork ready: %s\n' "$DEST"
