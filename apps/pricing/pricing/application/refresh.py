from datetime import date
from pathlib import Path

from pricing.adapters.aws_price_list import read_offer, source_id
from pricing.adapters.config_files import load_manual, load_sources
from pricing.adapters.ecb_rates import SOURCE as FX_SOURCE
from pricing.adapters.ecb_rates import read_usd_rate
from pricing.adapters.fetcher import Fetcher
from pricing.adapters.snapshot_store import SnapshotStore
from pricing.application.manual_check import SOURCE as MANUAL_SOURCE
from pricing.application.manual_check import check_manual
from pricing.application.paths import Paths


def refresh(paths: Paths, fetcher: Fetcher, today: date, only: frozenset[str] | None = None) -> tuple[Path, ...]:
    store = SnapshotStore(paths.snapshots)
    config = load_sources(paths.config)
    written = []
    if _wanted(FX_SOURCE, only):
        written.append(store.write_fx(read_usd_rate(fetcher, today)))
    for offer, wanted in sorted(config.aws_offers.items()):
        if _wanted(source_id(offer), only):
            written.append(store.write(read_offer(fetcher, offer, config.region, wanted, today)))
    if _wanted(MANUAL_SOURCE, only):
        entries, version = load_manual(paths.config)
        written.append(store.write(check_manual(entries, version, fetcher, today)))
    return tuple(written)


def _wanted(source: str, only: frozenset[str] | None) -> bool:
    return only is None or source in only
