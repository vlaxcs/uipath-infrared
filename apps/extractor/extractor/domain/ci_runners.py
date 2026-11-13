from datetime import datetime

DAYS_PER_MONTH = 30
SECONDS_PER_HOUR = 3600
UNKNOWN_RUNNER = "unknown"


def parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def job_seconds(job):
    started, completed = parse_time(job.get("started_at")), parse_time(job.get("completed_at"))
    if not started or not completed or completed < started:
        return 0.0
    return (completed - started).total_seconds()


def runner_type(job):
    labels = job.get("labels") or []
    if "self-hosted" in labels:
        return "self-hosted"
    return labels[0] if labels else UNKNOWN_RUNNER


def ci_runners(jobs, window_days, repository):
    seconds, runs = {}, {}
    for job in jobs:
        kind = runner_type(job)
        seconds[kind] = seconds.get(kind, 0.0) + job_seconds(job)
        runs.setdefault(kind, set()).add(job.get("run_id"))
    scale = DAYS_PER_MONTH / window_days
    runners = [{"runner_type": kind, "hours_month": round(seconds[kind] / SECONDS_PER_HOUR * scale, 2),
                "workflow_runs": len(runs[kind]), "provenance": "estimated"} for kind in sorted(seconds)]
    return {"runners": runners, "source_repo": repository}
