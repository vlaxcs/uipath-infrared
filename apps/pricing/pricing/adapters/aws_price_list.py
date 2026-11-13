import csv
import itertools
from datetime import date
from typing import Mapping

from pricing.adapters.fetcher import Fetcher
from pricing.domain.errors import PricingError
from pricing.domain.price import Price
from pricing.domain.selection import select_one_each
from pricing.domain.selector import Selector
from pricing.domain.snapshot import Snapshot

BASE_URL = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws"
METADATA_LINES = 5
ON_DEMAND = "OnDemand"


def source_id(offer: str) -> str:
    return f"aws-{offer}"


def offer_url(offer: str, region: str, version: str = "current") -> str:
    return f"{BASE_URL}/{offer}/{version}/{region}/index.csv"


def read_offer(
    fetcher: Fetcher, offer: str, region: str, wanted: Mapping[str, Selector], fetched_on: date,
) -> Snapshot:
    lines = iter(fetcher.lines(offer_url(offer, region)))
    metadata = {row[0]: row[1] for row in csv.reader(itertools.islice(lines, METADATA_LINES)) if len(row) >= 2}
    version = metadata.get("Version")
    if not version or metadata.get("OfferCode") != offer:
        raise PricingError(f"{offer}: not an AWS price list (metadata {sorted(metadata)})")
    rows = (row for row in csv.DictReader(lines) if row.get("TermType") == ON_DEMAND)
    selected = select_one_each(rows, wanted)
    prices = {
        key: Price(float(row["PricePerUnit"]), row["Currency"], row["Unit"], row["SKU"], row["PriceDescription"])
        for key, row in selected.items()
    }
    return Snapshot(source_id(offer), offer_url(offer, region, version), version, fetched_on, prices)
