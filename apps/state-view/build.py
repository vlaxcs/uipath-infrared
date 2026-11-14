#!/usr/bin/env python3
"""Inline the CSS, JavaScript and state document into one self-contained page.

    python3 apps/state-view/build.py          # writes dist/state-view.html

``render_html(document, card=None)`` is the reusable part: ``snapshot.py`` calls
it with an in-memory document and a card spec to render one snapshot.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
DIST = ROOT / "dist" / "state-view.html"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _payload(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def render_html(document: dict, card: dict | None = None) -> str:
    """Return the page with ``document`` inlined.

    ``card`` (e.g. ``{"state": "target"}``) makes the page open in card mode even
    without a ``#card`` hash; ``None`` keeps the normal interactive view.
    """
    html = read(WEB / "template.html")
    replacements = {
        "/*__CSS__*/": read(WEB / "app.css"),
        "/*__JS__*/": read(WEB / "app.js"),
        "/*__DATA__*/null": _payload(document),
        "/*__CARD__*/null": _payload(card),
    }
    for marker, content in replacements.items():
        if marker not in html:
            raise ValueError(f"missing marker in template: {marker}")
        html = html.replace(marker, content)
    return html


def build() -> None:
    document = json.loads(read(ROOT / "data" / "states.json"))
    DIST.parent.mkdir(parents=True, exist_ok=True)
    DIST.write_text(render_html(document), encoding="utf-8")
    print(f"wrote {DIST.relative_to(ROOT)} ({DIST.stat().st_size // 1024} KiB)")


if __name__ == "__main__":
    build()
