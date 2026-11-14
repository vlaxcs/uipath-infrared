from datetime import datetime, timezone

import pytest

from agent.domain.listing_search import Offer, distance_km, lease_listing, nearest_city, storia_radius_km
from agent.domain.sites import Point, SiteKind

NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)
BUCHAREST = Point(44.4268, 26.1025)


def offer(currency="EUR", rent=1000.0):
    return Offer("https://www.storia.ro/ro/oferta/x", "Spatiu 56 mp", rent, currency, 56)


def test_the_distance_between_bucharest_and_cluj_is_about_325_km():
    assert distance_km(BUCHAREST, Point(46.7712, 23.6236)) == pytest.approx(325, abs=5)


def test_a_pin_in_bucharest_searches_bucharest():
    assert nearest_city(Point(44.45, 26.08)).slug == "bucuresti"


def test_a_pin_in_cluj_searches_cluj():
    assert nearest_city(Point(46.77, 23.60)).slug == "cluj/cluj--napoca"


@pytest.mark.parametrize("pin", [Point(44.94, 26.02), Point(45.17, 28.79)], ids=["ploiesti", "tulcea"])
def test_a_pin_farther_than_50_km_from_every_city_searches_nowhere(pin):
    assert nearest_city(pin) is None


@pytest.mark.parametrize("needed, radius", [(3, 5), (20, 25), (25, 25), (26, 50), (90, 75)])
def test_storia_gets_the_smallest_radius_it_offers_that_covers_the_search(needed, radius):
    assert storia_radius_km(needed) == radius


def test_a_eur_rent_is_kept_as_it_is():
    listing = lease_listing(offer(), BUCHAREST, {"EUR": 1.0}, NOW)
    assert listing.kind == SiteKind.LEASE
    assert (listing.rent_eur_month, listing.currency, listing.rent_original, listing.area_m2) == (1000, "EUR", 1000, 56)


def test_a_usd_rent_is_converted_at_the_rate_given():
    listing = lease_listing(offer("USD", 1105.2), BUCHAREST, {"EUR": 1.0, "USD": 1 / 1.1052}, NOW)
    assert listing.rent_eur_month == pytest.approx(1000)
    assert (listing.currency, listing.rent_original) == ("USD", 1105.2)


def test_a_rent_in_a_currency_without_a_rate_is_dropped_never_guessed():
    assert lease_listing(offer("RON", 5000), BUCHAREST, {"EUR": 1.0}, NOW) is None
