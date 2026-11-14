from datetime import date

from pricing.adapters.fetcher import Fetcher
from pricing.adapters.page_text import visible_text
from pricing.domain.manual_entry import ManualEntry, quote_found
from pricing.domain.snapshot import Snapshot

SOURCE = "manual"
QUOTE_MISSING = "the quoted text is no longer on the page: re-read the price"


def check_manual(entries: tuple[ManualEntry, ...], version: str, fetcher: Fetcher, fetched_on: date) -> Snapshot:
    pages = {url: visible_text(fetcher.text(url)) for url in sorted({e.url for e in entries})}
    found = {e.key: e for e in entries if quote_found(e.quote, pages[e.url])}
    return Snapshot(
        source=SOURCE,
        url="apps/pricing/config/manual.json",
        version=version,
        fetched_on=fetched_on,
        prices={key: entry.price for key, entry in found.items()},
        unverified={e.key: QUOTE_MISSING for e in entries if e.key not in found},
    )
