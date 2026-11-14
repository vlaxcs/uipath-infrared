class TaggingApi:
    def __init__(self, client):
        self.client = client

    def resources(self):
        found, token = [], None
        while True:
            page = self.client.get_resources(ResourcesPerPage=100, **({"PaginationToken": token} if token else {}))
            found.extend(page.get("ResourceTagMappingList", []))
            token = page.get("PaginationToken")
            if not token:
                return found
