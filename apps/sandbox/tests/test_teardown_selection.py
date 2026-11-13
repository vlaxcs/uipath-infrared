from sandbox.domain.teardown_selection import InventoryItem, select_owned, teardown_order


def test_selects_only_names_under_the_prefix():
    items = [
        InventoryItem("vpc", "vpc-1", "sandbox-abc123-vpc"),
        InventoryItem("vpc", "vpc-2", "sandbox-abc124-vpc"),
        InventoryItem("bucket", "startup-uploads", "startup-uploads"),
        InventoryItem("instance", "i-1", "shop-web"),
        InventoryItem("subnet", "subnet-1", ""),
    ]

    assert [item.resource_id for item in select_owned(items, "sandbox-abc123-")] == ["vpc-1"]
    assert [item.resource_id for item in select_owned(items, "sandbox-")] == ["vpc-1", "vpc-2"]


def test_dependents_are_deleted_before_what_they_sit_in():
    items = [
        InventoryItem("vpc", "v", "sandbox-x-vpc"),
        InventoryItem("subnet", "s", "sandbox-x-s"),
        InventoryItem("elastic_ip", "e", "sandbox-x-e"),
        InventoryItem("nat_gateway", "n", "sandbox-x-n"),
        InventoryItem("target_group", "t", "sandbox-x-t"),
        InventoryItem("load_balancer", "l", "sandbox-x-l"),
        InventoryItem("db_subnet_group", "g", "sandbox-x-g"),
        InventoryItem("db_instance", "d", "sandbox-x-d"),
    ]

    order = [item.resource_type for item in teardown_order(items)]

    assert order.index("load_balancer") < order.index("target_group")
    assert order.index("db_instance") < order.index("db_subnet_group")
    assert order.index("nat_gateway") < order.index("elastic_ip")
    assert order[-2:] == ["subnet", "vpc"]
