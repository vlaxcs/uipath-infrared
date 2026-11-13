class ElbApi:
    def __init__(self, client):
        self.client = client

    def load_balancers(self):
        return self.client.describe_load_balancers()["LoadBalancers"]

    def attributes(self, arn):
        return self.client.describe_load_balancer_attributes(LoadBalancerArn=arn)["Attributes"]

    def target_groups_by_balancer(self):
        grouped = {}
        for group in self.client.describe_target_groups()["TargetGroups"]:
            for balancer_arn in group.get("LoadBalancerArns", []):
                grouped.setdefault(balancer_arn, []).append(group)
        return grouped

    def listeners(self, arn):
        return self.client.describe_listeners(LoadBalancerArn=arn)["Listeners"]

    def target_group_attributes(self, arn):
        return self.client.describe_target_group_attributes(TargetGroupArn=arn)["Attributes"]

    def registered_target_count(self, arn):
        return len(self.client.describe_target_health(TargetGroupArn=arn)["TargetHealthDescriptions"])
