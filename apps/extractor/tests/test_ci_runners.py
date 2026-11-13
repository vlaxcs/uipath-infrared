from extractor.domain.ci_runners import ci_runners


def job(run_id, labels, start="2026-11-01T10:00:00Z", end="2026-11-01T10:30:00Z"):
    return {"run_id": run_id, "labels": labels, "started_at": start, "completed_at": end}


def by_type(result):
    return {r["runner_type"]: r for r in result["runners"]}


def test_hours_are_summed_per_runner_type_and_scaled_to_a_month():
    jobs = [job(1, ["ubuntu-latest"]), job(1, ["ubuntu-latest"]), job(2, ["ubuntu-latest"])]
    runners = by_type(ci_runners(jobs, 15, "org/repo"))
    assert runners["ubuntu-latest"]["hours_month"] == 3.0
    assert runners["ubuntu-latest"]["workflow_runs"] == 2


def test_self_hosted_label_wins_over_other_labels():
    runners = by_type(ci_runners([job(1, ["linux", "self-hosted", "infrared"])], 30, "org/repo"))
    assert list(runners) == ["self-hosted"]


def test_unfinished_job_counts_no_hours():
    runners = by_type(ci_runners([job(1, ["ubuntu-latest"], end=None)], 30, "org/repo"))
    assert runners["ubuntu-latest"]["hours_month"] == 0


def test_hours_are_marked_estimated_and_repo_is_kept():
    result = ci_runners([job(1, [])], 30, "org/repo")
    assert result["source_repo"] == "org/repo"
    assert result["runners"][0]["runner_type"] == "unknown"
    assert result["runners"][0]["provenance"] == "estimated"
