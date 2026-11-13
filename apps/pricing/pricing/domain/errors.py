class PricingError(Exception):
    pass


class SelectionError(PricingError):
    pass


class BuildError(PricingError):
    pass
