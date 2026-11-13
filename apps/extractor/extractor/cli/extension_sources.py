from extractor.adapters.ai_consumption_file import read_ai_consumption
from extractor.adapters.github_actions import GithubActions
from extractor.adapters.postgres_stats import PostgresStats
from extractor.application.extensions import ExtensionSources


def extension_sources(extension_settings):
    return ExtensionSources(
        postgres=PostgresStats(extension_settings.rds_stats_password) if extension_settings.rds_stats_password else None,
        github=GithubActions(extension_settings.github_token, extension_settings.github_repository) if extension_settings.github_token else None,
        github_repository=extension_settings.github_repository,
        ai_consumption_file=extension_settings.ai_consumption_file,
        ai_consumption_reader=read_ai_consumption)
