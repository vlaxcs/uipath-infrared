from engine.domain.provenance import Evidence, Provenance, confidence_of


def test_confidence_is_set_by_the_weakest_input_and_names_it(mock_infra):
    gpu = mock_infra.component("ng-data-gpu")
    evidence = [gpu.usage["gpu_pct"].evidence, gpu.capacity["gpus"].evidence]
    confidence = confidence_of(evidence)
    assert confidence.level == "low"
    assert confidence.reason == "gpu_pct is synthetic"


def test_observed_inputs_give_high_confidence():
    confidence = confidence_of([Evidence("cpu_pct", Provenance.OBSERVED)])
    assert confidence.level == "high"


def test_estimated_beats_observed_as_the_weakest():
    confidence = confidence_of([
        Evidence("cpu_pct", Provenance.OBSERVED),
        Evidence("gb_month", Provenance.ESTIMATED),
    ])
    assert (confidence.level, confidence.reason) == ("medium", "gb_month is estimated")


def test_status_only_recommendations_are_high_confidence():
    assert confidence_of([]).level == "high"
