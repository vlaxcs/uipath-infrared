#!/usr/bin/env python3
"""Render one estate state as a PNG card for Slack.

    python3 apps/state-view/snapshot.py --layout consolidate --state target --out /tmp/card.png
        [--result PATH] [--infra PATH] [--chrome PATH] [--width 1200] [--height 675]
        [--scale 2] [--html-only]

``--state`` is ``current``, ``target`` or a state index.  Builds the states for
that candidate in memory, inlines the page in card mode and screenshots it with
headless Chrome.  ``--html-only`` writes the card HTML instead and needs no
Chrome.

On success prints one JSON line to stdout and exits 0:

    {"path", "layout", "state", "title", "caption", "alt"}

On failure prints a message to stderr, nothing to stdout, and exits non-zero
(2 bad arguments, 3 Chrome not found, 4 Chrome failed).  Standard library only.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_ROOT / "builder"))
sys.path.insert(0, str(APP_ROOT))

import build  # noqa: E402
import build_states  # noqa: E402

MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PATH_CHROMES = ("google-chrome", "chromium", "chromium-browser")


class SnapshotError(Exception):
    def __init__(self, message: str, code: int = 2):
        super().__init__(message)
        self.code = code


# ---------------------------------------------------------------------------
# Card facts (mirrors cardIndex/cardDiff/cardStateLabel in web/app.js)
# ---------------------------------------------------------------------------


def resolve_state(dataset: dict, spec: str) -> int:
    states = dataset["states"]
    value = str(spec).strip().lower()
    if value == "current":
        return 0
    if value == "target":
        return len(states) - 1
    if value.isdigit() and int(value) < len(states):
        return int(value)
    raise SnapshotError(
        f"unknown state {spec!r}; use current, target or an index from 0 to {len(states) - 1}"
    )


def diff_against_current(dataset: dict, index: int) -> dict:
    """Resource ids changed, added and removed between state 0 and ``index``.

    A resource is changed when any step up to ``index`` touched it (flags are
    review notes and do not count).
    """
    states = dataset["states"]
    before = {c["id"] for c in states[0]["infra"]["components"]}
    now = {c["id"] for c in states[index]["infra"]["components"]}
    touched = set()
    for state in states[1 : index + 1]:
        for change in state.get("changes") or []:
            if change.get("kind") not in ("removed", "flagged"):
                touched.add(change.get("component"))
    return {
        "changed": sorted((before & now) & touched),
        "added": sorted(now - before),
        "removed": sorted(before - now),
        "unchanged": sorted((before & now) - touched),
    }


def state_label(dataset: dict, index: int) -> str:
    if index == 0:
        return "No changes" if dataset.get("stepCount", 0) == 0 else "Current estate"
    return f"After {index} change{'' if index == 1 else 's'}"


def fmt_eur(value) -> str:
    return f"€{int(round(value or 0)):,}"


def card_facts(dataset: dict, index: int, state_name: str) -> dict:
    layout = dataset.get("layout") or {}
    layout_id = layout.get("id") or (dataset.get("source") or {}).get("candidate")
    label = layout.get("label") or layout_id
    states = dataset["states"]
    base = states[0]["summary"]["monthly_eur"]
    cost = states[index]["summary"]["monthly_eur"]
    diff = diff_against_current(dataset, index)
    counts = {key: len(ids) for key, ids in diff.items()}
    resources = len(states[index]["infra"]["components"])
    stacks = len(states[index]["infra"]["stacks"])
    project = dataset.get("title") or dataset.get("project") or "the"

    if index == 0:
        nothing = dataset.get("stepCount", 0) == 0
        title = f"{label}: {'no changes' if nothing else 'current estate'}"
        caption = f"{fmt_eur(base)}/mo · {'nothing changes' if nothing else 'no changes yet'}"
        alt = (
            f"Diagram of the {project} estate {'unchanged under the ' + label + ' plan' if nothing else 'as it runs today'}: "
            f"{resources} resources in {stacks} stacks costing {fmt_eur(base)} a month."
        )
    else:
        title = f"{label} after {index} change{'' if index == 1 else 's'}"
        caption = (
            f"{fmt_eur(base)}/mo → {fmt_eur(cost)}/mo · {counts['changed']} changed · "
            f"{counts['added']} added · {counts['removed']} removed"
        )
        alt = (
            f"Diagram of the {project} estate after {index} steps of the {label} plan: "
            f"{resources} resources in {stacks} stacks, {counts['changed']} changed, "
            f"{counts['added']} added and {counts['removed']} removed compared with today, "
            f"monthly cost going from {fmt_eur(base)} to {fmt_eur(cost)}."
        )
    return {
        "layout": layout_id,
        "state": state_name,
        "index": index,
        "title": title,
        "caption": caption,
        "alt": alt,
        "counts": counts,
    }


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def find_chrome(explicit: str | None) -> str:
    candidates = []
    if explicit:
        candidates.append(explicit)
    elif os.environ.get("CHROME_PATH"):
        candidates.append(os.environ["CHROME_PATH"])
    else:
        candidates.append(MAC_CHROME)
        candidates.extend(filter(None, (shutil.which(name) for name in PATH_CHROMES)))
    for candidate in candidates:
        if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    tried = ", ".join(candidates) or ", ".join((MAC_CHROME,) + PATH_CHROMES)
    raise SnapshotError(f"Chrome not found (tried: {tried}); pass --chrome or set CHROME_PATH", 3)


def card_html(dataset: dict, state_name: str) -> str:
    return build.render_html({"dataset": dataset}, card={"state": state_name})


def screenshot(html: str, out: Path, state_name: str, chrome: str, width: int, height: int, scale: float) -> None:
    workdir = Path(tempfile.mkdtemp(prefix="state-view-snapshot-"))
    try:
        page = workdir / "card.html"
        page.write_text(html, encoding="utf-8")
        target = out.with_name(out.name + ".partial.png")
        if target.exists():
            target.unlink()
        command = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={workdir / 'profile'}",
            f"--force-device-scale-factor={scale:g}",
            f"--window-size={width},{height}",
            f"--screenshot={target}",
            "--virtual-time-budget=3000",
            f"{page.as_uri()}#card&state={state_name}",
        ]
        try:
            proc = subprocess.run(command, capture_output=True, text=True, timeout=90)
        except subprocess.TimeoutExpired:
            raise SnapshotError("Chrome timed out after 90 s", 4)
        except OSError as error:
            raise SnapshotError(f"could not start Chrome: {error}", 4)
        if not target.exists() or target.stat().st_size == 0:
            tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-3:]
            raise SnapshotError(f"Chrome did not write a screenshot (exit {proc.returncode}): {' | '.join(tail)}", 4)
        os.replace(target, out)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def run(args: argparse.Namespace) -> dict:
    if args.width <= 0 or args.height <= 0 or args.scale <= 0:
        raise SnapshotError("--width, --height and --scale must be positive")
    for flag, value in (("--result", args.result), ("--infra", args.infra)):
        if value and not Path(value).is_file():
            raise SnapshotError(f"{flag} file not found: {value}")
    try:
        dataset = build_states.build_dataset(args.layout, args.infra, args.result)
    except build_states.LayoutError as error:
        raise SnapshotError(str(error))
    except (OSError, ValueError) as error:
        raise SnapshotError(f"could not build states: {error}")

    index = resolve_state(dataset, args.state)
    state_name = str(args.state).strip().lower()
    facts = card_facts(dataset, index, state_name)
    html = card_html(dataset, state_name)

    out = Path(args.out).expanduser()
    if not out.is_absolute():
        out = Path.cwd() / out
    out = out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    if args.html_only:
        out.write_text(html, encoding="utf-8")
    else:
        chrome = find_chrome(args.chrome)
        screenshot(html, out, state_name, chrome, args.width, args.height, args.scale)

    return {
        "path": str(out),
        "layout": facts["layout"],
        "state": state_name,
        "title": facts["title"],
        "caption": facts["caption"],
        "alt": facts["alt"],
    }


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render one estate state as a PNG card.")
    parser.add_argument("--layout", required=True, help="candidate id, e.g. consolidate")
    parser.add_argument("--state", required=True, help="current, target or a state index")
    parser.add_argument("--out", required=True, help="PNG path (HTML path with --html-only)")
    parser.add_argument("--result", default=None, help="engine result (default: apps/state-view/data/result.demo-shop.json)")
    parser.add_argument("--infra", default=None, help="baseline infra (default: contracts/mock/demo-shop.infra.json)")
    parser.add_argument("--chrome", default=None, help="Chrome binary (default: $CHROME_PATH, the macOS app, or google-chrome/chromium on PATH)")
    parser.add_argument("--width", type=int, default=1200)
    parser.add_argument("--height", type=int, default=675)
    parser.add_argument("--scale", type=float, default=2)
    parser.add_argument("--html-only", action="store_true", help="write the card HTML instead of a PNG; no Chrome needed")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv)
    except SystemExit as exit_:
        return int(exit_.code or 0) if exit_.code not in (None, 0) else 0
    try:
        payload = run(args)
    except SnapshotError as error:
        print(f"snapshot: {error}", file=sys.stderr)
        return error.code
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
