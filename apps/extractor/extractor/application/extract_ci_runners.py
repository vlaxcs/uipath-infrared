from datetime import timedelta

from extractor.domain.ci_runners import ci_runners


def extract_ci_runners(context, github, repository, now):
    if github is None:
        context.warnings.note("github runners skipped: GITHUB_TOKEN is empty")
        return None
    if not repository:
        context.warnings.note("github runners skipped: GITHUB_REPOSITORY is empty")
        return None
    since = (now - timedelta(days=context.window_days)).date().isoformat()
    runs = context.warnings.guard("github runs", lambda: github.runs_since(since))
    if runs is None:
        return None
    jobs = []
    for run in runs:
        jobs.extend(context.warnings.guard(f"github jobs {run['id']}", lambda: github.jobs(run["id"]), []))
    return ci_runners(jobs, context.window_days, repository)
