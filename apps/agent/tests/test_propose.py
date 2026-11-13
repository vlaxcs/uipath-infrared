import json
import shutil
import sys

from conftest import FLOW, FakeSession, answer_of, candidate

from agent.adapters.contracts import ContractChecker
from agent.adapters.engine import EngineCli
from agent.application.propose import Proposal, ProposalInputs
from agent.domain.candidates import figures_of


def proposal(run_dir, session, engine, revision=0, feedback=None):
    inputs = ProposalInputs(
        run_dir / "infra.json", run_dir / "forecast.json", run_dir / "catalog.json", run_dir / "findings.json",
        revision, feedback, run_dir / f"candidates.{revision}.json",
    )
    return Proposal(inputs, session, engine, ContractChecker())


def test_evaluate_candidate_answers_exactly_the_engines_figures(run_dir, engine_command):
    engine_result = json.loads((FLOW / "result.0.json").read_text(encoding="utf-8"))
    reply = proposal(run_dir, FakeSession(), EngineCli(engine_command)).evaluate_candidate(candidate(0))
    assert "is_error" not in reply
    assert answer_of(reply) == figures_of(engine_result, "agent-serverless-db")
    assert answer_of(reply)["feasible"] is False
    assert [v["constraint"] for v in answer_of(reply)["violations"]] == ["data_residency"]


def test_an_engine_refusal_comes_back_as_a_tool_error(run_dir):
    refusing = EngineCli([sys.executable, "-c", "import sys; print('engine: forecast breaks its schema', file=sys.stderr); sys.exit(2)"])
    reply = proposal(run_dir, FakeSession(), refusing).evaluate_candidate(candidate(0))
    assert reply["is_error"] is True
    assert "engine: forecast breaks its schema" in reply["content"][0]["text"]


def test_submit_refuses_a_candidate_that_carries_a_price_and_writes_nothing(run_dir, engine_command):
    priced = {**candidate(0), "monthly_eur": 220}
    run = proposal(run_dir, FakeSession(), EngineCli(engine_command))
    reply = run.submit_candidates({"candidates": [priced]})
    assert reply["is_error"] is True
    assert "monthly_eur" in reply["content"][0]["text"]
    assert not (run_dir / "candidates.0.json").exists()
    assert run.submitted is False


def test_submit_refuses_a_target_the_catalog_does_not_offer(run_dir, engine_command):
    unknown = candidate(0)
    unknown["actions"][0]["to"]["option"] = "no-such-option"
    reply = proposal(run_dir, FakeSession(), EngineCli(engine_command)).submit_candidates({"candidates": [unknown]})
    assert reply["is_error"] is True
    assert "no-such-option is not in the catalog" in reply["content"][0]["text"]


def test_submit_writes_a_document_that_passes_the_contract(run_dir, engine_command):
    run = proposal(run_dir, FakeSession(), EngineCli(engine_command))
    reply = run.submit_candidates({"candidates": [candidate(0)]})
    written = json.loads((run_dir / "candidates.0.json").read_text(encoding="utf-8"))
    assert "is_error" not in reply
    assert written["project"] == "startup" and written["revision"] == 0
    assert written["proposed_by"] == {"agent": "infrared-agent", "model": "fake-model"}
    assert ContractChecker().errors(written, json.loads((run_dir / "infra.json").read_text()), json.loads((run_dir / "catalog.json").read_text())) == []


def test_propose_exits_1_when_the_model_never_submits(run_dir, engine_command):
    assert proposal(run_dir, FakeSession(), EngineCli(engine_command)).run() == 1
    assert not (run_dir / "candidates.0.json").exists()


def test_propose_exits_0_once_the_model_submits(run_dir, engine_command):
    session = FakeSession(script=lambda tools: tools["submit_candidates"]({"candidates": [candidate(0)]}))
    assert proposal(run_dir, session, EngineCli(engine_command)).run() == 0


def test_a_revision_shows_the_model_why_its_candidates_were_sent_back(run_dir, engine_command):
    shutil.copyfile(FLOW / "result.0.json", run_dir / "result.0.json")
    feedback = run_dir / "feedback.1.json"
    feedback.write_text(json.dumps({"revision": 1, "from_step": "evaluate", "reason": "agent-serverless-db breaks data_residency", "result": "result.0.json", "rehearsal": None}), encoding="utf-8")
    session = FakeSession(script=lambda tools: tools["submit_candidates"]({"candidates": [candidate(1)]}))
    assert proposal(run_dir, session, EngineCli(engine_command), revision=1, feedback=feedback).run() == 0
    prompt = session.prompts[0]
    assert "agent-serverless-db breaks data_residency" in prompt
    assert '"constraint": "data_residency"' in prompt
    assert "managed_services" not in prompt.split("The engine's verdict")[1]
