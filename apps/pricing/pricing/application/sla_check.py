from datetime import date

from pricing.adapters.fetcher import Fetcher
from pricing.adapters.page_text import visible_text
from pricing.domain.manual_entry import quote_found
from pricing.domain.sla import SLA_SOURCE, SlaEntry, SlaSnapshot

SOURCE = SLA_SOURCE
QUOTE_MISSING = "the quoted text is no longer on the page: re-read the SLA"


def check_slas(entries: tuple[SlaEntry, ...], version: str, fetcher: Fetcher, fetched_on: date) -> SlaSnapshot:
    pages = {url: visible_text(fetcher.text(url)) for url in sorted({e.url for e in entries})}
    found = {e.key: e for e in entries if quote_found(e.quote, pages[e.url])}
    return SlaSnapshot(
        source=SOURCE,
        url="apps/pricing/config/slas.json",
        version=version,
        fetched_on=fetched_on,
        entries={key: entry for key, entry in found.items()},
        unverified={e.key: QUOTE_MISSING for e in entries if e.key not in found},
    )
