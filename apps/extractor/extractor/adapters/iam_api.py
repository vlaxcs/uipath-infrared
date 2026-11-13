class IamApi:
    def __init__(self, client):
        self.client = client

    def attached_policies(self, role):
        return self.client.list_attached_role_policies(RoleName=role)["AttachedPolicies"]

    def inline_policy_names(self, role):
        return self.client.list_role_policies(RoleName=role)["PolicyNames"]

    def inline_policy(self, role, name):
        return self.client.get_role_policy(RoleName=role, PolicyName=name)["PolicyDocument"]

    def user_names(self):
        return [u["UserName"] for u in self.client.list_users()["Users"]]

    def mfa_devices(self, user):
        return self.client.list_mfa_devices(UserName=user)["MFADevices"]
