import json
from dataclasses import dataclass
from typing import Any, Callable

MAX_CHARS = 20000


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    schema: dict
    handler: Callable[[dict[str, Any]], dict]


def answer(value: Any) -> dict:
    text = value if isinstance(value, str) else json.dumps(value, default=str, indent=1)
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS] + f"\n...[truncated {len(text) - MAX_CHARS} chars; narrow the call or use params]"
    return {"content": [{"type": "text", "text": text}]}


def refuse(reason: str) -> dict:
    return {**answer(reason), "is_error": True}
