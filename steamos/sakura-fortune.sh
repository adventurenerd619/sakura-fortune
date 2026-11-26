#!/usr/bin/env bash
# Sakura Fortune launcher (SteamOS / Linux). Steam should launch this script, not the raw binary.
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
ARGS=()
# Electron's sandbox needs unprivileged user namespaces; fall back if they are disabled
if [ -r /proc/sys/kernel/unprivileged_userns_clone ] && [ "$(cat /proc/sys/kernel/unprivileged_userns_clone)" = "0" ]; then
  ARGS+=(--no-sandbox)
fi
# Steam Deck Game Mode (gamescope): start fullscreen
if [ -n "$SteamDeck" ] || [ -n "$SteamGamepadUI" ] || [ -n "$GAMESCOPE_WAYLAND_DISPLAY" ]; then
  ARGS+=(--fullscreen)
fi
exec "$DIR/sakura-fortune" "${ARGS[@]}" "$@"
