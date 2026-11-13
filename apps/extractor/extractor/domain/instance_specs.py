HOURS_PER_MONTH = 730
USD_TO_EUR = 0.92
SPEC_BASIS = "published instance specs table inside the extractor (the API only returns the type name)"

INSTANCE_SPECS = {
    "m5.large": (2, 8, 0, 0.096), "m5.4xlarge": (16, 64, 0, 0.768), "m5.8xlarge": (32, 128, 0, 1.536),
    "m5.24xlarge": (96, 384, 0, 4.608), "c5.9xlarge": (36, 72, 0, 1.53), "c5.12xlarge": (48, 96, 0, 2.04),
    "r5.2xlarge": (8, 64, 0, 0.504), "r5.16xlarge": (64, 512, 0, 4.032), "m4.2xlarge": (8, 32, 0, 0.40),
    "p3.8xlarge": (32, 244, 4, 12.24),
    "db.r5.8xlarge": (32, 256, 0, 4.80), "db.r5.4xlarge": (16, 128, 0, 2.40), "db.m4.4xlarge": (16, 64, 0, 1.61),
    "db.r4.4xlarge": (16, 122, 0, 2.30),
    "cache.r5.4xlarge": (16, 104.7, 0, 2.0), "cache.m4.2xlarge": (8, 35.2, 0, 0.78),
}


def hourly_price_usd(sku):
    return INSTANCE_SPECS[sku][3]
