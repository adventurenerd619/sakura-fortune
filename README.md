# Sakura Fortune 🌸

A play-money slot machine with a Japanese spring-festival theme, for **Windows, SteamOS/Linux and Android**, built with **TypeScript + PixiJS 8**, packaged with **Electron** (desktop) and **Capacitor** (Android). A sister game to King Mike.
A Maneki-neko sits beside a 5×3, 25-line reel set in a woodblock-print village at dusk. It waves its paw at wins, bows when a bonus starts, and dozes off when you stop playing.

> **Play money only.** Money in the game is free and fictional and has no cash value. Nothing can be bought or won for real.

## Quick start

```powershell
npm install
npm start          # build and launch the game in Electron
```

| Command | What it does |
|---|---|
| `npm start` / `npm run dev` | Bundle with esbuild into `app/` and launch Electron |
| `npm run serve` | Bundle and serve the renderer at http://localhost:5173 (play in a normal browser; saves go to localStorage) |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Engine tests (all 25 paylines, cascades, every bonus rule, buys, forcing, the cap) |
| `npm run sim` | RTP simulator: 10M base spins + 1M of each bonus buy, on up to 8 threads (about 3–4 minutes) (`-- --spins N --buys N --seed N --workers N`); writes `sim-report.txt`, fails outside the targets |
| `npm run strips` | Print the base and free-spins reel strips built from the config |
| `npm run test:smoke` | Automated Electron play-through with screenshots in `smoke-out/` |
| `npm run test:persist` | Save safety and debug gating checks |
| `npm run test:controller` | Plays the game and drives every panel with simulated controller presses |
| `npm run test:gamepad` | Controller input mapping (several pads, D-pad repeat, sticks, non-standard pads) |
| `npm run audio:levels` | Renders every sound and music track offline; fails on clipping, silence or mismatched music loudness |
| `npm run dist` | Build the icon, a minified bundle, and the Windows installer + portable `.exe` in `dist/` |
| `npm run dist:linux` | SteamOS / Linux x64 `tar.gz` with installer |
| `npm run android:build` | Signed Android APK |
| `npm run android:bundle` | Signed Android App Bundle (.aab) for Google Play |
| `npm run steam-art` | Regenerate the Steam library artwork in `steamos/art/` |

### Building the .exe

```powershell
npm run dist
```

Output in `dist/`:
- `Sakura Fortune Setup 1.0.0.exe`: NSIS installer (you choose the install folder; adds Start-menu/desktop shortcuts)
- `Sakura Fortune Portable 1.0.0.exe`: single-file portable build, no install needed
- `win-unpacked/Sakura Fortune.exe`: the unpacked app

### SteamOS / Steam Deck (Linux x64)

```powershell
npm run dist:linux
```

Produces `dist/Sakura Fortune-1.0.0-linux-x64.tar.gz` (the Electron app for x64 Linux, plus `install.sh`, the `sakura-fortune.sh` launcher and `README-STEAMOS.txt`). On the Deck, in Desktop Mode: extract it, run `bash install.sh` (installs to `~/Applications/SakuraFortune`, adds a menu entry and adds the game to Steam), then play from Gaming Mode. The launcher starts fullscreen under Steam's Game Mode (`SteamDeck` / `SteamGamepadUI` / gamescope), or with `--fullscreen` anywhere. Saves go to `~/.config/sakura-fortune/`.

**Steam library artwork** lives in `steamos/art/` and is regenerated from the game's own art with `npm run steam-art`: `logo.png` (1280×720, transparent), `hero.png` (1920×620 banner), `capsule-wide.png` (920×430), `capsule-tall.png` (600×900) and `icon.png` (512×512). `install.sh` installs them for the shortcut through `set-steam-art.py` (restart Steam to see them).

### Code signing (Windows)

The .exe files are unsigned unless you provide a code-signing certificate, so Windows SmartScreen shows an "unknown publisher" warning. `npm run dist` signs automatically when these are set:

```powershell
$env:CSC_LINK = "C:path	ocertificate.pfx"
```

```powershell
$env:CSC_KEY_PASSWORD = "your-certificate-password"
```

The build says which it is doing ("Code signing: certificate configured" or "building UNSIGNED"). Set `SIGN_REQUIRED=1` to make an unsigned build fail, for release builds. Signing has not been tried with a real certificate yet.

### Android

```powershell
npm run android:build
```

Builds the web bundle, syncs it into the Capacitor project in `android/` and produces a signed `dist/Sakura Fortune-1.0.0-android.apk` (app id `com.sakurafortune.slots`, Android 7.0+, immersive fullscreen, screen kept awake). It plays in **portrait and landscape**: held upright, the game switches to a 1080-wide portrait layout that stretches to the phone's height; turned sideways, it goes back to 1920×1080. A rotation during a spin or feature is applied once it finishes. Needs JDK 21 and the Android SDK (`JAVA_HOME`/`ANDROID_HOME`, or the defaults in `%LOCALAPPDATA%\Android\jdk21` and `%LOCALAPPDATA%\Android\Sdk`).

- **Signing key:** the first build creates its own key, `android/keystore/sakura-fortune-release.jks`, and `android/keystore.properties` (random password). **Back these up**: updates to an installed app must be signed with the same key. Both are git-ignored. For Google Play, run `npm run android:bundle` and upload `dist/Sakura Fortune-1.0.0-android.aab` with Play App Signing (the key above becomes your upload key).
- **Saves** use Android SharedPreferences (Capacitor Preferences), with the same backup/recovery as desktop.
- **Back button:** closes panels, stops auto-spin, fast-forwards a presentation, or asks before leaving.
- `npm run android:sync` only copies the latest web build into `android/`. Icons and splash screens are generated by `node scripts/android-icons.mjs`.

## Controls

| Key / button | Action |
|---|---|
| **Space** / SPIN | Spin; during a presentation, fast-forward; at a prompt (START / ROLL / DRAW / OK), continue |
| **F11** / ⛶ | Toggle fullscreen |
| **Esc** | Close the open panel |
| **Ctrl+D** | Debug panel (dev builds only; see below) |
| AUTO | Auto-spin 10 / 25 / 50 / 100 / until feature (press again to stop). Optional stop limits in the same menu, remembered: stop on a single win of 10× / 25× / 50× / 100× bet, or when the balance has dropped by 25× / 50× / 100× / 250× bet since auto-spin started |
| TURBO | Faster reels and animations |
| − / + | Bet: 25, 50, 75, 100, 250, 500 or 1,000 credits per spin |
| Denom (1¢) | Value of one credit: 1¢, 2¢, 5¢, 10¢, 25¢, 50¢ or $1 |
| Show Credits / Show in $ | Switch every amount on screen between dollars (default) and credits |
| BUY BONUS | Torii Path (60× bet) or Lantern Festival (80× bet) |
| i / ☰ / ⚙ / ♪ | Paytable & rules / Stats / Settings / Mute (remembered) |
| + Funds | Add free play money ($100 / $500 / $1,000 or any amount up to $1,000) |

On the Torii Path and at the Omikuji box you can also just tap the screen.

**Controller** (Steam Deck, Xbox/PlayStation pads, Android controllers), same mapping as King Mike:

| Button | Action |
|---|---|
| A | Spin / fast-forward; **roll the die on the Torii Path**; draw an Omikuji slip; continue at prompts (in panels: press the focused button) |
| B | Back / close panel / stop auto |
| X / Y | Auto-spin / Bonus buy |
| D-pad / left stick | Bet − / + (in panels: move between buttons) |
| LB / RB | Denomination down / up |
| LT / RT | Credits/dollars view / Turbo |
| Start / View | Rules & paytable / Stats |

The game renders at 1920×1080 and scales to any window or screen (16:9, letterboxed on other shapes); upright phones get the 1080-wide portrait layout.

## Project layout

```
src/
  config/math.ts        ALL game math: paytable, 25 paylines, reel strip composition (base and free spins),
                        cascade multipliers, Omikuji slips, Torii Path spaces and prizes, free-spin awards,
                        bonus buy prices, the 5,000x cap, win tiers
  engine/
    game.ts             Pure game logic shared by the game, tests and simulator: line evaluation, Sakura Cascade,
                        Omikuji, Torii Path, Lantern Festival (sticky drifting Wilds, lanterns), buys, debug forcing.
                        Every play returns a complete settled script that the renderer replays.
    rng.ts              Seeded PRNG (simulator, strip builder) and crypto RNG (game)
  main/                 Electron main process (window, F11, save file IPC), preload and the save store
  renderer/
    main.ts             Game controller: spin flow, feature presentation, wallet, auto-spin, controller, debug panel
    art/svg.ts          All art as code-generated SVG: palette, 13 symbols, lacquer frame, Maneki-neko rig parts,
                        Omikuji box, Torii Path pieces, particles
    art/scenes.ts       Dusk village, lantern-lit night and mountain trail backgrounds
    art/textures.ts     Rasterizes the SVGs into Pixi textures at startup
    scene/              Pixi scene: reels (spin, cascades, sticky Wilds, paylines), mascot, Torii Path board,
                        background with petals/lanterns, effects, overlays
    ui/                 DOM UI: HUD, paytable & rules, the stats book
    audio.ts            Web Audio synth: koto / shakuhachi-style flute / taiko music (3 tracks) and all sounds
    stats.ts, save.ts   Stats recording and the save file
    layout.ts           Landscape and portrait layouts
    platform.ts         Electron / Android / browser differences (storage, back button, quit, fullscreen)
    gamepad.ts          Controller input (Gamepad API, standard layout)
tests/engine.test.ts    Engine tests (node:test via tsx)
android/                Capacitor Android project (MainActivity, manifest, signing, icons customized)
steamos/                SteamOS installer, launcher, readme and Steam art bundled into the Linux package
scripts/                build, serve, simulate, strips, make-icon, android-build/-icons, steamos-package,
                        steam-art, smoke-main (smoke test), test-persistence
```

## Save file

Saved automatically to `%APPDATA%\sakura-fortune\sakura-save.json` (Linux: `~/.config/sakura-fortune/`): balance, bet, denomination, display mode, sound settings (including mute) and motion setting, plus session and all-time stats. Delete the file to start fresh.

- **Wins are settled first.** When a spin, buy or feature result is decided, the whole win (every cascade, free spin, die roll and Omikuji slip) is credited, stats are recorded and the save is written to disk *before* any animation plays. The screen reveals the balance as the presentation runs. If the game is closed or crashes mid-feature, nothing is lost.
- **Atomic writes with a backup.** Each save is written to a temp file and swapped in; the previous good save is kept as `sakura-save.bak.json`.
- **Recovery.** If the save can't be read, the backup is restored and the player is told. If neither file is usable, the damaged file is kept as `sakura-save.corrupt-<time>.json` and a new game starts, with a notice.
- If the 5,000× cap cuts a Torii Path short, the end banner shows what the climb collected and that the maximum win was paid.
- Money is kept to a millionth of a dollar (small line pays are fractions of a cent at low bets) and rounded only for display.

## Game rules (summary)

- **5 reels × 3 rows, 25 fixed paylines.** Wins of 3 or more pay left to right from reel 1. Pays are multiples of the **total bet**; the highest win on each line counts.
- **Symbols** (3 / 4 / 5 of a kind): Golden Koi 1 / 3 / 10, Torii Gate 0.8 / 2 / 6, Paper Fan 0.6 / 1.5 / 4, Kabuto Helmet 0.5 / 1.2 / 3, Paper Lantern 0.4 / 1 / 2.5, Sakura Mochi 0.2 / 0.5 / 1.2, Teacup 0.2 / 0.4 / 1, Origami Crane 0.15 / 0.3 / 0.8, Bamboo 0.1 / 0.25 / 0.6, Mon Crest 0.1 / 0.2 / 0.5.
- **Maneki-neko Wild** pays 2 / 5 / 25, lands on reels 2–4 in the base game and substitutes for everything except the Shrine Bell and Kitsune Mask. **Shrine Bell** is the scatter (anywhere). **Kitsune Mask** lands on reels 1, 3 and 5 only and has no line pay.
- **Sakura Cascade** (every spin): winning symbols burst into petals and are removed; symbols fall and new ones drop in from the strip. Each further win in the same spin is multiplied ×1, ×2, ×3, then ×5 (cap). Resets every paid spin.
- **Omikuji Fortune Draw**: on a paid spin with no win, a 1-in-75 chance the shrine box shakes. Press A / SPIN or tap to draw: Daikichi 大吉 50× (2%), Chukichi 中吉 15× (10%), Shokichi 小吉 5× (28%), Kichi 吉 2× (45%), Kyo 凶 (15%). A Kyo slip is tied to the pine branch and you draw again from the four good slips. (Hover a kanji in the paytable or on the slip for its meaning.)
- **Torii Path**: Kitsune Masks on reels 1, 3 and 5 start the climb. A 24-stone path with torii gates at stones 5 / 10 / 15 / 20 and the shrine at 24; the layout is new each time. **3 rolls** of a die (press A / SPIN or tap to roll); the fox token hops along. Offering 1×–10× (~48% of stones), Lantern: end multiplier +1 from ×1 up to ×5 (~15%), Ema plaque: +1 roll (~20%), Fox spirit: jump to the next gate (~10%; never past the last gate), Mist: nothing (~7%). Passing or landing on a gate pays 5×, 10×, 20×, 40× in order; reaching the shrine pays 250× and ends the climb. At the end everything is multiplied by the lantern multiplier.
- **Lantern Festival Free Spins**: 3 / 4 / 5 Shrine Bells award 8 / 12 / 16 spins plus 2× / 5× / 20×, at night. Every Wild that lands (reels 2–5 in free spins) sticks and drifts one reel left each spin until it leaves reel 1. Each Shrine Bell lights a lantern; every 3 lanterns add 4 spins and raise the multiplier ×1 → ×2 → ×3 (cap). Cascades continue; cascade and lantern multipliers multiply. A payline that runs through a sticky Wild pays at most once per spin. No Torii Path or Omikuji in free spins.
- **Bonus buy**: Torii Path 60× bet, Lantern Festival 80× bet (8 spins + 2×). Bought features play exactly like natural ones.
- **Max win** 5,000× bet per spin or buy (features included).
- **Win celebrations**: Big Win 10×, Mega Win 25×, Daikichi Win 50×.
- **Money**: the wallet is in dollars (start $100; free top-ups). The denomination sets the value of a credit; it changes bet sizes, not the odds.

### Design notes (agreed changes from the first brief)

The first brief's numbers could not all hold at once: as specified (5 rolls) the Torii Path averaged about 227× against a 60× buy price, and the two features at 1 in 130 / 1 in 160 would have used up the whole RTP budget on their own. Agreed fix (option A): keep every prize and both buy prices, start the climb with **3 rolls**, and make the features rarer (**Torii Path ~1 in 240, Free Spins ~1 in 280**). Two consequences:
- With 3 rolls the climb can land on at most 3 non-Ema stones, so the lantern multiplier reaches ×4 at most in practice; the ×5 cap is still enforced (and tested).
- Because sticky Wilds never burst, two of them side by side would win on every cascade forever. Rule added: **a payline through a sticky Wild pays at most once per spin**.

## Math & RTP

All math lives in `src/config/math.ts`. Reel strips are built deterministically from per-reel symbol counts (`BASE_COUNTS`, `FS_COUNTS`, each reel with its own seed from `STRIP_SEED`); Bells, Masks and Wilds are spaced apart on the strips. Cascades refill from the strip above each reel's stop, so strip composition sets every probability. Results are in multiples of the bet, so RTP is the same at every bet and denomination.

Latest simulation (`npm run sim`, seed 2026, 8 chunks: 10,000,000 spins at bet 1 plus 1,000,000 of each bonus buy, 2.5 minutes on 8 threads; full output in `sim-report.txt`):

| Metric | Value |
|---|---|
| **Total RTP** | **95.87%** (target 95.5–96.5%) |
| Base game + Sakura Cascade | 37.88% |
| Omikuji Fortune Draw | 5.52% (1 in 102 spins, avg 5.7×) |
| Torii Path | 23.92% (1 in 243 spins, avg 58.2×, shrine reached on 3.4% of climbs) |
| Lantern Festival Free Spins | 28.55% incl. Bell pays 0.76% (1 in 281 spins, avg 80.1×, 0.5 retriggers each) |
| Hit rate | 27.85% (1 in 3.59) |
| Cascades | 0.195 extra cascades per winning spin |
| Std dev per spin | 9.61× bet (medium volatility) |
| Biggest win in 10M spins | 1,123× (a 36-spin Lantern Festival at ×3); 5,000× cap never reached |
| **Torii Path buy (60×)** | **96.11%** (avg 57.7×) |
| **Free Spins buy (80×)** | **95.93%** (avg 76.7×) |

Win distribution: no win 72.2%, under 1× 13.4%, 1–5× 12.0%, 5–10× 1.3%, 10–25× 0.53%, 25–50× 0.28%, 50–250× 0.30%, 250–1,000× 0.03%.

The work is split into 8 chunks, each with its own seed derived from `--seed`, so the result depends only on the seed and the chunk count, not on how many threads your machine has. With a per-spin standard deviation near 9.6×, a 10M-spin run measures total RTP to about ±0.6% (95% confidence), so a single run can land near the edge of the band. Earlier single-threaded runs of the same math (seeds 2026, 11, 12, 13) gave 96.00%, 96.24%, 96.03% and 95.74%; every one passed.

## Debug panel (Ctrl+D)

Available in dev runs (`npm start`) and the browser dev server. In the packaged .exe it is disabled unless the game is launched with `--debug` (for example `"Sakura Fortune.exe" --debug`); F12 dev tools follow the same rule. Never available in a release Android build.

Arm a forced outcome for the next spin: Free Spins with 3, 4 or 5 Bells, Free Spins with a lantern retrigger, the Torii Path, a Torii Path summit climb, or each Omikuji slip (Daikichi, Chukichi, Shokichi, Kichi, Kyo). You can also play either bonus buy for free and add $1,000 / $10,000. Debug spins, buys and funds are **excluded from stats** and counted separately as "Debug actions".

## Testing

```powershell
npm test               # 73 engine tests
npm run sim            # RTP simulation, fails outside the targets
npm run test:persist   # save safety + debug gating (Electron)
npm run test:smoke     # play-through with screenshots (Electron)
npm run test:controller # controller-only play and panel navigation (Electron)
npm run test:gamepad   # controller input mapping
npm run audio:levels   # sound and music levels
```

- `npm test` covers all 25 paylines (5-of-a-kind and 3-from-the-left on each), every paytable entry, Wild substitution and the highest-win-per-line rule, scatter/mask exclusions, strip placement rules, a hand-built cascade (burst, fall, refill, ×1 then ×2), cascade multiplier ladder and strip continuity over thousands of spins, sticky Wilds and the once-per-spin line rule, Omikuji odds and the Kyo redraw, the Torii Path layout, gates, offerings, ema, lanterns (and the ×5 cap), fox jumps and the summit, free-spin awards, lantern retriggers and multipliers, Wild drift, feature exclusions in free spins, triggers from the board, buy prices, every debug force and the 5,000× cap.
- `npm run test:persist` checks against the real save code: a crash in the middle of a bought Lantern Festival keeps the win, damaged saves are restored from the backup, unreadable saves start fresh with a notice, mute is remembered, and Ctrl+D is blocked in release builds.
- `npm run test:smoke` launches the built app with a throwaway save folder, plays normal and turbo spins, a line win, every Omikuji slip (Kyo with its redraw), a summit Torii Path, Free Spins with a retrigger, a big-win celebration, both bonus buys, auto-spin and both auto-spin stop limits, every panel and tab, denominations and the credits view, the back button, tapping the screen to continue a banner, and the portrait layout (a spin, a Torii Path, Free Spins and an Omikuji draw, with checks that the lantern meter and shrine box don't overlap the reels or side panel), then writes screenshots and `log.txt` to `smoke-out/`.
- `npm run test:controller` plays with simulated controller presses only: bet, denomination, credits view, turbo, A to spin, the auto-spin menu, Add Funds (no on-screen keyboard until you pick the amount box), settings sliders and the motion option, Stats and Rules pages (LB / RB, LT / RT), Y for the bonus buy, A to roll on the Torii Path, A to draw an Omikuji slip, and B to stop auto-spin.
- `npm run audio:levels` renders all 32 sounds and the three music tracks offline at full volume and fails if anything clips, is nearly silent, or the music tracks differ by more than 6 dB. It measures levels only; it can't judge how the music sounds.

## Credits

All art, music and sound are generated in code for this project. No third-party, stock or copied assets are used. Kanji appear only on the Omikuji slips (大吉 中吉 小吉 吉 凶), each with its reading and English meaning.
