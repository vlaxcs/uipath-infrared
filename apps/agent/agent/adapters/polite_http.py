import time
import urllib.error
import urllib.request
from typing import Callable
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from agent.application.ports import ListingSourceUnavailable

USER_AGENT = "InfraredSiteSearch/0.1 (demo; one request at a time)"
TIMEOUT_SECONDS = 20
GONE = (404, 410)
RETRIED = (429, 500, 502, 503, 504)

Get = Callable[[str, str, float], tuple[int, str]]


class PageMissing(Exception):
    pass


def urllib_get(url: str, user_agent: str, timeout: float) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": user_agent, "Accept-Language": "ro,en"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        return error.code, ""


class PoliteFetcher:
    def __init__(
        self, get: Get = urllib_get, sleep: Callable[[float], None] = time.sleep, clock: Callable[[], float] = time.monotonic,
        pause_seconds: float = 2.0, retries: int = 2, backoff_seconds: float = 2.0, user_agent: str = USER_AGENT,
    ):
        self.get = get
        self.sleep = sleep
        self.clock = clock
        self.pause_seconds = pause_seconds
        self.retries = retries
        self.backoff_seconds = backoff_seconds
        self.user_agent = user_agent
        self.last_request_at: dict[str, float] = {}
        self.robots: dict[str, RobotFileParser] = {}

    def text(self, url: str) -> str:
        if not self._robots_for(url).can_fetch(self.user_agent, url):
            raise ListingSourceUnavailable(f"robots.txt of {urlsplit(url).netloc} disallows {url}")
        status, body = self._get_with_retries(url)
        if status in GONE:
            raise PageMissing(url)
        return body

    def _robots_for(self, url: str) -> RobotFileParser:
        parts = urlsplit(url)
        host = parts.netloc
        if host not in self.robots:
            robots = RobotFileParser()
            status, body = self._get_with_retries(f"{parts.scheme}://{host}/robots.txt")
            robots.parse([] if status in GONE else body.splitlines())
            self.robots[host] = robots
        return self.robots[host]

    def _get_with_retries(self, url: str) -> tuple[int, str]:
        failure = ""
        for attempt in range(self.retries + 1):
            if attempt:
                self.sleep(self.backoff_seconds * 2 ** (attempt - 1))
            self._wait_for_turn(urlsplit(url).netloc)
            try:
                status, body = self.get(url, self.user_agent, TIMEOUT_SECONDS)
            except OSError as error:
                failure = f"{type(error).__name__}: {error}"
                continue
            if status not in RETRIED:
                if status != 200 and status not in GONE:
                    raise ListingSourceUnavailable(f"{url} answered {status}")
                return status, body
            failure = f"answered {status}"
        raise ListingSourceUnavailable(f"{url} {failure} after {self.retries} retries")

    def _wait_for_turn(self, host: str) -> None:
        last = self.last_request_at.get(host)
        if last is not None:
            wait = self.pause_seconds - (self.clock() - last)
            if wait > 0:
                self.sleep(wait)
        self.last_request_at[host] = self.clock()
