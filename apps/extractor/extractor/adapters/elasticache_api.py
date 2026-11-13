class ElasticacheApi:
    def __init__(self, client):
        self.client = client

    def clusters(self):
        return self.client.describe_cache_clusters()["CacheClusters"]
