def point_metric(value, unit, provenance="observed", basis=None):
    metric = {"value": value, "unit": unit, "provenance": provenance}
    if basis:
        metric["basis"] = basis
    return metric
