class DynamodbApi:
    def __init__(self, client):
        self.client = client

    def table_names(self):
        return self.client.list_tables()["TableNames"]

    def table(self, name):
        return self.client.describe_table(TableName=name)["Table"]

    def point_in_time_recovery(self, name):
        backups = self.client.describe_continuous_backups(TableName=name)["ContinuousBackupsDescription"]
        return backups["PointInTimeRecoveryDescription"]["PointInTimeRecoveryStatus"] == "ENABLED"

    def time_to_live(self, name):
        return self.client.describe_time_to_live(TableName=name)["TimeToLiveDescription"]["TimeToLiveStatus"] in ("ENABLED", "ENABLING")
