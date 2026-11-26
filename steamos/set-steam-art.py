#!/usr/bin/env python3
"""Install Sakura Fortune's library artwork (capsules, hero banner, logo, icon) for the
non-Steam shortcut. Run after the game has been added to Steam:
    python3 set-steam-art.py
Then restart Steam (or switch to Desktop Mode and back) to see the art.
"""
import glob
import os
import shutil
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "art")
NAME = "Sakura Fortune"


def parse_vdf(data, i=0):
    """Minimal binary VDF parser -> (dict, next index)."""
    out = {}
    while i < len(data):
        t = data[i]
        i += 1
        if t == 0x08:
            return out, i
        end = data.index(b"\0", i)
        key = data[i:end].decode("utf-8", "replace")
        i = end + 1
        if t == 0x00:
            out[key], i = parse_vdf(data, i)
        elif t == 0x01:
            end = data.index(b"\0", i)
            out[key] = data[i:end].decode("utf-8", "replace")
            i = end + 1
        elif t == 0x02:
            out[key] = struct.unpack("<i", data[i:i + 4])[0]
            i += 4
        else:
            raise ValueError("unknown VDF type %d" % t)
    return out, i


def shortcut_ids():
    homes = [os.path.expanduser("~/.local/share/Steam"), os.path.expanduser("~/.steam/steam")]
    seen = set()
    for home in homes:
        for vdf in glob.glob(os.path.join(home, "userdata", "*", "config", "shortcuts.vdf")):
            real = os.path.realpath(vdf)
            if real in seen:
                continue
            seen.add(real)
            try:
                data, _ = parse_vdf(open(vdf, "rb").read())
            except Exception as e:  # pragma: no cover
                print("Could not read", vdf, "-", e)
                continue
            for entry in data.get("shortcuts", {}).values():
                name = entry.get("AppName") or entry.get("appname") or ""
                if name.strip().lower() != NAME.lower():
                    continue
                appid = entry.get("appid")
                if appid is None:  # older Steam: derive it the way Steam does
                    exe = entry.get("Exe") or entry.get("exe") or ""
                    appid = zlib.crc32((exe + name).encode("utf-8")) | 0x80000000
                yield os.path.join(os.path.dirname(vdf), "grid"), appid & 0xFFFFFFFF


def main():
    found = False
    for grid, appid in shortcut_ids():
        found = True
        os.makedirs(grid, exist_ok=True)
        files = {
            "capsule-tall.png": "%dp.png" % appid,      # library grid (600x900)
            "capsule-wide.png": "%d.png" % appid,       # wide capsule / header (920x430)
            "hero.png": "%d_hero.png" % appid,          # banner behind the game page (1920x620)
            "logo.png": "%d_logo.png" % appid,          # logo drawn over the banner
            "icon.png": "%d_icon.png" % appid,
        }
        for src, dst in files.items():
            shutil.copyfile(os.path.join(ART, src), os.path.join(grid, dst))
        print("Sakura Fortune artwork installed for shortcut %d in %s" % (appid, grid))
    if not found:
        print("Sakura Fortune isn't in Steam yet. Add it (install.sh does this), restart Steam once, then run:")
        print("    python3 %s" % os.path.abspath(__file__))
        return 1
    print("Restart Steam to see the new artwork.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
