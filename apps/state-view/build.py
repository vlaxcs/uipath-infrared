#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
DIST = ROOT / "dist" / "state-view.html"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def build() -> None:
    document = json.loads(read(ROOT / "data" / "states.json"))
    payload = json.dumps(document, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = read(WEB / "template.html")
    replacements = {
        "/*__CSS__*/": read(WEB / "app.css"),
        "/*__JS__*/": read(WEB / "app.js"),
        "/*__DATA__*/null": payload,
    }
    for marker, content in replacements.items():
        if marker not in html:
            raise SystemExit(f"missing marker in template: {marker}")
        html = html.replace(marker, content)
    DIST.parent.mkdir(parents=True, exist_ok=True)
    DIST.write_text(html, encoding="utf-8")
    print(f"wrote {DIST.relative_to(ROOT)} ({DIST.stat().st_size // 1024} KiB)")


if __name__ == "__main__":
    build()
