class LambdaApi:
    def __init__(self, client):
        self.client = client

    def functions(self):
        return self.client.list_functions()["Functions"]

    def event_source_mappings(self):
        return self.client.list_event_source_mappings()["EventSourceMappings"]
