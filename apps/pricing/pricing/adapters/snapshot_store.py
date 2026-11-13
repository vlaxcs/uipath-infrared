from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

from pricing.adapters.ecb_rates import SOURCE as FX_SOURCE
from pricing.adapters.json_io import read_json, write_json
from pricing.domain.errors import PricingError
from pricing.domain.fx import FxRate
from pricing.domain.price import Price
from pricing.domain.snapshot import Snapshot


class SnapshotStore:
    def __init__(self, directory: Path) -> None:
        self.directory = Path(directory)

    def write(self, snapshot: Snapshot) -> Path:
        path = self._path(snapshot.source)
        write_json(path, {
            "source": snapshot.source,
            "url": snapshot.url,
            "version": snapshot.version,
            "fetched_on": snapshot.fetched_on.isoformat(),
            "prices": {key: asdict(price) for key, price in snapshot.prices.items()},
            "unverified": dict(snapshot.unverified),
        })
        return path

    def write_fx(self, fx: FxRate) -> Path:
        path = self._path(fx.source)
        write_json(path, {
            "source": fx.source, "url": fx.url, "rate_date": fx.rate_date.isoformat(),
            "fetched_on": fx.fetched_on.isoformat(), "usd_per_eur": fx.usd_per_eur,
        })
        return path

    def snapshots(self) -> tuple[Snapshot, ...]:
        return tuple(_snapshot(read_json(p)) for p in sorted(self.directory.glob("*.json")) if p.stem != FX_SOURCE)

    def fx(self) -> FxRate:
        path = self._path(FX_SOURCE)
        if not path.exists():
            raise PricingError(f"no exchange rate snapshot at {path}; run refresh first")
        raw = read_json(path)
        return FxRate(
            raw["source"], raw["url"], date.fromisoformat(raw["rate_date"]),
            date.fromisoformat(raw["fetched_on"]), raw["usd_per_eur"],
        )

    def _path(self, source: str) -> Path:
        return self.directory / f"{source}.json"


def _snapshot(raw: dict[str, Any]) -> Snapshot:
    return Snapshot(
        source=raw["source"],
        url=raw["url"],
        version=raw["version"],
        fetched_on=date.fromisoformat(raw["fetched_on"]),
        prices={key: Price(**price) for key, price in raw["prices"].items()},
        unverified=dict(raw.get("unverified", {})),
    )
