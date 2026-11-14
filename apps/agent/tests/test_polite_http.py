import pytest

from agent.adapters.polite_http import PageMissing, PoliteFetcher
from agent.application.ports import ListingSourceUnavailable

ALLOW_ALL = (200, "User-agent: *\nDisallow: /ajax/\n")


class FakeWeb:
    def __init__(self, pages):
        self.pages = pages
        self.asked = []

    def get(self, url, user_agent, timeout):
        self.asked.append(url)
        answer = self.pages[url]
        return answer.pop(0) if isinstance(answer, list) else answer


class FakeTime:
    def __init__(self):
        self.now = 0.0
        self.slept = []

    def clock(self):
        return self.now

    def sleep(self, seconds):
        self.slept.append(seconds)
        self.now += seconds


def fetcher(pages, time=None, **options):
    time = time or FakeTime()
    web = FakeWeb(pages)
    return PoliteFetcher(get=web.get, sleep=time.sleep, clock=time.clock, **options), web, time


def test_a_page_the_robots_file_disallows_is_never_fetched():
    polite, web, _ = fetcher({"https://site.test/robots.txt": ALLOW_ALL})
    with pytest.raises(ListingSourceUnavailable, match="robots.txt"):
        polite.text("https://site.test/ajax/list")
    assert web.asked == ["https://site.test/robots.txt"]


def test_a_site_without_a_robots_file_allows_everything():
    polite, _, _ = fetcher({"https://site.test/robots.txt": (404, ""), "https://site.test/a": (200, "page a")})
    assert polite.text("https://site.test/a") == "page a"


def test_two_requests_to_one_host_are_spaced_by_the_pause():
    time = FakeTime()
    pages = {"https://site.test/robots.txt": ALLOW_ALL, "https://site.test/a": (200, "a"), "https://site.test/b": (200, "b")}
    polite, _, _ = fetcher(pages, time, pause_seconds=2.0)
    polite.text("https://site.test/a")
    polite.text("https://site.test/b")
    assert sum(time.slept) >= 4.0
    assert all(seconds <= 2.0 for seconds in time.slept)


def test_a_server_error_is_retried_twice_then_the_source_is_unavailable():
    pages = {"https://site.test/robots.txt": ALLOW_ALL, "https://site.test/a": [(503, ""), (503, ""), (503, ""), (200, "late")]}
    polite, web, _ = fetcher(pages)
    with pytest.raises(ListingSourceUnavailable, match="503"):
        polite.text("https://site.test/a")
    assert web.asked.count("https://site.test/a") == 3


def test_a_retry_that_succeeds_returns_the_page():
    pages = {"https://site.test/robots.txt": ALLOW_ALL, "https://site.test/a": [(429, ""), (200, "page a")]}
    polite, _, _ = fetcher(pages)
    assert polite.text("https://site.test/a") == "page a"


def test_a_page_that_is_gone_is_not_retried():
    pages = {"https://site.test/robots.txt": ALLOW_ALL, "https://site.test/a": [(404, ""), (200, "never")]}
    polite, web, _ = fetcher(pages)
    with pytest.raises(PageMissing):
        polite.text("https://site.test/a")
    assert web.asked.count("https://site.test/a") == 1


def test_the_robots_file_is_read_once_per_host():
    pages = {"https://site.test/robots.txt": ALLOW_ALL, "https://site.test/a": (200, "a"), "https://site.test/b": (200, "b")}
    polite, web, _ = fetcher(pages)
    polite.text("https://site.test/a")
    polite.text("https://site.test/b")
    assert web.asked.count("https://site.test/robots.txt") == 1
