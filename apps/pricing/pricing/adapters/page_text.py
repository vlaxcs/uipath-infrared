import html
import re

HIDDEN = re.compile(r"<(script|style)\b.*?</\1\s*>", re.S | re.I)
TAG = re.compile(r"<[^>]+>")


def visible_text(page: str) -> str:
    return html.unescape(TAG.sub(" ", HIDDEN.sub(" ", page)))
