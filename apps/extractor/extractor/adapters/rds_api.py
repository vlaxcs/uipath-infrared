class RdsApi:
    def __init__(self, client):
        self.client = client

    def instances(self):
        return self.client.describe_db_instances()["DBInstances"]

    def clusters(self):
        return self.client.describe_db_clusters()["DBClusters"]
