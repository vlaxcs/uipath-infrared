import re
from pathlib import Path

AGENT = Path(__file__).resolve().parents[1] / "agent"


def importers_of(layer: str, forbidden: str) -> list[str]:
    pattern = re.compile(rf"^\s*(from|import)\s+agent\.({forbidden})\b", re.MULTILINE)
    return [path.name for path in sorted((AGENT / layer).glob("*.py")) if pattern.search(path.read_text(encoding="utf-8"))]


def test_the_domain_imports_no_other_layer():
    assert importers_of("domain", "adapters|application|cli") == []


def test_the_application_never_imports_an_adapter():
    assert importers_of("application", "adapters|cli") == []
