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
from urllib.parse import quote

import requests

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "destinations_seed.json"
SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/"
# identifies the caller, which Wikimedia asks for
HEADERS = {"User-Agent": "Roamio/1.0 (university project; destination cover images)"}
PAUSE_SECONDS = 0.12


def fetch_thumbnail(title: str) -> str | None:
    try:
        response = requests.get(
            f"{SUMMARY_URL}{quote(title.replace(' ', '_'))}", headers=HEADERS, timeout=15
        )
        if not response.ok:
            return None
        data = response.json()
        # a disambiguation page has no single subject, so its thumbnail would
        # be arbitrary
        if data.get("type") == "disambiguation":
            return None
        # the 'thumbnail' is a few hundred pixels wide, which is what a card
        # needs - originalimage can be several megabytes
        return (data.get("thumbnail") or {}).get("source")
    except requests.RequestException:
        return None


def main() -> None:
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    added = skipped = missing = 0

    for city in seed:
        if city.get("image_url"):
            skipped += 1
            continue

        # try "Name, Country" first: the bare name can land on a different
        # place entirely ("East London" is London's East End, not the South
        # African city). Wikipedia redirects the qualified title when the bare
        # one is the real article, so nothing is lost.
        for title in (f"{city['name']}, {city['country']}", city["name"]):
            url = fetch_thumbnail(title)
            time.sleep(PAUSE_SECONDS)
            if url:
                city["image_url"] = url
                added += 1
                print(f"  {city['name']:<22} {url.rsplit('/', 1)[-1][:46]}", flush=True)
                break
        else:
            missing += 1
            print(f"  {city['name']:<22} (no image found)", flush=True)

    SEED_PATH.write_text(json.dumps(seed, indent=2), encoding="utf-8")
    print(f"\n{added} added, {skipped} already had one, {missing} without an image")


if __name__ == "__main__":
    sys.exit(main())
