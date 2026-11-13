from sandbox.domain.naming import resource_name, run_prefix


def test_run_prefix_starts_with_sandbox():
    assert run_prefix("abc123") == "sandbox-abc123-"


def test_resource_name_slugs_and_truncates_without_losing_prefix():
    name = resource_name("sandbox-abc123-", "Web_Server.Primary-Load-Balancer", 32)

    assert name.startswith("sandbox-abc123-")
    assert len(name) <= 32
    assert name == name.lower()
    assert not name.endswith("-")
    assert "_" not in name and "." not in name
