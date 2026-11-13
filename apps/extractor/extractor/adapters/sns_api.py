class SnsApi:
    def __init__(self, client):
        self.client = client

    def topic_arns(self):
        return [t["TopicArn"] for t in self.client.list_topics()["Topics"]]

    def subscriptions(self, topic_arn):
        return self.client.list_subscriptions_by_topic(TopicArn=topic_arn)["Subscriptions"]
