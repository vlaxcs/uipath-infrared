class S3Api:
    def __init__(self, client):
        self.client = client

    def bucket_names(self):
        return [b["Name"] for b in self.client.list_buckets()["Buckets"]]

    def policy(self, bucket):
        try:
            return self.client.get_bucket_policy(Bucket=bucket)["Policy"]
        except Exception as error:
            if "NoSuchBucketPolicy" in str(error):
                return None
            raise

    def encryption_configured(self, bucket):
        try:
            return bool(self.client.get_bucket_encryption(Bucket=bucket)["ServerSideEncryptionConfiguration"])
        except Exception as error:
            if "ServerSideEncryptionConfigurationNotFound" in str(error):
                return False
            raise

    def versioning_enabled(self, bucket):
        return self.client.get_bucket_versioning(Bucket=bucket).get("Status") == "Enabled"

    def lifecycle_rules_present(self, bucket):
        try:
            return bool(self.client.get_bucket_lifecycle_configuration(Bucket=bucket)["Rules"])
        except Exception as error:
            if "NoSuchLifecycleConfiguration" in str(error):
                return False
            raise

    def notifications(self, bucket):
        return self.client.get_bucket_notification_configuration(Bucket=bucket)
