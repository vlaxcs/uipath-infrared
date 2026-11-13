from datetime import date

from pricing.domain.staleness import source_ages

TODAY = date(2026, 11, 14)


def test_an_old_snapshot_or_a_vanished_quote_is_a_problem():
    ages = source_ages([
        ("aws-AmazonEC2", date(2026, 10, 1), {}),
        ("ecb-fx", date(2026, 11, 13), {}),
        ("manual", date(2026, 11, 14), {"neon:storage-gb": "the quoted text is no longer on the page"}),
    ], TODAY, max_age_days=30)
    by_source = {a.source: a for a in ages}
    assert by_source["aws-AmazonEC2"].problems == ("44 days old, limit 30",)
    assert by_source["ecb-fx"].healthy
    assert by_source["manual"].problems == ("neon:storage-gb: the quoted text is no longer on the page",)
