import json

from conftest import FakeSession

from agent.application.investigate import investigate


def finding(**overrides):
    return {
        "title": "app-db runs in one zone", "category": "reliability", "stack": "startup", "resources": ["app-db"],
        "evidence": ["MultiAZ false"], "recommendation": "two zones", "confidence": "high", "risk": "failover",
        "migration_notes": "", "dry_run_script": "", **overrides,
    }


def test_findings_are_written_without_any_saving_the_model_offers(run_dir):
    replies = []
    session = FakeSession(script=lambda tools: replies.append(tools["record_finding"](finding(monthly_saving_usd=900.0, saving_basis="list price"))))
    assert investigate(run_dir / "infra.json", run_dir / "findings.json", session, ()) == 0
    written = json.loads((run_dir / "findings.json").read_text(encoding="utf-8"))
    assert [f["id"] for f in written["findings"]] == ["F001"]
    assert "monthly_saving_usd" not in written["findings"][0]
    assert "saving_basis" not in written["findings"][0]
    assert replies[0]["content"][0]["text"] == "recorded F001"


def test_a_finding_with_an_unknown_category_is_refused(run_dir):
    replies = []
    session = FakeSession(script=lambda tools: replies.append(tools["record_finding"](finding(category="vibes"))))
    investigate(run_dir / "infra.json", run_dir / "findings.json", session, ())
    assert replies[0]["is_error"] is True
    assert json.loads((run_dir / "findings.json").read_text(encoding="utf-8")) == {"findings": []}


def test_the_model_is_given_the_infra_component_ids(run_dir):
    session = FakeSession()
    investigate(run_dir / "infra.json", run_dir / "findings.json", session, ())
    assert '"id": "app-db"' in session.prompts[0]
