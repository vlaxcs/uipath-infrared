import re
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[1] / "engine"
FORBIDDEN_IN_DOMAIN = re.compile(r"^\s*(from|import)\s+engine\.(adapters|application|cli)\b", re.MULTILINE)


def test_domain_never_imports_adapters_application_or_the_cli():
    offenders = [
        path.name for path in sorted((ENGINE / "domain").glob("*.py"))
        if FORBIDDEN_IN_DOMAIN.search(path.read_text())
    ]
    assert offenders == []
