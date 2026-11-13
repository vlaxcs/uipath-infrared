from extractor.domain.components.dynamodb import dynamodb_table
from extractor.domain.cost_estimate import instance_hours_cost, monthly_cost


def test_monthly_cost_converts_usd_to_rounded_eur_and_keeps_basis():
    cost = monthly_cost(100.0, "list price")["monthly_eur"]
    assert cost["value"] == 92
    assert cost["unit"] == "EUR/month"
    assert cost["provenance"] == "estimated"
    assert cost["basis"].startswith("list price x 0.92 EUR/USD")


def test_unknown_total_has_no_cost():
    assert monthly_cost(None, "anything") is None


def test_instance_cost_is_price_times_hours_times_quantity():
    assert instance_hours_cost("m5.large", 3)["monthly_eur"]["value"] == round(0.096 * 730 * 3 * 0.92)


def test_instance_cost_adds_storage_extra():
    assert instance_hours_cost("m5.large", 1, 100.0)["monthly_eur"]["value"] == round((0.096 * 730 + 100) * 0.92)


def test_unknown_instance_type_is_not_priced():
    assert instance_hours_cost("x9.mega", 1) is None


def table(read_units, write_units, indexes=0, billing=None):
    described = {"ProvisionedThroughput": {"ReadCapacityUnits": read_units, "WriteCapacityUnits": write_units},
                 "KeySchema": [{"AttributeName": "pk"}],
                 "GlobalSecondaryIndexes": [{"Projection": {"ProjectionType": "ALL"}}] * indexes}
    if billing:
        described["BillingModeSummary"] = {"BillingMode": billing}
    return dynamodb_table("t", "t", described, True, False, None, None, None)


def test_provisioned_table_cost_counts_each_index_at_table_provisioning():
    expected = round((100 * 0.00013 + 50 * 0.00065) * 730 * 3 * 0.92)
    assert table(100, 50, indexes=2)["cost"]["monthly_eur"]["value"] == expected


def test_on_demand_table_has_no_cost():
    assert table(0, 0, billing="PAY_PER_REQUEST")["cost"] is None
