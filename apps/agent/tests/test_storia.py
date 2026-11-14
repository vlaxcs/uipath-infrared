import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from agent.adapters.polite_http import PageMissing
from agent.adapters.storia import StoriaLeases, parse_coordinates, parse_offers
from agent.application.ports import ListingSourceUnavailable
from agent.domain.sites import Point, SiteKind

FIXTURES = Path(__file__).parent / "fixtures" / "storia"
NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)
CENTRE = Point(44.4268, 26.1025)
SEARCH_URL = "https://www.storia.ro/ro/rezultate/inchiriere/spatiu-comercial/bucuresti?distanceRadius=25"
BANEASA = "https://www.storia.ro/ro/oferta/inchiriere-spatiu-comercial-in-baneasa-56mp-parter-IDIdaT"
PARKING = "https://www.storia.ro/ro/oferta/spaiu-comercial-de-nchiriat-parcare-inclus-IDI8fN"


def fixture(name):
    return (FIXTURES / name).read_text(encoding="utf-8")


def page(data):
    return f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script>'


def search_page(items):
    return page({"props": {"pageProps": {"data": {"searchAds": {"items": items}}}}})


def ad_page(lat, lng):
    return page({"props": {"pageProps": {"ad": {"location": {"coordinates": {"latitude": lat, "longitude": lng}}}}}})


def item(slug, rent=1000, area=100, currency="EUR", hidden=False):
    return {"id": 1, "title": slug, "href": f"[lang]/ad/{slug}", "hidePrice": hidden,
            "totalPrice": {"value": rent, "currency": currency}, "areaInSquareMeters": area, "estate": "COMMERCIAL_PROPERTY"}


class FakeFetcher:
    def __init__(self, pages):
        self.pages = pages
        self.asked = []

    def text(self, url):
        self.asked.append(url)
        if url not in self.pages:
            raise PageMissing(url)
        return self.pages[url]


def leases(pages, limit=20):
    fetcher = FakeFetcher(pages)
    return StoriaLeases(fetcher, {"EUR": 1.0}, now=lambda: NOW, limit=limit), fetcher


def test_the_search_page_gives_each_offer_with_its_price_area_and_url():
    offers = parse_offers(fixture("search-bucuresti.html"))
    assert len(offers) == 6
    baneasa = next(o for o in offers if o.url == BANEASA)
    assert (baneasa.rent, baneasa.currency, baneasa.area_m2) == (1000, "EUR", 56)
    assert baneasa.label == "Inchiriere spatiu comercial in Baneasa - 56mp Parter"


def test_an_offer_with_a_hidden_price_or_no_area_is_dropped():
    offers = parse_offers(search_page([item("kept"), item("hidden", hidden=True), item("no-area", area=None), item("no-rent", rent=None)]))
    assert [o.url.rsplit("/", 1)[1] for o in offers] == ["kept"]


def test_the_ad_page_gives_the_exact_coordinates():
    assert parse_coordinates(fixture("ad-inchiriere-spatiu-comercial-in-baneasa-56mp-parter-IDIdaT.html")) == Point(44.49096, 26.080755)


def test_a_search_reads_the_ads_near_the_pin_and_returns_leases():
    pages = {
        SEARCH_URL: fixture("search-bucuresti.html"),
        BANEASA: fixture("ad-inchiriere-spatiu-comercial-in-baneasa-56mp-parter-IDIdaT.html"),
        PARKING: fixture("ad-spaiu-comercial-de-nchiriat-parcare-inclus-IDI8fN.html"),
    }
    source, fetcher = leases(pages)
    found = source.search(CENTRE, 20, SiteKind.LEASE)
    assert fetcher.asked[0] == SEARCH_URL
    assert {listing.source_url for listing in found} == {BANEASA, PARKING}
    baneasa = next(listing for listing in found if listing.source_url == BANEASA)
    assert (baneasa.location, baneasa.area_m2, baneasa.rent_eur_month, baneasa.read_at) == (Point(44.49096, 26.080755), 56, 1000, NOW)


def test_an_ad_outside_the_radius_is_left_out():
    pages = {SEARCH_URL: search_page([item("near"), item("far")]),
             "https://www.storia.ro/ro/oferta/near": ad_page(44.43, 26.10),
             "https://www.storia.ro/ro/oferta/far": ad_page(44.43, 26.60)}
    source, _ = leases(pages)
    assert [l.source_url.rsplit("/", 1)[1] for l in source.search(CENTRE, 20, SiteKind.LEASE)] == ["near"]


def test_the_search_stops_reading_ads_once_it_has_enough():
    slugs = [f"ad-{n}" for n in range(5)]
    pages = {SEARCH_URL: search_page([item(s) for s in slugs]), **{f"https://www.storia.ro/ro/oferta/{s}": ad_page(44.43, 26.10) for s in slugs}}
    source, fetcher = leases(pages, limit=2)
    assert len(source.search(CENTRE, 20, SiteKind.LEASE)) == 2
    assert len(fetcher.asked) == 3


def test_an_ad_page_that_is_gone_is_skipped():
    pages = {SEARCH_URL: search_page([item("gone"), item("here")]), "https://www.storia.ro/ro/oferta/here": ad_page(44.43, 26.10)}
    source, _ = leases(pages)
    assert [l.source_url.rsplit("/", 1)[1] for l in source.search(CENTRE, 20, SiteKind.LEASE)] == ["here"]


def test_a_pin_far_from_every_city_searches_nothing():
    source, fetcher = leases({})
    assert source.search(Point(45.17, 28.79), 25, SiteKind.LEASE) == []
    assert fetcher.asked == []


def test_a_search_page_whose_layout_changed_makes_the_source_unavailable():
    source, _ = leases({SEARCH_URL: "<html>no data here</html>"})
    with pytest.raises(ListingSourceUnavailable, match="layout"):
        source.search(CENTRE, 20, SiteKind.LEASE)
