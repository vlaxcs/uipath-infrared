from collections import defaultdict
from datetime import datetime, timedelta, timezone

from startup.metrics import WINDOW_HOURS, cw

BATCH = 10


def datapoints_by_namespace(series, now):
    hours = [now - timedelta(hours=h) for h in range(1, WINDOW_HOURS)]
    grouped = defaultdict(list)
    for namespace, name, dims, unit, value in series:
        dimensions = [{"Name": k, "Value": v} for k, v in dims.items()]
        grouped[namespace].extend({"MetricName": name, "Dimensions": dimensions, "Timestamp": ts,
                                   "Value": value(ts), "Unit": unit} for ts in hours)
    return grouped


def push_metrics(series):
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    sent = 0
    for namespace, points in datapoints_by_namespace(series, now).items():
        for start in range(0, len(points), BATCH):
            cw.put_metric_data(Namespace=namespace, MetricData=points[start:start + BATCH])
        sent += len(points)
        print(f"  {namespace}: {len(points)} datapoints")
    print(f"Pushed {sent} datapoints over {WINDOW_HOURS // 24} days.")
