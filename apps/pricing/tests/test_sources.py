from datetime import date

import pytest

from pricing.adapters.aws_price_list import offer_url, read_offer
from pricing.adapters.ecb_rates import ECB_URL, read_usd_rate
from pricing.adapters.page_text import visible_text
from pricing.domain.errors import PricingError
from pricing.domain.manual_entry import quote_found
from pricing.domain.selector import Selector
from tests.fakes import FakeFetcher, aws_csv, ecb_xml

TODAY = date(2026, 11, 14)
RDS_ROWS = [
    {"SKU": "A", "TermType": "OnDemand", "PriceDescription": "$0.197 per hour", "Unit": "Hrs", "PricePerUnit": "0.1970000000", "Currency": "USD", "Instance Type": "db.m5.large"},
    {"SKU": "B", "TermType": "Reserved", "PriceDescription": "reserved", "Unit": "Hrs", "PricePerUnit": "0.1200000000", "Currency": "USD", "Instance Type": "db.m5.large"},
]


def test_an_aws_offer_keeps_only_the_selected_on_demand_prices_and_its_version():
    fetcher = FakeFetcher({offer_url("AmazonRDS", "eu-west-1"): aws_csv("AmazonRDS", "20261113215233", RDS_ROWS)})
    snapshot = read_offer(fetcher, "AmazonRDS", "eu-west-1", {"pg:db.m5.large": Selector({"Instance Type": "db.m5.large"})}, TODAY)
    [price] = snapshot.prices.values()
    assert (price.amount, price.currency, price.unit, price.reference) == (0.197, "USD", "Hrs", "A")
    assert (snapshot.source, snapshot.version, snapshot.fetched_on) == ("aws-AmazonRDS", "20261113215233", TODAY)
    assert snapshot.url == offer_url("AmazonRDS", "eu-west-1", "20261113215233")


def test_a_file_that_is_not_the_requested_offer_is_refused():
    fetcher = FakeFetcher({offer_url("AmazonRDS", "eu-west-1"): aws_csv("AmazonEC2", "1", RDS_ROWS)})
    with pytest.raises(PricingError, match="not an AWS price list"):
        read_offer(fetcher, "AmazonRDS", "eu-west-1", {}, TODAY)


def test_the_ecb_usd_rate_and_its_date():
    fx = read_usd_rate(FakeFetcher({ECB_URL: ecb_xml("2026-11-13", "1.1052")}), TODAY)
    assert (fx.usd_per_eur, fx.rate_date, fx.fetched_on) == (1.1052, date(2026, 11, 13), TODAY)
    assert fx.to_eur(110.52, "USD") == pytest.approx(100)
    assert fx.to_eur(5, "EUR") == 5


def test_no_usd_rate_is_an_error():
    with pytest.raises(PricingError, match="no USD rate"):
        read_usd_rate(FakeFetcher({ECB_URL: "<Cube time='2026-11-13'></Cube>"}), TODAY)


def test_a_quote_survives_markup_and_spacing_but_not_a_changed_price():
    page = visible_text("<script>var x='$9'</script><td>Large</td> <td>$ <b>0.1517</b></td>\n<td>~ $ 110</td>")
    assert quote_found("Large $ 0.1517 ~ $ 110", page)
    assert not quote_found("Large $ 0.1600 ~ $ 110", page)
    assert "$9" not in page
