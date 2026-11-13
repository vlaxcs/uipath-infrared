import hashlib
from datetime import date
from pathlib import Path
from typing import Any

from pricing.adapters.json_io import read_json
from pricing.domain.binding import Binding
from pricing.domain.manual_entry import ManualEntry
from pricing.domain.price import Price
from pricing.domain.selector import Selector
from pricing.domain.sources_config import SourcesConfig

SOURCES_FILE = "sources.json"
BINDINGS_FILE = "bindings.json"
MANUAL_FILE = "manual.json"


def load_sources(config_dir: Path) -> SourcesConfig:
    raw = read_json(config_dir / SOURCES_FILE)
    offers = {
        offer: {key: Selector(dict(filters)) for key, filters in wanted.items()}
        for offer, wanted in raw["aws"].items()
    }
    return SourcesConfig(raw["region"], offers)


def load_bindings(config_dir: Path) -> tuple[tuple[Binding, ...], dict[str, str]]:
    raw = read_json(config_dir / BINDINGS_FILE)
    bindings = tuple(Binding(**entry) for entry in raw["bindings"])
    return bindings, dict(raw.get("descriptions", {}))


def load_manual(config_dir: Path) -> tuple[tuple[ManualEntry, ...], str]:
    path = config_dir / MANUAL_FILE
    raw: dict[str, Any] = read_json(path)
    entries = tuple(
        ManualEntry(
            key=key,
            price=Price(entry["amount"], entry["currency"], entry["unit"], entry["url"], entry.get("note", "")),
            read_on=date.fromisoformat(entry["read_on"]),
            quote=entry["quote"],
        )
        for key, entry in sorted(raw.items())
    )
    return entries, hashlib.sha256(path.read_bytes()).hexdigest()[:12]
