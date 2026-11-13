from sandbox.domain.function_sku import DEFAULT_MEMORY_MB, DEFAULT_RUNTIME, parse_function_sku


def test_parses_runtime_and_memory():
    sku = parse_function_sku("python3.9/1024MB")

    assert (sku.runtime, sku.memory_mb) == ("python3.9", 1024)


def test_falls_back_when_sku_is_not_a_runtime():
    sku = parse_function_sku("standard")

    assert sku.runtime == DEFAULT_RUNTIME
    assert sku.memory_mb == DEFAULT_MEMORY_MB


def test_falls_back_on_garbage_runtime():
    assert parse_function_sku("??/x").runtime == DEFAULT_RUNTIME
