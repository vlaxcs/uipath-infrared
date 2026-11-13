class KinesisApi:
    def __init__(self, client):
        self.client = client

    def stream_names(self):
        return self.client.list_streams()["StreamNames"]

    def summary(self, name):
        return self.client.describe_stream_summary(StreamName=name)["StreamDescriptionSummary"]
