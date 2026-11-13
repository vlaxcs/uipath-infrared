from extractor.domain.metric_query import MetricQuery
from extractor.domain.series_summary import nearest_rank, summarize


def query(stat="Average", scale=1.0):
    return MetricQuery("AWS/EC2", "CPUUtilization", {"InstanceId": "i-1"}, "percent", stat, scale)


def points(values, stat="Average"):
    return [{stat: v, "Maximum": v + 10} for v in values]


def test_p95_of_hundred_hourly_points_is_the_95th_ranked_value():
    summary = summarize(query(), points(range(1, 101)), 14, "synthetic")
    assert summary["p95"] == 95
    assert summary["p50"] == 51
    assert summary["min"] == 1


def test_p95_is_independent_of_datapoint_order():
    shuffled = [7, 3, 9, 1, 5, 10, 2, 8, 4, 6]
    assert summarize(query(), points(shuffled), 14, "synthetic")["p95"] == 10


def test_nearest_rank_on_single_value():
    assert nearest_rank([42], 0.95) == 42


def test_average_series_takes_max_from_the_maximum_statistic():
    summary = summarize(query(), points([1, 2, 3]), 14, "observed")
    assert summary["max"] == 13
    assert summary["avg"] == 2
    assert "sum" not in summary


def test_sum_series_is_scaled_and_totalled():
    summary = summarize(query("Sum", 1 / 3600), points([3600, 7200], "Sum"), 14, "synthetic")
    assert summary["avg"] == 1.5
    assert summary["max"] == 2
    assert summary["sum"] == 3


def test_summary_carries_window_and_provenance():
    summary = summarize(query(), points([1]), 7, "synthetic")
    assert (summary["window_days"], summary["resolution_seconds"], summary["provenance"]) == (7, 3600, "synthetic")
    assert summary["basis"] == "CloudWatch AWS/EC2 CPUUtilization, Average, period 3600"


def test_no_datapoints_gives_no_series():
    assert summarize(query(), [], 14, "synthetic") is None
