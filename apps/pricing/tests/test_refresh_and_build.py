import json
from datetime import date
from pathlib import Path

import pytest

from pricing.adapters.aws_price_list import offer_url
from pricing.adapters.ecb_rates import ECB_URL
from pricing.application.build import build
from pricing.application.paths import Paths
from pricing.application.refresh import refresh
from pricing.domain.errors import PricingError
from tests.fakes import FakeFetcher, aws_csv, ecb_xml

TODAY = date(2026, 11, 14)
DEFAULTS = Paths()
VENDOR = "https://vendor.example/pricing"
SLA_VENDOR = "https://vendor.example/sla"


def configure(tmp_path: Path, quote: str) -> Paths:
    config = tmp_path / "config"
    config.mkdir()
    (config / "sources.json").write_text(json.dumps({
        "region": "eu-west-1", "aws": {"AmazonEC2": {"linux:t3.large": {"Instance Type": "t3.large"}}},
    }))
    (config / "bindings.json").write_text(json.dumps({"bindings": [
        {"option": "aws-ec2-general", "target": "tier:t3.large", "price": "aws-AmazonEC2/linux:t3.large", "unit": "Hrs", "per": "hour"},
        {"option": "managed-pg-platform", "target": "per_unit:storage_gb_month", "price": "manual/vendor:disk", "unit": "GB-Mo", "per": "unit"},
    ]}))
    (config / "manual.json").write_text(json.dumps({"vendor:disk": {
        "amount": 0.125, "currency": "USD", "unit": "GB-Mo", "url": VENDOR, "read_on": "2026-11-14", "quote": quote,
    }}))
    return Paths(config=config, snapshots=tmp_path / "snapshots", skeleton=DEFAULTS.skeleton, schema=DEFAULTS.schema, catalog=tmp_path / "catalog.json")


def fetcher() -> FakeFetcher:
    return FakeFetcher({
        ECB_URL: ecb_xml("2026-11-13", "1.25"),
        offer_url("AmazonEC2", "eu-west-1"): aws_csv("AmazonEC2", "20261110173852", [
            {"SKU": "S", "TermType": "OnDemand", "PriceDescription": "t3", "Unit": "Hrs", "PricePerUnit": "0.1", "Currency": "USD", "Instance Type": "t3.large"},
        ]),
        VENDOR: "<p>8 GB included, then <b>$ 0.125</b> per GB</p>",
        SLA_VENDOR: "<p>we commit to <b>99.9%</b> monthly uptime</p>",
    })


def write_sla(paths: Paths, quote: str = "99.9% monthly uptime", value: float = 99.9) -> None:
    (paths.config / "slas.json").write_text(json.dumps({
        "aws-ec2-general/availability_pct": {
            "url": SLA_VENDOR, "value": value, "read_on": "2026-11-14", "quote": quote, "note": "test",
        },
    }))


def tier(document, option_id, tier_id):
    [option] = [o for o in document["options"] if o["id"] == option_id]
    return next(t for t in option["pricing"]["tiers"] if t["id"] == tier_id)


def test_refresh_stores_snapshots_and_build_needs_no_network(tmp_path):
    paths = configure(tmp_path, "then $ 0.125 per GB")
    written = refresh(paths, fetcher(), TODAY)
    assert sorted(p.name for p in written) == ["aws-AmazonEC2.json", "ecb-fx.json", "manual.json", "sla.json"]
    built, text = build(paths)
    assert tier(built.document, "aws-ec2-general", "t3.large")["monthly_eur"] == pytest.approx(0.1 / 1.25 * 730)
    assert "managed-pg-platform/per_unit:storage_gb_month" in built.sourced
    assert text == build(paths)[1]


def test_an_sla_quote_is_verified_and_applied(tmp_path):
    paths = configure(tmp_path, "then $ 0.125 per GB")
    write_sla(paths)
    refresh(paths, fetcher(), TODAY)
    built, _ = build(paths)
    option = next(o for o in built.document["options"] if o["id"] == "aws-ec2-general")
    assert option["sla"]["availability_pct"] == 99.9
    assert "aws-ec2-general/availability_pct" in built.sla_sourced
    source = built.document["x_sla_sources"]["aws-ec2-general/availability_pct"]
    assert (source["value"], source["url"]) == (99.9, SLA_VENDOR)


def test_a_vanished_sla_quote_keeps_the_skeleton_value(tmp_path):
    paths = configure(tmp_path, "then $ 0.125 per GB")
    write_sla(paths)
    source = fetcher()
    source.pages[SLA_VENDOR] = "<p>we commit to <b>99.5%</b> monthly uptime</p>"
    refresh(paths, source, TODAY)
    built, _ = build(paths)
    option = next(o for o in built.document["options"] if o["id"] == "aws-ec2-general")
    assert option["sla"]["availability_pct"] == 99.5
    assert "aws-ec2-general/availability_pct" in built.sla_unsourced


def test_only_refreshes_the_named_sources(tmp_path):
    paths = configure(tmp_path, "then $ 0.125 per GB")
    source = fetcher()
    written = refresh(paths, source, TODAY, frozenset({"ecb-fx"}))
    assert [p.name for p in written] == ["ecb-fx.json"]
    assert source.requested == [ECB_URL]


def test_a_vanished_quote_keeps_the_skeleton_price(tmp_path):
    paths = configure(tmp_path, "then $ 0.150 per GB")
    refresh(paths, fetcher(), TODAY)
    built, _ = build(paths)
    assert "managed-pg-platform/per_unit:storage_gb_month" in built.unsourced


def test_build_without_snapshots_fails_clearly(tmp_path):
    paths = configure(tmp_path, "x")
    with pytest.raises(PricingError, match="run refresh first"):
        build(paths)


def test_the_committed_catalog_is_exactly_what_the_committed_snapshots_build():
    built, text = build(DEFAULTS)
    assert DEFAULTS.catalog.read_text(encoding="utf-8") == text
    assert built.document["x_fx"]["source"] == "ecb-fx"
