import pytest

from extractor.domain.ai_consumption import InvalidConsumption, ai_consumption


def test_every_injected_entry_is_synthetic_and_carries_the_window():
    result = ai_consumption({"window_days": 30, "provenance": "observed",
                             "models": [{"model": "m", "provider": "p", "input_tokens": 10, "output_tokens": 2, "cost_usd": 1.5}]})
    assert result == {"tokens_by_model": [{"model": "m", "provider": "p", "input_tokens": 10, "output_tokens": 2,
                                           "cost_usd": 1.5, "window_days": 30, "provenance": "synthetic"}]}


def test_unknown_input_fields_are_dropped_and_missing_counts_omitted():
    entry = ai_consumption({"window_days": 7, "models": [{"model": "m", "provider": "p", "team": "x"}]})["tokens_by_model"][0]
    assert set(entry) == {"model", "provider", "window_days", "provenance"}


def test_entry_without_provider_is_rejected():
    with pytest.raises(InvalidConsumption):
        ai_consumption({"window_days": 7, "models": [{"model": "m"}]})


def test_missing_window_is_rejected():
    with pytest.raises(InvalidConsumption):
        ai_consumption({"models": []})
