from dataclasses import dataclass

from extractor.application.extract_ai_consumption import extract_ai_consumption
from extractor.application.extract_ci_runners import extract_ci_runners
from extractor.application.extract_db_stats import extract_db_stats


@dataclass(frozen=True)
class ExtensionSources:
    postgres: object
    github: object
    github_repository: str
    ai_consumption_file: str
    ai_consumption_reader: object


def run_extensions(context, sources, now):
    extract_db_stats(context, sources.postgres)
    return {"ai_consumption": extract_ai_consumption(context, sources.ai_consumption_file, sources.ai_consumption_reader),
            "ci_runners": extract_ci_runners(context, sources.github, sources.github_repository, now)}
