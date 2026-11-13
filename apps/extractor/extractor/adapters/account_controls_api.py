class AccountControlsApi:
    def __init__(self, clients):
        self.clients = clients

    def trails(self):
        return self.clients.client("cloudtrail").describe_trails()["trailList"]

    def threat_detectors(self):
        return self.clients.client("guardduty").list_detectors()["DetectorIds"]

    def configuration_recorders(self):
        return self.clients.client("config").describe_configuration_recorders()["ConfigurationRecorders"]

    def backup_plans(self):
        return self.clients.client("backup").list_backup_plans()["BackupPlansList"]
