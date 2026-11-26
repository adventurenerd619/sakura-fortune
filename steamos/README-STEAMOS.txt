SAKURA FORTUNE - SteamOS / Steam Deck
=====================================

Install (Desktop Mode)
  1. Copy "Sakura Fortune-<version>-linux-x64.tar.gz" to the Deck (for example into Downloads).
  2. Right-click it > Extract Here (or: tar xzf "Sakura Fortune-...tar.gz").
  3. Open a terminal (Konsole) in the extracted folder and run:
         bash install.sh
     This installs to ~/Applications/SakuraFortune, adds a menu entry, and adds the game
     to your Steam library (SteamOS's steamos-add-to-steam).
  4. Switch back to Gaming Mode. Sakura Fortune is in Library > Non-Steam.

Library artwork
  install.sh also installs Sakura Fortune's capsule art, banner and logo for the shortcut.
  If Steam hadn't saved the new shortcut yet, restart Steam once and run:
         python3 ~/Applications/SakuraFortune/set-steam-art.py
  Or set them by hand: in the library, right-click the game > Manage > Set custom artwork
  (art/capsule-tall.png), and on the game page right-click the banner > Set custom background
  (art/hero.png) / Set custom logo (art/logo.png). The files are in ~/Applications/SakuraFortune/art/.

Controls (Steam Deck)
  A ........ Spin / skip / fast-forward; roll on the Torii Path; draw an Omikuji slip
  B ........ Back / close panel
  X ........ Auto-spin
  Y ........ Bonus buy
  D-pad / left stick ... Bet - / +  (and move between buttons in panels)
  L1 / R1 .. Denomination down / up
  L2 ....... Show credits / dollars
  R2 ....... Turbo
  START .... Rules & paytable
  VIEW ..... Stats
  The touchscreen also works everywhere.

  Extra controllers (PS4/PS5/Xbox) connected to the Deck work too, alongside the built-in controls.
  Settings (in game) lists every controller the game can see. If a controller works in Steam's
  menus but not in the game: in Gaming Mode open the game's Controller settings (the controller
  icon on its library page) and make sure Steam Input is enabled for that controller type
  (Settings > Controller > "Enable Steam Input for PlayStation controllers").

The game starts fullscreen in Gaming Mode. Saves are kept in ~/.config/sakura-fortune/.
Play money only: credits are free, fictional and have no cash value.
