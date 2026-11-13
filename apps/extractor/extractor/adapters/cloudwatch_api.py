PERIOD_SECONDS = 3600


class CloudwatchApi:
    def __init__(self, client):
        self.client = client

    def datapoints(self, query, start, end):
        return self.client.get_metric_statistics(
            Namespace=query.namespace, MetricName=query.name,
            Dimensions=[{"Name": k, "Value": v} for k, v in query.dimensions.items()],
            StartTime=start, EndTime=end, Period=PERIOD_SECONDS, Statistics=[query.stat, "Maximum"])["Datapoints"]
