SCHEMA_VERSION = "1.0"
AGENT_NAME = "infrared-agent"


def candidates_document(project: str, revision: int, model: str, candidates: list) -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "project": project,
        "revision": revision,
        "proposed_by": {"agent": AGENT_NAME, "model": model},
        "candidates": candidates,
    }


def figures_of(result: dict, candidate_id: str) -> dict | None:
    for candidate in result["candidates"]:
        if candidate["id"] == candidate_id:
            return {
                "id": candidate["id"],
                "feasible": candidate["feasible"],
                "violations": candidate["violations"],
                "run_eur_month_now": candidate["cost"]["run_eur_month_now"],
                "availability_pct": candidate.get("availability_pct"),
                "risk": candidate.get("risk"),
                "rank": candidate.get("rank"),
            }
    return None
