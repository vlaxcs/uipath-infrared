from datetime import date

from pricing.adapters.snapshot_store import SnapshotStore
from pricing.application.paths import Paths
from pricing.domain.staleness import SourceAge, source_ages


def status(paths: Paths, today: date, max_age_days: int) -> tuple[SourceAge, ...]:
    store = SnapshotStore(paths.snapshots)
    fx = store.fx()
    slas = store.sla()
    dated = [(s.source, s.fetched_on, s.unverified) for s in store.snapshots()]
    dated.append((slas.source, slas.fetched_on, slas.unverified))
    dated.append((fx.source, fx.fetched_on, {}))
    return source_ages(dated, today, max_age_days)
