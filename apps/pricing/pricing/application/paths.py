from dataclasses import dataclass
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = APP_DIR.parents[1]


@dataclass(frozen=True)
class Paths:
    config: Path = APP_DIR / "config"
    snapshots: Path = APP_DIR / "snapshots"
    skeleton: Path = REPO_DIR / "contracts" / "catalog.example.json"
    schema: Path = REPO_DIR / "contracts" / "catalog.schema.json"
    catalog: Path = REPO_DIR / "contracts" / "real" / "catalog.json"
