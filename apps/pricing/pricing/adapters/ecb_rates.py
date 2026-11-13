import re
from datetime import date

from pricing.adapters.fetcher import Fetcher
from pricing.domain.errors import PricingError
from pricing.domain.fx import FxRate

SOURCE = "ecb-fx"
ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
RATE_DATE = re.compile(r"time=['\"](\d{4}-\d{2}-\d{2})['\"]")
USD_RATE = re.compile(r"currency=['\"]USD['\"]\s+rate=['\"]([0-9]+(?:\.[0-9]+)?)['\"]")


def read_usd_rate(fetcher: Fetcher, fetched_on: date) -> FxRate:
    xml = fetcher.text(ECB_URL)
    day, rate = RATE_DATE.search(xml), USD_RATE.search(xml)
    if not day or not rate:
        raise PricingError("the ECB reference rates have no USD rate")
    return FxRate(SOURCE, ECB_URL, date.fromisoformat(day.group(1)), fetched_on, float(rate.group(1)))
