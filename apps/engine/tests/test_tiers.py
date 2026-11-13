from engine.domain.tiers import resolve_tier


def tiers_of(catalog, option_id):
    return catalog.option(option_id).pricing.tiers


def test_exact_sku_in_the_catalog_is_used_as_is(catalog):
    choice = resolve_tier(tiers_of(catalog, "aws-rds-postgres"), "db.m5.xlarge", 4, 16)
    assert (choice.tier.id, choice.units) == ("db.m5.xlarge", 1)


def test_unknown_sku_is_priced_as_the_smallest_tier_that_covers_its_size(catalog):
    choice = resolve_tier(tiers_of(catalog, "aws-rds-postgres"), "db.m5.4xlarge", 16, 64)
    assert (choice.tier.id, choice.units) == ("db.r6g.4xlarge", 1)


def test_a_size_no_single_tier_covers_is_priced_as_the_cheapest_multiple(catalog):
    choice = resolve_tier(tiers_of(catalog, "aws-eks-nodes"), "c5.12xlarge", 48, 96)
    assert (choice.tier.id, choice.units) == ("m6i.4xlarge", 3)


def test_gpu_nodes_are_only_priced_on_gpu_tiers(catalog):
    choice = resolve_tier(tiers_of(catalog, "aws-eks-nodes"), "p3.8xlarge", 32, 244, gpus=4)
    assert choice.tier.gpus > 0
    assert choice.units * choice.tier.gpus >= 4


def test_no_size_facts_means_no_price(catalog):
    assert resolve_tier(tiers_of(catalog, "aws-rds-postgres"), "db.unknown", None, None) is None
