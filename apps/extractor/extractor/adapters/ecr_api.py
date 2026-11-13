class EcrApi:
    def __init__(self, client):
        self.client = client

    def repositories(self):
        return self.client.describe_repositories()["repositories"]
