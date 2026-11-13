import pytest

from agent import settings


def test_missing_llm_key_stops_at_startup_naming_the_variable(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(SystemExit, match="ANTHROPIC_API_KEY"):
        settings.llm()


def test_blank_llm_key_counts_as_missing(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "   ")
    with pytest.raises(SystemExit, match="ANTHROPIC_API_KEY"):
        settings.llm()


def test_base_url_is_optional(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "key")
    monkeypatch.delenv("ANTHROPIC_BASE_URL", raising=False)
    assert settings.llm().base_url is None


def test_base_url_routes_through_another_provider(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "key")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://openrouter.ai/api")
    assert settings.llm().base_url == "https://openrouter.ai/api"
