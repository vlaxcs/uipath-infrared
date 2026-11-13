import statistics

RESOLUTION_SECONDS = 3600


def nearest_rank(sorted_values, quantile):
    return sorted_values[min(len(sorted_values) - 1, int(quantile * (len(sorted_values) - 1) + 0.5))]


def summarize(query, datapoints, window_days, provenance):
    values = sorted(point[query.stat] * query.scale for point in datapoints)
    if not values:
        return None
    if query.stat == "Average":
        maximum = max(point["Maximum"] * query.scale for point in datapoints)
    else:
        maximum = values[-1]
    summary = {"unit": query.unit, "window_days": window_days, "resolution_seconds": RESOLUTION_SECONDS,
               "provenance": provenance, "avg": round(statistics.fmean(values), 4), "min": round(values[0], 4),
               "p50": round(nearest_rank(values, .5), 4), "p95": round(nearest_rank(values, .95), 4),
               "max": round(maximum, 4), "basis": query.basis}
    if query.stat == "Sum":
        summary["sum"] = round(sum(values), 2)
    return summary


def present(**series):
    return {name: summary for name, summary in series.items() if summary}
