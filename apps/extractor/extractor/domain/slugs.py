import re


class SlugRegistry:
    def __init__(self):
        self.used = set()

    def make(self, text, prefix=""):
        base = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", f"{prefix}{text}".lower())).strip("-") or "x"
        candidate, suffix = base, 2
        while candidate in self.used:
            candidate, suffix = f"{base}-{suffix}", suffix + 1
        self.used.add(candidate)
        return candidate
