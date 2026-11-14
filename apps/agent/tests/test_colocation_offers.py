import json
from datetime import datetime, timezone

from agent.adapters.colocation_offers import ColocationOffers
from agent.adapters.listing_sources import ListingsByKind
from agent.adapters.polite_http import PageMissing
from agent.domain.sites import Point, SiteKind

NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)
TULCEA = Point(45.1716, 28.7914)
OFFER = {
    "label": "Royal Server, Colocation 42U, Tulcea", "lat": 45.1716, "lng": 28.7914,
    "location_basis": "city centre of Tulcea", "racks": 1, "rent_original": 400, "currency": "EUR",
    "source_url": "https://royal-server.ro/en/colocation.php", "quote": "€400/month",
}


class FakeFetcher:
    def __init__(self, pages):
        self.pages = pages
        self.asked = []

    def text(self, url):
        self.asked.append(url)
        if url not in self.pages:
            raise PageMissing(url)
        return self.pages[url]


def offers(tmp_path, pages, offer=OFFER):
    path = tmp_path / "colocation.json"
    path.write_text(json.dumps({"offers": [offer]}), encoding="utf-8")
    fetcher = FakeFetcher(pages)
    return ColocationOffers(path, fetcher, {"EUR": 1.0}, now=lambda: NOW), fetcher


def test_an_offer_whose_quote_is_still_on_its_page_is_returned(tmp_path):
    page = "<div class='plan'><h3>Colocation 42U</h3><p>&euro;400/month</p></div>"
    source, _ = offers(tmp_path, {OFFER["source_url"]: page})
    [listing] = source.search(TULCEA, 25, SiteKind.COLOCATION)
    assert (listing.kind, listing.racks, listing.rent_eur_month, listing.read_at) == (SiteKind.COLOCATION, 1, 400, NOW)


def test_a_quote_split_across_tags_on_the_page_still_matches(tmp_path):
    page = "<div class='price'><span class='amount'>€400</span><span class='period'>/month</span></div>"
    source, _ = offers(tmp_path, {OFFER["source_url"]: page})
    assert len(source.search(TULCEA, 25, SiteKind.COLOCATION)) == 1


def test_a_quote_left_only_in_a_script_does_not_count(tmp_path):
    page = "<p>Contact us for a price</p><script>var old = '€400/month';</script>"
    source, _ = offers(tmp_path, {OFFER["source_url"]: page})
    assert source.search(TULCEA, 25, SiteKind.COLOCATION) == []


def test_an_offer_whose_quote_vanished_is_dropped(tmp_path):
    source, _ = offers(tmp_path, {OFFER["source_url"]: "<p>€450/month</p>"})
    assert source.search(TULCEA, 25, SiteKind.COLOCATION) == []


def test_an_offer_whose_page_is_gone_is_dropped(tmp_path):
    source, _ = offers(tmp_path, {})
    assert source.search(TULCEA, 25, SiteKind.COLOCATION) == []


def test_an_offer_outside_the_radius_is_not_even_fetched(tmp_path):
    source, fetcher = offers(tmp_path, {OFFER["source_url"]: "€400/month"})
    assert source.search(Point(44.4268, 26.1025), 25, SiteKind.COLOCATION) == []
    assert fetcher.asked == []


class Recording:
    def __init__(self):
        self.kinds = []

    def search(self, center, radius_km, kind):
        self.kinds.append(kind)
        return []


def test_each_kind_goes_to_its_own_source():
    leases, colocation = Recording(), Recording()
    by_kind = ListingsByKind({SiteKind.LEASE: leases, SiteKind.COLOCATION: colocation})
    by_kind.search(TULCEA, 25, SiteKind.LEASE)
    by_kind.search(TULCEA, 25, SiteKind.COLOCATION)
    assert (leases.kinds, colocation.kinds) == ([SiteKind.LEASE], [SiteKind.COLOCATION])
