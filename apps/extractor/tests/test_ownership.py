from extractor.domain.ownership import resolve_ownership, resource_names, tags_by_name


def component(id_, name=None, tags=None, config=None):
    found = {"id": id_, "name": name or id_, "kind": "virtual_machine", "stack": "prod"}
    if tags:
        found["tags"] = tags
    if config:
        found["config"] = config
    return found


def owners(components):
    return {c["id"]: (c["x_ownership"]["project"], c["x_ownership"]["environment"], c["x_ownership"]["source"], c["stack"]) for c in components}


def test_each_source_assigns_a_project_in_order_of_reliability():
    components = [
        component("a", tags={"Project": "Booking", "Environment": "Production"}),
        component("b", tags={"Application": "fleet"}),
        component("c", config={"namespace": "ledger-staging"}),
        component("d", config={"account_id": "111122223333"}),
        component("e", name="search-api-dev"),
    ]
    tags = {"b-cfn": {}, "f": {"aws:cloudformation:stack-name": "payroll-prod"}}
    found = owners(resolve_ownership(components + [component("f")], [], tags, known_projects=("search",), accounts={"111122223333": "billing"}))
    assert found["a"] == ("booking", "prod", "tag", "booking-prod")
    assert found["b"][:3] == ("fleet", None, "tag")
    assert found["c"] == ("ledger", "staging", "namespace", "ledger-staging")
    assert found["d"][:3] == ("billing", None, "account")
    assert found["e"] == ("search", "dev", "name", "search-dev")
    assert found["f"] == ("payroll", "prod", "cloudformation", "payroll-prod")


def test_a_tag_wins_over_the_cloudformation_stack_and_the_name():
    found = owners(resolve_ownership(
        [component("db", name="search-db", tags={"project": "booking", "aws:cloudformation:stack-name": "payroll-prod"})],
        [], known_projects=("search",),
    ))
    assert found["db"][:3] == ("booking", None, "tag")


def test_tags_from_the_tagging_api_are_matched_by_resource_name():
    mappings = [{"ResourceARN": "arn:aws:rds:eu-west-1:111122223333:db:orders-db", "Tags": [{"Key": "Project", "Value": "shop"}, {"Key": "env", "Value": "stg"}]}]
    found = owners(resolve_ownership([component("rds-orders", name="orders-db")], [], tags_by_name(mappings)))
    assert found["rds-orders"] == ("shop", "staging", "tag", "shop-staging")


def test_an_untagged_resource_used_by_two_projects_is_shared_and_by_one_follows_it():
    components = [
        component("api-a", tags={"project": "booking"}),
        component("api-b", tags={"project": "fleet"}),
        component("nat"),
        component("cache"),
        component("orphan"),
    ]
    edges = [{"from": "api-a", "to": "nat"}, {"from": "api-b", "to": "nat"}, {"from": "api-a", "to": "cache"}]
    resolved = resolve_ownership(components, edges)
    found = owners(resolved)
    assert found["nat"] == (None, None, "shared", "shared")
    assert next(c for c in resolved if c["id"] == "nat")["x_ownership"]["shared_by"] == ["booking", "fleet"]
    assert found["cache"][:3] == ("booking", None, "dependency")
    assert found["orphan"] == (None, None, "none", "unassigned")


def test_an_estate_with_no_ownership_signal_keeps_its_stacks():
    components = [component("a"), component("b")]
    assert resolve_ownership(components, []) == components


def test_a_resource_is_found_by_the_name_in_its_arn():
    assert resource_names("arn:aws:rds:eu-west-1:1:db:orders-db") == ["orders-db"]
    assert resource_names("arn:aws:s3:::shop-assets") == ["shop-assets"]
    assert resource_names("arn:aws:ecs:eu-west-1:1:service/main/orders-api") == ["orders-api"]
    assert resource_names("arn:aws:elasticloadbalancing:eu-west-1:1:loadbalancer/app/shop-alb/50dc6c495c0c9188") == ["50dc6c495c0c9188", "shop-alb"]
