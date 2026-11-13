import pytest

from pricing.domain.errors import SelectionError
from pricing.domain.selection import select_one_each
from pricing.domain.selector import Selector

ROWS = [
    {"usageType": "EU-BoxUsage:m6i.xlarge", "operation": "RunInstances", "PricePerUnit": "0.214"},
    {"usageType": "EU-BoxUsage:m6i.xlarge", "operation": "RunInstances:0002", "PricePerUnit": "0.398"},
    {"usageType": "EU-NatGateway-Hours", "operation": "NatGateway", "PricePerUnit": "0.048"},
]


def test_each_key_gets_its_one_matching_row():
    selected = select_one_each(ROWS, {
        "linux": Selector({"usageType": "EU-BoxUsage:m6i.xlarge", "operation": "RunInstances"}),
        "nat": Selector({"usageType": "EU-NatGateway-Hours"}),
    })
    assert (selected["linux"]["PricePerUnit"], selected["nat"]["PricePerUnit"]) == ("0.214", "0.048")


def test_an_ambiguous_or_missing_price_fails_and_names_every_problem():
    with pytest.raises(SelectionError) as error:
        select_one_each(ROWS, {
            "too-many": Selector({"usageType": "EU-BoxUsage:m6i.xlarge"}),
            "none": Selector({"usageType": "EU-BoxUsage:m7i.xlarge"}),
            "fine": Selector({"usageType": "EU-NatGateway-Hours"}),
        })
    message = str(error.value)
    assert "too-many: 2 rows match" in message
    assert "none: 0 rows match usageType=EU-BoxUsage:m7i.xlarge" in message
    assert "fine" not in message
