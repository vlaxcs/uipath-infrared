class EventsApi:
    def __init__(self, client):
        self.client = client

    def rules(self):
        return self.client.list_rules()["Rules"]

    def targets(self, rule):
        return self.client.list_targets_by_rule(Rule=rule)["Targets"]
