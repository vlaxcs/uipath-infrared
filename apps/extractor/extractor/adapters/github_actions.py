import json
import urllib.parse
import urllib.request

API = "https://api.github.com"
PAGE_SIZE = 100
MAX_RUN_PAGES = 5
TIMEOUT_SECONDS = 20


class GithubActions:
    def __init__(self, token, repository):
        self.token, self.repository = token, repository

    def get(self, path, query):
        url = f"{API}/repos/{self.repository}/{path}?{urllib.parse.urlencode(query)}"
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {self.token}",
                                                       "Accept": "application/vnd.github+json",
                                                       "X-GitHub-Api-Version": "2022-11-28"})
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.load(response)

    def runs_since(self, since):
        runs = []
        for page in range(1, MAX_RUN_PAGES + 1):
            batch = self.get("actions/runs", {"created": f">={since}", "per_page": PAGE_SIZE, "page": page})["workflow_runs"]
            runs.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
        return runs

    def jobs(self, run_id):
        return self.get(f"actions/runs/{run_id}/jobs", {"per_page": PAGE_SIZE, "filter": "all"})["jobs"]
