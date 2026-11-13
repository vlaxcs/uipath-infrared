import json
import sys
from dataclasses import dataclass
from pathlib import Path

from agent.application.ports import CandidatesChecker, Engine, EngineRefused, Session
from agent.application.tools import Tool, answer, refuse
from agent.domain.candidates import candidates_document, figures_of
from agent.domain.prompts import PROPOSER, proposal_prompt

CANDIDATE_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "builds_on": {"type": ["string", "null"]},
        "revises": {"type": "string"},
        "rationale": {"type": "string"},
        "actions": {"type": "array", "items": {"type": "object"}},
    },
    "required": ["id", "builds_on", "rationale", "actions"],
}


@dataclass(frozen=True)
class ProposalInputs:
    infra: Path
    forecast: Path
    catalog: Path
    findings: Path
    revision: int
    feedback: Path | None
    out: Path


class Proposal:
    def __init__(self, inputs: ProposalInputs, session: Session, engine: Engine, checker: CandidatesChecker):
        self.inputs = inputs
        self.session = session
        self.engine = engine
        self.checker = checker
        self.infra = read(inputs.infra)
        self.catalog = read(inputs.catalog)
        self.submitted = False

    def evaluate_candidate(self, candidate: dict) -> dict:
        document = self._document([candidate])
        try:
            result = self.engine.evaluate(document, self.inputs.infra, self.inputs.forecast, self.inputs.catalog)
        except EngineRefused as refusal:
            return refuse(f"the engine refused the candidate: {refusal}")
        figures = figures_of(result, candidate.get("id", ""))
        if figures is None:
            return refuse(f"the engine's result has no candidate {candidate.get('id')}")
        return answer(figures)

    def submit_candidates(self, arguments: dict) -> dict:
        document = self._document(arguments.get("candidates", []))
        errors = self.checker.errors(document, self.infra, self.catalog)
        if errors:
            return refuse("nothing written; fix these and submit again:\n" + "\n".join(errors))
        self.inputs.out.write_text(json.dumps(document, indent=1) + "\n", encoding="utf-8")
        self.submitted = True
        return answer(f"wrote {len(document['candidates'])} candidates")

    def tools(self) -> list[Tool]:
        return [
            Tool("evaluate_candidate", "Ask the engine for one candidate's verdict and figures before you submit it.", CANDIDATE_SCHEMA, self.evaluate_candidate),
            Tool("submit_candidates", "Submit every candidate you keep, once, at the end.", {"type": "object", "properties": {"candidates": {"type": "array", "items": CANDIDATE_SCHEMA}}, "required": ["candidates"]}, self.submit_candidates),
        ]

    def run(self) -> int:
        feedback = read(self.inputs.feedback) if self.inputs.feedback else None
        prompt = proposal_prompt(self.infra, read(self.inputs.forecast), read(self.inputs.findings), feedback, self._rejected(feedback))
        self.session.run(PROPOSER, prompt, self.tools(), ())
        if not self.submitted:
            print(f"propose: the model finished without submitting candidates for revision {self.inputs.revision}", file=sys.stderr)
            return 1
        return 0

    def _rejected(self, feedback: dict | None) -> list:
        if not feedback:
            return []
        result = read(self.inputs.feedback.parent / feedback["result"])
        return [
            {"id": c["id"], "feasible": c["feasible"], "violations": c["violations"]}
            for c in result["candidates"]
            if c["source"] == "agent"
        ]

    def _document(self, candidates: list) -> dict:
        return candidates_document(self.infra["project"], self.inputs.revision, self.session.model, candidates)


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
