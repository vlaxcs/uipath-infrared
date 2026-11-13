from extractor.domain.metric_query import MetricQuery
from extractor.domain.series_summary import summarize


class SeriesReader:
    def __init__(self, cloudwatch, warnings, start, end, window_days, provenance):
        self.cloudwatch, self.warnings = cloudwatch, warnings
        self.start, self.end, self.window_days, self.provenance = start, end, window_days, provenance

    def read(self, namespace, name, dimensions, unit, stat="Average", scale=1.0):
        query = MetricQuery(namespace, name, dimensions, unit, stat, scale)
        datapoints = self.warnings.guard(query.label, lambda: self.cloudwatch.datapoints(query, self.start, self.end), [])
        return summarize(query, datapoints, self.window_days, self.provenance)
