from compare_startup import compare_component, compare_docs, passed


def component(id, kind="virtual_machine", name=None, **fields):
    c = {"id": id, "kind": kind, "quantity": 1, "status": "active"}
    if name:
        c["name"] = name
    c.update(fields)
    return c


def volume(id, name, size, sku="gp2", status="orphan"):
    return component(id, "block_storage", name, sku=sku, status=status, zones=1,
                     capacity={"storage_gb": {"value": size, "unit": "GB", "provenance": "observed"}})


def test_orphan_volume_matches_by_kind_and_volume_signature_without_a_startup_name():
    mock = {"components": [volume("logs-volume", None, 500)]}
    extractor = {"components": [volume("vol-orphan-gp2-500gb", "1 unattached gp2 volume(s) of 500 GB", 500),
                                volume("vol-orphan-gp2-1000gb", "6 unattached gp2 volume(s) of 1000 GB", 1000)]}
    results = compare_docs(extractor, mock)
    assert results["matched"] == [{"id": "logs-volume", "extractor_id": "vol-orphan-gp2-500gb"}]
    assert passed(results)


def test_orphan_volume_of_another_size_is_missing():
    mock = {"components": [volume("logs-volume", None, 500)]}
    extractor = {"components": [volume("vol-orphan-gp2-1000gb", "6 unattached gp2 volume(s) of 1000 GB", 1000)]}
    results = compare_docs(extractor, mock)
    assert results["missing_in_extractor"] == ["logs-volume"]
    assert not passed(results)


def test_each_orphan_volume_pairs_with_its_own_size():
    mock = {"components": [volume("logs-volume", None, 500), volume("scratch-volume", None, 1000)]}
    extractor = {"components": [volume("vol-orphan-gp2-1000gb", "6 unattached gp2 volume(s) of 1000 GB", 1000),
                                volume("vol-orphan-gp2-500gb", "1 unattached gp2 volume(s) of 500 GB", 500)]}
    assert compare_docs(extractor, mock)["matched"] == [{"id": "logs-volume", "extractor_id": "vol-orphan-gp2-500gb"},
                                                        {"id": "scratch-volume", "extractor_id": "vol-orphan-gp2-1000gb"}]


def test_omitted_zones_equal_null_zones():
    mock = component("queue", "queue", zones=None)
    extractor = component("q-startup-queue", "queue", "startup-queue")
    assert compare_component(mock, extractor)["ok"]


def test_zones_the_extractor_omits_do_not_match_a_number():
    mock = component("queue", "queue", zones=3)
    extractor = component("q-startup-queue", "queue", "startup-queue")
    assert not compare_component(mock, extractor)["ok"]


def test_null_security_field_equals_extractor_none():
    mock = component("old-bastion", security={"encryption_at_rest": None})
    extractor = component("vm-startup-old-bastion", name="startup-old-bastion", security={"encryption_at_rest": None})
    assert compare_component(mock, extractor)["ok"]


def test_security_field_the_extractor_reports_as_none_mismatches_a_mock_value():
    mock = component("old-bastion", security={"encryption_at_rest": False})
    extractor = component("vm-startup-old-bastion", name="startup-old-bastion", security={"encryption_at_rest": None})
    result = compare_component(mock, extractor)
    assert result["diffs"] == ["security.encryption_at_rest: mock=False extractor=None"]


def test_cache_public_exposure_is_skipped_when_the_extractor_does_not_populate_it():
    mock = component("cache", "cache", security={"public_exposure": "vpc_only", "encryption_at_rest": False})
    extractor = component("cache-startup-cache", "cache", "startup-cache", security={"encryption_at_rest": False})
    assert compare_component(mock, extractor)["ok"]


def test_cache_public_exposure_is_compared_when_populated():
    mock = component("cache", "cache", security={"public_exposure": "vpc_only"})
    extractor = component("cache-startup-cache", "cache", "startup-cache", security={"public_exposure": "internet"})
    assert not compare_component(mock, extractor)["ok"]


def test_extra_startup_component_fails_the_comparison():
    mock = {"components": [component("old-bastion")]}
    extractor = {"components": [component("vm-startup-old-bastion", name="startup-old-bastion"),
                                component("vm-startup-old-bastion-2", name="startup-old-bastion"),
                                component("vm-shop-bastion", name="shop-bastion")]}
    results = compare_docs(extractor, mock)
    assert results["extra_in_extractor"] == ["vm-startup-old-bastion-2"]
    assert not passed(results)


def test_exact_startup_name_wins_over_a_similar_one():
    mock = {"components": [component("app-db", "postgres")]}
    extractor = {"components": [component("rds-startup-app-db-copy", "postgres", "startup-app-db-copy"),
                                component("rds-startup-app-db", "postgres", "startup-app-db")]}
    results = compare_docs(extractor, mock)
    assert results["matched"] == [{"id": "app-db", "extractor_id": "rds-startup-app-db"}]


def test_status_mismatch_is_reported():
    mock = component("old-bastion", status="idle")
    extractor = component("vm-startup-old-bastion", name="startup-old-bastion", status="active")
    assert compare_component(mock, extractor)["diffs"] == ["status: mock=idle extractor=active"]


def test_another_project_prefix_scopes_and_matches_by_its_own_names():
    mock = {"components": [component("prod-api", "container")]}
    extractor = {"components": [component("svc-clinic-prod-api", "container", "clinic-prod/api"),
                                component("svc-legacy-api", "container", "legacy-ecs/orders-api")]}
    results = compare_docs(extractor, mock, "clinic")
    assert results["matched"] == [{"id": "prod-api", "extractor_id": "svc-clinic-prod-api"}]
    assert passed(results)
