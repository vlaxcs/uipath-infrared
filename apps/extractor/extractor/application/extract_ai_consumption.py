from pathlib import Path

from extractor.domain.ai_consumption import ai_consumption


def extract_ai_consumption(context, path, reader):
    if not path:
        context.warnings.note("ai consumption skipped: AI_CONSUMPTION_FILE is not set")
        return None
    if not Path(path).is_file():
        context.warnings.note(f"ai consumption skipped: {path} does not exist")
        return None
    return context.warnings.guard(f"ai consumption {path}", lambda: ai_consumption(reader(path)))
