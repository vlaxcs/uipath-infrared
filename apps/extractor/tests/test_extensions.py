import json
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator

from extractor.application.context import ExtractionContext
from extractor.application.extensions import ExtensionSources, run_extensions
from extractor.application.warnings import Warnings
from extractor.domain.document import infra_document
from extractor.domain.inventory import Inventory

SCHEMA = Path(__file__).resolve().parents[3] / "contracts" / "infra.schema.json"
NOW = datetime(2026, 11, 13, tzinfo=timezone.utc)
AI_FILE = Path(__file__).resolve().parents[1] / "examples" / "ai-consumption.example.json"


class FakePostgres:
    def __init__(self, failing=()):
        self.failing = failing

    def read(self, host, port, user, database):
        if port in self.failing:
            raise ConnectionError("connection timeout expired")
        return [{"schema": "public", "table": "orders", "size_bytes": 8192, "live_rows": 3, "seq_scans": 1, "idx_scans": 4,
                 "n_tup_ins": 3, "n_tup_upd": 0, "n_tup_del": 0}], 1


class FakeGithub:
    def runs_since(self, since):
        return [{"id": 7}]

    def jobs(self, run_id):
        return [{"run_id": run_id, "labels": ["ubuntu-latest"], "started_at": "2026-11-01T10:00:00Z",
                 "completed_at": "2026-11-01T11:00:00Z"}]


def context_with_databases():
    inventory = Inventory("us-east-1")
    context = ExtractionContext(aws=None, warnings=Warnings(), series=None, region="us-east-1", window_days=14,
                                metric_provenance="synthetic", inventory=inventory)
    for component_id, port in (("rds-a", 7001), ("rds-b", 7002)):
        inventory.add({"id": component_id, "name": component_id, "kind": "postgres", "service": "rds", "stateful": True})
        context.references.database_logins[component_id] = {"endpoint": f"172.17.0.2:{port}", "user": "admin", "database": "postgres"}
    return context


def sources(postgres=None, github=None, ai_file=""):
    return ExtensionSources(postgres=postgres, github=github, github_repository="org/repo", ai_consumption_file=str(ai_file),
                            ai_consumption_reader=lambda path: json.loads(Path(path).read_text()))


def components(context):
    return {c["id"]: c for c in context.inventory.components}


def test_every_extension_is_skipped_with_a_warning_when_unconfigured():
    context = context_with_databases()
    extended = run_extensions(context, sources(), NOW)
    assert extended == {"ai_consumption": None, "ci_runners": None}
    assert not any("db_stats" in c for c in context.inventory.components)
    assert context.warnings.messages == ["postgres stats skipped: RDS_STATS_PASSWORD is empty",
                                         "ai consumption skipped: AI_CONSUMPTION_FILE is not set",
                                         "github runners skipped: GITHUB_TOKEN is empty"]


def test_unreachable_database_degrades_to_a_warning():
    context = context_with_databases()
    run_extensions(context, sources(postgres=FakePostgres(failing=(7002,))), NOW)
    assert "db_stats" in components(context)["rds-a"]
    assert "db_stats" not in components(context)["rds-b"]
    assert "postgres stats rds-b at 172.17.0.2:7002: connection timeout expired" in context.warnings.messages


def test_missing_ai_file_is_a_warning_not_a_failure(tmp_path):
    context = context_with_databases()
    extended = run_extensions(context, sources(ai_file=tmp_path / "absent.json"), NOW)
    assert extended["ai_consumption"] is None
    assert any(m.startswith("ai consumption skipped:") and "absent.json" in m for m in context.warnings.messages)


def test_extended_document_passes_the_extended_schema():
    context = context_with_databases()
    extended = run_extensions(context, sources(postgres=FakePostgres(), github=FakeGithub(), ai_file=AI_FILE), NOW)
    document = infra_document("p", "http://localhost:4566", "us-east-1", NOW, {}, context.inventory, context.warnings.messages, extended)
    errors = [e.message for e in Draft202012Validator(json.loads(SCHEMA.read_text())).iter_errors(document)]
    assert errors == []
    assert document["schema_version"] == "1.1"
    assert document["ci_runners"]["runners"][0]["hours_month"] == round(30 / 14, 2)
    assert {e["provenance"] for e in document["ai_consumption"]["tokens_by_model"]} == {"synthetic"}


def test_document_without_extensions_stays_on_schema_1_0():
    context = context_with_databases()
    document = infra_document("p", "http://localhost:4566", "us-east-1", NOW, {}, context.inventory, [])
    assert document["schema_version"] == "1.0"
    assert "ai_consumption" not in document and "ci_runners" not in document
