class Route53Api:
    def __init__(self, client):
        self.client = client

    def hosted_zones(self):
        return self.client.list_hosted_zones()["HostedZones"]

    def records(self, zone_id):
        return self.client.list_resource_record_sets(HostedZoneId=zone_id)["ResourceRecordSets"]
