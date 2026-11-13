from datetime import date

import pytest

from pricing.domain.binding import Binding
from pricing.domain.catalog_build import SKELETON_VALUE, build_catalog
from pricing.domain.errors import BuildError
from pricing.domain.fx import FxRate
from pricing.domain.price import Price
from pricing.domain.snapshot import Snapshot

FX = FxRate("ecb-fx", "https://ecb", date(2026, 11, 13), date(2026, 11, 14), 1.25)
DAY = date(2026, 11, 14)


def skeleton():
    return {
        "schema_version": "1.0", "illustrative": True, "currency": "EUR", "hours_per_month": 730,
        "options": [{
            "id": "aws-ec2", "description": "old",
            "pricing": {
                "model": "tiered_instance",
                "tiers": [{"id": "t3.large", "vcpu": 2, "memory_gb": 8, "monthly_eur": 62}],
                "per_unit": [{"driver": "storage_gb_month", "eur_per_unit": 0.08}],
                "egress_per_gb_eur": 0.085,
            },
        }],
        "onprem_platforms": [{"id": "dc1"}],
    }


def snapshots(unverified=None):
    return (
        Snapshot("aws-AmazonEC2", "https://aws", "v1", DAY, {
            "linux:t3.large": Price(0.1, "USD", "Hrs", "SKU1", "t3"),
            "ebs:gp3": Price(0.1, "USD", "GB-Mo", "SKU2", "gp3"),
        }),
        Snapshot("manual", "manual.json", "abc", DAY, {"vendor:gb": Price(0.05, "EUR", "GB", "https://vendor", "")}, unverified or {}),
    )


def bind(target, price, unit, per="unit", multiplier=1.0):
    return Binding("aws-ec2", target, price, unit, per, multiplier)


def test_an_hourly_usd_price_becomes_a_monthly_eur_tier():
    built = build_catalog(skeleton(), (bind("tier:t3.large", "aws-AmazonEC2/linux:t3.large", "Hrs", "hour"),), {}, snapshots(), FX)
    [tier] = built.document["options"][0]["pricing"]["tiers"]
    assert tier["monthly_eur"] == pytest.approx(0.1 / 1.25 * 730)
    source = built.document["x_price_sources"]["aws-ec2/tier:t3.large"]
    assert (source["reference"], source["source_version"], source["fetched_on"]) == ("SKU1", "v1", "2026-11-14")


def test_a_multiplier_scales_one_unit_price_to_a_size():
    built = build_catalog(skeleton(), (bind("tier:t3.large", "aws-AmazonEC2/linux:t3.large", "Hrs", "hour", 4.0),), {}, snapshots(), FX)
    assert built.document["options"][0]["pricing"]["tiers"][0]["monthly_eur"] == pytest.approx(0.1 / 1.25 * 730 * 4)


def test_per_unit_and_pricing_fields_are_set_and_everything_unbound_is_listed():
    bindings = (
        bind("per_unit:storage_gb_month", "aws-AmazonEC2/ebs:gp3", "GB-Mo"),
        bind("pricing:egress_per_gb_eur", "manual/vendor:gb", "GB"),
    )
    built = build_catalog(skeleton(), bindings, {"aws-ec2": "new"}, snapshots(), FX)
    option = built.document["options"][0]
    assert option["pricing"]["per_unit"][0]["eur_per_unit"] == pytest.approx(0.08)
    assert option["pricing"]["egress_per_gb_eur"] == 0.05
    assert option["description"] == "new"
    assert built.unsourced == ("aws-ec2/tier:t3.large", "platform/dc1")
    assert built.document["illustrative"] is True
    assert built.document["x_unsourced"]["aws-ec2/tier:t3.large"] == SKELETON_VALUE


def test_a_catalog_with_every_price_sourced_is_not_illustrative():
    document = skeleton()
    document["options"][0]["pricing"]["per_unit"] = []
    del document["options"][0]["pricing"]["egress_per_gb_eur"]
    document["onprem_platforms"] = []
    built = build_catalog(document, (bind("tier:t3.large", "aws-AmazonEC2/linux:t3.large", "Hrs", "hour"),), {}, snapshots(), FX)
    assert (built.document["illustrative"], built.unsourced) == (False, ())


def test_a_price_whose_quote_vanished_stays_illustrative_with_the_reason():
    built = build_catalog(
        skeleton(), (bind("pricing:egress_per_gb_eur", "manual/vendor:gone", "GB"),), {},
        snapshots({"vendor:gone": "the quoted text is no longer on the page"}), FX,
    )
    assert built.document["options"][0]["pricing"]["egress_per_gb_eur"] == 0.085
    assert built.document["x_unsourced"]["aws-ec2/pricing:egress_per_gb_eur"] == "the quoted text is no longer on the page"


@pytest.mark.parametrize("binding, problem", [
    (bind("tier:t3.large", "aws-AmazonEC2/ebs:gp3", "Hrs", "hour"), "is per GB-Mo, the binding expects Hrs"),
    (bind("tier:t3.xlarge", "aws-AmazonEC2/linux:t3.large", "Hrs", "hour"), "0 entries with id t3.xlarge"),
    (bind("tier:t3.large", "aws-AmazonEC2/linux:t9.large", "Hrs", "hour"), "no price aws-AmazonEC2/linux:t9.large"),
    (Binding("aws-gone", "tier:x", "aws-AmazonEC2/linux:t3.large", "Hrs", "hour"), "no such option"),
])
def test_a_wrong_binding_fails_the_build(binding, problem):
    with pytest.raises(BuildError, match=problem):
        build_catalog(skeleton(), (binding,), {}, snapshots(), FX)


def test_the_build_leaves_the_skeleton_untouched_and_repeats_exactly():
    document = skeleton()
    bindings = (bind("tier:t3.large", "aws-AmazonEC2/linux:t3.large", "Hrs", "hour"),)
    first = build_catalog(document, bindings, {}, snapshots(), FX)
    second = build_catalog(document, bindings, {}, snapshots(), FX)
    assert first.document == second.document
    assert document["options"][0]["pricing"]["tiers"][0]["monthly_eur"] == 62
