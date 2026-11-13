from extractor.domain.instance_specs import HOURS_PER_MONTH, INSTANCE_SPECS, USD_TO_EUR
from extractor.domain.point_metric import point_metric


def monthly_cost(total_usd_month, basis):
    if total_usd_month is None:
        return None
    return {"monthly_eur": point_metric(round(total_usd_month * USD_TO_EUR), "EUR/month", "estimated",
                                        f"{basis} x {USD_TO_EUR} EUR/USD; approximate list price, no discounts")}


def instance_hours_cost(sku, quantity, extra_usd=0.0):
    if sku not in INSTANCE_SPECS:
        return None
    price = INSTANCE_SPECS[sku][3]
    return monthly_cost(price * HOURS_PER_MONTH * quantity + extra_usd,
                        f"{price} USD/h x {HOURS_PER_MONTH} h x {quantity} unit(s)")
