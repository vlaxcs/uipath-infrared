"""Live terminal view of one CloudWatch namespace.

Usage: python -m synth.watch AWS/RDS [--minutes 30] [--every 10] [--once]
Shows, per series, the latest 1-minute value, a sparkline of the window and min/max.
"""
import argparse
import os
import time
from datetime import datetime, timedelta, timezone

from .common import client

cw = client("cloudwatch")
BARS = "▁▂▃▄▅▆▇█"


def spark(vals):
    if not vals:
        return ""
    lo, hi = min(vals), max(vals)
    return "".join(BARS[0 if hi == lo else int((v - lo) / (hi - lo) * (len(BARS) - 1))] for v in vals)


def fmt(v):
    for unit, d in (("T", 1e12), ("G", 1e9), ("M", 1e6), ("k", 1e3)):
        if abs(v) >= d:
            return f"{v / d:.1f}{unit}"
    return f"{v:.2f}"


def series(ns):
    out, token = [], None
    while True:
        r = cw.list_metrics(Namespace=ns, **({"NextToken": token} if token else {}))
        out += r["Metrics"]
        token = r.get("NextToken")
        if not token:
            return out


def snapshot(ns, minutes):
    now = datetime.now(timezone.utc)
    rows = []
    for m in series(ns):
        pts = cw.get_metric_statistics(Namespace=ns, MetricName=m["MetricName"], Dimensions=m["Dimensions"],
                                       StartTime=now - timedelta(minutes=minutes), EndTime=now + timedelta(minutes=1),
                                       Period=60, Statistics=["Average"])["Datapoints"]
        vals = [p["Average"] for p in sorted(pts, key=lambda p: p["Timestamp"])]
        dims = ",".join(d["Value"] for d in m["Dimensions"])
        rows.append((m["MetricName"], dims, vals))
    return sorted(rows)


def render(ns, minutes):
    rows = snapshot(ns, minutes)
    print(f"{ns}  last {minutes}m  {datetime.now().strftime('%H:%M:%S')}  ({len(rows)} series)\n")
    print(f"{'metric':36} {'resource':34} {'now':>9}  {'min':>8} {'max':>8}  trend")
    for name, dims, v in rows:
        if v:
            print(f"{name[:36]:36} {dims[:34]:34} {fmt(v[-1]):>9}  {fmt(min(v)):>8} {fmt(max(v)):>8}  {spark(v[-40:])}")
        else:
            print(f"{name[:36]:36} {dims[:34]:34} {'-':>9}")


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("namespace")
    a.add_argument("--minutes", type=int, default=30)
    a.add_argument("--every", type=int, default=10)
    a.add_argument("--once", action="store_true")
    a = a.parse_args()
    while True:
        if not a.once:
            os.system("clear")
        render(a.namespace, a.minutes)
        if a.once:
            break
        time.sleep(a.every)
