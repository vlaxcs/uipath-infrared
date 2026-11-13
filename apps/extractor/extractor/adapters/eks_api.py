class EksApi:
    def __init__(self, client):
        self.client = client

    def cluster_names(self):
        return self.client.list_clusters()["clusters"]

    def cluster(self, name):
        return self.client.describe_cluster(name=name)["cluster"]

    def nodegroups(self, cluster):
        return [self.client.describe_nodegroup(clusterName=cluster, nodegroupName=n)["nodegroup"]
                for n in self.client.list_nodegroups(clusterName=cluster)["nodegroups"]]
