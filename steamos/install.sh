#!/usr/bin/env bash
# Sakura Fortune installer for SteamOS / Steam Deck (works on other x64 Linux too).
# Run from Desktop Mode:  bash install.sh
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Applications/SakuraFortune"

echo "Installing Sakura Fortune to $DEST ..."
mkdir -p "$DEST"
if [ "$SRC" != "$DEST" ]; then cp -a "$SRC/." "$DEST/"; fi

# archives built on Windows don't keep the executable bit
chmod +x "$DEST/sakura-fortune" "$DEST/sakura-fortune.sh" "$DEST/install.sh" 2>/dev/null || true
[ -f "$DEST/chrome_crashpad_handler" ] && chmod +x "$DEST/chrome_crashpad_handler"
[ -f "$DEST/chrome-sandbox" ] && chmod 755 "$DEST/chrome-sandbox"

# menu entry + icon
mkdir -p "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/512x512/apps"
cp "$DEST/sakura-fortune.png" "$HOME/.local/share/icons/hicolor/512x512/apps/sakura-fortune.png"
cat > "$HOME/.local/share/applications/sakura-fortune.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Sakura Fortune
Comment=A play-money Japanese spring-festival slot machine
Exec="$DEST/sakura-fortune.sh"
Icon=sakura-fortune
Categories=Game;
Terminal=false
EOF
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true

# add to Steam so it shows up in Game Mode
if command -v steamos-add-to-steam >/dev/null 2>&1; then
  steamos-add-to-steam "$HOME/.local/share/applications/sakura-fortune.desktop" && echo "Added Sakura Fortune to your Steam library."
else
  echo "To play in Game Mode: open Steam > Games > Add a Non-Steam Game to My Library > Sakura Fortune."
fi

# library artwork (capsules, hero banner, logo): Steam writes the new shortcut shortly after it is added
if command -v python3 >/dev/null 2>&1; then
  for i in 1 2 3 4 5 6; do
    if python3 "$DEST/set-steam-art.py" >/dev/null 2>&1; then python3 "$DEST/set-steam-art.py"; break; fi
    sleep 2
  done || true
  python3 "$DEST/set-steam-art.py" >/dev/null 2>&1 || echo "Artwork: after Steam has restarted once, run:  python3 \"$DEST/set-steam-art.py\""
fi
echo "Done. Sakura Fortune is installed in $DEST"
