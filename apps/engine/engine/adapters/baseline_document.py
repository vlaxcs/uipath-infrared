from typing import Any

from engine.domain.baseline import Baseline, MISMATCH_THRESHOLD_PCT


def baseline_document(project: str, baseline: Baseline) -> dict[str, Any]:
    return {
        "project": project,
        "monthly_eur": baseline.monthly_eur,
        "reported_monthly_eur": baseline.reported_monthly_eur,
        "catalog_monthly_eur": baseline.catalog_monthly_eur,
        "components": [
            {
                "component": cost.component,
                "monthly_eur": cost.monthly_eur,
                "source": cost.source,
                "reported_eur": cost.reported_eur,
                "catalog_eur": None if cost.catalog is None else cost.catalog.monthly_eur,
                "catalog_option": None if cost.catalog is None else cost.catalog.option_id,
                "catalog_gaps": [] if cost.catalog is None else list(cost.catalog.gaps),
                "flags": list(cost.flags),
            }
            for cost in baseline.costs
        ],
        "cross_check": {
            "threshold_pct": MISMATCH_THRESHOLD_PCT,
            "mismatches": [
                {
                    "component": check.component,
                    "reported_eur": check.reported_eur,
                    "catalog_eur": check.catalog_eur,
                    "diff_pct": check.diff_pct,
                    "catalog_basis": check.catalog_basis,
                }
                for check in baseline.mismatches()
            ],
        },
        "unpriced": list(baseline.unpriced),
    }
