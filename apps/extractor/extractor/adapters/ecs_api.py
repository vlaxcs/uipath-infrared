DESCRIBE_SERVICES_LIMIT = 10


class EcsApi:
    def __init__(self, client):
        self.client = client

    def cluster_names(self):
        return [arn.split("/")[-1] for arn in self.client.list_clusters()["clusterArns"]]

    def clusters_with_settings(self, names):
        if not names:
            return {}
        described = self.client.describe_clusters(clusters=names, include=["SETTINGS"])["clusters"]
        return {c["clusterName"]: c for c in described}

    def services(self, cluster):
        arns = self.client.list_services(cluster=cluster)["serviceArns"]
        described = {}
        for start in range(0, len(arns), DESCRIBE_SERVICES_LIMIT):
            batch = arns[start:start + DESCRIBE_SERVICES_LIMIT]
            for service in self.client.describe_services(cluster=cluster, services=batch)["services"]:
                described[service["serviceArn"]] = service
        return [described[arn] for arn in arns]

    def task_definition(self, arn):
        return self.client.describe_task_definition(taskDefinition=arn)["taskDefinition"]
