#!/usr/bin/env bash
# Symlink this repo into Cursor local plugins so the MCP + rules + skill load.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${HOME}/.cursor/plugins/local/privacy-gateway"
mkdir -p "$(dirname "$TARGET")"
if [[ -e "$TARGET" || -L "$TARGET" ]]; then
  rm -rf "$TARGET"
fi
ln -s "$ROOT" "$TARGET"
echo "Installed: $TARGET -> $ROOT"
echo "Reload Cursor window, then enable plugin variables OFFICE_USER_ID / OFFICE_ROLE."
