class SqsApi:
    def __init__(self, client):
        self.client = client

    def queue_urls(self):
        return self.client.list_queues().get("QueueUrls", [])

    def attributes(self, url):
        return self.client.get_queue_attributes(QueueUrl=url, AttributeNames=["All"])["Attributes"]
