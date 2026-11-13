from pathlib import Path
from typing import Any

from engine.adapters.baseline_document import baseline_document
from engine.adapters.inputs import load_catalog, load_infra
from engine.domain.baseline import price_baseline


def baseline_report(infra_path: Path, catalog_path: Path) -> dict[str, Any]:
    infra = load_infra(infra_path)
    catalog = load_catalog(catalog_path)
    return baseline_document(infra.project, price_baseline(infra, catalog))
