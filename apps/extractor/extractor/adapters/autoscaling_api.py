class AutoscalingApi:
    def __init__(self, client):
        self.client = client

    def groups(self):
        return self.client.describe_auto_scaling_groups()["AutoScalingGroups"]

    def policies_by_group(self):
        grouped = {}
        for policy in self.client.describe_policies()["ScalingPolicies"]:
            grouped.setdefault(policy["AutoScalingGroupName"], []).append(policy)
        return grouped
