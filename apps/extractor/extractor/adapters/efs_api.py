class EfsApi:
    def __init__(self, client):
        self.client = client

    def file_systems(self):
        return self.client.describe_file_systems()["FileSystems"]
