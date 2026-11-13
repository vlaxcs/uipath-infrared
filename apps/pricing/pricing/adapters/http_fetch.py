import io
import urllib.request
from typing import Iterator

TIMEOUT_S = 120
USER_AGENT = "Mozilla/5.0 (compatible; infrared-pricing)"


class HttpFetcher:
    def lines(self, url: str) -> Iterator[str]:
        with urllib.request.urlopen(_request(url), timeout=TIMEOUT_S) as response:
            yield from io.TextIOWrapper(response, encoding="utf-8", newline="")

    def text(self, url: str) -> str:
        with urllib.request.urlopen(_request(url), timeout=TIMEOUT_S) as response:
            return response.read().decode("utf-8", "replace")


def _request(url: str) -> urllib.request.Request:
    return urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
