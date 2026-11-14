import os
from datetime import datetime, timedelta, timezone

import psycopg
import pytest

from agent.adapters.site_store import PostgresSiteStore
from agent.application.ports import SiteStoreUnavailable
from agent.application.site_options import site_options
from agent.domain.sites import Listing, Point, SiteKind

ADMIN_URL = os.environ.get("SITES_TEST_ADMIN_URL", "")
SITE_STEP_URL = os.environ.get("SITES_TEST_DATABASE_URL", "")

pytestmark = pytest.mark.skipif(
    not (ADMIN_URL and SITE_STEP_URL),
    reason="SITES_TEST_ADMIN_URL and SITES_TEST_DATABASE_URL point at a PostGIS with the site migrations",
)

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)
CENTER = Point(44.4268, 26.1025)
KM_PER_DEGREE_LAT = 111.2


def north_of(center: Point, km: float) -> Point:
    return Point(center.lat + km / KM_PER_DEGREE_LAT, center.lng)


def lease(url: str, km: float, read_at: datetime = NOW, rent: float = 2000.0, area: float = 150.0) -> Listing:
    return Listing(SiteKind.LEASE, f"lease {url}", north_of(CENTER, km), area, None, rent, "RON", rent * 5, url, read_at)


def colocation(url: str, km: float, read_at: datetime = NOW) -> Listing:
    return Listing(SiteKind.COLOCATION, f"colo {url}", north_of(CENTER, km), None, 4, 3200.0, "EUR", 3200.0, url, read_at)


def admin(sql: str) -> list[tuple]:
    with psycopg.connect(ADMIN_URL) as connection:
        cursor = connection.execute(sql)
        return cursor.fetchall() if cursor.description else []


@pytest.fixture(autouse=True)
def empty_store():
    admin("truncate site_options restart identity")


@pytest.fixture
def store():
    return PostgresSiteStore(SITE_STEP_URL)


def urls(found, kind):
    return [o.listing.source_url for o in found[kind]]


def fresh_since():
    return NOW - timedelta(days=7)


def test_only_options_inside_the_radius_come_back_nearest_first(store):
    store.save([lease("far", 11.5), lease("near", 2), lease("edge", 9.5), lease("mid", 5)])
    found = store.nearby(CENTER, 10, [SiteKind.LEASE], fresh_since())
    assert urls(found, SiteKind.LEASE) == ["near", "mid", "edge"]
    assert [round(o.distance_km, 1) for o in found[SiteKind.LEASE]] == [2.0, 5.0, 9.5]


def test_an_option_read_more_than_seven_days_ago_is_ignored(store):
    store.save([lease("fresh", 1, NOW - timedelta(days=6)), lease("stale", 1, NOW - timedelta(days=8))])
    assert urls(store.nearby(CENTER, 10, [SiteKind.LEASE], fresh_since()), SiteKind.LEASE) == ["fresh"]


def test_an_option_marked_gone_is_ignored(store):
    store.save([lease("gone", 1), lease("here", 2)])
    admin("update site_options set gone_at = now() where source_url = 'gone'")
    assert urls(store.nearby(CENTER, 10, [SiteKind.LEASE], fresh_since()), SiteKind.LEASE) == ["here"]


def test_each_kind_comes_back_on_its_own_capped_at_twenty(store):
    store.save([lease(f"l{i}", 0.1 * i) for i in range(25)] + [colocation("c1", 3)])
    found = store.nearby(CENTER, 10, [SiteKind.LEASE, SiteKind.COLOCATION], fresh_since())
    assert urls(found, SiteKind.LEASE) == [f"l{i}" for i in range(20)]
    assert urls(found, SiteKind.COLOCATION) == ["c1"]


def test_a_listing_seen_again_stays_one_row_with_the_newer_price(store):
    store.save([lease("same", 1, NOW - timedelta(days=2), rent=2000)])
    store.save([lease("same", 1, NOW, rent=2400)])
    store.save([lease("same", 1, NOW - timedelta(days=1), rent=1800)])
    [option] = store.nearby(CENTER, 10, [SiteKind.LEASE], fresh_since())[SiteKind.LEASE]
    assert (option.listing.rent_eur_month, option.listing.read_at) == (2400, NOW)
    assert admin("select count(*) from site_options") == [(1,)]


def test_a_listing_twice_in_one_batch_keeps_the_latest(store):
    store.save([lease("dup", 1, NOW - timedelta(days=1), rent=1000), lease("dup", 1, NOW, rent=1100)])
    [option] = store.nearby(CENTER, 10, [SiteKind.LEASE], fresh_since())[SiteKind.LEASE]
    assert option.listing.rent_eur_month == 1100


def test_a_listing_seen_again_comes_back_after_it_was_gone(store):
    store.save([lease("back", 1, NOW - timedelta(days=1))])
    admin("update site_options set gone_at = now()")
    store.save([lease("back", 1, NOW)])
    assert urls(store.nearby(CENTER, 10, [SiteKind.LEASE], fresh_since()), SiteKind.LEASE) == ["back"]


def test_the_site_role_reaches_no_other_table_and_deletes_nothing():
    admin("create table if not exists not_for_the_site_step (id int)")
    with psycopg.connect(SITE_STEP_URL) as connection:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            connection.execute("select * from not_for_the_site_step")
    with psycopg.connect(SITE_STEP_URL) as connection:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            connection.execute("delete from site_options")


def test_enough_fresh_options_skip_the_search(store):
    store.save([lease(f"l{i}", i) for i in range(5)] + [colocation(f"c{i}", i) for i in range(5)])
    source = RecordingSource({})
    found = site_options(store, source, CENTER, 10, NOW)
    assert source.searched == []
    assert (len(found[SiteKind.LEASE]), len(found[SiteKind.COLOCATION])) == (5, 5)


def test_only_the_kind_short_of_fresh_options_is_searched_and_saved(store):
    store.save([lease(f"l{i}", i) for i in range(5)] + [colocation(f"old{i}", i, NOW - timedelta(days=9)) for i in range(5)])
    source = RecordingSource({SiteKind.COLOCATION: [colocation("new", 4)]})
    found = site_options(store, source, CENTER, 10, NOW)
    assert source.searched == [SiteKind.COLOCATION]
    assert urls(found, SiteKind.COLOCATION) == ["new"]
    assert len(found[SiteKind.LEASE]) == 5


def test_an_unreachable_store_stops_with_the_reason():
    unreachable = PostgresSiteStore("postgresql://nobody:nothing@127.0.0.1:1/sites")
    with pytest.raises(SiteStoreUnavailable, match="unreachable"):
        unreachable.nearby(CENTER, 10, [SiteKind.LEASE], fresh_since())


class RecordingSource:
    def __init__(self, results):
        self.results = results
        self.searched = []

    def search(self, center, radius_km, kind):
        self.searched.append(kind)
        return list(self.results.get(kind, []))
