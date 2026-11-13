import json
from pathlib import Path
from typing import Sequence

from agent.application.ports import Session
from agent.application.tools import Tool, answer, refuse
from agent.domain.findings import CATEGORIES, FIELDS, FindingLog
from agent.domain.prompts import LEAD, SPECIALISTS, investigation_prompt

RECORD_FINDING_DESCRIPTION = (
    "Record ONE optimization finding. Call once per distinct issue after you have evidence. "
    f"category: {'|'.join(CATEGORIES)}. resources: infra.json component ids or AWS names affected. "
    "evidence: concrete observations (config values, metric numbers). confidence: low|medium|high "
    "(cap at medium when the evidence is only synthetic metrics). risk: what could break. "
    "migration_notes: for migrate/consolidate, what must move together and in what order. "
    "dry_run_script: bash with aws CLI (--endpoint-url) commands implementing the change, or empty. "
    "It is saved for human review and NEVER executed. No savings, prices or costs."
)


def record_finding_tool(log: FindingLog) -> Tool:
    def record(fields: dict) -> dict:
        if fields.get("category") not in CATEGORIES:
            return refuse(f"category must be one of {', '.join(CATEGORIES)}")
        return answer(f"recorded {log.record(fields)}")

    return Tool("record_finding", RECORD_FINDING_DESCRIPTION, FIELDS, record)


def investigate(infra_path: Path, out_path: Path, session: Session, read_tools: Sequence[Tool]) -> int:
    infra = json.loads(infra_path.read_text(encoding="utf-8"))
    log = FindingLog()
    session.run(LEAD, investigation_prompt(infra), [*read_tools, record_finding_tool(log)], SPECIALISTS)
    out_path.write_text(json.dumps(log.document(), indent=1) + "\n", encoding="utf-8")
    return 0
