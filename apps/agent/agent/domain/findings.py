CATEGORIES = ("rightsize", "delete_idle", "consolidate", "migrate", "modernize", "storage_tiering", "network", "reliability", "security")

FIELDS = {
    "title": str,
    "category": str,
    "stack": str,
    "resources": list,
    "evidence": list,
    "recommendation": str,
    "confidence": str,
    "risk": str,
    "migration_notes": str,
    "dry_run_script": str,
}


class FindingLog:
    def __init__(self):
        self._findings = []

    def record(self, fields: dict) -> str:
        finding_id = f"F{len(self._findings) + 1:03d}"
        self._findings.append({"id": finding_id, **{name: fields[name] for name in FIELDS if name in fields}})
        return finding_id

    def document(self) -> dict:
        return {"findings": list(self._findings)}
