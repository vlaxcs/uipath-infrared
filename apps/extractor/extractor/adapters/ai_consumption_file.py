import json
from pathlib import Path


def read_ai_consumption(path):
    return json.loads(Path(path).read_text())
