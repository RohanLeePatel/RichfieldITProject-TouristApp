"""
Adds a cover photo to every city in data/destinations_seed.json.

Recommendation cards were rendering a flat gradient with a pin glyph for every
result. Travel is chosen visually before it is chosen rationally, so a page of
grey rectangles undersells destinations the engine worked hard to rank.

Source is the Wikipedia REST summary endpoint - free, no key, and already the
source of the "About this place" panel on the Weather page, so the attribution
the site shows is unchanged. Image licences on Wikipedia vary (mostly CC BY-SA
or public domain); keep the attribution visible wherever these are displayed.

Safe to re-run: cities that already have a usable image are skipped, so a
failed run costs nothing to resume. Run from the ai-features directory.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine.enrich import find_cover_image

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "destinations_seed.json"
PAUSE_SECONDS = 0.12


def main() -> None:
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    added = skipped = missing = 0

    for city in seed:
        if city.get("image_url"):
            skipped += 1
            continue

        url = find_cover_image(city["name"], city["country"])
        time.sleep(PAUSE_SECONDS)
        if url:
            city["image_url"] = url
            added += 1
            print(f"  {city['name']:<22} {url.rsplit('/', 1)[-1][:46]}", flush=True)
        else:
            missing += 1
            print(f"  {city['name']:<22} (no image found)", flush=True)

    SEED_PATH.write_text(json.dumps(seed, indent=2), encoding="utf-8")
    print(f"\n{added} added, {skipped} already had one, {missing} without an image")


if __name__ == "__main__":
    sys.exit(main())
