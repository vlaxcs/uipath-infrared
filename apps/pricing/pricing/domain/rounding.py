import math

SIGNIFICANT_DIGITS = 6


def significant(value: float, digits: int = SIGNIFICANT_DIGITS) -> float:
    if value == 0:
        return 0.0
    return round(value, digits - 1 - math.floor(math.log10(abs(value))))
