class Ec2Api:
    def __init__(self, client):
        self.client = client

    def vpcs(self):
        return self.client.describe_vpcs()["Vpcs"]

    def subnets(self):
        return self.client.describe_subnets()["Subnets"]

    def security_groups(self):
        return self.client.describe_security_groups()["SecurityGroups"]

    def instances(self):
        return [i for r in self.client.describe_instances()["Reservations"] for i in r["Instances"]]

    def volumes(self):
        return self.client.describe_volumes()["Volumes"]

    def nat_gateways(self):
        return self.client.describe_nat_gateways()["NatGateways"]

    def addresses(self):
        return self.client.describe_addresses()["Addresses"]

    def flow_logs(self):
        return self.client.describe_flow_logs()["FlowLogs"]
