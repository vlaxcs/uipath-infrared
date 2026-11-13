from pathlib import Path
from typing import Any

from engine.adapters.contracts import validate
from engine.adapters.inputs import load_inputs
from engine.adapters.result_document import result_document
from engine.application.strategies import BUILDERS
from engine.domain.baseline import price_baseline
from engine.domain.evaluation import evaluate_candidate
from engine.domain.proposals import build_proposals
from engine.domain.ranking import decide


def evaluate(infra_path: Path, forecast_path: Path, catalog_path: Path) -> dict[str, Any]:
    inputs = load_inputs(infra_path, catalog_path, forecast_path)
    infra, catalog, forecast = inputs.infra, inputs.catalog, inputs.forecast
    baseline = price_baseline(infra, catalog)
    proposals = build_proposals(BUILDERS, infra, catalog, forecast)
    evaluations = tuple(
        evaluate_candidate(p.candidate, p.layers, infra, catalog, forecast, baseline)
        for p in proposals.proposals
    )
    document = result_document(infra, catalog, forecast, baseline, evaluations, decide(evaluations, forecast), proposals.not_built)
    validate(document, "result.schema.json", "result")
    return document
