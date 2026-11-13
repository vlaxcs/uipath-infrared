import pytest

from sandbox.domain.target_text import TargetSpec, parse_target


@pytest.mark.parametrize(
    "text, expected",
    [
        ("3 x m5.2xlarge", TargetSpec(3, "m5.2xlarge", None)),
        ("db.r5.2xlarge", TargetSpec(None, "db.r5.2xlarge", None)),
        ("cache.r5.large, 2 zones", TargetSpec(None, "cache.r5.large", 2)),
        ("aws-aurora-postgres, 2 zones", TargetSpec(None, None, 2)),
        ("onprem-postgres, 2 nodes", TargetSpec(2, None, None)),
        ("aws-s3 eu-west-1", TargetSpec(None, None, None)),
        ("bursting", TargetSpec(None, None, None)),
        ("", TargetSpec(None, None, None)),
    ],
)
def test_reads_count_size_and_zones_from_free_text(text, expected):
    assert parse_target(text) == expected


def test_a_size_with_a_digit_before_x_is_not_a_count():
    assert parse_target("m5.2xlarge").quantity is None
