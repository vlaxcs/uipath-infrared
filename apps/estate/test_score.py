import json

from score import load_findings


def test_the_agents_findings_document_is_read(tmp_path):
    path = tmp_path / "findings.json"
    path.write_text(json.dumps({"findings": [{"id": "F001", "title": "idle gpu"}, {"id": "F002", "title": "orphan volume"}]}, indent=1))
    assert [f["id"] for f in load_findings(path)] == ["F001", "F002"]


def test_a_findings_jsonl_file_is_still_read(tmp_path):
    path = tmp_path / "findings.jsonl"
    path.write_text('{"id": "F001"}\n{"id": "F002"}\n')
    assert [f["id"] for f in load_findings(path)] == ["F001", "F002"]


def test_a_missing_file_has_no_findings(tmp_path):
    assert load_findings(tmp_path / "none.json") == []
