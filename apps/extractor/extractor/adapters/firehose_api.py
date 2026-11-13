class FirehoseApi:
    def __init__(self, client):
        self.client = client

    def stream_names(self):
        return self.client.list_delivery_streams()["DeliveryStreamNames"]

    def description(self, name):
        return self.client.describe_delivery_stream(DeliveryStreamName=name)["DeliveryStreamDescription"]
